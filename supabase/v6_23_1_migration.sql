-- SCHATZSUCHE ONLINE V6.23.1 – LOW-DISK LOCAL CANVAS / VERSIONED CHUNKS
-- Voraussetzung: V6.22 installiert. Falls V6.23 fehlgeschlagen ist, diese Datei statt v6_23_migration.sql ausführen.
-- EINMAL vollständig ausführen.

-- Das Spielfeld wird im Browser gezeichnet. Der Server hält nur Wahrheit +
-- kleine 64x64-Chunkversionen und liefert Detaildaten nur für geänderte Chunks.

create table if not exists public.game_map_chunks_v623(
  game_id uuid not null references public.games(id) on delete cascade,
  cx int not null,
  cy int not null,
  version bigint not null default 1,
  explored_count int not null default 0,
  updated_at timestamptz not null default clock_timestamp(),
  primary key(game_id,cx,cy)
);

create table if not exists public.game_map_chunk_players_v623(
  game_id uuid not null references public.games(id) on delete cascade,
  cx int not null,
  cy int not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  n int not null default 0,
  primary key(game_id,cx,cy,user_id)
);

alter table public.game_map_chunks_v623 enable row level security;
alter table public.game_map_chunk_players_v623 enable row level security;
revoke all on table public.game_map_chunks_v623 from anon,authenticated;
revoke all on table public.game_map_chunk_players_v623 from anon,authenticated;

create index if not exists game_map_chunks_changed_v623
  on public.game_map_chunks_v623(game_id,updated_at);
create index if not exists game_map_chunk_players_lookup_v623
  on public.game_map_chunk_players_v623(game_id,cx,cy,n desc);


-- V6.23.1: KEIN globaler Backfill mehr.
-- Bestehende Spiele werden nur dann chunkweise aufgebaut, wenn sie tatsächlich geöffnet werden.
create or replace function public.ensure_map_chunks_v6231(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  -- Falls für dieses Spiel bereits Chunkdaten existieren, nichts tun.
  if exists(
    select 1 from public.game_map_chunks_v623 where game_id=p_game_id limit 1
  ) then
    return;
  end if;

  -- Nur dieses EINE Spiel aufbauen. Kein globaler Scan aller Spiele.
  insert into public.game_map_chunks_v623(
    game_id,cx,cy,version,explored_count,updated_at
  )
  select
    ef.game_id,
    floor(ef.x/64.0)::int,
    floor(ef.y/64.0)::int,
    1,
    count(*)::int,
    clock_timestamp()
  from public.explored_fields ef
  where ef.game_id=p_game_id
  group by ef.game_id,floor(ef.x/64.0)::int,floor(ef.y/64.0)::int
  on conflict(game_id,cx,cy) do nothing;

  insert into public.game_map_chunk_players_v623(
    game_id,cx,cy,user_id,n
  )
  select
    ef.game_id,
    floor(ef.x/64.0)::int,
    floor(ef.y/64.0)::int,
    ef.discovered_by,
    count(*)::int
  from public.explored_fields ef
  where ef.game_id=p_game_id
    and ef.discovered_by is not null
  group by ef.game_id,floor(ef.x/64.0)::int,floor(ef.y/64.0)::int,ef.discovered_by
  on conflict(game_id,cx,cy,user_id) do nothing;
end;
$$;

revoke all on function public.ensure_map_chunks_v6231(uuid) from public;


-- Neue Aufdeckungen aktualisieren nur die berührten Chunks.
create or replace function public.map_chunks_insert_v623()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.game_map_chunks_v623(
    game_id,cx,cy,version,explored_count,updated_at
  )
  select
    nr.game_id,
    floor(nr.x/64.0)::int,
    floor(nr.y/64.0)::int,
    1,
    count(*)::int,
    clock_timestamp()
  from new_rows nr
  group by nr.game_id,floor(nr.x/64.0)::int,floor(nr.y/64.0)::int
  on conflict(game_id,cx,cy) do update set
    version=public.game_map_chunks_v623.version+1,
    explored_count=public.game_map_chunks_v623.explored_count+excluded.explored_count,
    updated_at=clock_timestamp();

  insert into public.game_map_chunk_players_v623(
    game_id,cx,cy,user_id,n
  )
  select
    nr.game_id,
    floor(nr.x/64.0)::int,
    floor(nr.y/64.0)::int,
    nr.discovered_by,
    count(*)::int
  from new_rows nr
  group by nr.game_id,floor(nr.x/64.0)::int,floor(nr.y/64.0)::int,nr.discovered_by
  on conflict(game_id,cx,cy,user_id) do update set
    n=public.game_map_chunk_players_v623.n+excluded.n;

  return null;
end;
$$;

drop trigger if exists map_chunks_insert_v623 on public.explored_fields;
create trigger map_chunks_insert_v623
after insert on public.explored_fields
referencing new table as new_rows
for each statement execute function public.map_chunks_insert_v623();


-- Änderungen an bereits aufgedeckten Feldern (z. B. Schatz wird nach
-- misslungener Bergung neu versteckt) müssen ebenfalls den Canvas-Cache invalidieren.
create or replace function public.map_chunks_update_v623()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.game_map_chunks_v623 c
  set version=c.version+1,
      updated_at=clock_timestamp()
  from (
    select distinct
      nr.game_id,
      floor(nr.x/64.0)::int cx,
      floor(nr.y/64.0)::int cy
    from new_rows nr
  ) x
  where c.game_id=x.game_id and c.cx=x.cx and c.cy=x.cy;

  return null;
end;
$$;

drop trigger if exists map_chunks_update_v623 on public.explored_fields;
create trigger map_chunks_update_v623
after update on public.explored_fields
referencing new table as new_rows
for each statement execute function public.map_chunks_update_v623();

-- Kleine Initialkarte + danach nur Deltas seit dem letzten Abgleich.
create or replace function public.get_map_chunk_changes_v623(
  p_game_id uuid,
  p_since timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  g public.games%rowtype;
  as_of_v timestamptz:=clock_timestamp();
  chunks_v jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if not exists(
    select 1 from public.game_players
    where game_id=p_game_id and user_id=auth.uid()
  ) then raise exception 'Nicht im Spiel'; end if;

  select * into g from public.games where id=p_game_id;
  if not found then raise exception 'Spiel nicht gefunden'; end if;

  perform public.ensure_map_chunks_v6231(p_game_id);

  with changed as (
    select c.*
    from public.game_map_chunks_v623 c
    where c.game_id=p_game_id
      and c.updated_at<=as_of_v
      and (p_since is null or c.updated_at>p_since)
  ), shaped as (
    select
      c.game_id,c.cx,c.cy,c.version,c.explored_count,c.updated_at,
      least(64,g.width-c.cx*64) w,
      least(64,g.height-c.cy*64) h,
      greatest(1,least(64,g.width-c.cx*64)*least(64,g.height-c.cy*64)) capacity,
      (
        select cp.user_id
        from public.game_map_chunk_players_v623 cp
        where cp.game_id=c.game_id and cp.cx=c.cx and cp.cy=c.cy
        order by cp.n desc,cp.user_id
        limit 1
      ) dominant_user_id
    from changed c
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'cx',cx,'cy',cy,
      'version',version,
      'explored_count',explored_count,
      'w',w,'h',h,
      'coverage',round(least(1.0,explored_count::numeric/capacity),4),
      'dominant_user_id',dominant_user_id
    )
    order by cy,cx
  ),'[]'::jsonb)
  into chunks_v
  from shaped;

  return jsonb_build_object(
    'chunk_size',64,
    'as_of',as_of_v,
    'chunks',chunks_v
  );
