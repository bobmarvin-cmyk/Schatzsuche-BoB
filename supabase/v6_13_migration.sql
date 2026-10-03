-- SCHATZSUCHE ONLINE V6.13
-- Goldbilanz, Schatzteil-Feedback, Reichtumsranking, Gold-Endabrechnung,
-- Satellitenmodus-Support, Game-Switcher und Gewinner-Taler->Gold.
-- Nach V6.12 EINMAL vollständig im Supabase SQL Editor ausführen.

-- =========================================================
-- 1) GOLD-ÖKONOMIE / GEWINNERUMWANDLUNG
-- =========================================================

alter table public.platform_settings
  add column if not exists winner_taler_gold_ug_per_1000 bigint not null default 10;

alter table public.games
  add column if not exists winner_taler_gold_ug bigint not null default 0,
  add column if not exists winner_taler_gold_awarded boolean not null default false;

create or replace function public.admin_set_winner_gold_factor_v613(p_ug_per_1000 bigint)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_admin_v67() then raise exception 'Keine Admin-Berechtigung'; end if;
  if p_ug_per_1000<0 or p_ug_per_1000>1000000 then
    raise exception 'Ungültiger Gewinner-Goldfaktor';
  end if;

  update public.platform_settings
  set winner_taler_gold_ug_per_1000=p_ug_per_1000,
      updated_at=now()
  where id=1;
end;
$$;
revoke all on function public.admin_set_winner_gold_factor_v613(bigint) from public;
grant execute on function public.admin_set_winner_gold_factor_v613(bigint) to authenticated;

create or replace function public.award_winner_taler_gold_v613(p_game_id uuid)
returns bigint
language plpgsql
security definer
set search_path=public
as $$
declare
  g public.games%rowtype;
  gp public.game_players%rowtype;
  s public.platform_settings%rowtype;
  amount bigint:=0;
  player_count_v int:=0;
begin
  select * into g from public.games where id=p_game_id for update;
  if not found or g.status='active' or g.winner_id is null then return 0; end if;

  if g.winner_taler_gold_awarded then
    return g.winner_taler_gold_ug;
  end if;

  select count(*)::int into player_count_v
  from public.game_players
  where game_id=p_game_id;

  if player_count_v<2 then
    update public.games
    set winner_taler_gold_ug=0,
        winner_taler_gold_awarded=true
    where id=p_game_id;
    return 0;
  end if;

  select * into gp
  from public.game_players
  where game_id=p_game_id and user_id=g.winner_id;

  select * into s from public.platform_settings where id=1;

  amount:=greatest(
    0,
    floor(coalesce(gp.coins,0)::numeric*s.winner_taler_gold_ug_per_1000/1000.0)::bigint
  );

  insert into public.gold_wallets(user_id)
  values(g.winner_id)
  on conflict(user_id) do nothing;

  if amount>0 then
    update public.gold_wallets
    set balance_ug=balance_ug+amount,
        updated_at=now()
    where user_id=g.winner_id;

    update public.profiles
    set gold_found_ug=gold_found_ug+amount
    where id=g.winner_id;

    insert into public.gold_transactions(
      user_id,game_id,amount_ug,transaction_type,note
    )
    values(
      g.winner_id,p_game_id,amount,
      'winner_taler_conversion',
      'Gewinner-Taler in Test-Gold umgewandelt'
    );
  end if;

  update public.games
  set winner_taler_gold_ug=amount,
      winner_taler_gold_awarded=true
  where id=p_game_id;

  perform public.snapshot_game_archive_v683(p_game_id);

  return amount;
end;
$$;
revoke all on function public.award_winner_taler_gold_v613(uuid) from public;
grant execute on function public.award_winner_taler_gold_v613(uuid) to authenticated;

-- Admin-Bilanz.
create or replace function public.admin_gold_overview_v613()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  s public.platform_settings%rowtype;
  wallet_total bigint:=0;
  treasure_paid bigint:=0;
  community_paid bigint:=0;
  winner_paid bigint:=0;
  test_grants bigint:=0;
