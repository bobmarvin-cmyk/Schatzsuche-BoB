-- SCHATZSUCHE ONLINE V6.18 – TERRAIN EXPERIMENT
-- Nach V6.17 EINMAL ausführen.

create table if not exists public.game_terrain_cells(
  game_id uuid not null references public.games(id) on delete cascade,
  x int not null,
  y int not null,
  terrain_type text not null,
  terrain_label text not null default '',
  source text not null default 'openfreemap-client',
  classified_at timestamptz not null default now(),
  primary key(game_id,x,y),
  check (terrain_type in ('open','water','forest','grass','farmland','wetland','sand','rock','park','residential','commercial','industrial','road','restricted','unknown'))
);

alter table public.game_terrain_cells enable row level security;

drop policy if exists "terrain readable by participants" on public.game_terrain_cells;
create policy "terrain readable by participants"
on public.game_terrain_cells for select to authenticated
using (
  exists(
    select 1 from public.game_players gp
    where gp.game_id=game_terrain_cells.game_id and gp.user_id=auth.uid()
  )
);

create index if not exists game_terrain_cells_game_type_v618
  on public.game_terrain_cells(game_id,terrain_type);

-- Client klassifiziert aus den geladenen OpenFreeMap/OpenMapTiles-Vektordaten.
-- Für V6.18 ist dies ein Experiment; spätere Echtgeld-/Sponsorlogik sollte serverseitig verifizieren.
create or replace function public.cache_terrain_cell_v618(
  p_game_id uuid,
  p_x int,
  p_y int,
  p_terrain_type text,
  p_terrain_label text default ''
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  g public.games%rowtype;
  t text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if not exists(
    select 1 from public.game_players
    where game_id=p_game_id and user_id=auth.uid()
  ) then raise exception 'Nicht im Spiel'; end if;

  select * into g from public.games where id=p_game_id;
  if not found then raise exception 'Spiel nicht gefunden'; end if;
  if p_x<0 or p_y<0 or p_x>=g.width or p_y>=g.height then
    raise exception 'Feld außerhalb des Spiels';
  end if;

  t:=lower(coalesce(p_terrain_type,'unknown'));
  if t not in ('open','water','forest','grass','farmland','wetland','sand','rock','park','residential','commercial','industrial','road','restricted','unknown') then
    t:='unknown';
  end if;

  insert into public.game_terrain_cells(game_id,x,y,terrain_type,terrain_label,classified_at)
  values(p_game_id,p_x,p_y,t,left(coalesce(p_terrain_label,''),80),now())
  on conflict(game_id,x,y) do update
  set terrain_type=excluded.terrain_type,
      terrain_label=excluded.terrain_label,
      classified_at=now();

  return jsonb_build_object('terrain_type',t,'x',p_x,'y',p_y);
end;
$$;
revoke all on function public.cache_terrain_cell_v618(uuid,int,int,text,text) from public;
grant execute on function public.cache_terrain_cell_v618(uuid,int,int,text,text) to authenticated;

create or replace function public.get_cached_terrain_v618(
  p_game_id uuid,p_x0 int,p_x1 int,p_y0 int,p_y1 int
)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'x',t.x,'y',t.y,'terrain_type',t.terrain_type,'terrain_label',t.terrain_label
  )),'[]'::jsonb)
  from public.game_terrain_cells t
  where t.game_id=p_game_id
    and t.x between least(p_x0,p_x1) and greatest(p_x0,p_x1)
    and t.y between least(p_y0,p_y1) and greatest(p_y0,p_y1)
    and exists(
      select 1 from public.game_players gp
      where gp.game_id=p_game_id and gp.user_id=auth.uid()
    );
$$;
revoke all on function public.get_cached_terrain_v618(uuid,int,int,int,int) from public;
grant execute on function public.get_cached_terrain_v618(uuid,int,int,int,int) to authenticated;

-- Terrain-Technologien.
insert into public.technologies(
  id,name,branch,cost,reveal_power_bonus,reward_bonus,moves_bonus,analysis_level,round_mod,requires,
  description,sort_order,is_active,capacity_bonus,regen_reduction
)
values
('ter1','Geländekunde','Gelände',2.00,0,0,0,0,null,array['root'],'Grundlage für anspruchsvolle Geländearten',700,true,0,0),
('ter2','Waldkunde','Gelände',4.00,0,0,0,0,null,array['ter1'],'Erlaubt Suche in Wald und dichtem Gehölz',710,true,0,0),
('ter3','Landexpedition','Gelände',5.00,0,.10,0,0,null,array['ter1'],'Acker, Wiese, Sand und Fels effizient durchsuchen · +10% Talerbonus',720,true,0,0),
('ter4','Boot & Sonar','Gelände',8.00,0,0,0,0,null,array['ter1'],'Erlaubt virtuelle Suche auf Wasserflächen',730,true,0,0),
('ter5','Sumpfausrüstung','Gelände',7.00,0,0,0,0,null,array['ter2'],'Erlaubt Suche in Feuchtgebieten',740,true,0,0),
('ter6','Urban Explorer','Gelände',6.00,0,0,0,0,null,array['ter1'],'Erlaubt Suche in Industrie- und Sonderflächen',750,true,0,0),
('ter7','Universalexpedition','Gelände',20.00,0,.15,0,0,null,array['ter2','ter4','ter5','ter6'],'Alle virtuellen Terrain-Sperren aufgehoben · +15% Talerbonus',760,true,0,0)
on conflict(id) do update set
  name=excluded.name,branch=excluded.branch,cost=excluded.cost,
  reward_bonus=excluded.reward_bonus,requires=excluded.requires,
  description=excluded.description,sort_order=excluded.sort_order,is_active=true;

