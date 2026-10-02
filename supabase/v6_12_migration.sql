-- SCHATZSUCHE ONLINE V6.12
-- Gimmick-Statistik, Multiplayer-Wertung, Gold-Endabrechnung,
-- globale Zufallsorte und Maschinen/Manuell-Entkopplung.
-- Nach V6.11 EINMAL im Supabase SQL Editor ausführen.

-- 1) Gimmick-Zähler + feinere Dichte
alter table public.games
  add column if not exists gimmick_target_count bigint not null default 0,
  add column if not exists gimmicks_found_count bigint not null default 0;

update public.platform_settings
set min_gimmick_percent=least(min_gimmick_percent,0.01),
    max_gimmick_percent=greatest(max_gimmick_percent,0.01);

-- Bestehende Spiele bekommen einen plausiblen Zielwert.
update public.games
set gimmick_target_count=greatest(
  0,
  round((width::numeric*height::numeric)*gimmick_percent/100.0)::bigint
)
where gimmick_target_count=0 and gimmick_percent>0;

-- 2) Basis-Tab entfernen: Grundlagen gehört jetzt zu Erkundung.
update public.technologies
set branch='Erkundung',
    sort_order=least(sort_order,90)
where id='root';

-- 3) Gimmick-Auswertung mit Gesamt-/Fundzähler.
create or replace function public.apply_gimmicks_v611(
  p_game_id uuid,
  p_user_id uuid,
  p_opened int,
  p_source text default 'manual'
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  g public.games%rowtype;
  gp public.game_players%rowtype;
  s public.platform_settings%rowtype;
  taler_hits int:=0;
  move_hits int:=0;
  scanner_hits int:=0;
  total_hits int:=0;
  remaining bigint:=0;
  taler_total numeric:=0;
  move_total int:=0;
  scanner_total int:=0;
  cap int;
begin
  select * into g from public.games where id=p_game_id for update;
  if not found or p_opened<=0 or g.gimmick_percent<=0 then
    return jsonb_build_object(
      'total',0,'source',p_source,
      'found_total',coalesce(g.gimmicks_found_count,0),
      'available_total',coalesce(g.gimmick_target_count,0)
    );
  end if;

  remaining:=greatest(0,g.gimmick_target_count-g.gimmicks_found_count);
  if remaining<=0 then
    return jsonb_build_object(
      'total',0,'source',p_source,
      'found_total',g.gimmicks_found_count,
      'available_total',g.gimmick_target_count
    );
  end if;

  select * into s from public.platform_settings where id=1;

  with rolls as (
    select floor(random()*3)::int as kind
    from generate_series(1,p_opened)
    where random()*100 < g.gimmick_percent
    limit remaining
  )
  select
    count(*) filter(where kind=0)::int,
    count(*) filter(where kind=1)::int,
    count(*) filter(where kind=2)::int,
    count(*)::int
  into taler_hits,move_hits,scanner_hits,total_hits
  from rolls;

  if total_hits<=0 then
    return jsonb_build_object(
      'total',0,'source',p_source,
      'found_total',g.gimmicks_found_count,
      'available_total',g.gimmick_target_count
    );
  end if;

  taler_total:=taler_hits*s.gimmick_taler_bonus;
  move_total:=move_hits*s.gimmick_move_bonus;
  scanner_total:=scanner_hits*s.gimmick_reveal_bonus;

  select * into gp
  from public.game_players
  where game_id=p_game_id and user_id=p_user_id
  for update;

  cap:=greatest(1,g.max_stored_moves+gp.move_capacity_bonus);

  update public.game_players
  set coins=coins+taler_total,
      moves_left=least(cap,moves_left+move_total),
      gimmick_reveal_bonus_pending=gimmick_reveal_bonus_pending+scanner_total
  where game_id=p_game_id and user_id=p_user_id;

  update public.games
  set gimmicks_found_count=least(
    gimmick_target_count,
    gimmicks_found_count+total_hits
  )
  where id=p_game_id
  returning * into g;

  return jsonb_build_object(
    'total',total_hits,
    'taler_hits',taler_hits,
    'move_hits',move_hits,
    'scanner_hits',scanner_hits,
    'taler_bonus',taler_total,
    'move_bonus',move_total,
    'reveal_bonus',scanner_total,
    'source',p_source,
    'found_total',g.gimmicks_found_count,
    'available_total',g.gimmick_target_count
  );
end;
$$;

-- 4) Globalere Zufallsorte + Zielzahl der Gimmicks.
create or replace function public.create_game_v612(
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
  p_treasure_count int default 1,
  p_gimmick_percent numeric default 1
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  gid uuid;
  idx int;
  lat numeric;
  lon numeric;
  label text;
begin
  if p_location_mode='random' then
    idx:=1+floor(random()*36)::int;
    case idx
      when 1 then lat:=64.1466; lon:=-21.9426; label:='Reykjavík';
      when 2 then lat:=59.9139; lon:=10.7522; label:='Oslo';
      when 3 then lat:=60.1699; lon:=24.9384; label:='Helsinki';
      when 4 then lat:=52.5200; lon:=13.4050; label:='Berlin';
      when 5 then lat:=41.9028; lon:=12.4964; label:='Rom';
      when 6 then lat:=38.7223; lon:=-9.1393; label:='Lissabon';
      when 7 then lat:=37.9838; lon:=23.7275; label:='Athen';
      when 8 then lat:=41.0082; lon:=28.9784; label:='Istanbul';
      when 9 then lat:=30.0444; lon:=31.2357; label:='Kairo';
      when 10 then lat:=-1.2921; lon:=36.8219; label:='Nairobi';
      when 11 then lat:=-33.9249; lon:=18.4241; label:='Kapstadt';
      when 12 then lat:=31.6295; lon:=-7.9811; label:='Marrakesch';
      when 13 then lat:=25.2048; lon:=55.2708; label:='Dubai';
      when 14 then lat:=28.6139; lon:=77.2090; label:='Delhi';
      when 15 then lat:=13.7563; lon:=100.5018; label:='Bangkok';
      when 16 then lat:=1.3521; lon:=103.8198; label:='Singapur';
      when 17 then lat:=35.6762; lon:=139.6503; label:='Tokio';
      when 18 then lat:=37.5665; lon:=126.9780; label:='Seoul';
      when 19 then lat:=22.3193; lon:=114.1694; label:='Hongkong';
      when 20 then lat:=-33.8688; lon:=151.2093; label:='Sydney';
      when 21 then lat:=-37.8136; lon:=144.9631; label:='Melbourne';
      when 22 then lat:=-36.8485; lon:=174.7633; label:='Auckland';
      when 23 then lat:=21.3069; lon:=-157.8583; label:='Honolulu';
      when 24 then lat:=49.2827; lon:=-123.1207; label:='Vancouver';
      when 25 then lat:=37.7749; lon:=-122.4194; label:='San Francisco';
      when 26 then lat:=40.7128; lon:=-74.0060; label:='New York';
      when 27 then lat:=19.4326; lon:=-99.1332; label:='Mexiko-Stadt';
      when 28 then lat:=9.9281; lon:=-84.0907; label:='San José';
      when 29 then lat:=-12.0464; lon:=-77.0428; label:='Lima';
      when 30 then lat:=-22.9068; lon:=-43.1729; label:='Rio de Janeiro';
      when 31 then lat:=-34.6037; lon:=-58.3816; label:='Buenos Aires';
      when 32 then lat:=-33.4489; lon:=-70.6693; label:='Santiago de Chile';
      when 33 then lat:=18.4655; lon:=-66.1057; label:='San Juan';
      when 34 then lat:=28.2916; lon:=-16.6291; label:='Teneriffa';
      when 35 then lat:=-8.4095; lon:=115.1889; label:='Bali';
      else lat:=64.9631; lon:=-19.0208; label:='Island – Hochland';
    end case;

    gid:=public.create_game_v611(
      p_name,p_field_count,p_cell_size_m,p_max_players,'coords',
      lat,lon,label,p_regen_seconds,p_max_stored_moves,
      p_is_private,p_password,p_game_type,p_entry_gold_ug,
      p_treasure_count,p_gimmick_percent
    );

    update public.games set location_mode='random' where id=gid;
  else
    gid:=public.create_game_v611(
      p_name,p_field_count,p_cell_size_m,p_max_players,p_location_mode,
      p_center_lat,p_center_lon,p_center_label,p_regen_seconds,p_max_stored_moves,
      p_is_private,p_password,p_game_type,p_entry_gold_ug,
      p_treasure_count,p_gimmick_percent
    );
  end if;

  update public.games
  set gimmick_target_count=greatest(
    0,
    round((width::numeric*height::numeric)*gimmick_percent/100.0)::bigint
  ),
  gimmicks_found_count=0
  where id=gid;

  return gid;
end;
$$;

revoke all on function public.create_game_v612(
  text,bigint,numeric,int,text,numeric,numeric,text,int,int,
  boolean,text,text,bigint,int,numeric
) from public;
grant execute on function public.create_game_v612(
  text,bigint,numeric,int,text,numeric,numeric,text,int,int,
  boolean,text,text,bigint,int,numeric
) to authenticated;

-- 5) Solo-Spiele zählen nicht als offizieller Sieg.
-- Wrapper korrigiert die bisherige Siegserhöhung sofort wieder zurück.
create or replace function public.reveal_area_v612(
  p_game_id uuid,p_x int,p_y int
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  r jsonb;
  winner uuid;
  cnt int;
begin
  r:=public.reveal_area_v611(p_game_id,p_x,p_y);

  if coalesce((r->>'game_over')::boolean,false) then
    select winner_id into winner from public.games where id=p_game_id;
    select count(*) into cnt from public.game_players where game_id=p_game_id;
    if cnt<2 and winner is not null then
      update public.profiles
      set wins=greatest(0,wins-1)
      where id=winner;
    end if;
  end if;

  return r;
end;
$$;
revoke all on function public.reveal_area_v612(uuid,int,int) from public;
grant execute on function public.reveal_area_v612(uuid,int,int) to authenticated;

-- Separater Laufzeit-Lock für Maschinen. Dadurch bleibt game_players während
-- der teuren Feldsuche frei und manuelle Klicks werden nicht von Maschinen blockiert.
create table if not exists public.machine_runtime_v612(
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_run_at timestamptz not null default now(),
  primary key(game_id,user_id)
);
alter table public.machine_runtime_v612 enable row level security;
-- Kein direkter Clientzugriff; ausschließlich SECURITY DEFINER RPC.

-- 6) Maschinen ohne langes Sperren der Spielerzeile.
-- Manuelle Züge können dadurch parallel weiterlaufen.
create or replace function public.run_machines_v612(p_game_id uuid)
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
  attempts int;
  side_len int;
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
  gimmicks jsonb;
  reserved boolean:=false;
  player_count_v int:=0;
  last_machine_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;

  -- WICHTIG: hier KEIN FOR UPDATE während der teuren Feldsuche.
  select * into gp
  from public.game_players
  where game_id=p_game_id and user_id=auth.uid();

  if not found then raise exception 'Nicht im Spiel'; end if;

  select * into g from public.games where id=p_game_id;
  if not found or g.status<>'active' then
    return jsonb_build_object('opened',0,'active',false);
  end if;

  if gp.machine_presence_at is null
     or gp.machine_presence_at<now()-interval '20 seconds' then
    return jsonb_build_object('opened',0,'active',false,'reason','Spielseite nicht aktiv');
  end if;

  if gp.machine_mode='focus'
     and (gp.auto_focus_x is null or gp.auto_focus_y is null) then
    return jsonb_build_object('opened',0,'active',true,'reason','Noch kein Suchgebiet gewählt');
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
  interval_s:=greatest(s.min_regen_seconds,round(g.regen_seconds*(1-gp.regen_reduction))::int);
  insert into public.machine_runtime_v612(game_id,user_id,last_run_at)
  values(p_game_id,auth.uid(),gp.machine_last_run_at)
  on conflict(game_id,user_id) do nothing;

  select last_run_at into last_machine_at
  from public.machine_runtime_v612
  where game_id=p_game_id and user_id=auth.uid();

  elapsed:=extract(epoch from(now()-last_machine_at));

  if elapsed<interval_s then
    return jsonb_build_object(
      'opened',0,'active',true,'machine_power',machine_power,
      'seconds_to_next',greatest(0,ceil(interval_s-elapsed)::int)
    );
  end if;

  -- Nur die separate Maschinen-Laufzeitzeile sperren/reservieren.
  update public.machine_runtime_v612
  set last_run_at=now()
  where game_id=p_game_id
    and user_id=auth.uid()
    and last_run_at<=now()-(interval_s*interval '1 second');

  get diagnostics player_count_v = row_count;
  reserved:=player_count_v>0;
  if not reserved then
    return jsonb_build_object('opened',0,'active',true,'seconds_to_next',interval_s);
  end if;

  -- Nur Maschinenleistung bestimmt die Kandidatenmenge.
  -- Dadurch blockiert ein sehr hoher manueller Reveal-Power-Wert Maschinen nicht mehr.
  attempts:=least(6000,greatest(300,machine_power*4));
  side_len:=ceil(sqrt(attempts::numeric))::int;
  rew:=s.exploration_reward*gp.reward_multiplier*s.machine_reward_factor;

  if gp.machine_mode='random' then
    with raw_candidates as (
      select floor(random()*g.width)::int x,floor(random()*g.height)::int y
      from generate_series(1,attempts)
    ), candidates as (
      select distinct r.x,r.y
      from raw_candidates r
      where not exists(
        select 1 from public.explored_fields ef
        where ef.game_id=p_game_id and ef.x=r.x and ef.y=r.y
      )
      limit machine_power
    ), tagged as (
      select c.x,c.y,(gt.id is not null) is_treasure
      from candidates c
      left join public.gold_treasures gt
        on gt.game_id=p_game_id and gt.x=c.x and gt.y=c.y
       and gt.found_by is null and gt.forfeited_at is null
    ), ins as (
      insert into public.explored_fields(game_id,x,y,discovered_by,is_treasure)
      select p_game_id,x,y,auth.uid(),is_treasure from tagged
      on conflict(game_id,x,y) do nothing
      returning x,y,is_treasure
    ), claimed as (
      update public.gold_treasures gt
      set found_by=auth.uid(),found_at=now()
      from ins i
      where i.is_treasure and gt.game_id=p_game_id
        and gt.x=i.x and gt.y=i.y and gt.found_by is null
        and gt.forfeited_at is null
      returning gt.share_bps,gt.amount_ug
    )
    select
      (select count(*)::int from ins),
      coalesce((select sum(share_bps)::int from claimed),0),
      (select count(*)::int from claimed),
      coalesce((select sum(amount_ug)::bigint from claimed),0)
    into opened,share_gained,parts_gained,gold_won;
  else
    with numbered as (
      select i-1 n from generate_series(1,attempts) i
    ), raw_candidates as (
      select
        gp.auto_focus_x+((n%side_len)::int-floor(side_len/2.0)::int) x,
        gp.auto_focus_y+((n/side_len)::int-floor(side_len/2.0)::int) y
      from numbered
    ), candidates as (
      select r.x,r.y
      from raw_candidates r
      where r.x between 0 and g.width-1 and r.y between 0 and g.height-1
        and not exists(
          select 1 from public.explored_fields ef
          where ef.game_id=p_game_id and ef.x=r.x and ef.y=r.y
        )
      order by greatest(abs(r.x-gp.auto_focus_x),abs(r.y-gp.auto_focus_y)),r.y,r.x
      limit machine_power
    ), tagged as (
      select c.x,c.y,(gt.id is not null) is_treasure
      from candidates c
      left join public.gold_treasures gt
        on gt.game_id=p_game_id and gt.x=c.x and gt.y=c.y
       and gt.found_by is null and gt.forfeited_at is null
    ), ins as (
      insert into public.explored_fields(game_id,x,y,discovered_by,is_treasure)
      select p_game_id,x,y,auth.uid(),is_treasure from tagged
      on conflict(game_id,x,y) do nothing
      returning x,y,is_treasure
    ), claimed as (
      update public.gold_treasures gt
      set found_by=auth.uid(),found_at=now()
      from ins i
      where i.is_treasure and gt.game_id=p_game_id
        and gt.x=i.x and gt.y=i.y and gt.found_by is null
        and gt.forfeited_at is null
      returning gt.share_bps,gt.amount_ug
    )
    select
      (select count(*)::int from ins),
      coalesce((select sum(share_bps)::int from claimed),0),
      (select count(*)::int from claimed),
      coalesce((select sum(amount_ug)::bigint from claimed),0)
    into opened,share_gained,parts_gained,gold_won;
  end if;

  update public.game_players
  set machine_last_run_at=now(),
      machine_ticks_used=machine_ticks_used+1,
      coins=coins+(opened*rew),
      treasure_share_bps=treasure_share_bps+share_gained,
      treasure_parts_found=treasure_parts_found+parts_gained,
      last_treasure_found_at=case when parts_gained>0 then now() else last_treasure_found_at end
  where game_id=p_game_id and user_id=auth.uid()
  returning treasure_share_bps into my_total_share;

  if opened>0 then
    update public.profiles
    set total_fields_revealed=total_fields_revealed+opened
    where id=auth.uid();
    update public.games set last_activity_at=now() where id=p_game_id;
  end if;

  if g.game_type='pay' and gold_won>0 then
    insert into public.gold_wallets(user_id) values(auth.uid())
    on conflict(user_id) do nothing;
    update public.gold_wallets
    set balance_ug=balance_ug+gold_won,updated_at=now()
    where user_id=auth.uid();
    update public.profiles set gold_found_ug=gold_found_ug+gold_won where id=auth.uid();
    insert into public.gold_transactions(user_id,game_id,amount_ug,transaction_type,note)
    values(auth.uid(),p_game_id,gold_won,'treasure_reward','Schatzteil durch Maschine gefunden');
    update public.games
    set gold_prize_pool_ug=greatest(0,gold_prize_pool_ug-gold_won)
    where id=p_game_id;
  end if;

  gimmicks:=public.apply_gimmicks_v611(p_game_id,auth.uid(),opened,'machine');

  select count(*)::int into remaining_treasures
  from public.gold_treasures
  where game_id=p_game_id and found_by is null and forfeited_at is null;

  if remaining_treasures=0 then
    select gp2.user_id,p.display_name,gp2.moves_used,gp2.treasure_share_bps
    into winner_id_v,winner_name_v,winner_moves_v,winner_share_v
    from public.game_players gp2
    join public.profiles p on p.id=gp2.user_id
    where gp2.game_id=p_game_id
    order by gp2.treasure_share_bps desc,gp2.last_treasure_found_at asc nulls last,
             gp2.moves_used asc,gp2.joined_at asc
    limit 1;

    update public.games
    set status='finished',winner_id=winner_id_v,
        closed_at=coalesce(closed_at,now()),close_reason=coalesce(close_reason,'completed')
    where id=p_game_id and status='active';

    if found then
      select count(*) into player_count_v from public.game_players where game_id=p_game_id;
      if player_count_v>=2 then
        update public.profiles set wins=wins+1 where id=winner_id_v;
      end if;
    end if;

    return jsonb_build_object(
      'message',case when auth.uid()=winner_id_v then '⚙️🏆 Alle Schatzteile gefunden – du gewinnst!'
                     else '⚙️ Alle Schatzteile gefunden. '||winner_name_v||' gewinnt.' end,
      'game_over',true,'won',auth.uid()=winner_id_v,'opened',opened,
      'remaining_treasures',0,'winner_id',winner_id_v,'winner_name',winner_name_v,
      'winner_moves_used',winner_moves_v,'winner_share_bps',winner_share_v,
      'machine_power',machine_power,'gimmicks',gimmicks
    );
  end if;

  return jsonb_build_object(
    'message',case when opened>0 then '⚙️ Maschinen: '||opened||' Felder automatisch aufgedeckt.'
      else '⚙️ In diesem Takt wurden keine freien Maschinenfelder gefunden.' end,
    'game_over',false,'won',false,'opened',opened,
    'remaining_treasures',remaining_treasures,'machine_power',machine_power,
    'seconds_to_next',interval_s,'gimmicks',gimmicks
  );
