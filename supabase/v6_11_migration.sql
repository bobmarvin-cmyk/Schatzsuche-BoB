-- SCHATZSUCHE ONLINE V6.11
-- Paygame-Safe-Update-Fix, Maschinenmodi/Timeout-Fix, Karten-Gimmicks
-- Nach V6.10 EINMAL vollständig im Supabase SQL Editor ausführen.

-- =========================================================
-- 1) PAYGAME FIX: SAFE UPDATE
-- =========================================================

create or replace function public.distribute_community_gold_v65(
  p_amount_ug bigint,
  p_game_id uuid
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  cnt bigint;
  per_user bigint;
  distributed bigint;
begin
  if p_amount_ug<=0 then return; end if;

  select count(*) into cnt from public.gold_wallets;
  if cnt<=0 then
    update public.platform_settings
    set community_reserve_ug=community_reserve_ug+p_amount_ug
    where id=1;
    return;
  end if;

  per_user:=floor(p_amount_ug::numeric/cnt)::bigint;
  if per_user<=0 then
    update public.platform_settings
    set community_reserve_ug=community_reserve_ug+p_amount_ug
    where id=1;
    return;
  end if;

  -- Explizite WHERE-Bedingung für Supabase/pg-safeupdate.
  update public.gold_wallets
  set balance_ug=balance_ug+per_user,
      updated_at=now()
  where user_id is not null;

  insert into public.gold_transactions(
    user_id,game_id,amount_ug,transaction_type,note
  )
  select
    user_id,p_game_id,per_user,
    'community_dividend','Community-Anteil aus Paygame'
  from public.gold_wallets
  where user_id is not null;

  distributed:=per_user*cnt;

  update public.platform_settings
  set community_reserve_ug=
      community_reserve_ug+(p_amount_ug-distributed)
  where id=1;
end;
$$;

-- =========================================================
-- 2) GIMMICK-MASTERWERTE
-- =========================================================

alter table public.platform_settings
  add column if not exists min_gimmick_percent numeric(5,2) not null default 0,
  add column if not exists max_gimmick_percent numeric(5,2) not null default 5,
  add column if not exists default_gimmick_percent numeric(5,2) not null default 1,
  add column if not exists gimmick_taler_bonus numeric(12,2) not null default 5,
  add column if not exists gimmick_move_bonus int not null default 1,
  add column if not exists gimmick_reveal_bonus int not null default 25;

alter table public.games
  add column if not exists gimmick_percent numeric(5,2) not null default 1;

alter table public.game_players
  add column if not exists gimmick_reveal_bonus_pending int not null default 0;

create or replace function public.admin_set_gimmick_settings_v611(
  p_min numeric,
  p_max numeric,
  p_default numeric,
  p_taler_bonus numeric,
  p_move_bonus int,
  p_reveal_bonus int
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_admin_v67() then
    raise exception 'Keine Admin-Berechtigung';
  end if;

  if p_min<0 or p_max>25 or p_max<p_min then
    raise exception 'Gimmick-Grenzen müssen zwischen 0 und 25 Prozent liegen';
  end if;

  if p_default<p_min or p_default>p_max then
    raise exception 'Standard-Gimmickwert muss innerhalb der Grenzen liegen';
  end if;

  if p_taler_bonus<0 or p_move_bonus<0 or p_reveal_bonus<0 then
    raise exception 'Gimmick-Boni dürfen nicht negativ sein';
  end if;

  update public.platform_settings
  set min_gimmick_percent=p_min,
      max_gimmick_percent=p_max,
      default_gimmick_percent=p_default,
      gimmick_taler_bonus=p_taler_bonus,
      gimmick_move_bonus=p_move_bonus,
      gimmick_reveal_bonus=p_reveal_bonus,
      updated_at=now()
  where id=1;
end;
$$;

revoke all on function public.admin_set_gimmick_settings_v611(
  numeric,numeric,numeric,numeric,int,int
) from public;

grant execute on function public.admin_set_gimmick_settings_v611(
  numeric,numeric,numeric,numeric,int,int
) to authenticated;

-- Gimmicks werden beim ERSTEN Aufdecken neuer Felder serverseitig ausgelost.
-- Da explored_fields jedes Feld nur einmal zulässt, kann ein Feld auch nur einmal triggern.
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
  taler_total numeric:=0;
  move_total int:=0;
  scanner_total int:=0;
  cap int;
begin
  if p_opened<=0 then
    return jsonb_build_object('total',0,'source',p_source);
  end if;

  select * into g from public.games where id=p_game_id;
  select * into s from public.platform_settings where id=1;

  if g.gimmick_percent<=0 then
    return jsonb_build_object('total',0,'source',p_source);
  end if;

  -- Für jedes neu aufgedeckte Feld genau eine Chance.
  -- Effektarten werden gleichmäßig auf drei Typen verteilt.
  with rolls as (
    select floor(random()*3)::int as kind
    from generate_series(1,p_opened)
    where random()*100 < g.gimmick_percent
  )
  select
    count(*) filter(where kind=0)::int,
    count(*) filter(where kind=1)::int,
    count(*) filter(where kind=2)::int,
    count(*)::int
  into taler_hits,move_hits,scanner_hits,total_hits
  from rolls;

  if total_hits<=0 then
    return jsonb_build_object('total',0,'source',p_source);
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
      gimmick_reveal_bonus_pending=
        gimmick_reveal_bonus_pending+scanner_total
  where game_id=p_game_id and user_id=p_user_id;

  return jsonb_build_object(
    'total',total_hits,
    'taler_hits',taler_hits,
    'move_hits',move_hits,
    'scanner_hits',scanner_hits,
    'taler_bonus',taler_total,
    'move_bonus',move_total,
    'reveal_bonus',scanner_total,
    'source',p_source
  );
end;
$$;

-- =========================================================
-- 3) SPIELERSTELLUNG MIT GIMMICK-PROZENT
-- =========================================================

