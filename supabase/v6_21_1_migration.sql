-- SCHATZSUCHE ONLINE V6.21.1
-- Ruhige Karte, Admin-Geodatenanalyse, Goldbarrenschmelze.
-- Voraussetzung: V6.21 installiert. EINMAL ausführen.

-- =========================================================
-- 1) ADMIN-GEODATEN-/HINTERGRUNDANALYSE
-- =========================================================

create or replace function public.admin_analyze_field_v6211(
  p_game_id uuid,p_x int,p_y int
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  g public.games%rowtype;
  terrain text;
  label text;
  lat_v numeric;
  lon_v numeric;
  meters_lon numeric;
  explored_v boolean;
  discovered_by_v uuid;
  nearest_water numeric;
  nearest_forest numeric;
  nearest_urban numeric;
  nearest_road numeric;
  nearest_treasure numeric;
  nearest_treasure_no int;
begin
  if not public.is_admin_v67() then raise exception 'Keine Admin-Berechtigung'; end if;

  select * into g from public.games where id=p_game_id;
  if not found then raise exception 'Spiel nicht gefunden'; end if;
  if p_x<0 or p_y<0 or p_x>=g.width or p_y>=g.height then
    raise exception 'Feld außerhalb des Spiels';
  end if;

  meters_lon:=greatest(1000,111320*cos(radians(g.center_lat)));
  lat_v:=g.center_lat + ((g.height/2.0)-(p_y+0.5))*g.cell_size_m/111320.0;
  lon_v:=g.center_lon + ((p_x+0.5)-(g.width/2.0))*g.cell_size_m/meters_lon;

  select tc.terrain_type,tc.terrain_label
  into terrain,label
  from public.game_terrain_cells tc
  where tc.game_id=p_game_id and tc.x=p_x and tc.y=p_y
  limit 1;

  select true,ef.discovered_by
  into explored_v,discovered_by_v
  from public.explored_fields ef
  where ef.game_id=p_game_id and ef.x=p_x and ef.y=p_y
  limit 1;

  select min(sqrt(power(tc.x-p_x,2)+power(tc.y-p_y,2))*g.cell_size_m)
  into nearest_water
  from public.game_terrain_cells tc
  where tc.game_id=p_game_id and tc.terrain_type='water';

  select min(sqrt(power(tc.x-p_x,2)+power(tc.y-p_y,2))*g.cell_size_m)
  into nearest_forest
  from public.game_terrain_cells tc
  where tc.game_id=p_game_id and tc.terrain_type='forest';

  select min(sqrt(power(tc.x-p_x,2)+power(tc.y-p_y,2))*g.cell_size_m)
  into nearest_urban
  from public.game_terrain_cells tc
  where tc.game_id=p_game_id
    and tc.terrain_type in ('residential','commercial','industrial','park');

  select min(sqrt(power(tc.x-p_x,2)+power(tc.y-p_y,2))*g.cell_size_m)
  into nearest_road
  from public.game_terrain_cells tc
  where tc.game_id=p_game_id and tc.terrain_type='road';

  select
    sqrt(power(gt.x-p_x,2)+power(gt.y-p_y,2))*g.cell_size_m,
    gt.treasure_no
  into nearest_treasure,nearest_treasure_no
  from public.gold_treasures gt
  where gt.game_id=p_game_id
    and gt.found_by is null
    and gt.forfeited_at is null
  order by sqrt(power(gt.x-p_x,2)+power(gt.y-p_y,2))
  limit 1;

  return jsonb_build_object(
    'game_id',g.id,
    'game_name',g.name,
    'x',p_x,'y',p_y,
    'lat',round(lat_v,6),
    'lon',round(lon_v,6),
    'terrain_type',coalesce(terrain,'unknown'),
    'terrain_label',coalesce(label,'Noch nicht kartiert'),
    'explored',coalesce(explored_v,false),
    'discovered_by',discovered_by_v,
    'nearest_water_m',round(nearest_water),
    'nearest_forest_m',round(nearest_forest),
    'nearest_urban_m',round(nearest_urban),
    'nearest_road_m',round(nearest_road),
    'nearest_open_treasure_m',round(nearest_treasure),
    'nearest_open_treasure_no',nearest_treasure_no,
    'cached_terrain_cells',(
      select count(*) from public.game_terrain_cells tc where tc.game_id=p_game_id
    )
  );
end;
$$;
revoke all on function public.admin_analyze_field_v6211(uuid,int,int) from public;
grant execute on function public.admin_analyze_field_v6211(uuid,int,int) to authenticated;

create or replace function public.admin_get_treasure_profiles_v6211(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  r record;
  result jsonb:='[]'::jsonb;
  p public.treasure_profiles_v621%rowtype;
begin
  if not public.is_admin_v67() then raise exception 'Keine Admin-Berechtigung'; end if;

  for r in
    select *
    from public.gold_treasures
    where game_id=p_game_id
    order by treasure_no
  loop
    select * into p from public.refresh_treasure_profile_v621(r.id);
    result:=result||jsonb_build_array(jsonb_build_object(
      'treasure_id',r.id,
      'treasure_no',r.treasure_no,
      'x',r.x,'y',r.y,
      'found_by',r.found_by,
      'share_bps',r.share_bps,
      'amount_ug',r.amount_ug,
      'sector',p.sector,
      'quadrant',p.quadrant,
      'center_distance_m',round(p.center_distance_m),
      'edge_distance_m',round(p.edge_distance_m),
      'terrain_type',p.terrain_type,
      'nearest_water_m',round(p.nearest_water_m),
      'nearest_forest_m',round(p.nearest_forest_m),
      'nearest_urban_m',round(p.nearest_urban_m),
      'nearest_road_m',round(p.nearest_road_m),
      'terrain_samples',p.terrain_samples
    ));
  end loop;

  return result;
end;
$$;
revoke all on function public.admin_get_treasure_profiles_v6211(uuid) from public;
grant execute on function public.admin_get_treasure_profiles_v6211(uuid) to authenticated;

-- =========================================================
-- 2) GOLD BAR SMELTER / DIGITALE BARREN
-- =========================================================

alter table public.platform_settings
  add column if not exists smelting_enabled boolean not null default true,
  add column if not exists allowed_bar_sizes_mg int[] not null
    default array[100,250,500,1000,2500,5000];

create table if not exists public.gold_bars_v6211(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  size_mg int not null check(size_mg>0),
  cost_ug bigint not null check(cost_ug>0),
  serial_no text not null unique,
  status text not null default 'minted'
    check(status in ('minted','redemption_requested','redeemed','remelted','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  redeemed_at timestamptz
);

alter table public.gold_bars_v6211 enable row level security;
drop policy if exists "own gold bars readable v6211" on public.gold_bars_v6211;
create policy "own gold bars readable v6211"
on public.gold_bars_v6211 for select to authenticated
using(user_id=auth.uid());

alter table public.gold_redemption_requests_v619
  add column if not exists bar_id uuid references public.gold_bars_v6211(id) on delete set null;

create unique index if not exists gold_redemption_bar_active_v6211
  on public.gold_redemption_requests_v619(bar_id)
  where bar_id is not null and status in ('pending','approved','fulfilled');

create or replace function public.smelt_gold_bar_v6211(p_size_mg int)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  s public.platform_settings%rowtype;
  w public.gold_wallets%rowtype;
  cost_v bigint;
  bar_id_v uuid;
  serial_v text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into s from public.platform_settings where id=1;

  if not coalesce(s.smelting_enabled,false) then
    raise exception 'Goldbarrenschmelze ist momentan deaktiviert';
  end if;
  if not p_size_mg=any(s.allowed_bar_sizes_mg) then
    raise exception 'Diese Barrengröße ist nicht freigeschaltet';
  end if;

  cost_v:=p_size_mg::bigint*1000;

  insert into public.gold_wallets(user_id) values(auth.uid())
  on conflict(user_id) do nothing;

  select * into w
  from public.gold_wallets
  where user_id=auth.uid()
  for update;

  if w.balance_ug<cost_v then
    raise exception 'Nicht genug Goldstaub für diesen Barren';
  end if;

  serial_v:='BOB-'||to_char(now(),'YYYYMMDD')||'-'||
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));

  update public.gold_wallets
  set balance_ug=balance_ug-cost_v,updated_at=now()
  where user_id=auth.uid();

  insert into public.gold_bars_v6211(user_id,size_mg,cost_ug,serial_no)
  values(auth.uid(),p_size_mg,cost_v,serial_v)
  returning id into bar_id_v;

  insert into public.gold_transactions(user_id,amount_ug,transaction_type,note)
  values(
    auth.uid(),-cost_v,'gold_bar_smelt',
    p_size_mg||' mg zu digitalem Goldbarren '||serial_v||' gegossen'
  );

  return jsonb_build_object(
    'bar_id',bar_id_v,
    'serial_no',serial_v,
    'size_mg',p_size_mg,
    'cost_ug',cost_v,
    'message','🔥 '||p_size_mg||' mg Goldbarren gegossen.'
  );
end;
$$;
revoke all on function public.smelt_gold_bar_v6211(int) from public;
grant execute on function public.smelt_gold_bar_v6211(int) to authenticated;

create or replace function public.remelt_gold_bar_v6211(p_bar_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  b public.gold_bars_v6211%rowtype;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;

  select * into b
  from public.gold_bars_v6211
  where id=p_bar_id and user_id=auth.uid()
  for update;

  if not found then raise exception 'Barren nicht gefunden'; end if;
  if b.status<>'minted' then
    raise exception 'Nur frei verfügbare digitale Barren können wieder eingeschmolzen werden';
  end if;

  insert into public.gold_wallets(user_id) values(auth.uid())
  on conflict(user_id) do nothing;

  update public.gold_wallets
  set balance_ug=balance_ug+b.cost_ug,updated_at=now()
  where user_id=auth.uid();

  update public.gold_bars_v6211
  set status='remelted',updated_at=now()
  where id=b.id;

  insert into public.gold_transactions(user_id,amount_ug,transaction_type,note)
  values(
    auth.uid(),b.cost_ug,'gold_bar_remelt',
    'Digitalen Goldbarren '||b.serial_no||' wieder zu Goldstaub eingeschmolzen'
  );

  return jsonb_build_object(
    'message','♻️ Barren wieder eingeschmolzen.',
    'amount_ug',b.cost_ug
  );
end;
$$;
revoke all on function public.remelt_gold_bar_v6211(uuid) from public;
grant execute on function public.remelt_gold_bar_v6211(uuid) to authenticated;

create or replace function public.request_bar_redemption_v6211(p_bar_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  s public.platform_settings%rowtype;
  b public.gold_bars_v6211%rowtype;
  rid uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;

  select * into s from public.platform_settings where id=1;
  if not coalesce(s.redemptions_enabled,false) then
    raise exception 'Physische Barren-/Prämienausgabe ist noch nicht freigeschaltet';
  end if;

  select * into b
  from public.gold_bars_v6211
  where id=p_bar_id and user_id=auth.uid()
  for update;

  if not found then raise exception 'Barren nicht gefunden'; end if;
  if b.status<>'minted' then raise exception 'Dieser Barren ist nicht frei einlösbar'; end if;

  insert into public.gold_redemption_requests_v619(
    user_id,amount_ug,reward_type,status,bar_id
  )
  values(auth.uid(),b.cost_ug,'gold_bar','pending',b.id)
  returning id into rid;

  update public.gold_bars_v6211
  set status='redemption_requested',updated_at=now()
  where id=b.id;

  return jsonb_build_object(
    'request_id',rid,
    'bar_id',b.id,
    'serial_no',b.serial_no,
    'size_mg',b.size_mg,
    'message','🪙 Physische Ausgabe wurde angefragt.'
  );
end;
$$;
revoke all on function public.request_bar_redemption_v6211(uuid) from public;
grant execute on function public.request_bar_redemption_v6211(uuid) to authenticated;

create or replace function public.admin_set_smelter_settings_v6211(
  p_smelting_enabled boolean,
  p_redemptions_enabled boolean,
  p_allowed_sizes_mg int[]
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  cleaned int[];
begin
  if not public.is_admin_v67() then raise exception 'Keine Admin-Berechtigung'; end if;

  select array_agg(distinct x order by x)
  into cleaned
  from unnest(coalesce(p_allowed_sizes_mg,'{}'::int[])) x
  where x between 10 and 100000;

  if cleaned is null or array_length(cleaned,1)=0 then
    raise exception 'Mindestens eine Barrengröße ist erforderlich';
  end if;

  update public.platform_settings
  set smelting_enabled=coalesce(p_smelting_enabled,false),
      redemptions_enabled=coalesce(p_redemptions_enabled,false),
      allowed_bar_sizes_mg=cleaned,
      updated_at=now()
  where id=1;

  return jsonb_build_object(
    'message','Goldbarrenschmelze gespeichert',
    'smelting_enabled',p_smelting_enabled,
    'redemptions_enabled',p_redemptions_enabled,
    'allowed_sizes_mg',cleaned
  );
end;
$$;
revoke all on function public.admin_set_smelter_settings_v6211(boolean,boolean,int[]) from public;
grant execute on function public.admin_set_smelter_settings_v6211(boolean,boolean,int[]) to authenticated;

create or replace function public.admin_gold_bars_overview_v6211()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if not public.is_admin_v67() then raise exception 'Keine Admin-Berechtigung'; end if;

  return jsonb_build_object(
    'minted_count',(select count(*) from public.gold_bars_v6211 where status='minted'),
    'minted_mg',(select coalesce(sum(size_mg),0) from public.gold_bars_v6211 where status='minted'),
    'requested_count',(select count(*) from public.gold_bars_v6211 where status='redemption_requested'),
    'requested_mg',(select coalesce(sum(size_mg),0) from public.gold_bars_v6211 where status='redemption_requested'),
    'redeemed_count',(select count(*) from public.gold_bars_v6211 where status='redeemed'),
    'redeemed_mg',(select coalesce(sum(size_mg),0) from public.gold_bars_v6211 where status='redeemed')
  );
end;
$$;
revoke all on function public.admin_gold_bars_overview_v6211() from public;
grant execute on function public.admin_gold_bars_overview_v6211() to authenticated;
