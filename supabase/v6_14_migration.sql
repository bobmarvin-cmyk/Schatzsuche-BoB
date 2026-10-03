-- SCHATZSUCHE ONLINE V6.14
-- Exklusive Technologien, Fallen, globale Ereignisse, sicherer Reveal-Wrapper.
-- Nach V6.13.2a EINMAL vollständig ausführen.

alter table public.technologies
  add column if not exists exclusive_per_game boolean not null default false,
  add column if not exists trap_type text,
  add column if not exists trap_power numeric(12,2) not null default 0,
  add column if not exists trap_limit int not null default 0;

alter table public.game_players
  add column if not exists trap_reveal_penalty_pending int not null default 0;

create table if not exists public.game_traps(
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  x int not null,
  y int not null,
  placed_by uuid not null references public.profiles(id) on delete cascade,
  technology_id text not null references public.technologies(id),
  trap_type text not null,
  power numeric(12,2) not null default 0,
  placed_at timestamptz not null default now(),
  triggered_by uuid references public.profiles(id) on delete set null,
  triggered_at timestamptz,
  unique(game_id,x,y)
);
create index if not exists game_traps_game_open_idx
  on public.game_traps(game_id,x,y)
  where triggered_at is null;
alter table public.game_traps enable row level security;
drop policy if exists "own traps read" on public.game_traps;
create policy "own traps read" on public.game_traps
for select to authenticated
using(placed_by=auth.uid());

create table if not exists public.game_events(
  id bigserial primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  event_type text not null,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.game_events enable row level security;
drop policy if exists "participants read events" on public.game_events;
create policy "participants read events" on public.game_events
for select to authenticated
using(exists(
  select 1 from public.game_players gp
  where gp.game_id=game_events.game_id and gp.user_id=auth.uid()
));

-- Exklusive Technologien: pro Game kann jede exklusive Technologie nur einen Besitzer haben.
create or replace function public.buy_technology_v614(
  p_game_id uuid,
  p_technology_id text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  gp public.game_players%rowtype;
  t public.technologies%rowtype;
  r text;
  owner_name text;
begin
  select * into gp
  from public.game_players
  where game_id=p_game_id and user_id=auth.uid()
  for update;
  if not found then raise exception 'Nicht im Spiel'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_game_id::text||':'||p_technology_id,0));

  select * into t from public.technologies where id=p_technology_id;
  if not found then raise exception 'Technologie nicht gefunden'; end if;
  if not t.is_active then raise exception 'Technologie ist derzeit deaktiviert'; end if;

  if exists(
    select 1 from public.player_technologies
    where game_id=p_game_id and user_id=auth.uid()
      and technology_id=p_technology_id
  ) then raise exception 'Bereits erforscht'; end if;

  if t.exclusive_per_game then
    select p.display_name into owner_name
    from public.player_technologies pt
    join public.profiles p on p.id=pt.user_id
    where pt.game_id=p_game_id
      and pt.technology_id=p_technology_id
      and pt.user_id<>auth.uid()
    limit 1;

    if owner_name is not null then
      raise exception 'Exklusive Technologie bereits von % gesichert',owner_name;
    end if;
  end if;

  foreach r in array coalesce(t.requires,'{}'::text[]) loop
    if not exists(
      select 1 from public.player_technologies
      where game_id=p_game_id and user_id=auth.uid()
        and technology_id=r
    ) then raise exception 'Voraussetzung fehlt'; end if;
  end loop;

  if gp.coins<t.cost then raise exception 'Nicht genug Taler'; end if;

  update public.game_players
  set coins=coins-t.cost
  where game_id=p_game_id and user_id=auth.uid();

  begin
    insert into public.player_technologies(game_id,user_id,technology_id)
    values(p_game_id,auth.uid(),p_technology_id);
  exception when unique_violation then
    raise exception 'Technologie wurde gerade von einem anderen Spieler gesichert';
  end;

  perform public.recompute_player_stats(p_game_id,auth.uid());

  if t.exclusive_per_game then
    insert into public.game_events(game_id,event_type,message,details)
    values(
      p_game_id,'exclusive_tech',
      coalesce((select display_name from public.profiles where id=auth.uid()),'Ein Spieler')
      ||' hat die exklusive Technologie „'||t.name||'“ gesichert.',
      jsonb_build_object('technology_id',t.id,'user_id',auth.uid())
    );
  end if;

  return jsonb_build_object('message',t.name||' erforscht');
end;
$$;
revoke all on function public.buy_technology_v614(uuid,text) from public;
grant execute on function public.buy_technology_v614(uuid,text) to authenticated;

