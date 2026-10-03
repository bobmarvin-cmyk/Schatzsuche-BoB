-- SCHATZSUCHE ONLINE V6.14.1
-- Mobile HUD / simple analysis is frontend only.
-- Backend: stronger traps + automated game generator.
-- Run ONCE after V6.14.

-- =========================================================
-- 1) STRONGER TRAPS
-- =========================================================

insert into public.technologies(
  id,name,branch,cost,reveal_power_bonus,reward_bonus,moves_bonus,
  analysis_level,round_mod,requires,capacity_bonus,regen_reduction,
  description,sort_order,is_active,machine_auto_fields,
  exclusive_per_game,trap_type,trap_power,trap_limit
)
values
 ('t4','EMP-Falle','Fallen',150,0,0,0,0,null,'{t3}',0,0,
  'Starke Zugfalle: vernichtet mehrere gespeicherte Züge.',830,true,0,false,'zug',3,2),
 ('t5','Sabotagefalle','Fallen',280,0,0,0,0,null,'{t4}',0,0,
  'Schwere Talerfalle mit hohem Verlust.',840,true,0,false,'taler',100,2),
 ('t6','Blackout-Störsender','Fallen',450,0,0,0,0,null,'{t5}',0,0,
  'Extremer Störsender: reduziert den nächsten manuellen Suchzug massiv.',850,true,0,false,'scanner',500,1)
on conflict(id) do nothing;

-- =========================================================
-- 2) AUTOMATIC GAME GENERATOR
-- =========================================================