create or replace function public.create_game_v611(
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
  s public.platform_settings%rowtype;
begin
  select * into s from public.platform_settings where id=1;

  if p_gimmick_percent<s.min_gimmick_percent
     or p_gimmick_percent>s.max_gimmick_percent then
    raise exception 'Gimmick-Anteil liegt außerhalb der Servergrenzen';
  end if;

  gid:=public.create_game_v610(
    p_name,p_field_count,p_cell_size_m,p_max_players,p_location_mode,
    p_center_lat,p_center_lon,p_center_label,p_regen_seconds,p_max_stored_moves,
    p_is_private,p_password,p_game_type,p_entry_gold_ug,p_treasure_count
  );

  update public.games
  set gimmick_percent=p_gimmick_percent
  where id=gid;

  return gid;
end;
$$;

revoke all on function public.create_game_v611(
  text,bigint,numeric,int,text,numeric,numeric,text,int,int,
  boolean,text,text,bigint,int,numeric
) from public;

grant execute on function public.create_game_v611(
  text,bigint,numeric,int,text,numeric,numeric,text,int,int,
  boolean,text,text,bigint,int,numeric
) to authenticated;

-- =========================================================
-- 4) MANUELLER ZUG: SCANNER-GIMMICK + GIMMICK-AUSWERTUNG
-- =========================================================

create or replace function public.reveal_area_v611(
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
  pending_bonus int:=0;
  result jsonb;
  gimmicks jsonb;
  opened int:=0;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;

  select gimmick_reveal_bonus_pending
  into pending_bonus
  from public.game_players
  where game_id=p_game_id and user_id=auth.uid()
  for update;

  if not found then raise exception 'Nicht im Spiel'; end if;

  -- Der Scannerbonus gilt genau für diesen einen manuellen Zug.
  if pending_bonus>0 then
    update public.game_players
    set reveal_power=reveal_power+pending_bonus,
        gimmick_reveal_bonus_pending=0
    where game_id=p_game_id and user_id=auth.uid();
  end if;

  result:=public.reveal_area_v610(p_game_id,p_x,p_y);

  -- Nach erfolgreichem Zug den temporären Bonus wieder entfernen.
  if pending_bonus>0 then
    update public.game_players
    set reveal_power=greatest(1,reveal_power-pending_bonus)
    where game_id=p_game_id and user_id=auth.uid();
  end if;

  opened:=coalesce((result->>'opened')::int,0);
  gimmicks:=public.apply_gimmicks_v611(
    p_game_id,auth.uid(),opened,'manual'
  );

  return result || jsonb_build_object('gimmicks',gimmicks);
end;
$$;

revoke all on function public.reveal_area_v611(uuid,int,int) from public;
grant execute on function public.reveal_area_v611(uuid,int,int) to authenticated;

-- =========================================================
-- 5) MASCHINENMODUS
-- =========================================================

alter table public.game_players
  add column if not exists machine_mode text not null default 'focus';

create or replace function public.set_machine_mode_v611(
  p_game_id uuid,
  p_mode text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if p_mode not in ('focus','random') then
    raise exception 'Ungültiger Maschinenmodus';
  end if;

  update public.game_players
  set machine_mode=p_mode,
      machine_last_run_at=now(),
      machine_presence_at=now()
  where game_id=p_game_id and user_id=auth.uid();

  if not found then raise exception 'Nicht im Spiel'; end if;
end;
$$;

revoke all on function public.set_machine_mode_v611(uuid,text) from public;
grant execute on function public.set_machine_mode_v611(uuid,text) to authenticated;

-- =========================================================
-- 6) MASCHINEN: BEGRENZTE KANDIDATEN, KEIN STATEMENT TIMEOUT
-- =========================================================

