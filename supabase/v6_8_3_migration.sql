-- SCHATZSUCHE ONLINE V6.8.3
-- Timeout-Fix für große Aufdeckungen + dauerhafte Hall of Fame
-- Nach V6.8.2 EINMAL vollständig im Supabase SQL Editor ausführen.

-- Für die einmalige Archiv-Backfill-Arbeit etwas mehr Luft.
set statement_timeout = '60s';

-- =========================================================
-- 1) ZÜGE PRO SPIELER MITZÄHLEN
-- =========================================================

alter table public.game_players
  add column if not exists moves_used bigint not null default 0;

-- =========================================================
-- 2) KOMPAKTES DAUERARCHIV
-- Die großen Live-Spieltabellen dürfen nach der Retentionszeit weiterhin
-- gelöscht werden. Die Hall-of-Fame-Daten bleiben separat erhalten.
-- =========================================================

alter table public.games
  add column if not exists archive_step int not null default 1;

update public.games
set archive_step=greatest(
  1,
  ceil(sqrt(greatest(1,(width::numeric*height::numeric))/3500.0))::int
);

create table if not exists public.game_archive(
  game_id uuid primary key,
  name text not null,
  created_at timestamptz,
  closed_at timestamptz,
  close_reason text,
  is_private boolean not null default false,
  game_type text not null default 'standard',
  width int not null,
  height int not null,
  center_lat numeric,
  center_lon numeric,
  center_label text,
  cell_size_m numeric,
  archive_step int not null default 1,
  winner_user_id uuid,
  winner_name text,
  winner_moves_used bigint,
  player_count int not null default 0,
  total_moves bigint not null default 0,
  total_fields bigint not null default 0,
  players jsonb not null default '[]'::jsonb,
  archived_at timestamptz not null default now()
);

create table if not exists public.game_archive_cell_counts(
  game_id uuid not null,
  bx int not null,
  by int not null,
  user_id uuid not null,
  n bigint not null default 0,
  has_treasure boolean not null default false,
  primary key(game_id,bx,by,user_id)
);

alter table public.game_archive enable row level security;
alter table public.game_archive_cell_counts enable row level security;
-- Bewusst keine direkten Client-Policies: Lesen nur über geprüfte RPCs.

create index if not exists game_archive_closed_idx
  on public.game_archive(closed_at desc);

create index if not exists game_archive_cells_game_idx
  on public.game_archive_cell_counts(game_id,bx,by);

-- Neue Spiele erhalten automatisch einen sinnvollen Archiv-Rasterfaktor.
create or replace function public.set_archive_step_v683()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.archive_step:=greatest(
    1,
    ceil(sqrt(greatest(1,(new.width::numeric*new.height::numeric))/3500.0))::int
  );
  return new;
end;
$$;

drop trigger if exists games_archive_step_v683 on public.games;
create trigger games_archive_step_v683
before insert or update of width,height on public.games
for each row execute function public.set_archive_step_v683();

-- Bei jeder Batch-Aufdeckung wird parallel nur eine kleine, komprimierte Endkarten-
-- Statistik gepflegt. So muss beim späteren Archivieren NICHT die komplette
-- explored_fields-Tabelle erneut durchgerechnet werden.
create or replace function public.archive_cells_insert_v683()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.game_archive_cell_counts(game_id,bx,by,user_id,n,has_treasure)
  select
    nr.game_id,
    (nr.x/greatest(g.archive_step,1))::int,
    (nr.y/greatest(g.archive_step,1))::int,
    nr.discovered_by,
    count(*)::bigint,
    bool_or(nr.is_treasure)
  from new_rows nr
  join public.games g on g.id=nr.game_id
  group by nr.game_id,
           (nr.x/greatest(g.archive_step,1))::int,
           (nr.y/greatest(g.archive_step,1))::int,
           nr.discovered_by
  on conflict(game_id,bx,by,user_id)
  do update set
    n=public.game_archive_cell_counts.n+excluded.n,
    has_treasure=public.game_archive_cell_counts.has_treasure or excluded.has_treasure;

  return null;
end;
$$;

