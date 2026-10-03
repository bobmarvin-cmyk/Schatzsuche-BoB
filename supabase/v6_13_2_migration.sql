-- SCHATZSUCHE ONLINE V6.13.2
-- Hotfix: Maschinen DISTINCT/ORDER BY + adaptive manuelle Rand-Suche.
-- Nach V6.13/V6.13.1 EINMAL ausführen.

-- Liefert die n-te Position einer quadratischen Spirale um (0,0).
-- So können wir weit nach außen suchen, ohne ein riesiges Quadrat zu materialisieren.
create or replace function public.spiral_offset_v6132(p_n int)
returns table(dx int,dy int)
language plpgsql
immutable
strict
as $$
declare
  k int;
  side int;
  maxn int;
  d int;
begin
  if p_n<=0 then
    dx:=0; dy:=0; return next; return;
  end if;

  k:=ceil((sqrt((p_n+1)::numeric)-1)/2)::int;
  side:=2*k;
  maxn:=(2*k+1)*(2*k+1)-1;
  d:=maxn-p_n;

  if d<side then
    dx:=k-d; dy:=-k;
  elsif d<2*side then
    dx:=-k; dy:=-k+(d-side);
  elsif d<3*side then
    dx:=-k+(d-2*side); dy:=k;
  else
    dx:=k; dy:=k-(d-3*side);
  end if;

  return next;
end;
$$;


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

  -- V6.13.2:
  -- Nicht mehr das komplette Quadrat um den Klick erzeugen.
  -- Drei begrenzte Spiralen suchen nah, mittel und weit nach außen.
  -- Dadurch überspringt ein großer Zug bereits vollständig erforschte Innenflächen.
  search_radius:=least(
    20000,
    greatest(500,gp.reveal_power*4)
  );

  with seq as (
    select n,scale
    from (values (1),(4),(16)) v(scale)
    cross join lateral generate_series(0,search_radius-1) gs(n)
  ), offsets as (
    select
      s.n,s.scale,
      o.dx*s.scale as dx,
      o.dy*s.scale as dy
    from seq s
    cross join lateral public.spiral_offset_v6132(s.n) o
  ), raw_candidates as (
    select
      p_x+dx as x,
      p_y+dy as y,
      greatest(abs(dx),abs(dy)) as dist
    from offsets
    where p_x+dx between 0 and g.width-1
      and p_y+dy between 0 and g.height-1
  ), dedup as (
    select distinct on (x,y) x,y,dist
    from raw_candidates
    order by x,y,dist
  ), candidates as (
    select d.x,d.y
    from dedup d
    where not exists(
      select 1
      from public.explored_fields ef
      where ef.game_id=p_game_id
        and ef.x=d.x
        and ef.y=d.y
    )
    order by d.dist,d.y,d.x
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
    ), dedup as (
      select distinct on (r.x,r.y)
        r.x,r.y,
        greatest(abs(r.x-gp.auto_focus_x),abs(r.y-gp.auto_focus_y)) as dist
      from raw_candidates r
      where not exists(
        select 1 from public.explored_fields ef
        where ef.game_id=p_game_id and ef.x=r.x and ef.y=r.y
      )
      order by r.x,r.y,
        greatest(abs(r.x-gp.auto_focus_x),abs(r.y-gp.auto_focus_y))
    ), candidates as (
      select d.x,d.y
      from dedup d
      order by d.dist,d.y,d.x
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
      'machine_power',machine_power,'gimmicks',gimmicks,
      'part_found',parts_gained>0,'parts_gained',parts_gained,
      'share_gained_bps',share_gained,'gold_won_ug',gold_won
    );
  end if;

  return jsonb_build_object(
    'message',case when opened>0 then '⚙️ Maschinen: '||opened||' Felder automatisch aufgedeckt.'
      else '⚙️ In diesem Takt wurden keine freien Maschinenfelder gefunden.' end,
    'game_over',false,'won',false,'opened',opened,
    'remaining_treasures',remaining_treasures,'machine_power',machine_power,
    'seconds_to_next',interval_s,'gimmicks',gimmicks,
    'part_found',parts_gained>0,'parts_gained',parts_gained,
    'share_gained_bps',share_gained,'gold_won_ug',gold_won
  );
end;
$$;
revoke all on function public.run_machines_v613(uuid) from public;
grant execute on function public.run_machines_v613(uuid) to authenticated;
