-- SCHATZSUCHE ONLINE V6.10
-- Teil-Schätze, Mehrschatz-Wertung, Maschinenfix und Kartenanalyse
-- Nach V6.9 EINMAL vollständig im Supabase SQL Editor ausführen.

-- =========================================================
-- 1) SCHATZTEILE / WERTUNG
-- =========================================================

alter table public.gold_treasures
  add column if not exists share_bps int not null default 10000;

alter table public.game_players
  add column if not exists treasure_share_bps int not null default 0,
  add column if not exists treasure_parts_found int not null default 0,
  add column if not exists last_treasure_found_at timestamptz,
  add column if not exists machine_ticks_used bigint not null default 0;

-- Bis zu 10 Schatzteile standardmäßig erlauben; in der Schaltzentrale kann der
-- Wert später wieder reduziert oder erhöht werden.
update public.platform_settings
set max_treasures=greatest(max_treasures,10)
where id=1;

-- Bestehende Standardspiele bekommen ihren bisherigen Einzelschatz als 1,000-Teil.
insert into public.gold_treasures(
  game_id,treasure_no,x,y,amount_ug,found_by,found_at,share_bps
)
select
  g.id,1,g.treasure_x,g.treasure_y,0,
  case when g.status<>'active' then g.winner_id else null end,
  case when g.status<>'active' then g.closed_at else null end,
  10000
from public.games g
where g.game_type='standard'
  and not exists(
    select 1 from public.gold_treasures gt where gt.game_id=g.id
  )
on conflict do nothing;

-- Bestehende Mehrschatz-Paygames gleichmäßig auf 1,000 Gesamt-Schatz verteilen.
with counts as (
  select game_id,count(*)::int as cnt
  from public.gold_treasures
  group by game_id
), numbered as (
  select
    gt.id,
    gt.game_id,
    gt.treasure_no,
    c.cnt,
    floor(10000.0/c.cnt)::int as base_share,
    10000-floor(10000.0/c.cnt)::int*c.cnt as remainder
  from public.gold_treasures gt
  join counts c on c.game_id=gt.game_id
)
update public.gold_treasures gt
set share_bps=n.base_share + case when n.treasure_no=1 then n.remainder else 0 end
from numbered n
where gt.id=n.id;

update public.games g
set treasure_count=x.cnt
from (
  select game_id,count(*)::int as cnt
  from public.gold_treasures
  group by game_id
) x
where g.id=x.game_id;

-- Bereits gefundene Teile in laufenden/alten Paygames auf die Spielerscores übertragen.
with scores as (
  select game_id,found_by as user_id,
         sum(share_bps)::int as share_bps,
         count(*)::int as parts,
         max(found_at) as last_found
  from public.gold_treasures
  where found_by is not null
  group by game_id,found_by
)
update public.game_players gp
set treasure_share_bps=s.share_bps,
    treasure_parts_found=s.parts,
    last_treasure_found_at=s.last_found
from scores s
where gp.game_id=s.game_id and gp.user_id=s.user_id;

-- =========================================================
-- 2) PAYGAME-EINSÄTZE PROPORTIONAL AUF OFFENE TEILE
-- =========================================================

