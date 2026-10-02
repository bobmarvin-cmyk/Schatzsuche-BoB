-- SCHATZSUCHE ONLINE V6.8.2
-- Mobile-/Multiplayer-Kartenstabilität: Viewport-Laden + serverseitige Aggregation
-- Nach V6.8.1/8.1a EINMAL vollständig im Supabase SQL Editor ausführen.

-- Exakte Gesamtzahl erforschter Felder direkt am Spiel speichern.
-- Dadurch muss der Browser für "Felder übrig" nicht mehr alle Feldzeilen laden.
alter table public.games
  add column if not exists explored_count bigint not null default 0;

update public.games g
set explored_count=(
  select count(*)::bigint
  from public.explored_fields ef
  where ef.game_id=g.id
);

-- Statement-Level-Trigger: auch ältere Clients/Funktionen halten explored_count korrekt,
-- ohne für jedes einzelne neue Feld ein separates games-UPDATE auszuführen.
create or replace function public.bump_explored_count_insert_v682()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.games g
  set explored_count=g.explored_count+x.cnt
  from (
    select game_id,count(*)::bigint as cnt
    from new_rows
    group by game_id
  ) x
  where g.id=x.game_id;
  return null;
end;
$$;

create or replace function public.bump_explored_count_delete_v682()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.games g
  set explored_count=greatest(0,g.explored_count-x.cnt)
  from (
    select game_id,count(*)::bigint as cnt
    from old_rows
    group by game_id
  ) x
  where g.id=x.game_id;
  return null;
end;
$$;

drop trigger if exists explored_count_insert_v682 on public.explored_fields;
create trigger explored_count_insert_v682
after insert on public.explored_fields
referencing new table as new_rows
for each statement
execute function public.bump_explored_count_insert_v682();

drop trigger if exists explored_count_delete_v682 on public.explored_fields;
create trigger explored_count_delete_v682
after delete on public.explored_fields
referencing old table as old_rows
for each statement
execute function public.bump_explored_count_delete_v682();

-- Der Primärschlüssel (game_id,x,y) hilft bereits. Dieser Index unterstützt zusätzlich
-- Rechteckabfragen auf x/y, wenn nur ein Kartenausschnitt geladen wird.
create index if not exists explored_fields_game_x_y_idx
  on public.explored_fields(game_id,x,y);

-- Liefert ausschließlich den sichtbaren Kartenausschnitt.
-- Bei weitem Zoom werden viele Einzelzellen serverseitig zu Anzeige-Blöcken zusammengefasst,
-- damit ein Handy niemals zehntausende Polygone gleichzeitig zeichnen muss.
create or replace function public.get_visible_fields_v682(
  p_game_id uuid,
  p_x0 int,
  p_x1 int,
  p_y0 int,
  p_y1 int,
  p_step int default 1
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  g public.games%rowtype;
  x0 int;
  x1 int;
  y0 int;
  y1 int;
  eff_step int;
  area numeric;
  rows_json jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if not exists(
    select 1 from public.game_players
    where game_id=p_game_id and user_id=auth.uid()
  ) then
    raise exception 'Nicht im Spiel';
  end if;

  select * into g from public.games where id=p_game_id;
  if not found then raise exception 'Spiel nicht gefunden'; end if;

  x0:=greatest(0,least(coalesce(p_x0,0),g.width-1));
  x1:=greatest(0,least(coalesce(p_x1,g.width-1),g.width-1));
  y0:=greatest(0,least(coalesce(p_y0,0),g.height-1));
  y1:=greatest(0,least(coalesce(p_y1,g.height-1),g.height-1));

  if x1<x0 then x0:=x0+x1; x1:=x0-x1; x0:=x0-x1; end if;
  if y1<y0 then y0:=y0+y1; y1:=y0-y1; y0:=y0-y1; end if;

  area:=(x1-x0+1)::numeric*(y1-y0+1)::numeric;

  -- Selbst manipulierte Clients dürfen den Server nicht zwingen, riesige exakte
  -- Kartenausschnitte zurückzugeben. Ziel sind maximal grob 3.000 Anzeige-Blöcke.
  eff_step:=greatest(
    1,
    least(10000,coalesce(p_step,1)),
    ceil(sqrt(greatest(1,area)/3000.0))::int
  );

  with base as (
    select
      ef.x,ef.y,ef.discovered_by,ef.is_treasure,
      floor(ef.x::numeric/eff_step)::int as bx,
      floor(ef.y::numeric/eff_step)::int as by
    from public.explored_fields ef
    where ef.game_id=p_game_id
      and ef.x between x0 and x1
      and ef.y between y0 and y1
  ), per_player as (
    select bx,by,discovered_by,count(*)::bigint as n
    from base
    group by bx,by,discovered_by
  ), dominant as (
    select distinct on (bx,by)
      bx,by,discovered_by,n
    from per_player
    order by bx,by,n desc,discovered_by
  ), meta as (
    select bx,by,bool_or(is_treasure) as is_treasure,count(*)::bigint as cell_count
    from base
    group by bx,by
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'x',m.bx*eff_step,
        'y',m.by*eff_step,
        'size',eff_step,
        'discovered_by',d.discovered_by,
        'is_treasure',m.is_treasure,
        'cell_count',m.cell_count
      )
      order by m.by,m.bx
    ),
    '[]'::jsonb
  )
  into rows_json
  from meta m
  join dominant d using(bx,by);

  return jsonb_build_object(
    'fields',rows_json,
    'step',eff_step,
    'approximate',eff_step>1
  );
