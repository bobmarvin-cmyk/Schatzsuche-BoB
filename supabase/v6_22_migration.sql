-- SCHATZSUCHE ONLINE V6.22 – CHUNK MAP
-- Voraussetzung: V6.21.1 installiert.
-- EINMAL vollständig ausführen.

-- =========================================================
-- 1) FESTE COVERAGE-CHUNKS FÜR DIE ÜBERSICHT
-- =========================================================

create or replace function public.get_map_chunks_v622(
  p_game_id uuid,
  p_x0 int,
  p_x1 int,
  p_y0 int,
  p_y1 int
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  g public.games%rowtype;
  x0 int; x1 int; y0 int; y1 int;
  chunk_size int;
  rows_json jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if not exists(
    select 1 from public.game_players
    where game_id=p_game_id and user_id=auth.uid()
  ) then raise exception 'Nicht im Spiel'; end if;

  select * into g from public.games where id=p_game_id;
  if not found then raise exception 'Spiel nicht gefunden'; end if;

  x0:=greatest(0,least(coalesce(p_x0,0),g.width-1));
  x1:=greatest(0,least(coalesce(p_x1,g.width-1),g.width-1));
  y0:=greatest(0,least(coalesce(p_y0,0),g.height-1));
  y1:=greatest(0,least(coalesce(p_y1,g.height-1),g.height-1));

  if x1<x0 then x0:=x0+x1; x1:=x0-x1; x0:=x0-x1; end if;
  if y1<y0 then y0:=y0+y1; y1:=y0-y1; y0:=y0-y1; end if;

  -- Pro Spiel konstant. Bei riesigen Spielen darf ein Coverage-Chunk größer sein,
  -- aber die Größe ändert sich nie beim Zoomen.
  chunk_size:=greatest(32,g.archive_step*4);

  with base as (
    select
      floor((ac.bx*g.archive_step)::numeric/chunk_size)::int cx,
      floor((ac.by*g.archive_step)::numeric/chunk_size)::int cy,
      ac.user_id,
      sum(ac.n)::bigint n,
      bool_or(ac.has_treasure) has_treasure
    from public.game_archive_cell_counts ac
    where ac.game_id=p_game_id
      and (ac.bx*g.archive_step) <= x1
      and ((ac.bx+1)*g.archive_step-1) >= x0
      and (ac.by*g.archive_step) <= y1
      and ((ac.by+1)*g.archive_step-1) >= y0
    group by
      floor((ac.bx*g.archive_step)::numeric/chunk_size)::int,
      floor((ac.by*g.archive_step)::numeric/chunk_size)::int,
      ac.user_id
  ), dominant as (
    select distinct on(cx,cy)
      cx,cy,user_id,n
    from base
    order by cx,cy,n desc,user_id
  ), meta as (
    select
      cx,cy,
      sum(n)::bigint explored_count,
      bool_or(has_treasure) has_treasure
    from base
    group by cx,cy
  ), shaped as (
    select
      m.cx,m.cy,
      m.cx*chunk_size x,
      m.cy*chunk_size y,
      least(chunk_size,g.width-m.cx*chunk_size) w,
      least(chunk_size,g.height-m.cy*chunk_size) h,
      m.explored_count,
      least(
        1.0,
        m.explored_count::numeric /
        greatest(
          1,
          least(chunk_size,g.width-m.cx*chunk_size) *
          least(chunk_size,g.height-m.cy*chunk_size)
        )
      ) coverage,
      d.user_id discovered_by,
      m.has_treasure
    from meta m
    join dominant d using(cx,cy)
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'cx',cx,'cy',cy,
      'x',x,'y',y,
      'w',w,'h',h,
      'chunk_size',chunk_size,
      'explored_count',explored_count,
      'coverage',round(coverage,4),
      'discovered_by',discovered_by,
      'has_treasure',has_treasure
    )
    order by cy,cx
  ),'[]'::jsonb)
  into rows_json
  from shaped;

  return jsonb_build_object(
    'mode','chunks',
    'chunk_size',chunk_size,
    'chunks',rows_json,
    'field_version',coalesce(g.field_version,0)
  );
end;
$$;

revoke all on function public.get_map_chunks_v622(uuid,int,int,int,int) from public;
grant execute on function public.get_map_chunks_v622(uuid,int,int,int,int) to authenticated;

-- =========================================================
-- 2) EXAKTE EINZELZELLEN FÜR DIE NAHANSICHT
-- =========================================================

create or replace function public.get_map_cells_v622(
  p_game_id uuid,
  p_x0 int,
  p_x1 int,
  p_y0 int,
  p_y1 int
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  g public.games%rowtype;
  x0 int; x1 int; y0 int; y1 int;
  area bigint;
  rows_json jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if not exists(
    select 1 from public.game_players
    where game_id=p_game_id and user_id=auth.uid()
  ) then raise exception 'Nicht im Spiel'; end if;

  select * into g from public.games where id=p_game_id;
  if not found then raise exception 'Spiel nicht gefunden'; end if;

  x0:=greatest(0,least(coalesce(p_x0,0),g.width-1));
  x1:=greatest(0,least(coalesce(p_x1,g.width-1),g.width-1));
  y0:=greatest(0,least(coalesce(p_y0,0),g.height-1));
  y1:=greatest(0,least(coalesce(p_y1,g.height-1),g.height-1));

  if x1<x0 then x0:=x0+x1; x1:=x0-x1; x0:=x0-x1; end if;
  if y1<y0 then y0:=y0+y1; y1:=y0-y1; y0:=y0-y1; end if;

  area:=(x1-x0+1)::bigint*(y1-y0+1)::bigint;
  if area>60000 then
    raise exception 'Nahansicht zu groß – bitte näher hineinzoomen';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'x',ef.x,
      'y',ef.y,
      'size',1,
      'discovered_by',ef.discovered_by,
      'is_treasure',ef.is_treasure
    )
    order by ef.y,ef.x
  ),'[]'::jsonb)
  into rows_json
  from public.explored_fields ef
  where ef.game_id=p_game_id
    and ef.x between x0 and x1
    and ef.y between y0 and y1;

  return jsonb_build_object(
    'mode','cells',
    'fields',rows_json,
    'field_version',coalesce(g.field_version,0)
  );
end;
$$;

revoke all on function public.get_map_cells_v622(uuid,int,int,int,int) from public;
grant execute on function public.get_map_cells_v622(uuid,int,int,int,int) to authenticated;

-- Hot path for exact rectangular viewport reads.
create index if not exists explored_fields_game_xy_v622
  on public.explored_fields(game_id,x,y);