create or replace function public.apply_paygame_entry_v65(
  p_game_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  g public.games%rowtype;
  s public.platform_settings%rowtype;
  w public.gold_wallets%rowtype;
  prize bigint;
  community bigint;
  platform bigint;
  open_share int;
  allocated bigint:=0;
  a record;
  piece bigint;
  rem bigint;
begin
  select * into g from public.games where id=p_game_id for update;
  if g.game_type<>'pay' then return; end if;
  if g.status<>'active' then raise exception 'Spiel ist beendet'; end if;

  select * into s from public.platform_settings where id=1;

  insert into public.gold_wallets(user_id)
  values(p_user_id)
  on conflict(user_id) do nothing;

  select * into w
  from public.gold_wallets
  where user_id=p_user_id
  for update;

  if w.balance_ug<g.entry_gold_ug then
    raise exception 'Nicht genug Test-Goldstaub';
  end if;

  select coalesce(sum(share_bps),0)::int
  into open_share
  from public.gold_treasures
  where game_id=p_game_id and found_by is null and forfeited_at is null;

  if open_share<=0 then
    raise exception 'Keine offenen Schatzteile mehr';
  end if;

  update public.gold_wallets
  set balance_ug=balance_ug-g.entry_gold_ug,
      updated_at=now()
  where user_id=p_user_id;

  insert into public.gold_transactions(
    user_id,game_id,amount_ug,transaction_type,note
  )
  values(
    p_user_id,p_game_id,-g.entry_gold_ug,
    'game_entry','Schürfrechte / Paygame-Einsatz'
  );

  prize:=floor(g.entry_gold_ug*s.prize_share_bps/10000.0)::bigint;
  community:=floor(g.entry_gold_ug*s.community_share_bps/10000.0)::bigint;
  platform:=g.entry_gold_ug-prize-community;

  update public.games
  set gold_prize_pool_ug=gold_prize_pool_ug+prize
  where id=p_game_id;

  update public.platform_settings
  set platform_revenue_ug=platform_revenue_ug+platform
  where id=1;

  -- Neue Einsätze werden nur noch auf die noch offenen Schatzanteile verteilt.
  for a in
    select id,share_bps
    from public.gold_treasures
    where game_id=p_game_id
      and found_by is null
      and forfeited_at is null
    order by treasure_no
  loop
    piece:=floor(prize::numeric*a.share_bps/open_share)::bigint;
    update public.gold_treasures
    set amount_ug=amount_ug+piece
    where id=a.id;
    allocated:=allocated+piece;
  end loop;

  rem:=prize-allocated;
  if rem>0 then
    update public.gold_treasures
    set amount_ug=amount_ug+rem
    where id=(
      select id
      from public.gold_treasures
      where game_id=p_game_id
        and found_by is null
        and forfeited_at is null
      order by treasure_no
      limit 1
    );
  end if;

  perform public.distribute_community_gold_v65(community,p_game_id);
end;
$$;

-- =========================================================
-- 3) NEUE SPIELERSTELLUNG: 1,000 SCHATZ AUF N TEILE
-- =========================================================

create or replace function public.create_game_v610(
  p_name text,
  p_field_count bigint,
  p_cell_size_m numeric,
  p_max_players int,
  p_location_mode text,
  p_center_lat numeric default null,
  p_center_lon numeric default null,
  p_center_label text default null,
  p_regen_seconds int default 30,
  p_max_stored_moves int default 4,
  p_is_private boolean default false,
  p_password text default null,
  p_game_type text default 'standard',
  p_entry_gold_ug bigint default 0,
  p_treasure_count int default 1
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  gid uuid;
  g public.games%rowtype;
  s public.platform_settings%rowtype;
  i int;
  rx int;
  ry int;
  base_share int;
  remainder int;
  current_pool bigint;
  allocated bigint:=0;
  piece bigint;
  first_x int;
  first_y int;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;

  select * into s from public.platform_settings where id=1;

  if p_treasure_count<1 or p_treasure_count>s.max_treasures then
    raise exception 'Schatzanzahl muss zwischen 1 und % liegen',s.max_treasures;
  end if;

  -- Die alte Erstellungsfunktion erzeugt zunächst genau einen Schatz und erledigt
  -- alle bewährten Prüfungen, Private-Game-Logik und den Host-Paygame-Einsatz.
  gid:=public.create_game_v67(
    p_name,
    p_field_count,
    p_cell_size_m,
    p_max_players,
    p_location_mode,
    p_center_lat,
    p_center_lon,
    p_center_label,
    p_regen_seconds,
    p_max_stored_moves,
    p_is_private,
    p_password,
    p_game_type,
    p_entry_gold_ug,
    '1'
  );

  select * into g from public.games where id=gid for update;
  current_pool:=coalesce(g.gold_prize_pool_ug,0);

  delete from public.gold_treasures where game_id=gid;

  base_share:=floor(10000.0/p_treasure_count)::int;
  remainder:=10000-base_share*p_treasure_count;

  for i in 1..p_treasure_count loop
    loop
      rx:=floor(random()*g.width)::int;
      ry:=floor(random()*g.height)::int;
      exit when not exists(
        select 1 from public.gold_treasures
        where game_id=gid and x=rx and y=ry
      );
    end loop;

    if i=1 then
      first_x:=rx;
      first_y:=ry;
    end if;

    insert into public.gold_treasures(
      game_id,treasure_no,x,y,share_bps,amount_ug
    )
    values(
      gid,i,rx,ry,
      base_share+case when i=1 then remainder else 0 end,
      0
    );
  end loop;

  -- Bei Paygames vorhandenen Host-Schatzpool proportional auf die Teile verteilen.
  if p_game_type='pay' and current_pool>0 then
    allocated:=0;
    for i in 1..p_treasure_count loop
      piece:=floor(
        current_pool::numeric *
        (select share_bps from public.gold_treasures
         where game_id=gid and treasure_no=i) / 10000
      )::bigint;

      update public.gold_treasures
      set amount_ug=piece
      where game_id=gid and treasure_no=i;

      allocated:=allocated+piece;
    end loop;

    if current_pool>allocated then
      update public.gold_treasures
      set amount_ug=amount_ug+(current_pool-allocated)
      where game_id=gid and treasure_no=1;
    end if;
  end if;

  update public.games
  set treasure_count=p_treasure_count,
      treasure_x=first_x,
      treasure_y=first_y
  where id=gid;

  return gid;
end;
$$;

revoke all on function public.create_game_v610(
  text,bigint,numeric,int,text,numeric,numeric,text,int,int,boolean,text,text,bigint,int
) from public;

grant execute on function public.create_game_v610(
  text,bigint,numeric,int,text,numeric,numeric,text,int,int,boolean,text,text,bigint,int
) to authenticated;

-- =========================================================
-- 4) SICHERER STATUS DER SCHATZTEILE (OHNE KOORDINATEN)
-- =========================================================