end;
$$;
revoke all on function public.run_machines_v612(uuid) from public;
grant execute on function public.run_machines_v612(uuid) to authenticated;

-- 7) Hall of Fame: nur echte Multiplayer-Spiele anzeigen.
drop function if exists public.list_game_archive_v683(int);
create function public.list_game_archive_v683(p_limit int default 100)
returns table(
  game_id uuid,name text,closed_at timestamptz,close_reason text,game_type text,
  winner_user_id uuid,winner_name text,winner_moves_used bigint,winner_share_bps int,
  player_count int,total_moves bigint,total_fields bigint
)
language sql stable security definer set search_path=public
as $$
  select a.game_id,a.name,a.closed_at,a.close_reason,a.game_type,
         a.winner_user_id,a.winner_name,a.winner_moves_used,a.winner_share_bps,
         a.player_count,a.total_moves,a.total_fields
  from public.game_archive a
  where auth.uid() is not null
    and a.player_count>=2
    and (
      not a.is_private
      or exists(
        select 1 from jsonb_array_elements(a.players) p
        where p->>'user_id'=auth.uid()::text
      )
    )
  order by a.closed_at desc nulls last
  limit least(greatest(coalesce(p_limit,100),1),250);
$$;
revoke all on function public.list_game_archive_v683(int) from public;
grant execute on function public.list_game_archive_v683(int) to authenticated;