end;
$$;

revoke all on function public.get_map_chunk_changes_v623(uuid,timestamptz) from public;
grant execute on function public.get_map_chunk_changes_v623(uuid,timestamptz) to authenticated;

-- Detaildaten: RLE statt ein JSON-Objekt pro Feld.
-- Ein Run ist [Startindex, Länge] innerhalb eines 64x64-Chunks.
create or replace function public.get_map_chunk_payloads_v623(
  p_game_id uuid,
  p_chunks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  payload_v jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if not exists(
    select 1 from public.game_players
    where game_id=p_game_id and user_id=auth.uid()
  ) then raise exception 'Nicht im Spiel'; end if;

  if jsonb_typeof(coalesce(p_chunks,'[]'::jsonb))<>'array' then
    raise exception 'Ungültige Chunkliste';
  end if;
  if jsonb_array_length(coalesce(p_chunks,'[]'::jsonb))>64 then
    raise exception 'Maximal 64 Chunks pro Detailabfrage';
  end if;

  perform public.ensure_map_chunks_v6231(p_game_id);

  with req as (
    select distinct
      (v->>'cx')::int cx,
      (v->>'cy')::int cy
    from jsonb_array_elements(coalesce(p_chunks,'[]'::jsonb)) v
    where v ? 'cx' and v ? 'cy'
    limit 64
  ), base as (
    select
      r.cx,r.cy,
      ef.discovered_by,
      ((ef.y-r.cy*64)*64+(ef.x-r.cx*64))::int idx,
      ef.is_treasure
    from req r
    join public.explored_fields ef
      on ef.game_id=p_game_id
     and ef.x between r.cx*64 and r.cx*64+63
     and ef.y between r.cy*64 and r.cy*64+63
  ), numbered as (
    select
      cx,cy,discovered_by,idx,is_treasure,
      idx-row_number() over(
        partition by cx,cy,discovered_by
        order by idx
      )::int grp
    from base
  ), runs as (
    select
      cx,cy,discovered_by,
      min(idx)::int start_idx,
      count(*)::int len
    from numbered
    group by cx,cy,discovered_by,grp
  ), user_runs as (
    select
      cx,cy,discovered_by,
      jsonb_agg(jsonb_build_array(start_idx,len) order by start_idx) runs
    from runs
    group by cx,cy,discovered_by
  ), grouped as (
    select
      cx,cy,
      jsonb_agg(
        jsonb_build_object(
          'user_id',discovered_by,
          'runs',runs
        )
        order by discovered_by
      ) groups
    from user_runs
    group by cx,cy
  ), treasure_numbered as (
    select
      cx,cy,idx,
      idx-row_number() over(partition by cx,cy order by idx)::int grp
    from base
    where is_treasure
  ), treasure_runs as (
    select
      cx,cy,
      jsonb_agg(
        jsonb_build_array(start_idx,len)
        order by start_idx
      ) runs
    from (
      select cx,cy,min(idx)::int start_idx,count(*)::int len
      from treasure_numbered
      group by cx,cy,grp
    ) x
    group by cx,cy
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'cx',r.cx,
      'cy',r.cy,
      'version',coalesce(c.version,0),
      'groups',coalesce(gp.groups,'[]'::jsonb),
      'treasure_runs',coalesce(tr.runs,'[]'::jsonb)
    )
    order by r.cy,r.cx
  ),'[]'::jsonb)
  into payload_v
  from req r
  left join public.game_map_chunks_v623 c
    on c.game_id=p_game_id and c.cx=r.cx and c.cy=r.cy
  left join grouped gp
    on gp.cx=r.cx and gp.cy=r.cy
  left join treasure_runs tr
    on tr.cx=r.cx and tr.cy=r.cy;

  return jsonb_build_object(
    'chunk_size',64,
    'chunks',payload_v
  );