create table if not exists public.auto_game_config_v6141(
  id int primary key default 1 check(id=1),
  enabled boolean not null default false,
  host_user_id uuid references auth.users(id) on delete set null,
  interval_minutes int not null default 60,
  next_run_at timestamptz not null default now()+interval '1 hour',
  name_prefix text not null default 'Auto-Runde',
  field_count bigint not null default 100000,
  cell_size_m numeric(12,2) not null default 100,
  max_players int not null default 20,
  regen_seconds int not null default 10,
  max_stored_moves int not null default 4,
  game_type text not null default 'standard',
  entry_gold_ug bigint not null default 10000,
  treasure_count int not null default 1,
  gimmick_percent numeric(5,2) not null default 0.10,
  location_mode text not null default 'random',
  center_lat numeric,
  center_lon numeric,
  center_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.auto_game_config_v6141 enable row level security;

insert into public.auto_game_config_v6141(id,host_user_id)
select 1,a.user_id
from public.admin_users a
order by a.created_at
limit 1
on conflict(id) do nothing;

create or replace function public.admin_get_auto_game_config_v6141()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select case when public.is_admin_v67()
    then to_jsonb(c)
    else null end
  from public.auto_game_config_v6141 c
  where c.id=1;
$$;
revoke all on function public.admin_get_auto_game_config_v6141() from public;
grant execute on function public.admin_get_auto_game_config_v6141() to authenticated;

create or replace function public.admin_save_auto_game_config_v6141(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  me uuid:=auth.uid();
  s public.platform_settings%rowtype;
  mins int;
begin
  if not public.is_admin_v67() then raise exception 'Keine Admin-Berechtigung'; end if;
  select * into s from public.platform_settings where id=1;

  mins:=greatest(5,least(10080,coalesce((p->>'interval_minutes')::int,60)));

  if (p->>'field_count')::bigint<s.min_game_fields or (p->>'field_count')::bigint>s.max_game_fields then
    raise exception 'Auto-Game Feldanzahl außerhalb der Servergrenzen';
  end if;
  if (p->>'cell_size_m')::numeric<s.min_cell_size_m or (p->>'cell_size_m')::numeric>s.max_cell_size_m then
    raise exception 'Auto-Game Feldgröße außerhalb der Servergrenzen';
  end if;
  if (p->>'max_players')::int<2 or (p->>'max_players')::int>s.max_game_players then
    raise exception 'Auto-Game Spielerzahl ungültig';
  end if;
  if (p->>'regen_seconds')::int<s.min_regen_seconds or (p->>'regen_seconds')::int>s.max_regen_seconds then
    raise exception 'Auto-Game Regenerationszeit ungültig';
  end if;

  update public.auto_game_config_v6141
  set enabled=coalesce((p->>'enabled')::boolean,false),
      host_user_id=coalesce(host_user_id,me),
      interval_minutes=mins,
      next_run_at=case
        when coalesce((p->>'enabled')::boolean,false) then now()+(mins||' minutes')::interval
        else next_run_at end,
      name_prefix=left(coalesce(nullif(trim(p->>'name_prefix'),''),'Auto-Runde'),60),
      field_count=(p->>'field_count')::bigint,
      cell_size_m=(p->>'cell_size_m')::numeric,
      max_players=(p->>'max_players')::int,
      regen_seconds=(p->>'regen_seconds')::int,
      max_stored_moves=(p->>'max_stored_moves')::int,
      game_type=case when p->>'game_type'='pay' then 'pay' else 'standard' end,
      entry_gold_ug=greatest(0,coalesce((p->>'entry_gold_ug')::bigint,0)),
      treasure_count=greatest(1,least(s.max_treasures,coalesce((p->>'treasure_count')::int,1))),
      gimmick_percent=greatest(s.min_gimmick_percent,least(s.max_gimmick_percent,coalesce((p->>'gimmick_percent')::numeric,s.default_gimmick_percent))),
      location_mode=case when p->>'location_mode'='coords' then 'coords' else 'random' end,
      center_lat=nullif(p->>'center_lat','')::numeric,
      center_lon=nullif(p->>'center_lon','')::numeric,
      center_label=nullif(trim(p->>'center_label'),''),
      updated_at=now()
  where id=1;

  return jsonb_build_object('message','Auto-Game-Einstellungen gespeichert');
end;
$$;
revoke all on function public.admin_save_auto_game_config_v6141(jsonb) from public;
grant execute on function public.admin_save_auto_game_config_v6141(jsonb) to authenticated;

create or replace function public.auto_game_tick_v6141(p_force boolean default false)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  c public.auto_game_config_v6141%rowtype;
  gid uuid;
  old_sub text;
begin
  select * into c
  from public.auto_game_config_v6141
  where id=1
  for update;

  if not found then return jsonb_build_object('created',false,'reason','Keine Konfiguration'); end if;
  if not p_force and not c.enabled then return jsonb_build_object('created',false,'reason','Deaktiviert'); end if;
  if not p_force and c.next_run_at>now() then return jsonb_build_object('created',false,'reason','Noch nicht fällig'); end if;
  if c.host_user_id is null then raise exception 'Kein Host für Auto-Games hinterlegt'; end if;

  -- create_game_v612 nutzt auth.uid(). Für den serverseitigen Cron-Lauf setzen wir
  -- die Host-ID nur transaktionslokal auf den konfigurierten Admin.
  old_sub:=current_setting('request.jwt.claim.sub',true);
  perform set_config('request.jwt.claim.sub',c.host_user_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',c.host_user_id::text,'role','authenticated')::text,true);

  gid:=public.create_game_v612(
    c.name_prefix||' '||to_char(now(),'DD.MM. HH24:MI'),
    c.field_count,c.cell_size_m,c.max_players,c.location_mode,
    c.center_lat,c.center_lon,c.center_label,c.regen_seconds,c.max_stored_moves,
    false,null,c.game_type,c.entry_gold_ug,c.treasure_count,c.gimmick_percent
  );

  update public.auto_game_config_v6141
  set next_run_at=now()+(interval_minutes||' minutes')::interval,
      updated_at=now()
  where id=1;

  return jsonb_build_object('created',true,'game_id',gid);
end;
$$;

revoke all on function public.auto_game_tick_v6141(boolean) from public;
revoke all on function public.auto_game_tick_v6141(boolean) from authenticated;

create or replace function public.admin_generate_auto_game_v6141()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_admin_v67() then raise exception 'Keine Admin-Berechtigung'; end if;
  return public.auto_game_tick_v6141(true);
end;
$$;
revoke all on function public.admin_generate_auto_game_v6141() from public;
grant execute on function public.admin_generate_auto_game_v6141() to authenticated;

-- pg_cron optional automatisch aktivieren. Falls die Extension im Projekt nicht
-- verfügbar/erlaubt ist, bleibt der Generator per Button vollständig nutzbar.
do $$
begin
  begin
    execute 'create extension if not exists pg_cron';
    perform cron.schedule(
      'bobs-auto-games-v6141',
      '*/5 * * * *',
      'select public.auto_game_tick_v6141(false);'
    );
  exception when others then
    raise notice 'pg_cron nicht verfügbar: %',sqlerrm;
  end;
end $$;