create or replace function public.get_treasure_status_v610(p_game_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',gt.id,
      'treasure_no',gt.treasure_no,
      'share_bps',gt.share_bps,
      'amount_ug',gt.amount_ug,
      'found_by',gt.found_by,
      'found_at',gt.found_at
    )
    order by gt.treasure_no
  ),'[]'::jsonb)
  from public.gold_treasures gt
  where gt.game_id=p_game_id
    and auth.uid() is not null
    and exists(
      select 1 from public.game_players gp
      where gp.game_id=p_game_id and gp.user_id=auth.uid()
    );
$$;

revoke all on function public.get_treasure_status_v610(uuid) from public;
grant execute on function public.get_treasure_status_v610(uuid) to authenticated;

-- =========================================================
-- 5) MEHRSCHATZ-AUFDECKUNG UND SIEGERWERTUNG
-- =========================================================

create or replace function public.reveal_area_v610(
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
  search_radius int:=0;
  share_gained int:=0;
  parts_gained int:=0;
  gold_won bigint:=0;
  remaining_treasures int:=0;
  winner_id_v uuid;
  winner_name_v text;
  winner_moves_v bigint;
  winner_share_v int;
  my_total_share int;
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

  search_radius:=least(
    greatest(g.width,g.height),
    greatest(2,ceil(sqrt(greatest(1,gp.reveal_power)::numeric))::int)
  );

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
        where ef.game_id=p_game_id
          and ef.x=p_x+dx
          and ef.y=p_y+dy
      )
    order by greatest(abs(dx),abs(dy)),dy,dx
    limit gp.reveal_power
  ), tagged as (
    select
      c.x,c.y,
      (gt.id is not null) as is_treasure
    from candidates c
    left join public.gold_treasures gt
      on gt.game_id=p_game_id
     and gt.x=c.x and gt.y=c.y
     and gt.found_by is null
     and gt.forfeited_at is null
  ), ins as (
    insert into public.explored_fields(
      game_id,x,y,discovered_by,is_treasure
    )
    select p_game_id,x,y,auth.uid(),is_treasure
    from tagged
    on conflict(game_id,x,y) do nothing
    returning x,y,is_treasure
  ), claimed as (
    update public.gold_treasures gt
    set found_by=auth.uid(),
        found_at=now()
    from ins i
    where i.is_treasure
      and gt.game_id=p_game_id
      and gt.x=i.x
      and gt.y=i.y
      and gt.found_by is null
      and gt.forfeited_at is null
    returning gt.share_bps,gt.amount_ug
  ), ins_stats as (
    select count(*)::int as opened from ins
  ), treasure_stats as (
    select
      coalesce(sum(share_bps),0)::int as share_gained,
      count(*)::int as parts_gained,
      coalesce(sum(amount_ug),0)::bigint as gold_won
    from claimed
  )
  select
    i.opened,t.share_gained,t.parts_gained,t.gold_won
  into opened,share_gained,parts_gained,gold_won
  from ins_stats i cross join treasure_stats t;

  if opened=0 then
    raise exception 'Hier ist bereits alles erforscht – wähle einen anderen Kartenbereich';
  end if;

  update public.game_players
  set coins=coins+(opened*rew),
      moves_left=moves_left-1,
      moves_used=moves_used+1,
      treasure_share_bps=treasure_share_bps+share_gained,
      treasure_parts_found=treasure_parts_found+parts_gained,
      last_treasure_found_at=case
        when parts_gained>0 then now()
        else last_treasure_found_at
      end
  where game_id=p_game_id and user_id=auth.uid()
  returning treasure_share_bps into my_total_share;

  update public.profiles
  set total_fields_revealed=total_fields_revealed+opened
  where id=auth.uid();

  update public.games
  set last_activity_at=now()
  where id=p_game_id;

  if g.game_type='pay' and gold_won>0 then
    insert into public.gold_wallets(user_id)
    values(auth.uid())
    on conflict(user_id) do nothing;

    update public.gold_wallets
    set balance_ug=balance_ug+gold_won,
        updated_at=now()
    where user_id=auth.uid();

    update public.profiles
    set gold_found_ug=gold_found_ug+gold_won
    where id=auth.uid();

    insert into public.gold_transactions(
      user_id,game_id,amount_ug,transaction_type,note
    )
    values(
      auth.uid(),p_game_id,gold_won,
      'treasure_reward','Schatzteil gefunden'
    );

    update public.games
    set gold_prize_pool_ug=greatest(0,gold_prize_pool_ug-gold_won)
    where id=p_game_id;
  end if;

  select count(*)::int
  into remaining_treasures
  from public.gold_treasures
  where game_id=p_game_id
    and found_by is null
    and forfeited_at is null;

  if remaining_treasures=0 then
    select
      gp2.user_id,
      p.display_name,
      gp2.moves_used,
      gp2.treasure_share_bps
    into winner_id_v,winner_name_v,winner_moves_v,winner_share_v
    from public.game_players gp2
    join public.profiles p on p.id=gp2.user_id
    where gp2.game_id=p_game_id
    order by
      gp2.treasure_share_bps desc,
      gp2.last_treasure_found_at asc nulls last,
      gp2.moves_used asc,
      gp2.joined_at asc
    limit 1;

    update public.games
    set status='finished',
        winner_id=winner_id_v,
        closed_at=coalesce(closed_at,now()),
        close_reason=coalesce(close_reason,'completed')
    where id=p_game_id and status='active';

    if found then
      update public.profiles
      set wins=wins+1
      where id=winner_id_v;
    end if;

    return jsonb_build_object(
      'message',
        case when auth.uid()=winner_id_v
          then '🏆 Alle Schatzteile gefunden – du gewinnst mit '||
               to_char(winner_share_v/100.0,'FM990.00')||'% des Gesamtschatzes!'
          else '🏁 Alle Schatzteile gefunden. '||winner_name_v||
               ' gewinnt mit '||to_char(winner_share_v/100.0,'FM990.00')||'%.'
        end,
      'game_over',true,
      'won',auth.uid()=winner_id_v,
      'opened',opened,
      'part_found',parts_gained>0,
      'parts_gained',parts_gained,
      'share_gained_bps',share_gained,
      'my_share_bps',my_total_share,
      'remaining_treasures',0,
      'gold_won_ug',gold_won,
      'winner_id',winner_id_v,
      'winner_name',winner_name_v,
      'winner_moves_used',winner_moves_v,
      'winner_share_bps',winner_share_v
    );
  end if;

  return jsonb_build_object(
    'message',
      opened||' Felder aufgedeckt. +'||
      to_char(opened*rew,'FM999999990.00')||' Taler.'||
      case when parts_gained>0
        then ' 🧩 Schatzanteil gefunden: +'||
             to_char(share_gained/100.0,'FM990.00')||'%.'
        else '' end ||
      case when gold_won>0
        then ' ✨ '||
             trim(to_char(gold_won/1000000.0,'FM999990.000000'))||
             ' g Test-Gold!'
        else '' end,
    'game_over',false,
    'won',false,
    'opened',opened,
    'part_found',parts_gained>0,
    'parts_gained',parts_gained,
    'share_gained_bps',share_gained,
    'my_share_bps',my_total_share,
    'remaining_treasures',remaining_treasures,
    'gold_won_ug',gold_won
  );
