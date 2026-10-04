-- SCHATZSUCHE ONLINE V6.21 – DEDUKTIONSSUCHE
-- Voraussetzung: V6.20.2 installiert.
-- EINMAL vollständig ausführen.

-- =========================================================
-- 1) SERVERSEITIGER SCHATZPROFIL-PASS
-- =========================================================

create table if not exists public.treasure_profiles_v621(
  treasure_id uuid primary key references public.gold_treasures(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  treasure_no int not null,
  sector text not null,
  quadrant text not null,
  center_distance_m numeric not null,
  edge_distance_m numeric not null,
  terrain_type text,
  nearest_water_m numeric,
  nearest_forest_m numeric,
  nearest_urban_m numeric,
  nearest_road_m numeric,
  terrain_samples int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.treasure_profiles_v621 enable row level security;
-- Kein direkter Client-SELECT: Schatzprofil enthält interne Metadaten.
revoke all on table public.treasure_profiles_v621 from anon,authenticated;

create or replace function public.refresh_treasure_profile_v621(p_treasure_id uuid)
returns public.treasure_profiles_v621
language plpgsql
security definer
set search_path=public
as $$
declare
  gt public.gold_treasures%rowtype;
  g public.games%rowtype;
  p public.treasure_profiles_v621%rowtype;
  xb text;
  yb text;
begin
  select * into gt from public.gold_treasures where id=p_treasure_id;
  if not found then raise exception 'Schatzteil nicht gefunden'; end if;

  select * into g from public.games where id=gt.game_id;
  if not found then raise exception 'Spiel nicht gefunden'; end if;

  xb:=case
    when gt.x < g.width/3.0 then 'West'
    when gt.x >= g.width*2/3.0 then 'Ost'
    else 'Mitte'
  end;
  yb:=case
    when gt.y < g.height/3.0 then 'Nord'
    when gt.y >= g.height*2/3.0 then 'Süd'
    else 'Mitte'
  end;

  insert into public.treasure_profiles_v621(
    treasure_id,game_id,treasure_no,sector,quadrant,
    center_distance_m,edge_distance_m,
    terrain_type,nearest_water_m,nearest_forest_m,nearest_urban_m,nearest_road_m,
    terrain_samples,updated_at
  )
  values(
    gt.id,gt.game_id,gt.treasure_no,
    case
      when xb='Mitte' and yb='Mitte' then 'Zentrum'
      when xb='Mitte' then yb||'mitte'
      when yb='Mitte' then xb||'mitte'
      else yb||xb
    end,
    case
      when gt.x<g.width/2.0 and gt.y<g.height/2.0 then 'Nordwest'
      when gt.x>=g.width/2.0 and gt.y<g.height/2.0 then 'Nordost'
      when gt.x<g.width/2.0 and gt.y>=g.height/2.0 then 'Südwest'
      else 'Südost'
    end,
    sqrt(
      power((gt.x+0.5-g.width/2.0)*g.cell_size_m,2)+
      power((gt.y+0.5-g.height/2.0)*g.cell_size_m,2)
    ),
    least(
      (gt.x+0.5)*g.cell_size_m,
      (g.width-gt.x-0.5)*g.cell_size_m,
      (gt.y+0.5)*g.cell_size_m,
      (g.height-gt.y-0.5)*g.cell_size_m
    ),
    (select tc.terrain_type
     from public.game_terrain_cells tc
     where tc.game_id=gt.game_id and tc.x=gt.x and tc.y=gt.y
     limit 1),
    (select min(sqrt(power(tc.x-gt.x,2)+power(tc.y-gt.y,2))*g.cell_size_m)
     from public.game_terrain_cells tc
     where tc.game_id=gt.game_id and tc.terrain_type='water'),
    (select min(sqrt(power(tc.x-gt.x,2)+power(tc.y-gt.y,2))*g.cell_size_m)
     from public.game_terrain_cells tc
     where tc.game_id=gt.game_id and tc.terrain_type='forest'),
    (select min(sqrt(power(tc.x-gt.x,2)+power(tc.y-gt.y,2))*g.cell_size_m)
     from public.game_terrain_cells tc
     where tc.game_id=gt.game_id
       and tc.terrain_type in ('residential','commercial','industrial','park')),
    (select min(sqrt(power(tc.x-gt.x,2)+power(tc.y-gt.y,2))*g.cell_size_m)
     from public.game_terrain_cells tc
     where tc.game_id=gt.game_id and tc.terrain_type='road'),
    (select count(*)::int from public.game_terrain_cells tc where tc.game_id=gt.game_id),
    now()
  )
  on conflict(treasure_id) do update set
    sector=excluded.sector,
    quadrant=excluded.quadrant,
    center_distance_m=excluded.center_distance_m,
    edge_distance_m=excluded.edge_distance_m,
    terrain_type=coalesce(excluded.terrain_type,public.treasure_profiles_v621.terrain_type),
    nearest_water_m=coalesce(excluded.nearest_water_m,public.treasure_profiles_v621.nearest_water_m),
    nearest_forest_m=coalesce(excluded.nearest_forest_m,public.treasure_profiles_v621.nearest_forest_m),
    nearest_urban_m=coalesce(excluded.nearest_urban_m,public.treasure_profiles_v621.nearest_urban_m),
    nearest_road_m=coalesce(excluded.nearest_road_m,public.treasure_profiles_v621.nearest_road_m),
    terrain_samples=greatest(public.treasure_profiles_v621.terrain_samples,excluded.terrain_samples),
    updated_at=now()
  returning * into p;

  return p;
end;
$$;
revoke all on function public.refresh_treasure_profile_v621(uuid) from public;

-- =========================================================
-- 2) PERSÖNLICHES HINWEISBUCH
-- =========================================================

create table if not exists public.analysis_clues_v621(
  id bigserial primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  treasure_id uuid not null references public.gold_treasures(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  clue_no int not null,
  clue_kind text not null,
  level int not null,
  text text not null,
  payload jsonb not null default '{}'::jsonb,
  cost numeric(12,2) not null default 0,
  focus_x int,
  focus_y int,
  created_at timestamptz not null default now(),
  unique(treasure_id,user_id,clue_no)
);

alter table public.analysis_clues_v621 enable row level security;
drop policy if exists "own analysis clues readable v621" on public.analysis_clues_v621;
create policy "own analysis clues readable v621"
on public.analysis_clues_v621 for select to authenticated
using(user_id=auth.uid());

create index if not exists analysis_clues_user_game_v621
  on public.analysis_clues_v621(user_id,game_id,created_at);

create or replace function public.get_my_analysis_clues_v621(p_game_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,
    'treasure_no',gt.treasure_no,
    'clue_no',c.clue_no,
    'clue_kind',c.clue_kind,
    'level',c.level,
    'text',c.text,
    'payload',c.payload,
    'cost',c.cost,
    'created_at',c.created_at
  ) order by c.created_at),'[]'::jsonb)
  from public.analysis_clues_v621 c
  join public.gold_treasures gt on gt.id=c.treasure_id
  where c.game_id=p_game_id and c.user_id=auth.uid();