drop trigger if exists archive_cells_insert_v683 on public.explored_fields;
create trigger archive_cells_insert_v683
after insert on public.explored_fields
referencing new table as new_rows
for each statement
execute function public.archive_cells_insert_v683();

-- Bestehende Spiele einmalig in die kompakte Endkartenstruktur übernehmen.
insert into public.game_archive_cell_counts(game_id,bx,by,user_id,n,has_treasure)
select
  ef.game_id,
  (ef.x/greatest(g.archive_step,1))::int,
  (ef.y/greatest(g.archive_step,1))::int,
  ef.discovered_by,
  count(*)::bigint,
  bool_or(ef.is_treasure)
from public.explored_fields ef
join public.games g on g.id=ef.game_id
group by ef.game_id,
         (ef.x/greatest(g.archive_step,1))::int,
         (ef.y/greatest(g.archive_step,1))::int,
         ef.discovered_by
on conflict(game_id,bx,by,user_id)
do update set
  n=excluded.n,
  has_treasure=excluded.has_treasure;

-- Metadaten und Spieler-Endstand sichern.
create or replace function public.snapshot_game_archive_v683(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  g public.games%rowtype;
  win_id uuid;
  win_name text;
  win_moves bigint;
  players_json jsonb;
  pc int;
  total_moves_v bigint;
begin
  select * into g from public.games where id=p_game_id;
  if not found then return; end if;

  win_id:=g.winner_id;

  -- Bei Paygames: falls kein klassischer winner_id vorhanden ist, gilt für die
  -- Archivdarstellung der Spieler mit dem meisten gefundenen Test-Gold als Top-Finder.
  if win_id is null and g.game_type='pay' then
    select gt.found_by
    into win_id
    from public.gold_treasures gt
    where gt.game_id=p_game_id and gt.found_by is not null
    group by gt.found_by
    order by sum(gt.amount_ug) desc, min(gt.found_at) asc
    limit 1;
  end if;

  if win_id is not null then
    select p.display_name,gp.moves_used
    into win_name,win_moves
    from public.profiles p
    left join public.game_players gp
      on gp.game_id=p_game_id and gp.user_id=p.id
    where p.id=win_id;
  end if;

  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'user_id',gp.user_id,
        'display_name',p.display_name,
        'avatar_path',p.avatar_path,
        'player_color',gp.player_color,
        'moves_used',gp.moves_used,
        'fields',coalesce((
          select sum(ac.n)
          from public.game_archive_cell_counts ac
          where ac.game_id=p_game_id and ac.user_id=gp.user_id
        ),0),
        'coins',gp.coins
      )
      order by case when gp.user_id=win_id then 0 else 1 end,
               gp.moves_used,
               gp.joined_at
    ),'[]'::jsonb),
    count(*)::int,
    coalesce(sum(gp.moves_used),0)::bigint
  into players_json,pc,total_moves_v
  from public.game_players gp
  join public.profiles p on p.id=gp.user_id
  where gp.game_id=p_game_id;

  insert into public.game_archive(
    game_id,name,created_at,closed_at,close_reason,is_private,game_type,
    width,height,center_lat,center_lon,center_label,cell_size_m,archive_step,
    winner_user_id,winner_name,winner_moves_used,player_count,total_moves,
    total_fields,players,archived_at
  )
  values(
    g.id,g.name,g.created_at,coalesce(g.closed_at,now()),g.close_reason,
    g.is_private,g.game_type,g.width,g.height,g.center_lat,g.center_lon,
    g.center_label,g.cell_size_m,g.archive_step,
    win_id,win_name,win_moves,pc,total_moves_v,
    coalesce(g.explored_count,0),players_json,now()
  )
  on conflict(game_id) do update set
    name=excluded.name,
    closed_at=excluded.closed_at,
    close_reason=excluded.close_reason,
    winner_user_id=excluded.winner_user_id,
    winner_name=excluded.winner_name,
    winner_moves_used=excluded.winner_moves_used,
    player_count=excluded.player_count,
    total_moves=excluded.total_moves,
    total_fields=excluded.total_fields,
    players=excluded.players,
    archived_at=now();
end;
$$;