end;
$$;

revoke all on function public.reveal_area_v610(uuid,int,int) from public;
grant execute on function public.reveal_area_v610(uuid,int,int) to authenticated;

-- =========================================================
-- 6) ANALYSE: NÄCHSTEN NOCH OFFENEN SCHATZTEIL ANALYSIEREN
-- =========================================================

create or replace function public.get_analysis_hint_v68(
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
  g public.games%rowtype;
  gp public.game_players%rowtype;
  tx int;
  ty int;
  target_lat numeric;
  target_lon numeric;
  click_lat numeric;
  click_lon numeric;
  meters_lon numeric;
  bucket_m numeric;
  lat_step numeric;
  lon_step numeric;
  approx_lat numeric;
  approx_lon numeric;
  dx numeric;
  dy numeric;
  dist_m numeric;
  direction text;
  part_no int;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;

  select * into g from public.games where id=p_game_id;
  if not found then return null; end if;

  select * into gp
  from public.game_players
  where game_id=p_game_id and user_id=auth.uid();

  if not found or gp.analysis_level<=0 then return null; end if;

  select gt.x,gt.y,gt.treasure_no
  into tx,ty,part_no
  from public.gold_treasures gt
  where gt.game_id=p_game_id
    and gt.found_by is null
    and gt.forfeited_at is null
  order by
    power(gt.x-p_x,2)+power(gt.y-p_y,2),
    gt.treasure_no
  limit 1;

  if not found then return null; end if;

  meters_lon:=greatest(1000,111320*cos(radians(g.center_lat)));
  target_lat:=g.center_lat+((g.height/2.0)-(ty+0.5))*g.cell_size_m/111320.0;
  target_lon:=g.center_lon+((tx+0.5)-(g.width/2.0))*g.cell_size_m/meters_lon;
  click_lat:=g.center_lat+((g.height/2.0)-(p_y+0.5))*g.cell_size_m/111320.0;
  click_lon:=g.center_lon+((p_x+0.5)-(g.width/2.0))*g.cell_size_m/meters_lon;

  bucket_m:=case gp.analysis_level
    when 1 then greatest(5000,g.cell_size_m*80)
    when 2 then greatest(2500,g.cell_size_m*40)
    when 3 then greatest(1200,g.cell_size_m*20)
    when 4 then greatest(600,g.cell_size_m*10)
    when 5 then greatest(300,g.cell_size_m*5)
    else greatest(150,g.cell_size_m*2)
  end;

  lat_step:=bucket_m/111320.0;
  lon_step:=bucket_m/meters_lon;
  approx_lat:=round(target_lat/lat_step)*lat_step;
  approx_lon:=round(target_lon/lon_step)*lon_step;

  dx:=(target_lon-click_lon)*meters_lon;
  dy:=(target_lat-click_lat)*111320.0;
  dist_m:=sqrt(dx*dx+dy*dy);

  direction:=case
    when abs(dx)<dist_m*.25 and dy>0 then 'Norden'
    when abs(dx)<dist_m*.25 and dy<0 then 'Süden'
    when abs(dy)<dist_m*.25 and dx>0 then 'Osten'
    when abs(dy)<dist_m*.25 and dx<0 then 'Westen'
    when dx>0 and dy>0 then 'Nordosten'
    when dx<0 and dy>0 then 'Nordwesten'
    when dx>0 and dy<0 then 'Südosten'
    else 'Südwesten'
  end;

  return jsonb_build_object(
    'level',gp.analysis_level,
    'treasure_no',part_no,
    'lat',round(approx_lat,6),
    'lon',round(approx_lon,6),
    'radius_m',bucket_m,
    'text',
      '🧩 Analyse für einen noch offenen Schatzteil: '||
      case
        when gp.analysis_level=1 then
          'grob '||direction||'. Nutze große Orte, Landschaft und Hauptstraßen im markierten Bereich.'
        when gp.analysis_level=2 then
          direction||', Hinweiszone etwa '||round(bucket_m/1000.0,1)||' km. Vergleiche Orte, Straßen und Gewässer.'
        when gp.analysis_level=3 then
          'ungefähr '||round(dist_m/100.0)*100||' m Richtung '||direction||
          '. Nutze die reale Karte, nicht nur das Raster.'
        when gp.analysis_level=4 then
          'Kartenradar etwa '||round(dist_m/100.0)*100||' m Richtung '||direction||
          '. Straßen, Wege, Siedlungen und Gewässer helfen bei der Orientierung.'
        when gp.analysis_level=5 then
          'Geodatenanalyse etwa '||round(dist_m/50.0)*50||' m Richtung '||direction||'.'
        else
          'KI-Kartenanalyse etwa '||round(dist_m/25.0)*25||' m Richtung '||direction||
          '. Prüfe die benannten Kartenmerkmale innerhalb der markierten Zone.'
      end
  );
end;
$$;

-- =========================================================
-- 7) MASCHINENFIX + MEHRSCHATZ
-- =========================================================