$$;
revoke all on function public.get_my_analysis_clues_v621(uuid) from public;
grant execute on function public.get_my_analysis_clues_v621(uuid) to authenticated;

-- =========================================================
-- 3) DETERMINISTISCHE DEDUKTIONSANALYSE
-- =========================================================

create or replace function public.buy_analysis_hint_v621(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  gp public.game_players%rowtype;
  g public.games%rowtype;
  s public.platform_settings%rowtype;
  gt public.gold_treasures%rowtype;
  prof public.treasure_profiles_v621%rowtype;
  cost numeric:=0;
  clue_no_v int:=0;
  slot int:=0;
  clue_kind_v text;
  clue_text text;
  payload_v jsonb:='{}'::jsonb;
  dx numeric;
  dy numeric;
  dist_m numeric;
  direction text;
  dist_bucket numeric;
  center_bucket numeric;
  edge_bucket numeric;
  target_lat numeric;
  target_lon numeric;
  meters_lon numeric;
  approx_lat numeric;
  approx_lon numeric;
  radius_m numeric;
  feature_name text;
  feature_dist numeric;
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
    raise exception 'Von dieser Suchposition hast du bereits analysiert. Setze zuerst einen neuen manuellen Suchpunkt.';
  end if;

  select * into g from public.games where id=p_game_id;
  if not found or g.status<>'active' then raise exception 'Spiel nicht aktiv'; end if;

  if g.start_at is not null and g.start_at>now() then
    raise exception 'Analysen werden erst mit dem gemeinsamen Spielstart freigeschaltet';
  end if;

  select * into gt
  from public.gold_treasures
  where game_id=p_game_id and found_by is null and forfeited_at is null
  order by treasure_no
  limit 1;
  if not found then raise exception 'Kein offenes Schatzteil vorhanden'; end if;

  select * into prof from public.refresh_treasure_profile_v621(gt.id);

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

  select count(*)::int+1 into clue_no_v
  from public.analysis_clues_v621
  where treasure_id=gt.id and user_id=auth.uid();

  -- Feste Profilhinweise werden nur einmal verkauft.
  -- Danach werden neue Suchpositionen für echte Peilungen verwendet.
  if clue_no_v=1 then
    slot:=1; -- Sektor
  elsif clue_no_v=2 and gp.analysis_level>=2 then
    slot:=2; -- Zentrumring
  elsif clue_no_v=3 and gp.analysis_level>=3 then
    slot:=3; -- Terrain / Rand
  elsif clue_no_v>3 and gp.analysis_level>=3
        and prof.terrain_type is not null
        and not exists(
          select 1 from public.analysis_clues_v621 c
          where c.treasure_id=gt.id and c.user_id=auth.uid() and c.clue_kind='terrain'
        ) then
    slot:=3; -- Terrain wurde erst später kartografisch bekannt
  elsif clue_no_v=5 and gp.analysis_level>=5 then
    slot:=5; -- Umgebung
  elsif clue_no_v=6 and gp.analysis_level>=6 then
    slot:=6; -- Präzisionszone
  else
    slot:=4; -- neue Peilung von der aktuellen Suchposition
  end if;

  meters_lon:=greatest(1000,111320*cos(radians(g.center_lat)));
  target_lat:=g.center_lat + ((g.height/2.0)-(gt.y+0.5))*g.cell_size_m/111320.0;
  target_lon:=g.center_lon + ((gt.x+0.5)-(g.width/2.0))*g.cell_size_m/meters_lon;

  dx:=(gt.x-gp.auto_focus_x)*g.cell_size_m;
  dy:=(gp.auto_focus_y-gt.y)*g.cell_size_m;
  dist_m:=sqrt(dx*dx+dy*dy);
  direction:=case
    when dist_m<g.cell_size_m then 'direkt hier'
    when abs(dx)<dist_m*.25 and dy>0 then 'Norden'
    when abs(dx)<dist_m*.25 and dy<0 then 'Süden'
    when abs(dy)<dist_m*.25 and dx>0 then 'Osten'
    when abs(dy)<dist_m*.25 and dx<0 then 'Westen'
    when dx>0 and dy>0 then 'Nordosten'
    when dx<0 and dy>0 then 'Nordwesten'
    when dx>0 and dy<0 then 'Südosten'
    else 'Südwesten'
  end;

  if slot=1 then
    clue_kind_v:='sector';
    clue_text:='🧭 Sektoranalyse: Das offene Schatzteil liegt im Kartenbereich „'||prof.sector||
      '“. Das ist ein festes Merkmal dieses Schatzes.';
    payload_v:=jsonb_build_object(
      'sector',prof.sector,
      'quadrant',prof.quadrant
    );

  elsif slot=2 then
    clue_kind_v:='center_ring';
    center_bucket:=case
      when gp.analysis_level<=2 then greatest(2000,g.cell_size_m*30)
      when gp.analysis_level=3 then greatest(1000,g.cell_size_m*15)
      else greatest(500,g.cell_size_m*8)
    end;
    clue_text:='📐 Zentrumring: Der Schatz liegt etwa '||
      round(prof.center_distance_m/center_bucket)*center_bucket||
      ' m vom Kartenmittelpunkt entfernt (Toleranz ungefähr ±'||round(center_bucket/2)||' m).';
    payload_v:=jsonb_build_object(
      'center_distance_m',round(prof.center_distance_m/center_bucket)*center_bucket,
      'tolerance_m',round(center_bucket/2)
    );

  elsif slot=3 then
    if prof.terrain_type is not null then
      clue_kind_v:='terrain';
      clue_text:='🌍 Geländeanalyse: Das Schatzfeld ist als „'||
        case prof.terrain_type
          when 'forest' then 'Wald'
          when 'water' then 'Wasser'
          when 'wetland' then 'Feuchtgebiet'
          when 'farmland' then 'Landwirtschaft'
          when 'grass' then 'Grünland'
          when 'park' then 'Park'
          when 'residential' then 'Wohngebiet'
          when 'commercial' then 'Gewerbe'
          when 'industrial' then 'Industrie'
          when 'road' then 'Verkehrsfläche'
          when 'sand' then 'Sand'
          when 'rock' then 'Fels'
          else 'offenes Gelände' end||
        '“ kartiert.';
      payload_v:=jsonb_build_object('terrain_type',prof.terrain_type);
    else
      clue_kind_v:='edge_distance';
      edge_bucket:=greatest(500,g.cell_size_m*8);
      clue_text:='🗺️ Randanalyse: Das Schatzfeld liegt ungefähr '||
        round(prof.edge_distance_m/edge_bucket)*edge_bucket||
        ' m von der nächstgelegenen Spielgebietsgrenze entfernt (±'||round(edge_bucket/2)||' m). '||
        'Die exakte Terrainklasse ist dort noch nicht ausreichend vermessen.';
      payload_v:=jsonb_build_object(
        'edge_distance_m',round(prof.edge_distance_m/edge_bucket)*edge_bucket,
        'tolerance_m',round(edge_bucket/2),
        'terrain_known',false
      );
    end if;

  elsif slot=4 then
    clue_kind_v:='bearing';
    dist_bucket:=case
      when gp.analysis_level=4 then greatest(600,g.cell_size_m*8)
      when gp.analysis_level=5 then greatest(300,g.cell_size_m*5)
      else greatest(150,g.cell_size_m*3)
    end;
    clue_text:='📡 Peilung von deiner letzten Suchposition: Ziel Richtung '||direction||
      ', Entfernung ungefähr '||round(dist_m/dist_bucket)*dist_bucket||
      ' m (±'||round(dist_bucket/2)||' m).';
    payload_v:=jsonb_build_object(
      'direction',direction,
      'distance_m',round(dist_m/dist_bucket)*dist_bucket,
      'tolerance_m',round(dist_bucket/2)
    );

  elsif slot=5 then
    clue_kind_v:='proximity';
    -- Bevorzugt die nächstgelegene bereits kartografisch bekannte Landmarkenklasse.
    feature_name:=null;feature_dist:=null;
    if prof.nearest_water_m is not null then
      feature_name:='Gewässer';feature_dist:=prof.nearest_water_m;
    end if;
    if prof.nearest_forest_m is not null and (feature_dist is null or prof.nearest_forest_m<feature_dist) then
      feature_name:='Waldfläche';feature_dist:=prof.nearest_forest_m;
    end if;
    if prof.nearest_urban_m is not null and (feature_dist is null or prof.nearest_urban_m<feature_dist) then
      feature_name:='Siedlungs-/Nutzfläche';feature_dist:=prof.nearest_urban_m;
    end if;
    if prof.nearest_road_m is not null and (feature_dist is null or prof.nearest_road_m<feature_dist) then
      feature_name:='Verkehrsfläche';feature_dist:=prof.nearest_road_m;
    end if;

    if feature_dist is null then
      clue_text:='🧩 Umgebungsanalyse: In den bisher vermessenen Kartendaten liegt noch keine ausreichend nahe Landmarkenklasse vor. '||
        'Nutze Sektor, Zentrumring und Peilungen zur weiteren Eingrenzung.';
      payload_v:=jsonb_build_object('feature_known',false,'terrain_samples',prof.terrain_samples);
    else
      dist_bucket:=greatest(250,g.cell_size_m*4);
      clue_text:='🧩 Umgebungsanalyse: Die nächstgelegene bisher kartierte '||feature_name||
        ' liegt ungefähr '||round(feature_dist/dist_bucket)*dist_bucket||
        ' m vom Schatzfeld entfernt (±'||round(dist_bucket/2)||' m).';
      payload_v:=jsonb_build_object(
        'feature_known',true,
        'feature',feature_name,
        'distance_m',round(feature_dist/dist_bucket)*dist_bucket,
        'tolerance_m',round(dist_bucket/2),
        'terrain_samples',prof.terrain_samples
      );
    end if;

  else
    clue_kind_v:='precision_zone';
    radius_m:=greatest(g.cell_size_m*3,150);
    approx_lat:=round(target_lat/(radius_m/111320.0))*(radius_m/111320.0);
    approx_lon:=round(target_lon/(radius_m/meters_lon))*(radius_m/meters_lon);
    clue_text:='🎯 Präzisionsabgleich: Deine bisherigen Hinweise lassen sich auf einen kleinen Kartenbereich von ungefähr '||
      round(radius_m)||' m Radius verdichten. Jetzt zählt die Kombination aus Karte, Terrain und Peilungen.';
    payload_v:=jsonb_build_object('radius_m',radius_m);
  end if;

  update public.game_players
  set coins=coins-cost,
      analysis_last_focus_x=auto_focus_x,
      analysis_last_focus_y=auto_focus_y,
      analysis_purchases=analysis_purchases+1
  where game_id=p_game_id and user_id=auth.uid();

  insert into public.analysis_clues_v621(
    game_id,treasure_id,user_id,clue_no,clue_kind,level,text,payload,cost,focus_x,focus_y
  )
  values(
    p_game_id,gt.id,auth.uid(),clue_no_v,clue_kind_v,gp.analysis_level,
    clue_text,payload_v,cost,gp.auto_focus_x,gp.auto_focus_y
  );

  return jsonb_build_object(
    'treasure_no',gt.treasure_no,
    'clue_no',clue_no_v,
    'kind',clue_kind_v,
    'level',gp.analysis_level,
    'text',clue_text,
    'payload',payload_v,
    'cost',cost,
    'lat',case when clue_kind_v='precision_zone' then round(approx_lat,6) else null end,
    'lon',case when clue_kind_v='precision_zone' then round(approx_lon,6) else null end,
    'radius_m',case when clue_kind_v='precision_zone' then radius_m else null end
  );
end;
$$;
revoke all on function public.buy_analysis_hint_v621(uuid) from public;
grant execute on function public.buy_analysis_hint_v621(uuid) to authenticated;


-- =========================================================
-- 4) NEUVERSTECKEN: ALTE HINWEISE WERDEN UNGÜLTIG + ERSTATTET
-- =========================================================