create or replace function public.run_machines_v611(p_game_id uuid)
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

  if gp.machine_mode='focus'
     and (gp.auto_focus_x is null or gp.auto_focus_y is null) then
    return jsonb_build_object(
      'opened',0,'active',true,
      'reason','Noch kein manuelles Suchgebiet gewählt'
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
      'opened',0,'active',true,'machine_power',machine_power,
      'seconds_to_next',greatest(0,ceil(interval_s-elapsed)::int)
    );
  end if;

  -- Harte Obergrenze verhindert explodierende generate_series/Sortierungen.
  attempts:=least(
    12000,
    greatest(500,machine_power*8,gp.reveal_power*8)
  );
  side_len:=ceil(sqrt(attempts::numeric))::int;

  rew:=s.exploration_reward*gp.reward_multiplier*s.machine_reward_factor;

  if gp.machine_mode='random' then
    with raw_candidates as (
      select
        floor(random()*g.width)::int as x,
        floor(random()*g.height)::int as y
      from generate_series(1,attempts)
    ), candidates as (
      select distinct r.x,r.y
      from raw_candidates r
      where not exists(
        select 1
        from public.explored_fields ef
        where ef.game_id=p_game_id and ef.x=r.x and ef.y=r.y
      )
      limit machine_power
    ), tagged as (
      select c.x,c.y,(gt.id is not null) as is_treasure
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
      set found_by=auth.uid(),found_at=now()
      from ins i
      where i.is_treasure
        and gt.game_id=p_game_id
        and gt.x=i.x and gt.y=i.y
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

  else
    -- FOCUS: begrenztes Quadrat um den letzten manuellen Klick.
    -- Keine riesige Radius-Suche mehr.
    with numbered as (
      select i-1 as n
      from generate_series(1,attempts) i
    ), raw_candidates as (
      select
        gp.auto_focus_x +
          ((n % side_len)::int - floor(side_len/2.0)::int) as x,
        gp.auto_focus_y +
          ((n / side_len)::int - floor(side_len/2.0)::int) as y
      from numbered
    ), candidates as (
      select r.x,r.y
      from raw_candidates r
      where r.x between 0 and g.width-1
        and r.y between 0 and g.height-1
        and not exists(
          select 1
          from public.explored_fields ef
          where ef.game_id=p_game_id and ef.x=r.x and ef.y=r.y
        )
      order by
        greatest(abs(r.x-gp.auto_focus_x),abs(r.y-gp.auto_focus_y)),
        r.y,r.x
      limit machine_power
    ), tagged as (
      select c.x,c.y,(gt.id is not null) as is_treasure
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
      set found_by=auth.uid(),found_at=now()
      from ins i
      where i.is_treasure
        and gt.game_id=p_game_id
        and gt.x=i.x and gt.y=i.y
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
  end if;

  -- Timer wird IMMER sauber neu gestartet.
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
      'treasure_reward','Schatzteil durch Maschine gefunden'
    );

    update public.games
    set gold_prize_pool_ug=greatest(0,gold_prize_pool_ug-gold_won)
    where id=p_game_id;
  end if;

  gimmicks:=public.apply_gimmicks_v611(
    p_game_id,auth.uid(),opened,'machine'
  );

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
      update public.profiles
      set wins=wins+1
      where id=winner_id_v;
    end if;

    return jsonb_build_object(
      'message',
        case when auth.uid()=winner_id_v
          then '⚙️🏆 Alle Schatzteile gefunden – du gewinnst!'
          else '⚙️ Alle Schatzteile gefunden. '||winner_name_v||' gewinnt.'
        end,
      'game_over',true,
      'won',auth.uid()=winner_id_v,
      'opened',opened,
      'remaining_treasures',0,
      'winner_id',winner_id_v,
      'winner_name',winner_name_v,
      'winner_moves_used',winner_moves_v,
      'winner_share_bps',winner_share_v,
      'machine_power',machine_power,
      'gimmicks',gimmicks
    );
  end if;

  return jsonb_build_object(
    'message',
      case
        when opened>0 then
          '⚙️ Maschinen: '||opened||' Felder automatisch aufgedeckt.'
        when gp.machine_mode='random' then
          '⚙️ Zufallssuche fand in diesem Takt keine freien Felder.'
        else
          '⚙️ Im aktuellen Fokus sind keine freien Felder erreichbar – setze einen neuen Fokus oder wähle Zufallssuche.'
      end ||
      case when parts_gained>0
        then ' 🧩 +'||to_char(share_gained/100.0,'FM990.00')||'% Schatzanteil.'
        else '' end,
    'game_over',false,
    'won',false,
    'opened',opened,
    'remaining_treasures',remaining_treasures,
    'machine_power',machine_power,
    'seconds_to_next',interval_s,
    'gimmicks',gimmicks
  );
end;
$$;

revoke all on function public.run_machines_v611(uuid) from public;
grant execute on function public.run_machines_v611(uuid) to authenticated;
