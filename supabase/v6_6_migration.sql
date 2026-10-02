-- SCHATZSUCHE ONLINE V6.6
-- Inaktivitäts-Schließung, Löschung alter Spiele, Restgold-Verteilung und Profile
-- Nach V6.5.3a EINMAL im Supabase SQL Editor ausführen.

-- =========================================================
-- 1) SPIELLEBENSZYKLUS
-- =========================================================

alter table public.games
  add column if not exists last_activity_at timestamptz not null default now();

alter table public.games
  add column if not exists closed_at timestamptz;

alter table public.games
  add column if not exists close_reason text;

-- Bestehende Spiele: letzte echte Feld-Aufdeckung als Aktivität übernehmen.
update public.games g
set last_activity_at = coalesce(
  (select max(e.discovered_at) from public.explored_fields e where e.game_id=g.id),
  g.created_at,
  now()
);

-- Bereits beendete Spiele bekommen ab Migration einen Lösch-Zeitpunkt.
update public.games
set closed_at=coalesce(closed_at,now()),
    close_reason=coalesce(close_reason,'completed')
where status<>'active';

alter table public.gold_treasures
  add column if not exists forfeited_at timestamptz;

-- Serverweit einstellbare Regeln.
alter table public.platform_settings
  add column if not exists game_inactivity_hours int not null default 24;

alter table public.platform_settings
  add column if not exists closed_game_retention_hours int not null default 72;

alter table public.platform_settings
  add column if not exists inactive_community_share_bps int not null default 5000;

alter table public.platform_settings
  add column if not exists inactive_platform_share_bps int not null default 5000;

do $$
begin
  if not exists(
    select 1 from pg_constraint
    where conname='platform_settings_inactive_split_check'
  ) then
    alter table public.platform_settings
      add constraint platform_settings_inactive_split_check
      check(inactive_community_share_bps + inactive_platform_share_bps = 10000);
  end if;

  if not exists(
    select 1 from pg_constraint
    where conname='platform_settings_inactivity_hours_check'
  ) then
    alter table public.platform_settings
      add constraint platform_settings_inactivity_hours_check
      check(game_inactivity_hours between 1 and 720);
  end if;

  if not exists(
    select 1 from pg_constraint
    where conname='platform_settings_retention_hours_check'
  ) then
    alter table public.platform_settings
      add constraint platform_settings_retention_hours_check
      check(closed_game_retention_hours between 1 and 8760);
  end if;
end $$;

-- Wartung:
-- * aktive Spiele ohne Zug seit X Stunden schließen
-- * offenen Test-Gold-Schatz verteilen
-- * geschlossene/beendete Spiele nach Y Stunden vollständig löschen
create or replace function public.run_game_maintenance_v66()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  s public.platform_settings%rowtype;
  g public.games%rowtype;
  remaining_gold bigint;
  community_gold bigint;
  platform_gold bigint;
  closed_count int:=0;
  deleted_count int:=0;
begin
  select * into s
  from public.platform_settings
  where id=1;

  for g in
    select *
    from public.games
    where status='active'
      and last_activity_at <= now() - make_interval(hours=>s.game_inactivity_hours)
    for update skip locked
  loop
    if g.game_type='pay' then
      select coalesce(sum(amount_ug),0)::bigint
      into remaining_gold
      from public.gold_treasures
      where game_id=g.id
        and found_by is null
        and forfeited_at is null;

      if remaining_gold>0 then
        community_gold:=floor(
          remaining_gold::numeric * s.inactive_community_share_bps / 10000
        )::bigint;
        platform_gold:=remaining_gold-community_gold;

        -- Offene Schätze werden endgültig eingezogen.
        update public.gold_treasures
        set amount_ug=0,
            forfeited_at=now()
        where game_id=g.id
          and found_by is null
          and forfeited_at is null;

        update public.games
        set gold_prize_pool_ug=0
        where id=g.id;

        if community_gold>0 then
          perform public.distribute_community_gold_v65(community_gold,g.id);
        end if;

        if platform_gold>0 then
          update public.platform_settings
          set platform_revenue_ug=platform_revenue_ug+platform_gold,
              updated_at=now()
          where id=1;

          insert into public.gold_transactions(
            user_id,game_id,amount_ug,transaction_type,note
          )
          values(
            null,g.id,platform_gold,'inactive_game_platform',
            'Restschatz aus automatisch geschlossenem Paygame'
          );
        end if;
      end if;
    end if;

    update public.games
    set status='closed',
        closed_at=now(),
        close_reason='inactive'
    where id=g.id;

    closed_count:=closed_count+1;
  end loop;

  -- Historische Spieldaten werden nach der Retentionszeit gelöscht.
  with doomed as (
    select id
    from public.games
    where status<>'active'
      and closed_at is not null
      and closed_at <= now() - make_interval(hours=>s.closed_game_retention_hours)
  ),
  deleted as (
    delete from public.games
    where id in (select id from doomed)
    returning id
  )
  select count(*) into deleted_count from deleted;

  return jsonb_build_object(
    'closed_games',closed_count,
    'deleted_games',deleted_count
  );