create or replace function public.relocate_treasure_v619(
  p_treasure_id uuid,p_game_id uuid
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  g public.games%rowtype;
  nx int;
  ny int;
  tries int:=0;
  oldx int;
  oldy int;
  r record;
begin
  select * into g from public.games where id=p_game_id;
  select x,y into oldx,oldy
  from public.gold_treasures
  where id=p_treasure_id and game_id=p_game_id;

  if oldx is null then raise exception 'Schatzteil nicht gefunden'; end if;

  -- Bereits bezahlte Hinweise beziehen sich auf die alte Position.
  -- Vor dem Neuverstecken werden sie deshalb vollständig in Taler erstattet.
  for r in
    select user_id,sum(cost) refund
    from public.analysis_clues_v621
    where treasure_id=p_treasure_id
    group by user_id
  loop
    update public.game_players
    set coins=coins+r.refund,
        analysis_last_focus_x=null,
        analysis_last_focus_y=null
    where game_id=p_game_id and user_id=r.user_id;
  end loop;

  delete from public.analysis_clues_v621 where treasure_id=p_treasure_id;
  delete from public.treasure_profiles_v621 where treasure_id=p_treasure_id;

  loop
    tries:=tries+1;
    nx:=floor(random()*g.width)::int;
    ny:=floor(random()*g.height)::int;

    exit when not exists(
      select 1 from public.explored_fields
      where game_id=p_game_id and x=nx and y=ny
    ) and not exists(
      select 1 from public.gold_treasures
      where game_id=p_game_id and x=nx and y=ny and id<>p_treasure_id
    );

    if tries>=1000 then
      raise exception 'Kein freies Feld für neue Schatzposition gefunden';
    end if;
  end loop;

  update public.explored_fields
  set is_treasure=false
  where game_id=p_game_id and x=oldx and y=oldy;

  update public.gold_treasures
  set x=nx,y=ny,found_by=null,found_at=null
  where id=p_treasure_id;
end;
$$;

-- =========================================================
-- 5) ANALYSE-TECHNOLOGIEN INHALTLICH AUF DEDUKTION AUSRICHTEN
-- =========================================================