-- 8) Gold-Endabrechnung in Archivdaten ergänzen.
create or replace function public.snapshot_game_archive_v683(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  g public.games%rowtype;
  win_id uuid; win_name text; win_moves bigint; win_share int;
  players_json jsonb; pc int; total_moves_v bigint;
begin
  select * into g from public.games where id=p_game_id;
  if not found then return; end if;

  win_id:=g.winner_id;
  if win_id is not null then
    select p.display_name,gp.moves_used,gp.treasure_share_bps
    into win_name,win_moves,win_share
    from public.profiles p
    left join public.game_players gp on gp.game_id=p_game_id and gp.user_id=p.id
    where p.id=win_id;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'user_id',gp.user_id,'display_name',p.display_name,'avatar_path',p.avatar_path,
      'player_color',gp.player_color,'moves_used',gp.moves_used,
      'machine_ticks_used',gp.machine_ticks_used,
      'treasure_share_bps',gp.treasure_share_bps,
      'treasure_parts_found',gp.treasure_parts_found,
      'gold_received_ug',coalesce((
        select sum(gt.amount_ug) from public.gold_treasures gt
        where gt.game_id=p_game_id and gt.found_by=gp.user_id
      ),0),
      'fields',coalesce((
        select sum(ac.n) from public.game_archive_cell_counts ac
        where ac.game_id=p_game_id and ac.user_id=gp.user_id
      ),0),
      'coins',gp.coins
    )
    order by gp.treasure_share_bps desc,gp.moves_used,gp.joined_at
  ),'[]'::jsonb),
  count(*)::int,coalesce(sum(gp.moves_used),0)::bigint
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
    win_id,win_name,win_moves,win_share,pc,total_moves_v,
    coalesce(g.explored_count,0),players_json,now()
  )
  on conflict(game_id) do update set
    name=excluded.name,closed_at=excluded.closed_at,close_reason=excluded.close_reason,
    winner_user_id=excluded.winner_user_id,winner_name=excluded.winner_name,
    winner_moves_used=excluded.winner_moves_used,winner_share_bps=excluded.winner_share_bps,
    player_count=excluded.player_count,total_moves=excluded.total_moves,
    total_fields=excluded.total_fields,players=excluded.players,archived_at=now();
end;
$$;

-- Bereits abgeschlossene noch vorhandene Spiele aktualisieren.
do $$
declare r record;
begin
  for r in select id from public.games where status<>'active' loop
    perform public.snapshot_game_archive_v683(r.id);
  end loop;
end $$;


-- 9) Öffentliche Profile zeigen das Beitrittsdatum.
create or replace function public.get_public_profile_v68(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
 select case when p.id is null then null else jsonb_build_object(
   'id',p.id,
   'display_name',p.display_name,
   'bio',coalesce(p.bio,''),
   'avatar_path',p.avatar_path,
   'wins',p.wins,
   'total_games',p.total_games,
   'total_fields_revealed',p.total_fields_revealed,
   'gold_found_ug',p.gold_found_ug,
   'created_at',p.created_at
 ) end
 from (select 1) x
 left join public.profiles p on p.id=p_user_id
 where auth.uid() is not null;
$$;
revoke all on function public.get_public_profile_v68(uuid) from public;
grant execute on function public.get_public_profile_v68(uuid) to authenticated;