create or replace function public.run_machines_v610(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  gp public.game_players%rowtype;
  g public.games%rowtype;
  s public.platform_settings%rowtype;
  machine_power int:=0;
  interval_s int;
  elapsed numeric;
  search_radius int;
  opened int:=0;
  rew numeric:=0;
  share_gained int:=0;
  parts_gained int:=0;
  gold_won bigint:=0;
  remaining_treasures int:=0;
  winner_id_v uuid;
  winner_name_v text;
  winner_moves_v bigint;
  winner_share_v int;
  my_total_share int;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;

  select * into gp
  from public.game_players
  where game_id=p_game_id and user_id=auth.uid()
  for update;

  if not found then raise exception 'Nicht im Spiel'; end if;

  select * into g from public.games where id=p_game_id;
  if not found or g.status<>'active' then
    return jsonb_build_object('opened',0,'active',false);
  end if;

  if gp.machine_presence_at is null
     or gp.machine_presence_at<now()-interval '20 seconds' then
    return jsonb_build_object(
      'opened',0,'active',false,'reason','Spielseite nicht aktiv'
    );
  end if;

  if gp.auto_focus_x is null or gp.auto_focus_y is null then
    return jsonb_build_object(
      'opened',0,'active',true,'reason','Noch kein manuelles Suchgebiet gewählt'
    );
  end if;

  select coalesce(sum(t.machine_auto_fields),0)::int
  into machine_power
  from public.player_technologies pt
  join public.technologies t on t.id=pt.technology_id
  where pt.game_id=p_game_id
    and pt.user_id=auth.uid()
    and t.is_active=true;

  if machine_power<=0 then
    return jsonb_build_object('opened',0,'active',true,'machine_power',0);
  end if;

  select * into s from public.platform_settings where id=1;

  interval_s:=greatest(
    s.min_regen_seconds,
    round(g.regen_seconds*(1-gp.regen_reduction))::int
  );

  elapsed:=extract(epoch from (now()-gp.machine_last_run_at));

  if elapsed<interval_s then
    return jsonb_build_object(
      'opened',0,
      'active',true,
      'machine_power',machine_power,
      'seconds_to_next',greatest(0,ceil(interval_s-elapsed)::int)
    );
  end if;

  -- Der alte Radius war bei kleinen Maschinen oft schon durch den manuellen Zug leer.
  -- Nun berücksichtigt der Radius auch die manuelle Suchleistung und wächst deutlich weiter.
  search_radius:=least(
    greatest(g.width,g.height),
    greatest(
      20,
      ceil(sqrt(greatest(machine_power,gp.reveal_power)::numeric)*1.5)::int+15
    )
  );

  rew:=s.exploration_reward*gp.reward_multiplier*s.machine_reward_factor;

  with candidates as (
    select
      gp.auto_focus_x+dx as x,
      gp.auto_focus_y+dy as y
    from generate_series(-search_radius,search_radius) dy
    cross join generate_series(-search_radius,search_radius) dx
    where gp.auto_focus_x+dx between 0 and g.width-1
      and gp.auto_focus_y+dy between 0 and g.height-1
      and not exists(
        select 1 from public.explored_fields ef
        where ef.game_id=p_game_id
          and ef.x=gp.auto_focus_x+dx
          and ef.y=gp.auto_focus_y+dy
      )
    order by greatest(abs(dx),abs(dy)),dy,dx
    limit machine_power
  ), tagged as (
    select
      c.x,c.y,
      (gt.id is not null) as is_treasure
    from candidates c
    left join public.gold_treasures gt
      on gt.game_id=p_game_id
     and gt.x=c.x and gt.y=c.y
     and gt.found_by is null
     and gt.forfeited_at is null
  ), ins as (
    insert into public.explored_fields(
      game_id,x,y,discovered_by,is_treasure
    )
    select p_game_id,x,y,auth.uid(),is_treasure
    from tagged
    on conflict(game_id,x,y) do nothing
    returning x,y,is_treasure
  ), claimed as (
    update public.gold_treasures gt
    set found_by=auth.uid(),
        found_at=now()
    from ins i
    where i.is_treasure
      and gt.game_id=p_game_id
      and gt.x=i.x
      and gt.y=i.y
      and gt.found_by is null
      and gt.forfeited_at is null
    returning gt.share_bps,gt.amount_ug
  ), a as (
    select count(*)::int as opened from ins
  ), b as (
    select
      coalesce(sum(share_bps),0)::int as share_gained,
      count(*)::int as parts_gained,
      coalesce(sum(amount_ug),0)::bigint as gold_won
    from claimed
  )
  select a.opened,b.share_gained,b.parts_gained,b.gold_won
  into opened,share_gained,parts_gained,gold_won
  from a cross join b;

  -- Jeder fällige Maschinentakt wird sauber abgeschlossen, auch wenn das unmittelbare
  -- Gebiet gerade keine neuen Felder enthält. Dadurch startet der Clienttimer neu.
  update public.game_players
  set machine_last_run_at=now(),
      machine_ticks_used=machine_ticks_used+1,
      coins=coins+(opened*rew),
      treasure_share_bps=treasure_share_bps+share_gained,
      treasure_parts_found=treasure_parts_found+parts_gained,
      last_treasure_found_at=case
        when parts_gained>0 then now()
        else last_treasure_found_at
      end
  where game_id=p_game_id and user_id=auth.uid()
  returning treasure_share_bps into my_total_share;

  if opened>0 then
    update public.profiles
    set total_fields_revealed=total_fields_revealed+opened
    where id=auth.uid();

    update public.games
    set last_activity_at=now()
    where id=p_game_id;
  end if;

  if g.game_type='pay' and gold_won>0 then
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
      auth.uid(),p_game_id,gold_won,
      'treasure_reward','Schatzteil durch Maschine gefunden'
    );

    update public.games
    set gold_prize_pool_ug=greatest(0,gold_prize_pool_ug-gold_won)
    where id=p_game_id;
  end if;

  select count(*)::int
  into remaining_treasures
  from public.gold_treasures
  where game_id=p_game_id
    and found_by is null
    and forfeited_at is null;

  if remaining_treasures=0 then
    select
      gp2.user_id,p.display_name,gp2.moves_used,gp2.treasure_share_bps
    into winner_id_v,winner_name_v,winner_moves_v,winner_share_v
    from public.game_players gp2
    join public.profiles p on p.id=gp2.user_id
    where gp2.game_id=p_game_id
    order by
      gp2.treasure_share_bps desc,
      gp2.last_treasure_found_at asc nulls last,
      gp2.moves_used asc,
      gp2.joined_at asc
    limit 1;

    update public.games
    set status='finished',
        winner_id=winner_id_v,
        closed_at=coalesce(closed_at,now()),
        close_reason=coalesce(close_reason,'completed')
    where id=p_game_id and status='active';

    if found then
      update public.profiles set wins=wins+1 where id=winner_id_v;
    end if;

    return jsonb_build_object(
      'message',
        case when auth.uid()=winner_id_v
          then '⚙️🏆 Deine Maschinen haben den letzten Schatzteil gefunden – du gewinnst!'
          else '⚙️ Letzter Schatzteil gefunden. '||winner_name_v||' gewinnt.'
        end,
      'game_over',true,
      'won',auth.uid()=winner_id_v,
      'opened',opened,
      'part_found',parts_gained>0,
      'share_gained_bps',share_gained,
      'my_share_bps',my_total_share,
      'remaining_treasures',0,
      'winner_id',winner_id_v,
      'winner_name',winner_name_v,
      'winner_moves_used',winner_moves_v,
      'winner_share_bps',winner_share_v,
      'machine_power',machine_power
    );
  end if;

  return jsonb_build_object(
    'message',
      case when opened>0
        then '⚙️ Maschinen: '||opened||' Felder automatisch aufgedeckt.'
        else '⚙️ Im aktuellen Suchgebiet sind keine neuen Felder erreichbar – setze den Maschinenfokus mit einem neuen manuellen Kartenklick.'
      end ||
      case when parts_gained>0
        then ' 🧩 +'||to_char(share_gained/100.0,'FM990.00')||'% Schatzanteil.'
        else '' end,
    'game_over',false,
    'won',false,
    'opened',opened,
    'part_found',parts_gained>0,
    'share_gained_bps',share_gained,
    'my_share_bps',my_total_share,
    'remaining_treasures',remaining_treasures,
    'machine_power',machine_power,
    'seconds_to_next',interval_s
  );
