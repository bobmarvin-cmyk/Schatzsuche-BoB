-- SCHATZSUCHE ONLINE V6.20
-- Turnierstart, Gimmick-Sync, Maschinen-Stabilität, Bergungsvarianten.
-- Voraussetzung: V6.19 installiert. EINMAL ausführen.

alter table public.games add column if not exists start_at timestamptz;

create or replace function public.set_game_start_v620(p_game_id uuid,p_start_at timestamptz)
returns timestamptz
language plpgsql
security definer
set search_path=public
as $$
declare g public.games%rowtype; v_start timestamptz;
begin
 if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
 select * into g from public.games where id=p_game_id for update;
 if not found then raise exception 'Spiel nicht gefunden'; end if;
 if g.created_by<>auth.uid() then raise exception 'Nur der Ersteller darf den Start festlegen'; end if;
 if g.status<>'active' then raise exception 'Spiel ist nicht aktiv'; end if;
 v_start:=case when p_start_at is null or p_start_at<=now() then null else p_start_at end;
 update public.games set start_at=v_start where id=p_game_id;

 if v_start is not null then
   update public.game_players
   set moves_left=1,
       last_regen_at=v_start,
       machine_last_run_at=v_start
   where game_id=p_game_id;
 end if;

 return v_start;
end;
$$;
revoke all on function public.set_game_start_v620(uuid,timestamptz) from public;
grant execute on function public.set_game_start_v620(uuid,timestamptz) to authenticated;


create or replace function public.sync_prestart_player_v620()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare s timestamptz;
begin
  select start_at into s from public.games where id=new.game_id;
  if s is not null and s>now() then
    new.moves_left:=1;
    new.last_regen_at:=s;
    new.machine_last_run_at:=s;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_prestart_player_v620 on public.game_players;
create trigger sync_prestart_player_v620
before insert on public.game_players
for each row execute function public.sync_prestart_player_v620();


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
  -- Gimmick-Auswertung pro Spiel kurz serialisieren. Das hält Zähler und
  -- Ausschüttung auch bei mehreren gleichzeitigen Spielern konsistent.
  perform pg_advisory_xact_lock(hashtextextended('gimmick:'||p_game_id::text,0));

  select * into g from public.games where id=p_game_id;
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

create or replace function public.get_game_live_state_v616(
  p_game_id uuid,
  p_after_event_id bigint default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  g public.games%rowtype;
  ev jsonb;
  player_rows jsonb;
  winner_name text;
  winner_share int:=0;
  winner_moves bigint:=0;
begin
  if not exists(
    select 1 from public.game_players
    where game_id=p_game_id and user_id=auth.uid()
  ) then raise exception 'Nicht im Spiel'; end if;

  select * into g from public.games where id=p_game_id;
  if not found then return null; end if;

  if g.winner_id is not null then
    select p.display_name,gp.treasure_share_bps,gp.moves_used
    into winner_name,winner_share,winner_moves
    from public.profiles p
    left join public.game_players gp
      on gp.game_id=p_game_id and gp.user_id=p.id
    where p.id=g.winner_id;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'user_id',gp.user_id,
      'coins',gp.coins,
      'moves_left',gp.moves_left,
      'reveal_power',gp.reveal_power,
      'reward_multiplier',gp.reward_multiplier,
      'analysis_level',gp.analysis_level,
      'player_color',gp.player_color,
      'move_capacity_bonus',gp.move_capacity_bonus,
      'regen_reduction',gp.regen_reduction,
      'last_regen_at',gp.last_regen_at,
      'machine_last_run_at',gp.machine_last_run_at,
      'auto_focus_x',gp.auto_focus_x,
      'auto_focus_y',gp.auto_focus_y,
      'treasure_share_bps',gp.treasure_share_bps,
      'treasure_parts_found',gp.treasure_parts_found,
      'machine_ticks_used',gp.machine_ticks_used,
      'machine_mode',gp.machine_mode,
      'gimmick_reveal_bonus_pending',gp.gimmick_reveal_bonus_pending,
      'fields_revealed',gp.fields_revealed,
      'tech_count',coalesce((
        select count(*) from public.player_technologies pt
        where pt.game_id=gp.game_id and pt.user_id=gp.user_id
      ),0),
      'profiles',jsonb_build_object(
        'display_name',p.display_name,
        'avatar_path',p.avatar_path
      )
    )
    order by gp.joined_at
  ),'[]'::jsonb)
  into player_rows
  from public.game_players gp
  join public.profiles p on p.id=gp.user_id
  where gp.game_id=p_game_id;

  select coalesce(jsonb_agg(x order by (x->>'id')::bigint),'[]'::jsonb)
  into ev
  from (
    select jsonb_build_object(
      'id',ge.id,
      'event_type',ge.event_type,
      'message',ge.message,
      'details',ge.details,
      'created_at',ge.created_at
    ) x
    from public.game_events ge
    where ge.game_id=p_game_id
      and ge.id>coalesce(p_after_event_id,0)
    order by ge.id
    limit 20
  ) q;

  return jsonb_build_object(
    'explored_count',g.explored_count,
    'field_version',g.field_version,
    'status',g.status,
    'winner_id',g.winner_id,
    'winner_name',winner_name,
    'winner_share_bps',winner_share,
    'winner_moves_used',winner_moves,
    'winner_taler_gold_ug',g.winner_taler_gold_ug,
    'gimmicks_found_count',g.gimmicks_found_count,
    'gimmick_target_count',g.gimmick_target_count,
    'start_at',g.start_at,
    'players',player_rows,
    'events',ev
  );