begin
  if not public.is_admin_v67() then raise exception 'Keine Admin-Berechtigung'; end if;
  select * into s from public.platform_settings where id=1;

  select coalesce(sum(balance_ug),0)::bigint into wallet_total
  from public.gold_wallets;

  select coalesce(sum(amount_ug),0)::bigint into treasure_paid
  from public.gold_transactions
  where transaction_type='treasure_reward' and amount_ug>0;

  select coalesce(sum(amount_ug),0)::bigint into community_paid
  from public.gold_transactions
  where transaction_type='community_dividend' and amount_ug>0;

  select coalesce(sum(amount_ug),0)::bigint into winner_paid
  from public.gold_transactions
  where transaction_type='winner_taler_conversion' and amount_ug>0;

  select coalesce(sum(amount_ug),0)::bigint into test_grants
  from public.gold_transactions
  where transaction_type='test_grant' and amount_ug>0;

  return jsonb_build_object(
    'wallet_total_ug',wallet_total,
    'treasure_paid_ug',treasure_paid,
    'community_paid_ug',community_paid,
    'winner_conversion_paid_ug',winner_paid,
    'test_grants_ug',test_grants,
    'community_reserve_ug',s.community_reserve_ug,
    'platform_absorbed_ug',s.platform_revenue_ug,
    'tracked_total_ug',wallet_total+s.community_reserve_ug+s.platform_revenue_ug
  );
end;
$$;
revoke all on function public.admin_gold_overview_v613() from public;
grant execute on function public.admin_gold_overview_v613() to authenticated;

-- =========================================================
-- 2) REICHTUM-BESTENLISTE
-- =========================================================

create or replace function public.leaderboard_v65(p_metric text,p_limit int default 50)
returns table(user_id uuid,display_name text,metric_value bigint)
language plpgsql security definer set search_path=public as $$
begin
 p_limit:=least(greatest(p_limit,1),100);

 if p_metric='wins' then
  return query
  select p.id,p.display_name,p.wins::bigint
  from public.profiles p
  order by p.wins desc,p.total_fields_revealed desc
  limit p_limit;

 elsif p_metric='fields' then
  return query
  select p.id,p.display_name,p.total_fields_revealed::bigint
  from public.profiles p
  order by p.total_fields_revealed desc
  limit p_limit;

 elsif p_metric='gold' then
  return query
  select p.id,p.display_name,p.gold_found_ug::bigint
  from public.profiles p
  order by p.gold_found_ug desc
  limit p_limit;

 elsif p_metric='wealth' then
  return query
  select p.id,p.display_name,coalesce(w.balance_ug,0)::bigint
  from public.profiles p
  left join public.gold_wallets w on w.user_id=p.id
  order by coalesce(w.balance_ug,0) desc,p.display_name
  limit p_limit;

 elsif p_metric='games' then
  return query
  select p.id,p.display_name,p.total_games::bigint
  from public.profiles p
  order by p.total_games desc
  limit p_limit;

 else
  raise exception 'Unbekannte Bestenliste';
 end if;
end;
$$;

-- =========================================================
-- 3) SCHNELL ZWISCHEN EIGENEN AKTIVEN SPIELEN WECHSELN
-- =========================================================

create or replace function public.my_active_games_v613()
returns table(game_id uuid,name text,last_activity_at timestamptz)
language sql
stable
security definer
set search_path=public
as $$
  select g.id,g.name,g.last_activity_at
  from public.game_players gp
  join public.games g on g.id=gp.game_id
  where gp.user_id=auth.uid()
    and g.status='active'
  order by g.last_activity_at desc nulls last,g.created_at desc;
$$;
revoke all on function public.my_active_games_v613() from public;
grant execute on function public.my_active_games_v613() to authenticated;

-- =========================================================
-- 4) MANUELLER SPIELABSCHLUSS + GEWINNER-GOLD
-- =========================================================

create or replace function public.reveal_area_v613(p_game_id uuid,p_x int,p_y int)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  r jsonb;
  bonus bigint:=0;
begin
  r:=public.reveal_area_v612(p_game_id,p_x,p_y);

  if coalesce((r->>'game_over')::boolean,false) then
    bonus:=public.award_winner_taler_gold_v613(p_game_id);
    r:=r||jsonb_build_object('winner_taler_gold_ug',bonus);
  end if;

  return r;