end;
$$;

revoke all on function public.get_visible_fields_v682(uuid,int,int,int,int,int) from public;
grant execute on function public.get_visible_fields_v682(uuid,int,int,int,int,int) to authenticated;

-- Aufdeckung ohne Rückgabe tausender einzelner Feldobjekte.
-- Nach dem Zug lädt der Client nur seinen sichtbaren Kartenausschnitt neu.
create or replace function public.reveal_area_v682(
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
  if gp.moves_left<=0 then raise exception 'Keine Züge verfügbar – der nächste Zug regeneriert automatisch'; end if;

  select * into s from public.platform_settings where id=1;
  rew:=s.exploration_reward*gp.reward_multiplier;

  search_radius:=least(
    greatest(g.width,g.height),
    greatest(12,ceil(sqrt(gp.reveal_power::numeric)*4)::int+12)
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
          select 1 from public.explored_fields ef
          where ef.game_id=p_game_id and ef.x=p_x+dx and ef.y=p_y+dy
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
          select 1 from public.explored_fields ef
          where ef.game_id=p_game_id and ef.x=p_x+dx and ef.y=p_y+dy
        )
      order by greatest(abs(dx),abs(dy)),dy,dx
      limit gp.reveal_power
    ), tagged as (
      select c.x,c.y,(gt.id is not null) as is_treasure
      from candidates c
      left join public.gold_treasures gt
        on gt.game_id=p_game_id and gt.x=c.x and gt.y=c.y
       and gt.found_by is null and gt.forfeited_at is null
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
      values(auth.uid()) on conflict(user_id) do nothing;

      update public.gold_wallets
      set balance_ug=balance_ug+gold_won,updated_at=now()
      where user_id=auth.uid();

      update public.profiles
      set gold_found_ug=gold_found_ug+gold_won
      where id=auth.uid();

      insert into public.gold_transactions(user_id,game_id,amount_ug,transaction_type,note)
      values(auth.uid(),p_game_id,gold_won,'treasure_reward','Goldschatz gefunden');

      update public.games
      set gold_prize_pool_ug=greatest(0,gold_prize_pool_ug-gold_won)
      where id=p_game_id;
    end if;
  end if;

  if opened=0 then
    raise exception 'Hier ist bereits alles erforscht';
  end if;

  update public.game_players
  set coins=coins+(opened*rew),
      moves_left=moves_left-1
  where game_id=p_game_id and user_id=auth.uid();

  update public.profiles
  set total_fields_revealed=total_fields_revealed+opened
  where id=auth.uid();

  update public.games
  set last_activity_at=now()
  where id=p_game_id;

  if g.game_type='standard' and legacy_hit then
    update public.games
    set status='finished',winner_id=auth.uid(),closed_at=coalesce(closed_at,now()),close_reason=coalesce(close_reason,'completed')
    where id=p_game_id and status='active';

    if found then
      update public.profiles set wins=wins+1 where id=auth.uid();
    end if;

    return jsonb_build_object(
      'message','🏆 Schatz gefunden!',
      'won',true,
      'opened',opened
    );
  end if;

  if g.game_type='pay' then
    select count(*) into remaining_treasures
    from public.gold_treasures
    where game_id=p_game_id and found_by is null and forfeited_at is null;

    if remaining_treasures=0 then
      update public.games
      set status='finished',closed_at=coalesce(closed_at,now()),close_reason=coalesce(close_reason,'completed')
      where id=p_game_id and status='active';
    end if;
  end if;

  return jsonb_build_object(
    'message',
      opened||' Felder aufgedeckt. +'||to_char(opened*rew,'FM999999990.00')||' Taler.'||
      case when gold_won>0
        then ' ✨ Goldschatz gefunden: '||trim(to_char(gold_won/1000000.0,'FM999990.000000'))||' g Test-Gold!'
        else '' end,
    'won',false,
    'opened',opened,
    'gold_won_ug',gold_won
  );
end;
$$;

revoke all on function public.reveal_area_v682(uuid,int,int) from public;
grant execute on function public.reveal_area_v682(uuid,int,int) to authenticated;