-- Sobald ein Spiel von active auf finished/closed wechselt, wird der Endstand
-- sofort und ohne teure Vollkartenabfrage archiviert.
create or replace function public.archive_on_game_close_v683()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if old.status='active' and new.status<>'active' then
    perform public.snapshot_game_archive_v683(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists archive_on_game_close_v683 on public.games;
create trigger archive_on_game_close_v683
after update of status on public.games
for each row execute function public.archive_on_game_close_v683();

-- Bestehende bereits beendete Spiele ebenfalls aufnehmen.
do $$
declare r record;
begin
  for r in select id from public.games where status<>'active' loop
    perform public.snapshot_game_archive_v683(r.id);
  end loop;
end $$;

-- Hall-of-Fame-Liste. Private Spiele sieht nur, wer selbst Teilnehmer war.
create or replace function public.list_game_archive_v683(p_limit int default 100)
returns table(
  game_id uuid,
  name text,
  closed_at timestamptz,
  close_reason text,
  game_type text,
  winner_user_id uuid,
  winner_name text,
  winner_moves_used bigint,
  player_count int,
  total_moves bigint,
  total_fields bigint
)
language sql
stable
security definer
set search_path=public
as $$
  select
    a.game_id,a.name,a.closed_at,a.close_reason,a.game_type,
    a.winner_user_id,a.winner_name,a.winner_moves_used,
    a.player_count,a.total_moves,a.total_fields
  from public.game_archive a
  where auth.uid() is not null
    and (
      not a.is_private
      or exists(
        select 1
        from jsonb_array_elements(a.players) p
        where p->>'user_id'=auth.uid()::text
      )
    )
  order by a.closed_at desc nulls last
  limit least(greatest(coalesce(p_limit,100),1),250);
$$;

revoke all on function public.list_game_archive_v683(int) from public;
grant execute on function public.list_game_archive_v683(int) to authenticated;

-- Einzelnes Archiv samt kompakter Endkarte.
create or replace function public.get_game_archive_v683(p_game_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  a public.game_archive%rowtype;
  fields_json jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;

  select * into a from public.game_archive where game_id=p_game_id;
  if not found then raise exception 'Archiviertes Spiel nicht gefunden'; end if;

  if a.is_private and not exists(
    select 1
    from jsonb_array_elements(a.players) p
    where p->>'user_id'=auth.uid()::text
  ) then
    raise exception 'Kein Zugriff auf dieses private Spiel';
  end if;

  with per_bucket as (
    select
      bx,by,user_id,n,has_treasure,
      row_number() over(partition by bx,by order by n desc,user_id) as rn
    from public.game_archive_cell_counts
    where game_id=p_game_id
  ), treasure as (
    select bx,by,bool_or(has_treasure) as has_treasure
    from public.game_archive_cell_counts
    where game_id=p_game_id
    group by bx,by
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'x',p.bx*a.archive_step,
      'y',p.by*a.archive_step,
      'size',a.archive_step,
      'discovered_by',p.user_id,
      'is_treasure',t.has_treasure
    )
    order by p.by,p.bx
  ),'[]'::jsonb)
  into fields_json
  from per_bucket p
  join treasure t using(bx,by)
  where p.rn=1;

  return jsonb_build_object(
    'archive',to_jsonb(a),
    'fields',fields_json
  );
end;
$$;

revoke all on function public.get_game_archive_v683(uuid) from public;
grant execute on function public.get_game_archive_v683(uuid) to authenticated;

-- =========================================================
-- 3) TIMEOUT-FIX: DEUTLICH KLEINERER KANDIDATENBEREICH
-- Vorher wurden bei ~2.000 Feldern/Zug teils >140.000 Kandidaten erzeugt.
-- Jetzt werden auch am Kartenrand nur grob maximal ~4x reveal_power Kandidaten
-- betrachtet. Dadurch bleibt die SQL-Arbeit pro Zug kontrollierbar.
-- =========================================================