update public.technologies set
  name='Kartografie',
  description='Liest den groben Karten-Sektor des Schatzes aus. Grundlage der Deduktionssuche.'
where id='a1';

update public.technologies set
  name='Distanzanalyse',
  description='Ergänzt einen festen Entfernungsring um den Kartenmittelpunkt.'
where id='a2';

update public.technologies set
  name='Geländespuren',
  description='Verknüpft Schatzsuche mit Terrain oder Randlage des realen Kartenrasters.'
where id='a3';

update public.technologies set
  name='Peilradar',
  description='Misst Richtung und Entfernungsband von deiner letzten Suchposition zum Schatz.'
where id='a4';

update public.technologies set
  name='Geodatenanalyse',
  description='Vergleicht den Schatz mit bereits kartierten Wasser-, Wald-, Siedlungs- und Verkehrsflächen.'
where id='a5';

update public.technologies set
  name='Deduktions-KI',
  description='Verdichtet die vorherigen Hinweise zu einer kleinen Präzisionszone. Kombinieren musst du selbst.'
where id='a6';

update public.technologies set
  description='Exklusive Analyse Stufe 6: maximale Präzisions- und Deduktionswerkzeuge.'
where id='x2';

-- Alte Analyse-RPC bleibt vorhanden, V6.21-Client verwendet ausschließlich V6.21.
