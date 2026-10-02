-- SCHATZSUCHE ONLINE V6.9
-- Dynamische Zugzeit-Auswahl + Maschinen/Automatisierung
-- Nach V6.8.3 EINMAL vollständig im Supabase SQL Editor ausführen.

-- =========================================================
-- 1) MASTERWERTE
-- =========================================================

alter table public.platform_settings
  add column if not exists machine_reward_factor numeric(8,4) not null default .25;

-- Standard-Zugzeit immer innerhalb der aktuell eingestellten Grenzen halten.
create or replace function public.admin_set_default_regen_v68(p_seconds int)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  s public.platform_settings%rowtype;
  clamped int;
begin
  if not public.is_admin_v67() then
    raise exception 'Keine Admin-Berechtigung';
  end if;

  select * into s from public.platform_settings where id=1;
  clamped:=least(s.max_regen_seconds,greatest(s.min_regen_seconds,p_seconds));

  update public.platform_settings
  set default_regen_seconds=clamped,
      updated_at=now()
  where id=1;
end;
$$;

revoke all on function public.admin_set_default_regen_v68(int) from public;
grant execute on function public.admin_set_default_regen_v68(int) to authenticated;

create or replace function public.admin_set_machine_reward_v690(p_factor numeric)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_admin_v67() then
    raise exception 'Keine Admin-Berechtigung';
  end if;

  if p_factor<0 or p_factor>5 then
    raise exception 'Maschinen-Talerfaktor muss zwischen 0 und 5 liegen';
  end if;

  update public.platform_settings
  set machine_reward_factor=p_factor,
      updated_at=now()
  where id=1;
end;
$$;

revoke all on function public.admin_set_machine_reward_v690(numeric) from public;
grant execute on function public.admin_set_machine_reward_v690(numeric) to authenticated;

-- =========================================================
-- 2) ZUGREGENERATION RESPEKTIERT MASTER-MINIMUM
-- =========================================================

create or replace function public.refresh_player_moves(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  g public.games%rowtype;
  gp public.game_players%rowtype;
  s public.platform_settings%rowtype;
  cap int;
  interval_s int;
  elapsed numeric;
  gained int;
  new_moves int;
begin
  select * into g from public.games where id=p_game_id;
  if not found then raise exception 'Spiel nicht gefunden'; end if;

  select * into gp
  from public.game_players
  where game_id=p_game_id and user_id=auth.uid()
  for update;

  if not found then raise exception 'Nicht im Spiel'; end if;

  select * into s from public.platform_settings where id=1;

  cap:=greatest(1,g.max_stored_moves+gp.move_capacity_bonus);
  interval_s:=greatest(
    s.min_regen_seconds,
    round(g.regen_seconds*(1-gp.regen_reduction))::int
  );

  if gp.moves_left>=cap then
    update public.game_players
    set moves_left=cap,last_regen_at=now()
    where game_id=p_game_id and user_id=auth.uid();

    return jsonb_build_object(
      'moves',cap,
      'capacity',cap,
      'interval_seconds',interval_s,
      'seconds_to_next',interval_s
    );
  end if;

  elapsed:=extract(epoch from (now()-gp.last_regen_at));
  gained:=floor(elapsed/interval_s)::int;

  if gained>0 then
    new_moves:=least(cap,gp.moves_left+gained);

    update public.game_players
    set moves_left=new_moves,
        last_regen_at=case
          when new_moves>=cap then now()
          else gp.last_regen_at+(gained*interval_s)*interval '1 second'
        end
    where game_id=p_game_id and user_id=auth.uid()
    returning * into gp;
  else
    new_moves:=gp.moves_left;
  end if;

  return jsonb_build_object(
    'moves',new_moves,
    'capacity',cap,
    'interval_seconds',interval_s,
    'seconds_to_next',
      greatest(0,ceil(interval_s-extract(epoch from (now()-gp.last_regen_at)))::int)
  );
end;
$$;

-- =========================================================
-- 3) TECHNOLOGIEBAUM: MASCHINEN
-- =========================================================

alter table public.technologies
  add column if not exists machine_auto_fields int not null default 0;