end;
$$;

revoke all on function public.run_machines_v610(uuid) from public;
grant execute on function public.run_machines_v610(uuid) to authenticated;

-- =========================================================
-- 8) HALL OF FAME UM SCHATZANTEILE ERWEITERN
-- =========================================================

alter table public.game_archive
  add column if not exists winner_share_bps int;

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
  win_share int;
  players_json jsonb;
  pc int;
  total_moves_v bigint;
begin
  select * into g from public.games where id=p_game_id;
  if not found then return; end if;

  win_id:=g.winner_id;

  if win_id is not null then
    select p.display_name,gp.moves_used,gp.treasure_share_bps
    into win_name,win_moves,win_share
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
        'machine_ticks_used',gp.machine_ticks_used,
        'treasure_share_bps',gp.treasure_share_bps,
        'treasure_parts_found',gp.treasure_parts_found,
        'fields',coalesce((
          select sum(ac.n)
          from public.game_archive_cell_counts ac
          where ac.game_id=p_game_id and ac.user_id=gp.user_id
        ),0),
        'coins',gp.coins
      )
      order by gp.treasure_share_bps desc,gp.moves_used,gp.joined_at
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
    winner_user_id,winner_name,winner_moves_used,winner_share_bps,
    player_count,total_moves,total_fields,players,archived_at
  )
  values(
    g.id,g.name,g.created_at,coalesce(g.closed_at,now()),g.close_reason,
    g.is_private,g.game_type,g.width,g.height,g.center_lat,g.center_lon,
    g.center_label,g.cell_size_m,g.archive_step,
    win_id,win_name,win_moves,win_share,
    pc,total_moves_v,coalesce(g.explored_count,0),players_json,now()
  )
  on conflict(game_id) do update set
    name=excluded.name,
    closed_at=excluded.closed_at,
    close_reason=excluded.close_reason,
    winner_user_id=excluded.winner_user_id,
    winner_name=excluded.winner_name,
    winner_moves_used=excluded.winner_moves_used,
    winner_share_bps=excluded.winner_share_bps,
    player_count=excluded.player_count,
    total_moves=excluded.total_moves,
    total_fields=excluded.total_fields,
    players=excluded.players,
    archived_at=now();
end;
$$;


-- Hall-of-Fame-Liste mit Siegeranteil.
-- Der Rückgabetyp erhält eine neue Spalte, daher alte Signatur zuerst entfernen.
drop function if exists public.list_game_archive_v683(int);

create function public.list_game_archive_v683(p_limit int default 100)
returns table(
  game_id uuid,
  name text,
  closed_at timestamptz,
  close_reason text,
  game_type text,
  winner_user_id uuid,
  winner_name text,
  winner_moves_used bigint,
  winner_share_bps int,
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
    a.winner_user_id,a.winner_name,a.winner_moves_used,a.winner_share_bps,
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

-- Bereits vorhandene Archive nach Migration einmal mit den neuen Schatzwerten aktualisieren,
-- solange die zugrunde liegenden Live-Spiele noch vorhanden sind.
do $$
declare r record;
begin
  for r in
    select id from public.games where status<>'active'
  loop
    perform public.snapshot_game_archive_v683(r.id);
  end loop;
end $$;