end;
$$;

revoke all on function public.get_map_chunk_payloads_v623(uuid,jsonb) from public;
grant execute on function public.get_map_chunk_payloads_v623(uuid,jsonb) to authenticated;



-- =========================================================
-- 3) KOMPAKTE TERRAIN-ÜBERTRAGUNG
-- =========================================================
-- Statt bis zu 1.500 JSON-Objekten sendet der Browser zusammenhängende Runs:
-- [Startindex, Länge, Terrain-Typ, Label]

create or replace function public.cache_terrain_runs_v623(
  p_game_id uuid,
  p_runs jsonb
)
returns int
language plpgsql
security definer
set search_path=public
as $$
declare
  g public.games%rowtype;
  inserted_count int:=0;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if not exists(
    select 1 from public.game_players
    where game_id=p_game_id and user_id=auth.uid()
  ) then raise exception 'Nicht im Spiel'; end if;

  select * into g from public.games where id=p_game_id;
  if not found then raise exception 'Spiel nicht gefunden'; end if;

  if jsonb_typeof(coalesce(p_runs,'[]'::jsonb))<>'array' then
    raise exception 'Ungültige Terrain-Runs';
  end if;
  if jsonb_array_length(coalesce(p_runs,'[]'::jsonb))>1600 then
    raise exception 'Zu viele Terrain-Runs';
  end if;
  if (
    select coalesce(sum(greatest(0,least(1600,coalesce((r->>1)::int,0)))),0)
    from jsonb_array_elements(coalesce(p_runs,'[]'::jsonb)) r
  )>1600 then
    raise exception 'Maximal 1600 Terrain-Felder pro Batch';
  end if;

  with raw as (
    select
      greatest(0,coalesce((r->>0)::bigint,0)) start_idx,
      greatest(0,least(1600,coalesce((r->>1)::int,0))) len,
      lower(coalesce(r->>2,'unknown')) terrain_type,
      left(coalesce(r->>3,''),80) terrain_label
    from jsonb_array_elements(coalesce(p_runs,'[]'::jsonb)) r
    where jsonb_typeof(r)='array'
  ), expanded as (
    select
      start_idx+s.n idx,
      case when terrain_type in (
        'open','water','forest','grass','farmland','wetland','sand','rock',
        'park','residential','commercial','industrial','road','restricted','unknown'
      ) then terrain_type else 'unknown' end terrain_type,
      terrain_label
    from raw
    cross join lateral generate_series(0,len-1) s(n)
  ), limited as (
    select
      mod(idx,g.width)::int px,
      floor(idx::numeric/g.width)::int py,
      terrain_type,terrain_label
    from expanded
    where idx>=0 and idx<(g.width::bigint*g.height::bigint)
    order by idx
    limit 1600
  ), ins as (
    insert into public.game_terrain_cells(
      game_id,x,y,terrain_type,terrain_label,classified_at
    )
    select p_game_id,px,py,terrain_type,terrain_label,now()
    from limited
    on conflict(game_id,x,y) do nothing
    returning 1
  )
  select count(*)::int into inserted_count from ins;

  return inserted_count;
end;
$$;

revoke all on function public.cache_terrain_runs_v623(uuid,jsonb) from public;
grant execute on function public.cache_terrain_runs_v623(uuid,jsonb) to authenticated;
