-- SCHATZSUCHE ONLINE V6.15.1
-- Realtime-Felderzähler, bezahlte Analysen, globale Endcards,
-- kreative Namen und "gleiches Spiel nochmal".
-- Nach V6.15 EINMAL vollständig ausführen.

-- =========================================================
-- 1) GAME_PLAYERS SICHER IN REALTIME VERÖFFENTLICHEN
-- =========================================================

do $$
begin
  if not exists(
    select 1
    from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='game_players'
  ) then
    alter publication supabase_realtime add table public.game_players;
  end if;
exception when others then
  raise notice 'game_players konnte nicht automatisch zu Realtime ergänzt werden: %',sqlerrm;
end $$;

-- UPDATE-Ereignisse brauchen einen stabilen Schlüssel.
alter table public.game_players replica identity full;

-- =========================================================
-- 2) ANALYSE NUR NOCH GEGEN TALER / EINMAL PRO SUCHPOSITION
-- =========================================================

alter table public.platform_settings
  add column if not exists analysis_hint_base_cost numeric(12,2) not null default 5;

alter table public.game_players
  add column if not exists analysis_last_focus_x int,
  add column if not exists analysis_last_focus_y int,
  add column if not exists analysis_purchases bigint not null default 0;

create or replace function public.admin_set_analysis_cost_v6151(p_base_cost numeric)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_admin_v67() then raise exception 'Keine Admin-Berechtigung'; end if;
  if p_base_cost<0 or p_base_cost>1000000 then raise exception 'Ungültiger Analysepreis'; end if;

  update public.platform_settings
  set analysis_hint_base_cost=p_base_cost,
      updated_at=now()
  where id=1;
end;
$$;
revoke all on function public.admin_set_analysis_cost_v6151(numeric) from public;
grant execute on function public.admin_set_analysis_cost_v6151(numeric) to authenticated;

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
  cost:=round(s.analysis_hint_base_cost*greatest(1,gp.analysis_level),2);

  if gp.coins<cost then
    raise exception 'Nicht genug Taler für die Analyse (% T benötigt)',cost;
  end if;

  hint:=public.get_analysis_hint_v68(
    p_game_id,
    gp.auto_focus_x,
    gp.auto_focus_y
  );

  if hint is null then raise exception 'Für dieses Spiel ist aktuell kein Analysehinweis verfügbar'; end if;

  update public.game_players
  set coins=coins-cost,
      analysis_last_focus_x=auto_focus_x,
      analysis_last_focus_y=auto_focus_y,
      analysis_purchases=analysis_purchases+1
  where game_id=p_game_id and user_id=auth.uid();

  return hint || jsonb_build_object(
    'cost',cost,
    'purchases',gp.analysis_purchases+1
  );
end;
$$;
revoke all on function public.buy_analysis_hint_v6151(uuid) from public;
grant execute on function public.buy_analysis_hint_v6151(uuid) to authenticated;

-- =========================================================
-- 3) GLOBALE GEWINNMELDUNG / ENDCARD
-- =========================================================

create or replace function public.emit_game_win_event_v6151(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  g public.games%rowtype;
  gp public.game_players%rowtype;
  winner_name text;
begin
  select * into g from public.games where id=p_game_id;
  if not found or g.status<>'finished' or g.winner_id is null then return; end if;

  if exists(
    select 1 from public.game_events
    where game_id=p_game_id and event_type='game_won'
  ) then return; end if;

  select gp0.* into gp
  from public.game_players gp0
  where gp0.game_id=p_game_id and gp0.user_id=g.winner_id;

  select display_name into winner_name
  from public.profiles where id=g.winner_id;

  insert into public.game_events(game_id,event_type,message,details)
  values(
    p_game_id,
    'game_won',
    '🏆 '||coalesce(winner_name,'Ein Spieler')||' hat das Spiel gewonnen!',
    jsonb_build_object(
      'winner_id',g.winner_id,
      'winner_name',coalesce(winner_name,'Spieler'),
      'winner_share_bps',coalesce(gp.treasure_share_bps,0),
      'winner_moves_used',coalesce(gp.moves_used,0),
      'winner_taler_gold_ug',coalesce(g.winner_taler_gold_ug,0)
    )
  );
end;
$$;

create or replace function public.reveal_area_v6151(
  p_game_id uuid,p_x int,p_y int
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  r jsonb;
begin
  r:=public.reveal_area_v614(p_game_id,p_x,p_y);
  if coalesce((r->>'game_over')::boolean,false) then
    perform public.emit_game_win_event_v6151(p_game_id);
  end if;
  return r;
end;
$$;
revoke all on function public.reveal_area_v6151(uuid,int,int) from public;
grant execute on function public.reveal_area_v6151(uuid,int,int) to authenticated;

create or replace function public.run_machines_game_v6151(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  r jsonb;
begin
  r:=public.run_machines_game_v614(p_game_id);
  if coalesce((r->>'game_over')::boolean,false) then
    perform public.emit_game_win_event_v6151(p_game_id);
  end if;
  return r;
end;
$$;
revoke all on function public.run_machines_game_v6151(uuid) from public;
grant execute on function public.run_machines_game_v6151(uuid) to authenticated;

-- =========================================================
-- 4) KREATIVE SPIELNAMEN + GLEICHES SPIEL NOCHMAL
-- =========================================================

create or replace function public.random_game_name_v6151()
returns text
language plpgsql
volatile
set search_path=public
as $$
declare
  adjectives text[]:=array[
    'Nebel','Gold','Schatten','Nordlicht','Wild','Mond','Atlas','Kompass',
    'Sternen','Glut','Falken','Wolken','Drachen','Fjord','Wüsten','Dschungel'
  ];
  nouns text[]:=array[
    'Jagd','Pfad','Expedition','Rallye','Mission','Spur','Odyssee','Runde',
    'Quest','Fährte','Abenteuer','Suche','Sprint','Reise','Geheimnis','Challenge'
  ];
  candidate text;
  tries int:=0;
begin
  loop
    tries:=tries+1;
    candidate:=adjectives[1+floor(random()*array_length(adjectives,1))::int]
      ||nouns[1+floor(random()*array_length(nouns,1))::int];

    exit when not exists(
      select 1 from public.games g
      where lower(g.name)=lower(candidate)
        and g.created_at>now()-interval '30 days'
    );

    exit when tries>=20;
  end loop;

  if tries>=20 then
    candidate:=candidate||' '||to_char(now(),'DDHH24MI');
  end if;

  return candidate;
end;
$$;

create or replace function public.create_same_game_v6151(p_game_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  g public.games%rowtype;
  gid uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;

  select * into g from public.games where id=p_game_id;
  if not found then raise exception 'Spiel nicht gefunden'; end if;

  if not exists(
    select 1 from public.game_players
    where game_id=p_game_id and user_id=auth.uid()
  ) then raise exception 'Nur Teilnehmer können dieselben Einstellungen erneut verwenden'; end if;

  gid:=public.create_game_v612(
    public.random_game_name_v6151(),
    g.width::bigint*g.height::bigint,
    g.cell_size_m,
    g.max_players,
    g.location_mode,
    g.center_lat,
    g.center_lon,
    g.center_label,
    g.regen_seconds,
    g.max_stored_moves,
    g.is_private,
    null,
    g.game_type,
    g.entry_gold_ug,
    g.treasure_count,
    g.gimmick_percent
  );

  return gid;
end;
$$;
revoke all on function public.create_same_game_v6151(uuid) from public;
grant execute on function public.create_same_game_v6151(uuid) to authenticated;
