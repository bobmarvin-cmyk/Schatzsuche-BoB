-- SCHATZSUCHE ONLINE V6.8.1
-- Multiplayer-/Feldaufdeckungs-Performance
-- Nach V6.8 EINMAL vollständig im Supabase SQL Editor ausführen.

create or replace function public.reveal_area_v681(
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
  gp game_players%rowtype;
  g games%rowtype;
  s platform_settings%rowtype;
  opened int:=0;
  rew numeric:=0;
  gold_won bigint:=0;
  legacy_hit boolean:=false;
  remaining_treasures int:=0;
  search_radius int:=0;
  opened_rows jsonb:='[]'::jsonb;
  treasure_ord bigint;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;

  -- Regeneration zunächst aktualisieren.
  perform public.refresh_player_moves(p_game_id);

  -- Nur die eigene Spielerzeile sperren. So blockieren sich verschiedene Spieler
  -- nicht mehr gegenseitig über einen globalen Game-Lock.
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

  -- Genug Kandidaten rund um den Klick erzeugen, aber nicht die gesamte Karte.
  -- Für große Reveal-Power wächst der Suchradius automatisch.
  search_radius:=least(
    greatest(g.width,g.height),
    greatest(12,ceil(sqrt(gp.reveal_power::numeric)*4)::int+12)
  );

  -- STANDARD-SPIEL:
  -- Kandidaten in Spiral-/Ring-Reihenfolge wählen. Wenn der Schatz in der gewählten
  -- Menge liegt, nur bis einschließlich Schatz einfügen. Alles erfolgt set-basiert.
  if g.game_type='standard' then
    with candidates as (
      select
        p_x+dx as x,
        p_y+dy as y,
        greatest(abs(dx),abs(dy)) as radius,
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
      select min(ord) filter(where is_treasure) as treasure_ord from tagged
    ), chosen as (
      select t.* from tagged t,stop_at s
      where s.treasure_ord is null or t.ord<=s.treasure_ord
    ), ins as (
      insert into public.explored_fields(game_id,x,y,discovered_by,is_treasure)
      select p_game_id,x,y,auth.uid(),is_treasure
      from chosen
      on conflict(game_id,x,y) do nothing
      returning x,y,discovered_by,is_treasure,discovered_at
    )
    select
      count(*),
      coalesce(bool_or(is_treasure),false),
      coalesce(jsonb_agg(jsonb_build_object(
        'x',x,'y',y,'discovered_by',discovered_by,
        'is_treasure',is_treasure,'discovered_at',discovered_at
      ) order by discovered_at),'[]'::jsonb)
    into opened,legacy_hit,opened_rows
    from ins;

  else
    -- PAYGAME: ebenfalls alle Felder in EINER Insert-Operation.
    with candidates as (
      select
        p_x+dx as x,
        p_y+dy as y
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
      returning x,y,discovered_by,is_treasure,discovered_at
    )
    select
      count(*),
      coalesce(jsonb_agg(jsonb_build_object(
        'x',x,'y',y,'discovered_by',discovered_by,
        'is_treasure',is_treasure,'discovered_at',discovered_at
      ) order by discovered_at),'[]'::jsonb)
    into opened,opened_rows
    from ins;

    -- Nur tatsächlich von diesem Aufdeckungsvorgang neu eingefügte Schatzfelder auszahlen.
    with hitcoords as (
      select (x->>'x')::int as x,(x->>'y')::int as y
      from jsonb_array_elements(opened_rows) x
      where coalesce((x->>'is_treasure')::boolean,false)
    ), claimed as (
      update public.gold_treasures gt
      set found_by=auth.uid(),found_at=now()
      from hitcoords h
      where gt.game_id=p_game_id
        and gt.x=h.x and gt.y=h.y
        and gt.found_by is null
        and gt.forfeited_at is null
      returning gt.amount_ug
    )
    select coalesce(sum(amount_ug),0)::bigint into gold_won from claimed;

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

  -- Nur EIN Update für Taler + Zug statt eines Updates pro Feld.
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
    -- Nur der erste erfolgreiche Abschluss gewinnt bei konkurrierenden Requests.
    update public.games
    set status='finished',winner_id=auth.uid(),closed_at=coalesce(closed_at,now()),close_reason=coalesce(close_reason,'completed')
    where id=p_game_id and status='active';

    if found then
      update public.profiles set wins=wins+1 where id=auth.uid();
    end if;

    return jsonb_build_object(
      'message','🏆 Schatz gefunden!',
      'won',true,
      'opened',opened,
      'fields',opened_rows
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
    'gold_won_ug',gold_won,
    'fields',opened_rows
  );
end;
$$;

revoke all on function public.reveal_area_v681(uuid,int,int) from public;
grant execute on function public.reveal_area_v681(uuid,int,int) to authenticated;

-- Indexe für die häufigsten Multiplayer-Abfragen sicherstellen.
create index if not exists explored_fields_game_discovered_idx
  on public.explored_fields(game_id,discovered_at);

create index if not exists game_players_game_user_idx
  on public.game_players(game_id,user_id);

create index if not exists gold_treasures_game_xy_open_idx
  on public.gold_treasures(game_id,x,y)
  where found_by is null and forfeited_at is null;