end;
$$;

revoke all on function public.run_game_maintenance_v66() from public;
grant execute on function public.run_game_maintenance_v66() to authenticated;

-- V6.5-Aufdeckung verwenden und danach exakt diese Partie als aktiv markieren.
create or replace function public.reveal_area_v66(
  p_game_id uuid,
  p_x int,
  p_y int
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  result jsonb;
begin
  result:=public.reveal_area_v65(p_game_id,p_x,p_y);

  update public.games
  set last_activity_at=now(),
      closed_at=case
        when status<>'active' and closed_at is null then now()
        else closed_at
      end,
      close_reason=case
        when status<>'active' and close_reason is null then 'completed'
        else close_reason
      end
  where id=p_game_id;

  return result;
end;
$$;

revoke all on function public.reveal_area_v66(uuid,int,int) from public;
grant execute on function public.reveal_area_v66(uuid,int,int) to authenticated;

-- Falls pg_cron bereits im Supabase-Projekt aktiviert ist,
-- wird die Wartung zusätzlich stündlich ausgeführt.
-- Ohne pg_cron läuft dieselbe Wartung beim Öffnen von Lobby/Spiel.
do $$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    begin
      execute $cron$
        select cron.schedule(
          'schatzsuche-v66-maintenance',
          '0 * * * *',
          'select public.run_game_maintenance_v66();'
        )
      $cron$;
    exception when others then
      raise notice 'pg_cron konnte nicht automatisch geplant werden: %',sqlerrm;
    end;
  end if;
end $$;

-- =========================================================
-- 2) PERSONALISIERTE PROFILE
-- =========================================================

alter table public.profiles
  add column if not exists bio text not null default '';

alter table public.profiles
  add column if not exists avatar_path text;

do $$
begin
  if not exists(
    select 1 from pg_constraint
    where conname='profiles_bio_length_check'
  ) then
    alter table public.profiles
      add constraint profiles_bio_length_check
      check(char_length(bio)<=500);
  end if;
end $$;

-- Der Nutzer darf nur Name, Bio und den exakt eigenen Avatarpfad ändern.
create or replace function public.update_profile_v66(
  p_display_name text,
  p_bio text,
  p_avatar_path text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  clean_name text:=trim(coalesce(p_display_name,''));
  clean_bio text:=trim(coalesce(p_bio,''));
  allowed_avatar text:=auth.uid()::text||'/avatar';
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  if char_length(clean_name)<1 or char_length(clean_name)>30 then
    raise exception 'Spielername muss zwischen 1 und 30 Zeichen lang sein';
  end if;

  if char_length(clean_bio)>500 then
    raise exception 'Infotext darf maximal 500 Zeichen lang sein';
  end if;

  if p_avatar_path is not null and p_avatar_path<>allowed_avatar then
    raise exception 'Ungültiger Profilbild-Pfad';
  end if;

  update public.profiles
  set display_name=clean_name,
      bio=clean_bio,
      avatar_path=p_avatar_path
  where id=auth.uid();
end;
$$;

revoke all on function public.update_profile_v66(text,text,text) from public;
grant execute on function public.update_profile_v66(text,text,text) to authenticated;

-- Öffentlicher Avatar-Bucket. Es dürfen nur ungefährliche Bildtypen hochgeladen werden.
insert into storage.buckets(
  id,name,public,file_size_limit,allowed_mime_types
)
values(
  'avatars','avatars',true,2097152,
  array['image/jpeg','image/png','image/webp']
)
on conflict(id) do update
set public=true,
    file_size_limit=2097152,
    allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "v66 avatar public read" on storage.objects;
create policy "v66 avatar public read"
on storage.objects
for select
to public
using(bucket_id='avatars');

drop policy if exists "v66 avatar self insert" on storage.objects;
create policy "v66 avatar self insert"
on storage.objects
for insert
to authenticated
with check(
  bucket_id='avatars'
  and (storage.foldername(name))[1]=auth.uid()::text
  and name=auth.uid()::text||'/avatar'
);

drop policy if exists "v66 avatar self update" on storage.objects;
create policy "v66 avatar self update"
on storage.objects
for update
to authenticated
using(
  bucket_id='avatars'
  and (storage.foldername(name))[1]=auth.uid()::text
)
with check(
  bucket_id='avatars'
  and name=auth.uid()::text||'/avatar'
);

drop policy if exists "v66 avatar self delete" on storage.objects;
create policy "v66 avatar self delete"
on storage.objects
for delete
to authenticated
using(
  bucket_id='avatars'
  and name=auth.uid()::text||'/avatar'
);