end;
$$;
revoke all on function public.reveal_area_v613(uuid,int,int) from public;
grant execute on function public.reveal_area_v613(uuid,int,int) to authenticated;

-- =========================================================
-- 5) MASCHINEN-FOKUS: WÄCHST MIT DER ZEIT WEITER
-- =========================================================

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
    ), candidates as (
      select distinct r.x,r.y
      from raw_candidates r
      where not exists(
        select 1 from public.explored_fields ef
        where ef.game_id=p_game_id and ef.x=r.x and ef.y=r.y
      )
      order by
        greatest(abs(r.x-gp.auto_focus_x),abs(r.y-gp.auto_focus_y)),
        r.y,r.x
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


-- Nach dem Maschinenabschluss Gewinner-Taler ebenfalls umwandeln.
create or replace function public.run_machines_game_v613(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  r jsonb;
  bonus bigint:=0;
begin
  r:=public.run_machines_v613(p_game_id);

  if coalesce((r->>'game_over')::boolean,false) then
    bonus:=public.award_winner_taler_gold_v613(p_game_id);
    r:=r||jsonb_build_object('winner_taler_gold_ug',bonus);
  end if;

  return r;
end;
$$;
revoke all on function public.run_machines_game_v613(uuid) from public;
grant execute on function public.run_machines_game_v613(uuid) to authenticated;

-- =========================================================
-- 6) ARCHIV: COMMUNITY + GEWINNERBONUS
-- =========================================================

alter table public.game_archive
  add column if not exists community_distributed_ug bigint not null default 0,
  add column if not exists community_recipient_count int not null default 0,
  add column if not exists winner_taler_gold_ug bigint not null default 0;

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
  community_total bigint:=0;
  community_recipients int:=0;
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

  select
    coalesce(sum(amount_ug),0)::bigint,
    count(distinct user_id)::int
  into community_total,community_recipients
  from public.gold_transactions
  where game_id=p_game_id
    and transaction_type='community_dividend'
    and amount_ug>0;

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
      'community_received_ug',coalesce((
        select sum(tx.amount_ug) from public.gold_transactions tx
        where tx.game_id=p_game_id and tx.user_id=gp.user_id
          and tx.transaction_type='community_dividend' and tx.amount_ug>0
      ),0),
      'winner_conversion_ug',case when gp.user_id=g.winner_id then g.winner_taler_gold_ug else 0 end,
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
    player_count,total_moves,total_fields,players,archived_at,
    community_distributed_ug,community_recipient_count,winner_taler_gold_ug
  )
  values(
    g.id,g.name,g.created_at,coalesce(g.closed_at,now()),g.close_reason,
    g.is_private,g.game_type,g.width,g.height,g.center_lat,g.center_lon,
    g.center_label,g.cell_size_m,g.archive_step,
    win_id,win_name,win_moves,win_share,pc,total_moves_v,
    coalesce(g.explored_count,0),players_json,now(),
    community_total,community_recipients,g.winner_taler_gold_ug
  )
  on conflict(game_id) do update set
    name=excluded.name,closed_at=excluded.closed_at,close_reason=excluded.close_reason,
    winner_user_id=excluded.winner_user_id,winner_name=excluded.winner_name,
    winner_moves_used=excluded.winner_moves_used,winner_share_bps=excluded.winner_share_bps,
    player_count=excluded.player_count,total_moves=excluded.total_moves,
    total_fields=excluded.total_fields,players=excluded.players,archived_at=now(),
    community_distributed_ug=excluded.community_distributed_ug,
    community_recipient_count=excluded.community_recipient_count,
    winner_taler_gold_ug=excluded.winner_taler_gold_ug;
end;
$$;

-- Bestehende Archive nur um die neuen Verteilungsfelder ergänzen.
-- Gewinner-Taler->Gold gilt bewusst erst für Spielabschlüsse ab V6.13.
do $$
declare r record;
begin
  for r in select id from public.games where status<>'active' loop
    perform public.snapshot_game_archive_v683(r.id);
  end loop;
end $$;