end;
$$;
revoke all on function public.get_game_live_state_v616(uuid,bigint) from public;
grant execute on function public.get_game_live_state_v616(uuid,bigint) to authenticated;

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

  if g.game_type in ('pay','sponsor') and gold_won>0 then
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

create or replace function public.reveal_area_v620(p_game_id uuid,p_x int,p_y int)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare g public.games%rowtype;
begin
 select * into g from public.games where id=p_game_id;
 if not found then raise exception 'Spiel nicht gefunden'; end if;
 if g.start_at is not null and g.start_at>now() then
   raise exception 'Turnier startet erst in % Sekunden',
     greatest(1,ceil(extract(epoch from(g.start_at-now())))::int);
 end if;
 return public.reveal_area_v6151(p_game_id,p_x,p_y);
end;
$$;
revoke all on function public.reveal_area_v620(uuid,int,int) from public;
grant execute on function public.reveal_area_v620(uuid,int,int) to authenticated;

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
  where game_id=p_game_id and user_id=auth.uid()
  for update;

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

  -- V6.20: Mikro-Batching. Nominale Maschinenleistung bleibt erhalten,
  -- aber ein einzelner DB-Lauf verarbeitet höchstens 75 Felder.
  -- Hohe Leistung wird auf häufigere kurze Läufe verteilt.
  machine_total_power:=machine_power;
  machine_power:=least(machine_total_power,75);

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
  attempts:=least(220,greatest(120,machine_power*2));
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

  if g.game_type in ('pay','sponsor') and gold_won>0 then
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