-- Bereits vorhandene recompute_player_stats-Funktion berücksichtigt reward_bonus automatisch.


-- Maschinen berücksichtigen bereits klassifizierte Terrain-Sperren.
create or replace function public.run_machines_v613(p_game_id uuid)
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
  machine_total_power int:=0;
  base_interval_s int:=0;
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

  -- V6.17: Mikro-Batching. Nominale Maschinenleistung bleibt erhalten,
  -- aber ein einzelner DB-Lauf verarbeitet höchstens 150 Felder.
  -- Hohe Leistung wird auf häufigere kurze Läufe verteilt.
  machine_total_power:=machine_power;
  machine_power:=least(machine_total_power,150);

  select * into s from public.platform_settings where id=1;
  base_interval_s:=greatest(s.min_regen_seconds,round(g.regen_seconds*(1-gp.regen_reduction))::int);
  interval_s:=greatest(1,round(base_interval_s*(machine_power::numeric/machine_total_power))::int);
  insert into public.machine_runtime_v612(game_id,user_id,last_run_at)
  values(p_game_id,auth.uid(),gp.machine_last_run_at)
  on conflict(game_id,user_id) do nothing;

  select last_run_at into last_machine_at
  from public.machine_runtime_v612
  where game_id=p_game_id and user_id=auth.uid();

  elapsed:=extract(epoch from(now()-last_machine_at));

  if elapsed<interval_s then
    return jsonb_build_object(
      'opened',0,'active',true,'machine_power',machine_total_power,'machine_batch',machine_power,
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
  attempts:=least(420,greatest(180,machine_power*2));
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
        and not exists(
          select 1
          from public.game_terrain_cells tc
          where tc.game_id=p_game_id and tc.x=r.x and tc.y=r.y
            and (
              (tc.terrain_type='forest' and not exists(
                select 1 from public.player_technologies pt
                where pt.game_id=p_game_id and pt.user_id=auth.uid()
                  and pt.technology_id in ('ter2','ter7')
              ))
              or
              (tc.terrain_type='water' and not exists(
                select 1 from public.player_technologies pt
                where pt.game_id=p_game_id and pt.user_id=auth.uid()
                  and pt.technology_id in ('ter4','ter7')
              ))
              or
              (tc.terrain_type='wetland' and not exists(
                select 1 from public.player_technologies pt
                where pt.game_id=p_game_id and pt.user_id=auth.uid()
                  and pt.technology_id in ('ter5','ter7')
              ))
              or
              (tc.terrain_type in ('industrial','restricted') and not exists(
                select 1 from public.player_technologies pt
                where pt.game_id=p_game_id and pt.user_id=auth.uid()
                  and pt.technology_id in ('ter6','ter7')
              ))
            )
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
    with raw_candidates as (
      select
        greatest(0,least(g.width-1,
          gp.auto_focus_x + floor((random()*2-1) *
            least(greatest(g.width,g.height),
              greatest(12,side_len + sqrt(greatest(1,gp.machine_ticks_used+1))*side_len)
            )
          )::int
        )) as x,
        greatest(0,least(g.height-1,
          gp.auto_focus_y + floor((random()*2-1) *
            least(greatest(g.width,g.height),
              greatest(12,side_len + sqrt(greatest(1,gp.machine_ticks_used+1))*side_len)
            )
          )::int
        )) as y
      from generate_series(1,attempts)
    ), candidates as (
      select distinct r.x,r.y
      from raw_candidates r
      where not exists(
        select 1 from public.explored_fields ef
        where ef.game_id=p_game_id and ef.x=r.x and ef.y=r.y
      )
        and not exists(
          select 1
          from public.game_terrain_cells tc
          where tc.game_id=p_game_id and tc.x=r.x and tc.y=r.y
            and (
              (tc.terrain_type='forest' and not exists(
                select 1 from public.player_technologies pt
                where pt.game_id=p_game_id and pt.user_id=auth.uid()
                  and pt.technology_id in ('ter2','ter7')
              ))
              or
              (tc.terrain_type='water' and not exists(
                select 1 from public.player_technologies pt
                where pt.game_id=p_game_id and pt.user_id=auth.uid()
                  and pt.technology_id in ('ter4','ter7')
              ))
              or
              (tc.terrain_type='wetland' and not exists(
                select 1 from public.player_technologies pt
                where pt.game_id=p_game_id and pt.user_id=auth.uid()
                  and pt.technology_id in ('ter5','ter7')
              ))
              or
              (tc.terrain_type in ('industrial','restricted') and not exists(
                select 1 from public.player_technologies pt
                where pt.game_id=p_game_id and pt.user_id=auth.uid()
                  and pt.technology_id in ('ter6','ter7')
              ))
            )
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
      'machine_power',machine_total_power,'machine_batch',machine_power,'gimmicks',gimmicks,
      'part_found',parts_gained>0,'parts_gained',parts_gained,
      'share_gained_bps',share_gained,'gold_won_ug',gold_won
    );
  end if;

  return jsonb_build_object(
    'message',case when opened>0 then '⚙️ Maschinen: '||opened||' Felder automatisch aufgedeckt.'
      else '⚙️ In diesem Takt wurden keine freien Maschinenfelder gefunden.' end,
    'game_over',false,'won',false,'opened',opened,
    'remaining_treasures',remaining_treasures,'machine_power',machine_total_power,'machine_batch',machine_power,
    'seconds_to_next',interval_s,'gimmicks',gimmicks,
    'part_found',parts_gained>0,'parts_gained',parts_gained,
    'share_gained_bps',share_gained,'gold_won_ug',gold_won
  );
end;
$$;
revoke all on function public.run_machines_v613(uuid) from public;
grant execute on function public.run_machines_v613(uuid) to authenticated;