-- Neue exklusive Technologien und Fallen.
insert into public.technologies(
  id,name,branch,cost,reveal_power_bonus,reward_bonus,moves_bonus,
  analysis_level,round_mod,requires,capacity_bonus,regen_reduction,
  description,sort_order,is_active,machine_auto_fields,
  exclusive_per_game,trap_type,trap_power,trap_limit
)
values
 ('x1','Pionierpatent','Erkundung',55,400,0,0,0,null,'{e5}',0,0,
  'Nur ein Spieler pro Game kann dieses Patent besitzen. +400 Felder/Zug.',195,true,0,true,null,0,0),
 ('x2','Kartographenmonopol','Analyse',70,0,0,0,6,null,'{a4}',0,0,
  'Exklusive Hochstufen-Kartenanalyse.',355,true,0,true,null,0,0),
 ('x3','Automationspatent','Automatisierung',140,0,0,0,0,null,'{m3}',0,0,
  'Exklusive industrielle Automatisierung.',735,true,300,true,null,0,0),
 ('t1','Talerfalle','Fallen',20,0,0,0,0,null,'{root}',0,0,
  'Verdeckte Falle: Opfer verliert Taler.',800,true,0,false,'taler',20,3),
 ('t2','Zugfalle','Fallen',45,0,0,0,0,null,'{t1}',0,0,
  'Verdeckte Falle: Opfer verliert gespeicherte Züge.',810,true,0,false,'zug',1,3),
 ('t3','Störsender','Fallen',85,0,0,0,0,null,'{t2}',0,0,
  'Verdeckte Falle: reduziert die nächste manuelle Suchleistung.',820,true,0,false,'scanner',50,2)
on conflict(id) do nothing;