create or replace function public.run_machines_game_v620(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare g public.games%rowtype; locked boolean; r jsonb;
begin
 select * into g from public.games where id=p_game_id;
 if not found or g.status<>'active' then
   return jsonb_build_object('opened',0,'active',false);
 end if;
 if g.start_at is not null and g.start_at>now() then
   return jsonb_build_object('opened',0,'active',true,'waiting_for_start',true,
     'seconds_to_start',greatest(1,ceil(extract(epoch from(g.start_at-now())))::int));
 end if;

 locked:=pg_try_advisory_xact_lock(hashtextextended('machine:'||p_game_id::text,0));
 if not locked then
   return jsonb_build_object('opened',0,'active',true,'busy',true,'reason','anderer Maschinenlauf aktiv');
 end if;

 perform set_config('app.reveal_source','machine',true);
 r:=public.run_machines_v613(p_game_id);
 if coalesce((r->>'game_over')::boolean,false) then
   perform public.emit_game_win_event_v6151(p_game_id);
 end if;
 return r;
end;
$$;
revoke all on function public.run_machines_game_v620(uuid) from public;
grant execute on function public.run_machines_game_v620(uuid) to authenticated;

alter table public.treasure_claims_v619
  add column if not exists challenge_type text not null default 'memory_forward',
  add column if not exists challenge_payload jsonb not null default '{}'::jsonb,
  add column if not exists started_at timestamptz;

update public.treasure_claims_v619
set challenge_payload=jsonb_build_object('display_code',challenge_code)
where challenge_payload='{}'::jsonb;

create or replace function public.intercept_treasure_claim_v619()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
 display_code text:='';
 answer_code text:='';
 ctype text;
 payload jsonb:='{}'::jsonb;
 i int;
 a int;
 b int;
 op text;
begin
 if old.found_by is null and new.found_by is not null
    and coalesce(current_setting('app.claim_finalize',true),'')<>'1' then

   case floor(random()*3)::int
     when 0 then ctype:='memory_forward';
     when 1 then ctype:='memory_reverse';
     else ctype:='math';
   end case;

   if ctype in ('memory_forward','memory_reverse') then
     for i in 1..6 loop
       display_code:=display_code||(1+floor(random()*4)::int)::text;
     end loop;
     answer_code:=case when ctype='memory_reverse' then reverse(display_code) else display_code end;
     payload:=jsonb_build_object('display_code',display_code);
   else
     a:=8+floor(random()*43)::int;
     b:=2+floor(random()*19)::int;
     if random()<0.5 then
       op:='+';
       answer_code:=(a+b)::text;
     else
       if b>a then i:=a;a:=b;b:=i; end if;
       op:='−';
       answer_code:=(a-b)::text;
     end if;
     payload:=jsonb_build_object('expression',a::text||' '||op||' '||b::text);
   end if;

   insert into public.treasure_claims_v619(
     game_id,treasure_id,user_id,challenge_code,challenge_type,challenge_payload,status,expires_at
   )
   values(old.game_id,old.id,new.found_by,answer_code,ctype,payload,'pending',now()+interval '5 minutes')
   on conflict do nothing;

   return null;
 end if;
 return new;
end;
$$;

create or replace function public.get_my_pending_claim_v620(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  c public.treasure_claims_v619%rowtype;
  gt public.gold_treasures%rowtype;
begin
  select * into c
  from public.treasure_claims_v619
  where game_id=p_game_id and user_id=auth.uid() and status='pending'
  order by created_at
  limit 1
  for update;

  if not found then return null; end if;

  if (c.started_at is not null and c.expires_at<now())
     or (c.started_at is null and c.created_at<now()-interval '5 minutes') then
    update public.treasure_claims_v619
    set status='expired',resolved_at=now()
    where id=c.id;

    perform public.relocate_treasure_v619(c.treasure_id,c.game_id);
    return null;
  end if;

  select * into gt from public.gold_treasures where id=c.treasure_id;

  return jsonb_build_object(
    'id',c.id,
    'treasure_no',gt.treasure_no,
    'challenge_type',c.challenge_type,
    'started_at',c.started_at,
    'created_at',c.created_at,
    'expires_at',c.expires_at,
    'expression',case when c.challenge_type='math' then c.challenge_payload->>'expression' else null end,
    'share_bps',gt.share_bps,
    'amount_ug',gt.amount_ug
  );
end;
$$;
revoke all on function public.get_my_pending_claim_v620(uuid) from public;
grant execute on function public.get_my_pending_claim_v620(uuid) to authenticated;

create or replace function public.start_treasure_claim_v620(p_claim_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare c public.treasure_claims_v619%rowtype;
begin
 select * into c from public.treasure_claims_v619
 where id=p_claim_id and user_id=auth.uid()
 for update;
 if not found or c.status<>'pending' then raise exception 'Bergungsprüfung nicht mehr aktiv'; end if;
 if c.started_at is not null then raise exception 'Bergungsprüfung wurde bereits gestartet'; end if;

 update public.treasure_claims_v619
 set started_at=now(),expires_at=now()+interval '90 seconds'
 where id=c.id
 returning * into c;

 return jsonb_build_object(
   'id',c.id,'challenge_type',c.challenge_type,
   'display_code',case when c.challenge_type in ('memory_forward','memory_reverse') then c.challenge_payload->>'display_code' else null end,
   'expression',case when c.challenge_type='math' then c.challenge_payload->>'expression' else null end,
   'expires_at',c.expires_at
 );
end;
$$;
revoke all on function public.start_treasure_claim_v620(uuid) from public;
grant execute on function public.start_treasure_claim_v620(uuid) to authenticated;

create or replace function public.resolve_treasure_claim_v620(p_claim_id uuid,p_answer text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
 c public.treasure_claims_v619%rowtype;
 gt public.gold_treasures%rowtype;
 g public.games%rowtype;
 remaining int;
 winner_id_v uuid;
 winner_name_v text;
 winner_moves_v bigint;
 winner_share_v int;
 player_count_v int;
 bonus bigint:=0;
begin
 if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;

 select * into c from public.treasure_claims_v619
 where id=p_claim_id and user_id=auth.uid()
 for update;
 if not found or c.status<>'pending' then raise exception 'Bergungsprüfung nicht mehr aktiv'; end if;
 if c.started_at is null then raise exception 'Bergungsprüfung wurde noch nicht gestartet'; end if;

 select * into gt from public.gold_treasures where id=c.treasure_id for update;
 select * into g from public.games where id=c.game_id for update;

 if now()>c.expires_at then
   update public.treasure_claims_v619 set status='expired',resolved_at=now() where id=c.id;
   perform public.relocate_treasure_v619(gt.id,c.game_id);
   return jsonb_build_object('passed',false,'reason','expired',
     'message','⏱️ Bergung zu spät – der Schatz wurde neu versteckt.');
 end if;

 if coalesce(trim(p_answer),'')<>c.challenge_code then
   update public.treasure_claims_v619 set status='failed',resolved_at=now() where id=c.id;
   perform public.relocate_treasure_v619(gt.id,c.game_id);
   return jsonb_build_object('passed',false,'reason','wrong',
     'message','❌ Bergung misslungen – der Schatz wurde neu versteckt.');
 end if;

 update public.treasure_claims_v619 set status='passed',resolved_at=now() where id=c.id;
 perform set_config('app.claim_finalize','1',true);
 update public.gold_treasures set found_by=auth.uid(),found_at=now()
 where id=gt.id and found_by is null;

 update public.game_players
 set treasure_share_bps=treasure_share_bps+gt.share_bps,
     treasure_parts_found=treasure_parts_found+1,
     last_treasure_found_at=now()
 where game_id=c.game_id and user_id=auth.uid();

 if gt.amount_ug>0 then
   insert into public.gold_wallets(user_id) values(auth.uid()) on conflict(user_id) do nothing;
   update public.gold_wallets set balance_ug=balance_ug+gt.amount_ug,updated_at=now()
   where user_id=auth.uid();
   update public.profiles set gold_found_ug=gold_found_ug+gt.amount_ug where id=auth.uid();
   insert into public.gold_transactions(user_id,game_id,amount_ug,transaction_type,note)
   values(auth.uid(),c.game_id,gt.amount_ug,
     case when g.game_type='sponsor' then 'sponsor_treasure_reward' else 'treasure_reward' end,
     'Schatz nach bestandener Bergungsprüfung');
   update public.games set gold_prize_pool_ug=greatest(0,gold_prize_pool_ug-gt.amount_ug)
   where id=c.game_id;
 end if;

 select count(*)::int into remaining
 from public.gold_treasures
 where game_id=c.game_id and found_by is null and forfeited_at is null;

 if remaining=0 then
   select gp.user_id,p.display_name,gp.moves_used,gp.treasure_share_bps
   into winner_id_v,winner_name_v,winner_moves_v,winner_share_v
   from public.game_players gp
   join public.profiles p on p.id=gp.user_id
   where gp.game_id=c.game_id
   order by gp.treasure_share_bps desc,gp.last_treasure_found_at asc nulls last,
            gp.moves_used asc,gp.joined_at asc
   limit 1;

   update public.games
   set status='finished',winner_id=winner_id_v,
       closed_at=coalesce(closed_at,now()),close_reason=coalesce(close_reason,'completed')
   where id=c.game_id and status='active';

   select count(*) into player_count_v from public.game_players where game_id=c.game_id;
   if player_count_v>=2 then update public.profiles set wins=wins+1 where id=winner_id_v; end if;

   bonus:=public.award_winner_taler_gold_v613(c.game_id);
   perform public.emit_game_win_event_v6151(c.game_id);
 end if;

 return jsonb_build_object(
   'passed',true,'message','✅ Bergung geschafft – Schatz gesichert!',
   'share_bps',gt.share_bps,'amount_ug',gt.amount_ug,'treasure_no',gt.treasure_no,
   'remaining_treasures',remaining,'game_over',remaining=0,'winner_id',winner_id_v,
   'winner_name',winner_name_v,'winner_moves_used',coalesce(winner_moves_v,0),
   'winner_share_bps',coalesce(winner_share_v,0),'winner_taler_gold_ug',bonus
 );
end;
$$;
revoke all on function public.resolve_treasure_claim_v620(uuid,text) from public;
grant execute on function public.resolve_treasure_claim_v620(uuid,text) to authenticated;

create index if not exists explored_fields_game_yx_v620
  on public.explored_fields(game_id,y,x);


-- V6.20 challenge flow is authoritative; old V6.19 endpoints are disabled.
revoke all on function public.get_my_pending_claim_v619(uuid) from authenticated;
revoke all on function public.resolve_treasure_claim_v619(uuid,text) from authenticated;