-- Eigener Technologie-Zweig "Automatisierung".
insert into public.technologies(
  id,name,branch,cost,
  reveal_power_bonus,reward_bonus,moves_bonus,analysis_level,round_mod,requires,
  capacity_bonus,regen_reduction,
  description,sort_order,is_active,machine_auto_fields
)
values
  ('m1','Vermessungsdrohne','Automatisierung',2.50,0,0,0,0,null,'{root}',0,0,
   'Automatische Vermessung im zuletzt manuell gewählten Suchgebiet.',700,true,5),

  ('m2','Suchroboter','Automatisierung',8.00,0,0,0,0,null,'{m1}',0,0,
   'Erweitert deine automatische Suchleistung.',710,true,15),

  ('m3','Drohnenschwarm','Automatisierung',25.00,0,0,0,0,null,'{m2}',0,0,
   'Ein koordinierter Schwarm für automatische Flächensuche.',720,true,50),

  ('m4','Autonomer Roverpark','Automatisierung',80.00,0,0,0,0,null,'{m3}',0,0,
   'Autonome Bodenfahrzeuge erweitern die automatische Suche.',730,true,150),

  ('m5','Suchfabrik','Automatisierung',250.00,0,0,0,0,null,'{m4}',0,0,
   'Großanlage für die automatische Feldsuche.',740,true,500)
on conflict(id) do nothing;

-- Schaltzentrale kann Maschinenleistung ebenfalls ändern.
create or replace function public.admin_update_technology_v690(
  p_id text,
  p_name text,
  p_branch text,
  p_description text,
  p_cost numeric,
  p_reveal_power_bonus int,
  p_reward_bonus numeric,
  p_analysis_level int,
  p_capacity_bonus int,
  p_regen_reduction numeric,
  p_machine_auto_fields int,
  p_requires text[],
  p_sort_order int,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  r text;
  x record;
begin
  if not public.is_admin_v67() then
    raise exception 'Keine Admin-Berechtigung';
  end if;

  if not exists(select 1 from public.technologies where id=p_id) then
    raise exception 'Technologie nicht gefunden';
  end if;

  if length(trim(coalesce(p_name,'')))<1 then
    raise exception 'Name fehlt';
  end if;

  if length(trim(coalesce(p_branch,'')))<1 then
    raise exception 'Kategorie fehlt';
  end if;

  if p_cost<0 then raise exception 'Preis darf nicht negativ sein'; end if;

  if p_reveal_power_bonus<0
     or p_analysis_level<0
     or p_capacity_bonus<0
     or p_machine_auto_fields<0 then
    raise exception 'Bonuswerte dürfen nicht negativ sein';
  end if;

  if p_reward_bonus<0 then
    raise exception 'Talerbonus darf nicht negativ sein';
  end if;

  if p_regen_reduction<0 or p_regen_reduction>.80 then
    raise exception 'Regenerationsbonus muss zwischen 0 und 0,80 liegen';
  end if;

  if p_id=any(coalesce(p_requires,'{}'::text[])) then
    raise exception 'Technologie kann sich nicht selbst voraussetzen';
  end if;

  foreach r in array coalesce(p_requires,'{}'::text[]) loop
    if not exists(select 1 from public.technologies where id=r) then
      raise exception 'Unbekannte Voraussetzung: %',r;
    end if;
  end loop;

  update public.technologies
  set name=trim(p_name),
      branch=trim(p_branch),
      description=left(coalesce(p_description,''),250),
      cost=p_cost,
      reveal_power_bonus=p_reveal_power_bonus,
      reward_bonus=p_reward_bonus,
      analysis_level=p_analysis_level,
      capacity_bonus=p_capacity_bonus,
      regen_reduction=p_regen_reduction,
      machine_auto_fields=p_machine_auto_fields,
      requires=coalesce(p_requires,'{}'::text[]),
      sort_order=p_sort_order,
      is_active=p_is_active
  where id=p_id;

  for x in
    select distinct game_id,user_id
    from public.player_technologies
    where technology_id=p_id
  loop
    perform public.recompute_player_stats(x.game_id,x.user_id);
  end loop;

  return jsonb_build_object('message',trim(p_name)||' gespeichert');
end;
$$;

revoke all on function public.admin_update_technology_v690(
  text,text,text,text,numeric,int,numeric,int,int,numeric,int,text[],int,boolean
) from public;

grant execute on function public.admin_update_technology_v690(
  text,text,text,text,numeric,int,numeric,int,int,numeric,int,text[],int,boolean
) to authenticated;

-- =========================================================
-- 4) MASCHINEN-PRESENCE / ZIELGEBIET
-- =========================================================

