-- SCHATZSUCHE ONLINE V6.16a
-- Performance-Live-State, zuverlässige globale Events und Analysepreise.
-- Nach V6.15.1 EINMAL vollständig ausführen.

-- =========================================================
-- 1) LEICHTER GLOBALER LIVE-STATE STATT FELD-EVENT-STURM
-- =========================================================

alter table public.games
  add column if not exists field_version bigint not null default 0;

-- Bestehenden Counter-Trigger ersetzen: pro INSERT-Statement nur EIN Games-Update.
create or replace function public.bump_explored_count_insert_v682()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.games g
  set explored_count=g.explored_count+x.cnt,
      field_version=g.field_version+1
  from (
    select game_id,count(*)::bigint as cnt
    from new_rows
    group by game_id
  ) x
  where g.id=x.game_id;
  return null;
end;
$$;

create or replace function public.bump_explored_count_delete_v682()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.games g
  set explored_count=greatest(0,g.explored_count-x.cnt),
      field_version=g.field_version+1
  from (
    select game_id,count(*)::bigint as cnt
    from old_rows
    group by game_id
  ) x
  where g.id=x.game_id;
  return null;
end;
$$;

-- Lightweight Fallback-Sync: ein kleiner RPC ersetzt tausende explored_fields-Realtime-Events.
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
    'players',player_rows,
    'events',ev
  );
end;
$$;
revoke all on function public.get_game_live_state_v616(uuid,bigint) from public;
grant execute on function public.get_game_live_state_v616(uuid,bigint) to authenticated;

-- =========================================================
-- 2) ANALYSEPREIS PRO STUFE EINSTELLBAR
-- =========================================================

alter table public.platform_settings
  add column if not exists analysis_price_l1 numeric(12,2) not null default 5,
  add column if not exists analysis_price_l2 numeric(12,2) not null default 10,
  add column if not exists analysis_price_l3 numeric(12,2) not null default 15,
  add column if not exists analysis_price_l4 numeric(12,2) not null default 20,
  add column if not exists analysis_price_l5 numeric(12,2) not null default 25,
  add column if not exists analysis_price_l6 numeric(12,2) not null default 30;

create or replace function public.admin_set_analysis_prices_v616(
  p_l1 numeric,p_l2 numeric,p_l3 numeric,p_l4 numeric,p_l5 numeric,p_l6 numeric
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_admin_v67() then raise exception 'Keine Admin-Berechtigung'; end if;
  if least(p_l1,p_l2,p_l3,p_l4,p_l5,p_l6)<0 then
    raise exception 'Analysepreise dürfen nicht negativ sein';
  end if;

  update public.platform_settings
  set analysis_price_l1=p_l1,
      analysis_price_l2=p_l2,
      analysis_price_l3=p_l3,
      analysis_price_l4=p_l4,
      analysis_price_l5=p_l5,
      analysis_price_l6=p_l6,
      updated_at=now()
  where id=1;
end;
$$;
revoke all on function public.admin_set_analysis_prices_v616(numeric,numeric,numeric,numeric,numeric,numeric) from public;
grant execute on function public.admin_set_analysis_prices_v616(numeric,numeric,numeric,numeric,numeric,numeric) to authenticated;

create or replace function public.buy_analysis_hint_v6151(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  gp public.game_players%rowtype;
  s public.platform_settings%rowtype;
  cost numeric:=0;
  hint jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;

  select * into gp
  from public.game_players
  where game_id=p_game_id and user_id=auth.uid()
  for update;

  if not found then raise exception 'Nicht im Spiel'; end if;
  if gp.analysis_level<=0 then raise exception 'Du besitzt noch keine Analyse-Technologie'; end if;
  if gp.auto_focus_x is null or gp.auto_focus_y is null then
    raise exception 'Suche zuerst manuell auf der Karte';
  end if;

  if gp.analysis_last_focus_x=gp.auto_focus_x
     and gp.analysis_last_focus_y=gp.auto_focus_y then
    raise exception 'Diese Suchposition wurde bereits analysiert. Suche erst an einer neuen Stelle weiter.';
  end if;

  select * into s from public.platform_settings where id=1;
  cost:=case
    when gp.analysis_level<=1 then s.analysis_price_l1
    when gp.analysis_level=2 then s.analysis_price_l2
    when gp.analysis_level=3 then s.analysis_price_l3
    when gp.analysis_level=4 then s.analysis_price_l4
    when gp.analysis_level=5 then s.analysis_price_l5
    else s.analysis_price_l6
  end;

  if gp.coins<cost then
    raise exception 'Nicht genug Taler für die Analyse (% T benötigt)',cost;
  end if;

  hint:=public.get_analysis_hint_v68(p_game_id,gp.auto_focus_x,gp.auto_focus_y);
  if hint is null then raise exception 'Für dieses Spiel ist aktuell kein Analysehinweis verfügbar'; end if;

  update public.game_players
  set coins=coins-cost,
      analysis_last_focus_x=auto_focus_x,
      analysis_last_focus_y=auto_focus_y,
      analysis_purchases=analysis_purchases+1
  where game_id=p_game_id and user_id=auth.uid();

  return hint || jsonb_build_object('cost',cost,'purchases',gp.analysis_purchases+1);
end;
$$;


-- =========================================================
-- 4) SCHATZTEIL-FUND ALS GLOBALES GAME-EVENT
-- =========================================================

create or replace function public.emit_treasure_found_event_v616()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  n text;
begin
  if old.found_by is null and new.found_by is not null then
    select display_name into n from public.profiles where id=new.found_by;

    insert into public.game_events(game_id,event_type,message,details)
    values(
      new.game_id,
      'treasure_found',
      '🧩 '||coalesce(n,'Ein Spieler')||' hat ein Schatzteil gefunden!',
      jsonb_build_object(
        'finder_id',new.found_by,
        'finder_name',coalesce(n,'Spieler'),
        'treasure_no',new.treasure_no,
        'share_bps',coalesce(new.share_bps,0),
        'gold_ug',coalesce(new.amount_ug,0)
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists emit_treasure_found_event_v616 on public.gold_treasures;
create trigger emit_treasure_found_event_v616
after update of found_by on public.gold_treasures
for each row execute function public.emit_treasure_found_event_v616();




-- Hot paths für große Multiplayer-Runden.
create index if not exists explored_fields_game_discoverer_idx
  on public.explored_fields(game_id,discovered_by);
create index if not exists game_players_game_user_v616_idx
  on public.game_players(game_id,user_id);
create index if not exists player_technologies_game_user_v616_idx
  on public.player_technologies(game_id,user_id);
create index if not exists game_events_game_id_id_v616_idx
  on public.game_events(game_id,id);
