-- SCHATZSUCHE ONLINE V6.17
-- Mikro-Batching für Maschinen + schneller Karten-Viewport.
-- Nach V6.16a.5.1 EINMAL ausführen.

-- Hot-path-Indizes
create index if not exists explored_fields_game_xy_v617
  on public.explored_fields(game_id,x,y);
create index if not exists archive_cells_game_bxy_v617
  on public.game_archive_cell_counts(game_id,bx,by);
create index if not exists game_traps_open_xy_v617
  on public.game_traps(game_id,x,y)
  where triggered_at is null;

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


create or replace function public.get_visible_fields_v617(
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
  x0 int; x1 int; y0 int; y1 int;
  eff_step int;
  area numeric;
  rows_json jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if not exists(
    select 1 from public.game_players
    where game_id=p_game_id and user_id=auth.uid()
  ) then raise exception 'Nicht im Spiel'; end if;

  select * into g from public.games where id=p_game_id;
  if not found then raise exception 'Spiel nicht gefunden'; end if;

  x0:=greatest(0,least(coalesce(p_x0,0),g.width-1));
  x1:=greatest(0,least(coalesce(p_x1,g.width-1),g.width-1));
  y0:=greatest(0,least(coalesce(p_y0,0),g.height-1));
  y1:=greatest(0,least(coalesce(p_y1,g.height-1),g.height-1));

  if x1<x0 then x0:=x0+x1; x1:=x0-x1; x0:=x0-x1; end if;
  if y1<y0 then y0:=y0+y1; y1:=y0-y1; y0:=y0-y1; end if;

  area:=(x1-x0+1)::numeric*(y1-y0+1)::numeric;
  eff_step:=greatest(
    1,
    least(10000,coalesce(p_step,1)),
    ceil(sqrt(greatest(1,area)/1400.0))::int
  );

  -- Bei weitem Zoom nicht mehr Millionen explored_fields-Zeilen gruppieren.
  -- Stattdessen die bereits während des Spiels gepflegte Archivverdichtung nutzen.
  if eff_step>=greatest(1,g.archive_step) then
    with base as (
      select
        floor((ac.bx*g.archive_step)::numeric/eff_step)::int obx,
        floor((ac.by*g.archive_step)::numeric/eff_step)::int oby,
        ac.user_id,
        sum(ac.n)::bigint n,
        bool_or(ac.has_treasure) has_treasure
      from public.game_archive_cell_counts ac
      where ac.game_id=p_game_id
        and ac.bx between floor(x0::numeric/g.archive_step)::int
                      and floor(x1::numeric/g.archive_step)::int
        and ac.by between floor(y0::numeric/g.archive_step)::int
                      and floor(y1::numeric/g.archive_step)::int
      group by
        floor((ac.bx*g.archive_step)::numeric/eff_step)::int,
        floor((ac.by*g.archive_step)::numeric/eff_step)::int,
        ac.user_id
    ), dominant as (
      select distinct on(obx,oby)
        obx,oby,user_id,n
      from base
      order by obx,oby,n desc,user_id
    ), meta as (
      select obx,oby,sum(n)::bigint cell_count,bool_or(has_treasure) is_treasure
      from base
      group by obx,oby
    )
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'x',m.obx*eff_step,
        'y',m.oby*eff_step,
        'size',eff_step,
        'discovered_by',d.user_id,
        'is_treasure',m.is_treasure,
        'cell_count',m.cell_count
      )
      order by m.oby,m.obx
    ),'[]'::jsonb)
    into rows_json
    from meta m join dominant d using(obx,oby);

    return jsonb_build_object(
      'fields',rows_json,
      'step',eff_step,
      'approximate',true,
      'source','archive'
    );
  end if;

  -- Nahe Ansicht: echte Einzelzellen / kleine Buckets.
  with base as (
    select
      ef.x,ef.y,ef.discovered_by,ef.is_treasure,
      floor(ef.x::numeric/eff_step)::int bx,
      floor(ef.y::numeric/eff_step)::int by
    from public.explored_fields ef
    where ef.game_id=p_game_id
      and ef.x between x0 and x1
      and ef.y between y0 and y1
  ), per_player as (
    select bx,by,discovered_by,count(*)::bigint n
    from base
    group by bx,by,discovered_by
  ), dominant as (
    select distinct on(bx,by) bx,by,discovered_by,n
    from per_player
    order by bx,by,n desc,discovered_by
  ), meta as (
    select bx,by,bool_or(is_treasure) is_treasure,count(*)::bigint cell_count
    from base
    group by bx,by
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'x',m.bx*eff_step,
      'y',m.by*eff_step,
      'size',eff_step,
      'discovered_by',d.discovered_by,
      'is_treasure',m.is_treasure,
      'cell_count',m.cell_count
    )
    order by m.by,m.bx
  ),'[]'::jsonb)
  into rows_json
  from meta m join dominant d using(bx,by);

  return jsonb_build_object(
    'fields',rows_json,
    'step',eff_step,
    'approximate',eff_step>1,
    'source','live'
  );
end;
$$;
revoke all on function public.get_visible_fields_v617(uuid,int,int,int,int,int) from public;
grant execute on function public.get_visible_fields_v617(uuid,int,int,int,int,int) to authenticated;
