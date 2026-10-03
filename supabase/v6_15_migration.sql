-- SCHATZSUCHE ONLINE V6.15
-- Synchronisierte Spieler-Feldzahlen, Ingame-Ranking, Admin-Spielverwaltung.
-- Nach V6.14.1 EINMAL vollständig ausführen.

-- =========================================================
-- 1) FELDER PRO SPIELER SERVERSEITIG SYNCHRON HALTEN
-- =========================================================

alter table public.game_players
  add column if not exists fields_revealed bigint not null default 0;

update public.game_players gp
set fields_revealed=x.cnt
from (
  select game_id,discovered_by as user_id,count(*)::bigint cnt
  from public.explored_fields
  group by game_id,discovered_by
) x
where gp.game_id=x.game_id and gp.user_id=x.user_id;

create or replace function public.sync_player_fields_v615()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.game_players gp
  set fields_revealed=gp.fields_revealed+x.cnt
  from (
    select game_id,discovered_by as user_id,count(*)::bigint cnt
    from new_rows
    group by game_id,discovered_by
  ) x
  where gp.game_id=x.game_id and gp.user_id=x.user_id;

  return null;
end;
$$;

drop trigger if exists sync_player_fields_v615 on public.explored_fields;
create trigger sync_player_fields_v615
after insert on public.explored_fields
referencing new table as new_rows
for each statement execute function public.sync_player_fields_v615();

-- =========================================================
-- 2) INGAME-WETTKAMPF / RANKING
-- =========================================================

create or replace function public.get_game_competition_v615(p_game_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'user_id',gp.user_id,
      'display_name',p.display_name,
      'coins',gp.coins,
      'fields_revealed',gp.fields_revealed,
      'reveal_power',gp.reveal_power,
      'treasure_share_bps',gp.treasure_share_bps,
      'tech_count',coalesce((
        select count(*) from public.player_technologies pt
        where pt.game_id=gp.game_id and pt.user_id=gp.user_id
      ),0)
    )
    order by gp.joined_at
  ),'[]'::jsonb)
  from public.game_players gp
  join public.profiles p on p.id=gp.user_id
  where gp.game_id=p_game_id
    and exists(
      select 1 from public.game_players me
      where me.game_id=p_game_id and me.user_id=auth.uid()
    );
$$;

revoke all on function public.get_game_competition_v615(uuid) from public;
grant execute on function public.get_game_competition_v615(uuid) to authenticated;

-- =========================================================
-- 3) ADMIN: SPIELE AUFLISTEN / BEENDEN / LÖSCHEN
-- =========================================================

create or replace function public.admin_list_games_v615(p_limit int default 200)
returns table(
  id uuid,name text,status text,game_type text,created_at timestamptz,
  last_activity_at timestamptz,closed_at timestamptz,player_count bigint,
  explored_count bigint,center_label text
)
language sql
stable
security definer
set search_path=public
as $$
  select
    g.id,g.name,g.status,g.game_type,g.created_at,g.last_activity_at,g.closed_at,
    (select count(*) from public.game_players gp where gp.game_id=g.id)::bigint,
    coalesce(g.explored_count,0)::bigint,
    g.center_label
  from public.games g
  where public.is_admin_v67()
  order by
    case when g.status='active' then 0 else 1 end,
    g.created_at desc
  limit least(greatest(coalesce(p_limit,200),1),500);
$$;

revoke all on function public.admin_list_games_v615(int) from public;
grant execute on function public.admin_list_games_v615(int) to authenticated;

create or replace function public.admin_end_game_v615(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  g public.games%rowtype;
  s public.platform_settings%rowtype;
  unresolved bigint:=0;
  community bigint:=0;
  platform bigint:=0;
begin
  if not public.is_admin_v67() then raise exception 'Keine Admin-Berechtigung'; end if;

  select * into g from public.games where id=p_game_id for update;
  if not found then raise exception 'Spiel nicht gefunden'; end if;
  if g.status<>'active' then
    return jsonb_build_object('message','Spiel ist bereits beendet');
  end if;

  if g.game_type='pay' then
    select coalesce(sum(amount_ug),0)::bigint
    into unresolved
    from public.gold_treasures
    where game_id=p_game_id
      and found_by is null
      and forfeited_at is null;

    select * into s from public.platform_settings where id=1;

    if unresolved>0 then
      community:=floor(unresolved::numeric*s.inactive_community_share_bps/10000.0)::bigint;
      platform:=unresolved-community;

      perform public.distribute_community_gold_v65(community,p_game_id);

      update public.platform_settings
      set platform_revenue_ug=platform_revenue_ug+platform
      where id=1;

      update public.gold_treasures
      set amount_ug=0,forfeited_at=now()
      where game_id=p_game_id
        and found_by is null
        and forfeited_at is null;

      update public.games
      set gold_prize_pool_ug=greatest(0,gold_prize_pool_ug-unresolved)
      where id=p_game_id;
    end if;
  end if;

  update public.games
  set status='closed',
      closed_at=now(),
      close_reason='admin'
  where id=p_game_id;

  perform public.snapshot_game_archive_v683(p_game_id);

  return jsonb_build_object(
    'message','Spiel beendet',
    'community_ug',community,
    'platform_ug',platform
  );
end;
$$;

revoke all on function public.admin_end_game_v615(uuid) from public;
grant execute on function public.admin_end_game_v615(uuid) to authenticated;

create or replace function public.admin_delete_game_v615(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_admin_v67() then raise exception 'Keine Admin-Berechtigung'; end if;
  if not exists(select 1 from public.games where id=p_game_id) then
    raise exception 'Spiel nicht gefunden';
  end if;

  if exists(select 1 from public.games where id=p_game_id and status='active') then
    perform public.admin_end_game_v615(p_game_id);
  end if;

  perform public.snapshot_game_archive_v683(p_game_id);
  delete from public.games where id=p_game_id;

  return jsonb_build_object('message','Spiel gelöscht; Archiv-Endstand bleibt erhalten.');
end;
$$;

revoke all on function public.admin_delete_game_v615(uuid) from public;
grant execute on function public.admin_delete_game_v615(uuid) to authenticated;