alter table public.game_players
  add column if not exists auto_focus_x int,
  add column if not exists auto_focus_y int,
  add column if not exists machine_presence_at timestamptz,
  add column if not exists machine_last_run_at timestamptz not null default now();

-- Wird nur von der sichtbaren Spielseite regelmäßig aufgerufen.
create or replace function public.machine_presence_v690(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;

  update public.game_players gp
  set machine_presence_at=now()
  from public.games g
  where gp.game_id=p_game_id
    and gp.user_id=auth.uid()
    and g.id=gp.game_id
    and g.status='active';

  if not found then raise exception 'Nicht im aktiven Spiel'; end if;
end;
$$;

revoke all on function public.machine_presence_v690(uuid) from public;
grant execute on function public.machine_presence_v690(uuid) to authenticated;

-- Jeder manuelle Kartenklick setzt das Gebiet, in dem die Maschinen weiterarbeiten.
create or replace function public.set_machine_focus_v690(
  p_game_id uuid,
  p_x int,
  p_y int
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  g public.games%rowtype;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;

  select * into g from public.games where id=p_game_id;
  if not found or g.status<>'active' then raise exception 'Spiel nicht aktiv'; end if;

  if p_x<0 or p_y<0 or p_x>=g.width or p_y>=g.height then
    raise exception 'Ungültiges Feld';
  end if;

  update public.game_players
  set auto_focus_x=p_x,
      auto_focus_y=p_y,
      machine_presence_at=now()
  where game_id=p_game_id and user_id=auth.uid();

  if not found then raise exception 'Nicht im Spiel'; end if;
end;
$$;

revoke all on function public.set_machine_focus_v690(uuid,int,int) from public;
grant execute on function public.set_machine_focus_v690(uuid,int,int) to authenticated;

-- =========================================================
-- 5) AUTOMATISCHE AUFDECKUNG
-- Nur wenn Presence in den letzten 20 Sekunden aktualisiert wurde.
-- Kein Nachholen verpasster Takte nach Rückkehr.
-- =========================================================

create or replace function public.run_machines_v690(p_game_id uuid)
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
  legacy_hit boolean:=false;
  gold_won bigint:=0;
  remaining_treasures int:=0;
  winner_name_v text;
  winner_moves_v bigint;
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

  -- Ohne sichtbare/aktive Spielseite keine Maschine.
  if gp.machine_presence_at is null
     or gp.machine_presence_at < now()-interval '20 seconds' then
    return jsonb_build_object('opened',0,'active',false,'reason','Spielseite nicht aktiv');
  end if;

  if gp.auto_focus_x is null or gp.auto_focus_y is null then
    return jsonb_build_object('opened',0,'active',true,'reason','Noch kein manuelles Suchgebiet gewählt');
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

  -- Kein Offline-Catch-up: genau EIN Takt pro aktivem Aufruf.
  update public.game_players
  set machine_last_run_at=now()
  where game_id=p_game_id and user_id=auth.uid();

  rew:=s.exploration_reward*gp.reward_multiplier*s.machine_reward_factor;

  search_radius:=least(
    greatest(g.width,g.height),
    greatest(2,ceil(sqrt(greatest(1,machine_power)::numeric))::int)
  );

  if g.game_type='standard' then
    with candidates as (
      select
        gp.auto_focus_x+dx as x,
        gp.auto_focus_y+dy as y,
        row_number() over(
          order by greatest(abs(dx),abs(dy)),dy,dx
        ) as ord
      from generate_series(-search_radius,search_radius) dy
      cross join generate_series(-search_radius,search_radius) dx
      where gp.auto_focus_x+dx between 0 and g.width-1
        and gp.auto_focus_y+dy between 0 and g.height-1
        and not exists(
          select 1
          from public.explored_fields ef
          where ef.game_id=p_game_id
            and ef.x=gp.auto_focus_x+dx
            and ef.y=gp.auto_focus_y+dy
        )
      order by greatest(abs(dx),abs(dy)),dy,dx
      limit machine_power
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
      insert into public.explored_fields(
        game_id,x,y,discovered_by,is_treasure
      )
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
      select
        gp.auto_focus_x+dx as x,
        gp.auto_focus_y+dy as y
      from generate_series(-search_radius,search_radius) dy
      cross join generate_series(-search_radius,search_radius) dx
      where gp.auto_focus_x+dx between 0 and g.width-1
        and gp.auto_focus_y+dy between 0 and g.height-1
        and not exists(
          select 1
          from public.explored_fields ef
          where ef.game_id=p_game_id
            and ef.x=gp.auto_focus_x+dx
            and ef.y=gp.auto_focus_y+dy
        )
      order by greatest(abs(dx),abs(dy)),dy,dx
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
        and gt.x=i.x
        and gt.y=i.y
        and gt.found_by is null
        and gt.forfeited_at is null
      returning gt.amount_ug
    ), stats as (
      select count(*)::int as opened from ins
    ), winnings as (
      select coalesce(sum(amount_ug),0)::bigint as gold_won
      from claimed
    )
    select stats.opened,winnings.gold_won
    into opened,gold_won
    from stats cross join winnings;

    if gold_won>0 then
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
        'treasure_reward','Goldschatz durch Maschine gefunden'
      );

      update public.games
      set gold_prize_pool_ug=greatest(0,gold_prize_pool_ug-gold_won)
      where id=p_game_id;
    end if;
  end if;

  if opened>0 then
    update public.game_players
    set coins=coins+(opened*rew)
    where game_id=p_game_id and user_id=auth.uid();

    update public.profiles
    set total_fields_revealed=total_fields_revealed+opened
    where id=auth.uid();

    update public.games
    set last_activity_at=now()
    where id=p_game_id;
  end if;

  if g.game_type='standard' and legacy_hit then
    update public.games
    set status='finished',
        winner_id=auth.uid(),
        closed_at=coalesce(closed_at,now()),
        close_reason=coalesce(close_reason,'completed')
    where id=p_game_id and status='active';

    if found then
      update public.profiles
      set wins=wins+1
      where id=auth.uid();
    end if;

    select p.display_name,gp2.moves_used
    into winner_name_v,winner_moves_v
    from public.profiles p
    join public.game_players gp2
      on gp2.user_id=p.id and gp2.game_id=p_game_id
    where p.id=auth.uid();

    return jsonb_build_object(
      'message','⚙️🏆 Deine Maschinen haben den Schatz gefunden!',
      'won',true,
      'opened',opened,
      'machine_power',machine_power,
      'winner_name',winner_name_v,
      'winner_moves_used',winner_moves_v
    );
  end if;

  if g.game_type='pay' then
    select count(*) into remaining_treasures
    from public.gold_treasures
    where game_id=p_game_id
      and found_by is null
      and forfeited_at is null;

    if remaining_treasures=0 then
      update public.games
      set status='finished',
          closed_at=coalesce(closed_at,now()),
          close_reason=coalesce(close_reason,'completed')
      where id=p_game_id and status='active';
    end if;
  end if;

  return jsonb_build_object(
    'message',
      case
        when opened>0 then
          '⚙️ Maschinen: '||opened||' Felder automatisch aufgedeckt. +'||
          to_char(opened*rew,'FM999999990.00')||' Taler.'
        else '⚙️ Im aktuellen Maschinengebiet sind keine neuen Felder mehr erreichbar.'
      end ||
      case when gold_won>0
        then ' ✨ Goldschatz gefunden: '||
             trim(to_char(gold_won/1000000.0,'FM999990.000000'))||
             ' g Test-Gold!'
        else '' end,
    'won',false,
    'opened',opened,
    'machine_power',machine_power,
    'gold_won_ug',gold_won,
    'seconds_to_next',interval_s
  );
end;
$$;

revoke all on function public.run_machines_v690(uuid) from public;
grant execute on function public.run_machines_v690(uuid) to authenticated;