create or replace function public.admin_update_technology_v614(
  p_id text,p_name text,p_branch text,p_description text,p_cost numeric,
  p_reveal_power_bonus int,p_reward_bonus numeric,p_analysis_level int,
  p_capacity_bonus int,p_regen_reduction numeric,p_machine_auto_fields int,
  p_exclusive_per_game boolean,p_trap_type text,p_trap_power numeric,p_trap_limit int,
  p_requires text[],p_sort_order int,p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_admin_v67() then raise exception 'Keine Admin-Berechtigung'; end if;
  if not exists(select 1 from public.technologies where id=p_id) then
    raise exception 'Technologie nicht gefunden';
  end if;
  if p_cost<0 or p_reveal_power_bonus<0 or p_reward_bonus<0
     or p_analysis_level<0 or p_capacity_bonus<0 or p_regen_reduction<0
     or p_machine_auto_fields<0 or p_trap_power<0 or p_trap_limit<0 then
    raise exception 'Ungültiger negativer Wert';
  end if;

  update public.technologies
  set name=trim(p_name),branch=trim(p_branch),
      description=left(coalesce(p_description,''),250),cost=p_cost,
      reveal_power_bonus=p_reveal_power_bonus,reward_bonus=p_reward_bonus,
      analysis_level=p_analysis_level,capacity_bonus=p_capacity_bonus,
      regen_reduction=p_regen_reduction,machine_auto_fields=p_machine_auto_fields,
      exclusive_per_game=coalesce(p_exclusive_per_game,false),
      trap_type=nullif(trim(coalesce(p_trap_type,'')),''),
      trap_power=p_trap_power,trap_limit=p_trap_limit,
      requires=coalesce(p_requires,'{}'::text[]),
      sort_order=p_sort_order,is_active=p_is_active
  where id=p_id;

  perform public.recompute_player_stats(pt.game_id,pt.user_id)
  from public.player_technologies pt
  where pt.technology_id=p_id;

  return jsonb_build_object('message',trim(p_name)||' gespeichert');
end;
$$;
revoke all on function public.admin_update_technology_v614(
  text,text,text,text,numeric,int,numeric,int,int,numeric,int,boolean,text,numeric,int,text[],int,boolean
) from public;
grant execute on function public.admin_update_technology_v614(
  text,text,text,text,numeric,int,numeric,int,int,numeric,int,boolean,text,numeric,int,text[],int,boolean
) to authenticated;

create or replace function public.place_trap_v614(
  p_game_id uuid,p_x int,p_y int,p_technology_id text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  g public.games%rowtype;
  t public.technologies%rowtype;
  active_count int;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into g from public.games where id=p_game_id;
  if not found or g.status<>'active' then raise exception 'Spiel nicht aktiv'; end if;

  if p_x<0 or p_y<0 or p_x>=g.width or p_y>=g.height then
    raise exception 'Ungültiges Feld';
  end if;

  if exists(select 1 from public.explored_fields where game_id=p_game_id and x=p_x and y=p_y) then
    raise exception 'Fallen können nur auf noch nicht aufgedeckten Feldern liegen';
  end if;

  select t0.* into t
  from public.technologies t0
  join public.player_technologies pt on pt.technology_id=t0.id
  where pt.game_id=p_game_id and pt.user_id=auth.uid()
    and t0.id=p_technology_id and t0.trap_type is not null;
  if not found then raise exception 'Fallen-Technologie nicht erworben'; end if;

  select count(*)::int into active_count
  from public.game_traps
  where game_id=p_game_id and placed_by=auth.uid()
    and technology_id=p_technology_id and triggered_at is null;

  if active_count>=t.trap_limit then
    raise exception 'Maximale aktive Fallen dieser Art erreicht';
  end if;

  insert into public.game_traps(
    game_id,x,y,placed_by,technology_id,trap_type,power
  ) values(
    p_game_id,p_x,p_y,auth.uid(),p_technology_id,t.trap_type,t.trap_power
  );

  return jsonb_build_object('message','🪤 '||t.name||' verdeckt platziert');
end;
$$;
revoke all on function public.place_trap_v614(uuid,int,int,text) from public;
grant execute on function public.place_trap_v614(uuid,int,int,text) to authenticated;

create or replace function public.get_my_traps_v614(p_game_id uuid)
returns table(id uuid,x int,y int,trap_type text,power numeric,technology_id text)
language sql
stable
security definer
set search_path=public
as $$
  select gt.id,gt.x,gt.y,gt.trap_type,gt.power,gt.technology_id
  from public.game_traps gt
  where gt.game_id=p_game_id
    and gt.placed_by=auth.uid()
    and gt.triggered_at is null
  order by gt.placed_at;
$$;
revoke all on function public.get_my_traps_v614(uuid) from public;
grant execute on function public.get_my_traps_v614(uuid) to authenticated;

-- Fallen werden bei jedem INSERT in explored_fields ausgelöst – manuell und Maschine.
create or replace function public.process_traps_v614()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  hit record;
  victim public.game_players%rowtype;
  s public.platform_settings%rowtype;
  victim_name text;
  setter_name text;
  source text;
  reward_loss numeric;
  gt record;
  eligible int;
  base_share int;
  rem_share int;
  base_gold bigint;
  rem_gold bigint;
  p record;
  idx int;
begin
  source:=coalesce(current_setting('app.reveal_source',true),'manual');
  select * into s from public.platform_settings where id=1;

  for hit in
    select tr.*,nr.discovered_by
    from new_rows nr
    join public.game_traps tr
      on tr.game_id=nr.game_id and tr.x=nr.x and tr.y=nr.y
    where tr.triggered_at is null
      and tr.placed_by<>nr.discovered_by
  loop
    select * into victim
    from public.game_players
    where game_id=hit.game_id and user_id=hit.discovered_by
    for update;

    select display_name into victim_name from public.profiles where id=hit.discovered_by;
    select display_name into setter_name from public.profiles where id=hit.placed_by;

    reward_loss:=s.exploration_reward*victim.reward_multiplier*
      case when source='machine' then s.machine_reward_factor else 1 end;

    update public.game_players
    set coins=coins-reward_loss
    where game_id=hit.game_id and user_id=hit.discovered_by;

    if hit.trap_type='taler' then
      update public.game_players
      set coins=coins-hit.power
      where game_id=hit.game_id and user_id=hit.discovered_by;
    elsif hit.trap_type='zug' then
      update public.game_players
      set moves_left=greatest(0,moves_left-hit.power::int)
      where game_id=hit.game_id and user_id=hit.discovered_by;
    elsif hit.trap_type='scanner' then
      update public.game_players
      set trap_reveal_penalty_pending=trap_reveal_penalty_pending+hit.power::int
      where game_id=hit.game_id and user_id=hit.discovered_by;
    end if;

    update public.game_traps
    set triggered_by=hit.discovered_by,triggered_at=now()
    where id=hit.id;

    insert into public.game_events(game_id,event_type,message,details)
    values(
      hit.game_id,'trap',
      '🪤 '||coalesce(victim_name,'Ein Spieler')||' ist in eine '||
      case hit.trap_type when 'taler' then 'Talerfalle'
                         when 'zug' then 'Zugfalle'
                         else 'Störsender-Falle' end||
      ' von '||coalesce(setter_name,'einem Spieler')||' geraten.',
      jsonb_build_object('victim_id',hit.discovered_by,'setter_id',hit.placed_by,
                         'trap_type',hit.trap_type,'power',hit.power)
    );

    -- Liegt zufällig ein Schatz auf dem Fallenfeld, wird er auf alle Spieler außer
    -- dem Fallensteller verteilt.
    for gt in
      select *
      from public.gold_treasures
      where game_id=hit.game_id and x=hit.x and y=hit.y
        and found_by is null and forfeited_at is null
      for update
    loop
      select count(*)::int into eligible
      from public.game_players
      where game_id=hit.game_id and user_id<>hit.placed_by;

      if eligible>0 then
        base_share:=floor(gt.share_bps::numeric/eligible)::int;
        rem_share:=gt.share_bps-base_share*eligible;
        base_gold:=floor(gt.amount_ug::numeric/eligible)::bigint;
        rem_gold:=gt.amount_ug-base_gold*eligible;
        idx:=0;

        for p in
          select gp.user_id
          from public.game_players gp
          where gp.game_id=hit.game_id and gp.user_id<>hit.placed_by
          order by gp.joined_at
        loop
          idx:=idx+1;
          update public.game_players
          set treasure_share_bps=treasure_share_bps+base_share+
              case when idx=1 then rem_share else 0 end,
              last_treasure_found_at=now()
          where game_id=hit.game_id and user_id=p.user_id;

          if gt.amount_ug>0 then
            insert into public.gold_wallets(user_id) values(p.user_id)
            on conflict(user_id) do nothing;
            update public.gold_wallets
            set balance_ug=balance_ug+base_gold+case when idx=1 then rem_gold else 0 end,
                updated_at=now()
            where user_id=p.user_id;
            update public.profiles
            set gold_found_ug=gold_found_ug+base_gold+case when idx=1 then rem_gold else 0 end
            where id=p.user_id;
            insert into public.gold_transactions(
              user_id,game_id,amount_ug,transaction_type,note
            ) values(
              p.user_id,hit.game_id,
              base_gold+case when idx=1 then rem_gold else 0 end,
              'trap_treasure_share','Schatz auf Fallenfeld gemeinschaftlich verteilt'
            );
          end if;
        end loop;

        update public.games
        set gold_prize_pool_ug=greatest(0,gold_prize_pool_ug-gt.amount_ug)
        where id=hit.game_id;
      end if;

      update public.gold_treasures
      set amount_ug=0,forfeited_at=now()
      where id=gt.id;

      insert into public.game_events(game_id,event_type,message,details)
      values(
        hit.game_id,'trap_treasure',
        '💥 Unter einer Falle lag ein Schatzteil! Der Anteil wurde auf alle Spieler außer dem Fallensteller verteilt.',
        jsonb_build_object('setter_id',hit.placed_by,'share_bps',gt.share_bps)
      );
    end loop;
  end loop;

  return null;
end;
$$;

drop trigger if exists process_traps_v614 on public.explored_fields;
create trigger process_traps_v614
after insert on public.explored_fields
referencing new table as new_rows
for each statement execute function public.process_traps_v614();

-- Wrapper markiert Quelle für korrekten Taler-Neutralisierungssatz
-- und wendet Störsender auf den nächsten manuellen Zug an.
create or replace function public.reveal_area_v614(
  p_game_id uuid,p_x int,p_y int
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  penalty int:=0;
  r jsonb;
begin
  perform set_config('app.reveal_source','manual',true);

  select trap_reveal_penalty_pending into penalty
  from public.game_players
  where game_id=p_game_id and user_id=auth.uid()
  for update;

  if coalesce(penalty,0)>0 then
    update public.game_players
    set reveal_power=greatest(1,reveal_power-penalty),
        trap_reveal_penalty_pending=0
    where game_id=p_game_id and user_id=auth.uid();
  end if;

  r:=public.reveal_area_v613(p_game_id,p_x,p_y);

  if coalesce(penalty,0)>0 then
    update public.game_players
    set reveal_power=reveal_power+penalty
    where game_id=p_game_id and user_id=auth.uid();
  end if;

  return r;
end;
$$;
revoke all on function public.reveal_area_v614(uuid,int,int) from public;
grant execute on function public.reveal_area_v614(uuid,int,int) to authenticated;

create or replace function public.run_machines_game_v614(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  perform set_config('app.reveal_source','machine',true);
  return public.run_machines_game_v613(p_game_id);
end;
$$;
revoke all on function public.run_machines_game_v614(uuid) from public;
grant execute on function public.run_machines_game_v614(uuid) to authenticated;


do $$
begin
  begin
    alter publication supabase_realtime add table public.game_events;
  exception when duplicate_object then null;
  end;
end $$;