create or replace function public.reveal_area_v683(
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
  gp public.game_players%rowtype;
  g public.games%rowtype;
  s public.platform_settings%rowtype;
  opened int:=0;
  rew numeric:=0;
  gold_won bigint:=0;
  legacy_hit boolean:=false;
  remaining_treasures int:=0;
  search_radius int:=0;
  winner_name_v text;
  winner_moves_v bigint;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;

  perform public.refresh_player_moves(p_game_id);

  select * into gp
  from public.game_players
  where game_id=p_game_id and user_id=auth.uid()
  for update;

  if not found then raise exception 'Nicht im Spiel'; end if;

  select * into g from public.games where id=p_game_id;
  if not found then raise exception 'Spiel nicht gefunden'; end if;
  if g.status<>'active' then raise exception 'Spiel beendet'; end if;
  if gp.moves_left<=0 then
    raise exception 'Keine Züge verfügbar – der nächste Zug regeneriert automatisch';
  end if;

  select * into s from public.platform_settings where id=1;
  rew:=s.exploration_reward*gp.reward_multiplier;

  -- Radius sqrt(reveal_power) => ca. 4 * reveal_power Kandidaten im Vollquadrat.
  -- Selbst in einer Kartenecke bleibt grob reveal_power Platz.
  search_radius:=least(
    greatest(g.width,g.height),
    greatest(2,ceil(sqrt(greatest(1,gp.reveal_power)::numeric))::int)
  );

  if g.game_type='standard' then
    with candidates as (
      select
        p_x+dx as x,
        p_y+dy as y,
        row_number() over(order by greatest(abs(dx),abs(dy)),dy,dx) as ord
      from generate_series(-search_radius,search_radius) dy
      cross join generate_series(-search_radius,search_radius) dx
      where p_x+dx between 0 and g.width-1
        and p_y+dy between 0 and g.height-1
        and not exists(
          select 1
          from public.explored_fields ef
          where ef.game_id=p_game_id
            and ef.x=p_x+dx
            and ef.y=p_y+dy
        )
      order by greatest(abs(dx),abs(dy)),dy,dx
      limit gp.reveal_power
    ), tagged as (
      select c.*,(c.x=g.treasure_x and c.y=g.treasure_y) as is_treasure
      from candidates c
    ), stop_at as (
      select min(ord) filter(where is_treasure) as treasure_ord
      from tagged
    ), chosen as (
      select t.*
      from tagged t
      cross join stop_at stoprow
      where stoprow.treasure_ord is null or t.ord<=stoprow.treasure_ord
    ), ins as (
      insert into public.explored_fields(game_id,x,y,discovered_by,is_treasure)
      select p_game_id,x,y,auth.uid(),is_treasure
      from chosen
      on conflict(game_id,x,y) do nothing
      returning is_treasure
    )
    select count(*)::int,coalesce(bool_or(is_treasure),false)
    into opened,legacy_hit
    from ins;

  else
    with candidates as (
      select p_x+dx as x,p_y+dy as y
      from generate_series(-search_radius,search_radius) dy
      cross join generate_series(-search_radius,search_radius) dx
      where p_x+dx between 0 and g.width-1
        and p_y+dy between 0 and g.height-1
        and not exists(
          select 1
          from public.explored_fields ef
          where ef.game_id=p_game_id
            and ef.x=p_x+dx
            and ef.y=p_y+dy
        )
      order by greatest(abs(dx),abs(dy)),dy,dx
      limit gp.reveal_power
    ), tagged as (
      select c.x,c.y,(gt.id is not null) as is_treasure
      from candidates c
      left join public.gold_treasures gt
        on gt.game_id=p_game_id
       and gt.x=c.x and gt.y=c.y
       and gt.found_by is null
       and gt.forfeited_at is null
    ), ins as (
      insert into public.explored_fields(game_id,x,y,discovered_by,is_treasure)
      select p_game_id,x,y,auth.uid(),is_treasure
      from tagged
      on conflict(game_id,x,y) do nothing
      returning x,y,is_treasure
    ), claimed as (
      update public.gold_treasures gt
      set found_by=auth.uid(),found_at=now()
      from ins i
      where i.is_treasure
        and gt.game_id=p_game_id
        and gt.x=i.x and gt.y=i.y
        and gt.found_by is null
        and gt.forfeited_at is null
      returning gt.amount_ug
    ), stats as (
      select count(*)::int as opened from ins
    ), winnings as (
      select coalesce(sum(amount_ug),0)::bigint as gold_won from claimed
    )
    select stats.opened,winnings.gold_won
    into opened,gold_won
    from stats cross join winnings;

    if gold_won>0 then
      insert into public.gold_wallets(user_id)
      values(auth.uid())
      on conflict(user_id) do nothing;

      update public.gold_wallets
      set balance_ug=balance_ug+gold_won,updated_at=now()
      where user_id=auth.uid();

      update public.profiles
      set gold_found_ug=gold_found_ug+gold_won
      where id=auth.uid();

      insert into public.gold_transactions(
        user_id,game_id,amount_ug,transaction_type,note
      )
      values(
        auth.uid(),p_game_id,gold_won,'treasure_reward','Goldschatz gefunden'
      );

      update public.games
      set gold_prize_pool_ug=greatest(0,gold_prize_pool_ug-gold_won)
      where id=p_game_id;
    end if;
  end if;

  if opened=0 then
    raise exception 'Hier ist bereits alles erforscht – wähle einen anderen Kartenbereich';
  end if;

  update public.game_players
  set coins=coins+(opened*rew),
      moves_left=moves_left-1,
      moves_used=moves_used+1
  where game_id=p_game_id and user_id=auth.uid();

  update public.profiles
  set total_fields_revealed=total_fields_revealed+opened
  where id=auth.uid();

  update public.games
  set last_activity_at=now()
  where id=p_game_id;

  if g.game_type='standard' and legacy_hit then
    update public.games
    set status='finished',
        winner_id=auth.uid(),
        closed_at=coalesce(closed_at,now()),
        close_reason=coalesce(close_reason,'completed')
    where id=p_game_id and status='active';

    if found then
      update public.profiles set wins=wins+1 where id=auth.uid();
    end if;

    select p.display_name,gp2.moves_used
    into winner_name_v,winner_moves_v
    from public.profiles p
    join public.game_players gp2
      on gp2.user_id=p.id and gp2.game_id=p_game_id
    where p.id=auth.uid();

    return jsonb_build_object(
      'message','🏆 Schatz gefunden!',
      'won',true,
      'opened',opened,
      'winner_name',winner_name_v,
      'winner_moves_used',winner_moves_v
    );
  end if;

  if g.game_type='pay' then
    select count(*) into remaining_treasures
    from public.gold_treasures
    where game_id=p_game_id
      and found_by is null
      and forfeited_at is null;

    if remaining_treasures=0 then
      update public.games
      set status='finished',
          closed_at=coalesce(closed_at,now()),
          close_reason=coalesce(close_reason,'completed')
      where id=p_game_id and status='active';
    end if;
  end if;

  return jsonb_build_object(
    'message',
      opened||' Felder aufgedeckt. +'||
      to_char(opened*rew,'FM999999990.00')||' Taler.'||
      case when gold_won>0
        then ' ✨ Goldschatz gefunden: '||
             trim(to_char(gold_won/1000000.0,'FM999990.000000'))||
             ' g Test-Gold!'
        else '' end,
    'won',false,
    'opened',opened,
    'gold_won_ug',gold_won
  );
end;
$$;

revoke all on function public.reveal_area_v683(uuid,int,int) from public;
grant execute on function public.reveal_area_v683(uuid,int,int) to authenticated;

-- =========================================================
-- 4) WARTUNG: Live-Rohdaten nach Retention weiter löschen,
-- aber Archiv bleibt dauerhaft bestehen.
-- =========================================================

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
          remaining_gold::numeric*s.inactive_community_share_bps/10000
        )::bigint;
        platform_gold:=remaining_gold-community_gold;

        update public.gold_treasures
        set amount_ug=0,forfeited_at=now()
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

  -- Sicherheitshalber Archive aktualisieren, bevor die großen Live-Daten verschwinden.
  for g in
    select *
    from public.games
    where status<>'active'
      and closed_at is not null
      and closed_at <= now()-make_interval(hours=>s.closed_game_retention_hours)
  loop
    perform public.snapshot_game_archive_v683(g.id);
    delete from public.games where id=g.id;
    deleted_count:=deleted_count+1;
  end loop;

  return jsonb_build_object(
    'closed_games',closed_count,
    'deleted_games',deleted_count
  );
end;
$$;

reset statement_timeout;
