
-- SCHATZSUCHE ONLINE V6.19
-- Sponsor-Spiele + serverseitige Schatz-Bergung + Terrain-Guard + Prämien-Grundlage.
-- Voraussetzung: V6.18 ist installiert.
-- EINMAL ausführen.

-- =========================================================
-- 1) SPONSORSPIELE
-- =========================================================

alter table public.games drop constraint if exists games_game_type_check;
alter table public.games
  add constraint games_game_type_check
  check(game_type in ('standard','pay','sponsor'));

alter table public.games
  add column if not exists sponsor_name text,
  add column if not exists sponsored_by uuid references public.profiles(id) on delete set null,
  add column if not exists sponsor_pool_ug bigint not null default 0;

create or replace function public.create_sponsor_game_v619(
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
  p_sponsor_name text default null,
  p_sponsor_gold_ug bigint default 0,
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
  w public.gold_wallets%rowtype;
  sponsor_label text;
  allocated bigint:=0;
  piece bigint;
  i int;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if p_sponsor_gold_ug<=0 then raise exception 'Sponsor-Pool muss größer 0 sein'; end if;

  insert into public.gold_wallets(user_id) values(auth.uid())
  on conflict(user_id) do nothing;

  select * into w
  from public.gold_wallets
  where user_id=auth.uid()
  for update;

  if w.balance_ug<p_sponsor_gold_ug then
    raise exception 'Nicht genug Goldstaub für den Sponsor-Pool';
  end if;

  -- Wir nutzen die bewährte Standard-Erstellung und wandeln das Spiel danach
  -- in ein kostenloses Sponsor-Spiel um.
  gid:=public.create_game_v612(
    p_name,p_field_count,p_cell_size_m,p_max_players,p_location_mode,
    p_center_lat,p_center_lon,p_center_label,p_regen_seconds,p_max_stored_moves,
    p_is_private,p_password,'standard',0,p_treasure_count,p_gimmick_percent
  );

  select coalesce(nullif(trim(p_sponsor_name),''),p.display_name,'Sponsor')
  into sponsor_label
  from public.profiles p
  where p.id=auth.uid();

  update public.gold_wallets
  set balance_ug=balance_ug-p_sponsor_gold_ug,updated_at=now()
  where user_id=auth.uid();

  insert into public.gold_transactions(user_id,game_id,amount_ug,transaction_type,note)
  values(auth.uid(),gid,-p_sponsor_gold_ug,'sponsor_funding','Sponsor-Pool gestiftet');

  update public.games
  set game_type='sponsor',
      sponsor_name=sponsor_label,
      sponsored_by=auth.uid(),
      sponsor_pool_ug=p_sponsor_gold_ug,
      gold_prize_pool_ug=p_sponsor_gold_ug,
      entry_gold_ug=0
  where id=gid;

  for i in 1..p_treasure_count loop
    piece:=floor(
      p_sponsor_gold_ug::numeric *
      (select share_bps from public.gold_treasures
       where game_id=gid and treasure_no=i) / 10000
    )::bigint;

    update public.gold_treasures
    set amount_ug=piece
    where game_id=gid and treasure_no=i;

    allocated:=allocated+piece;
  end loop;

  if p_sponsor_gold_ug>allocated then
    update public.gold_treasures
    set amount_ug=amount_ug+(p_sponsor_gold_ug-allocated)
    where game_id=gid and treasure_no=1;
  end if;

  return gid;
end;
$$;

revoke all on function public.create_sponsor_game_v619(
  text,bigint,numeric,int,text,numeric,numeric,text,int,int,
  boolean,text,text,bigint,int,numeric
) from public;
grant execute on function public.create_sponsor_game_v619(
  text,bigint,numeric,int,text,numeric,numeric,text,int,int,
  boolean,text,text,bigint,int,numeric
) to authenticated;


-- =========================================================
-- 2) TERRAIN-CACHE OHNE UPDATE-DEADLOCKS + BATCH
-- =========================================================

create or replace function public.cache_terrain_cell_v618(
  p_game_id uuid,
  p_x int,
  p_y int,
  p_terrain_type text,
  p_terrain_label text default ''
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  g public.games%rowtype;
  t text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if not exists(
    select 1 from public.game_players
    where game_id=p_game_id and user_id=auth.uid()
  ) then raise exception 'Nicht im Spiel'; end if;

  select * into g from public.games where id=p_game_id;
  if not found then raise exception 'Spiel nicht gefunden'; end if;
  if p_x<0 or p_y<0 or p_x>=g.width or p_y>=g.height then
    raise exception 'Feld außerhalb des Spiels';
  end if;

  t:=lower(coalesce(p_terrain_type,'unknown'));
  if t not in ('open','water','forest','grass','farmland','wetland','sand','rock','park','residential','commercial','industrial','road','restricted','unknown') then
    t:='unknown';
  end if;

  -- Einmal klassifiziert bleibt ein Feld stabil. Kein konkurrierendes UPDATE mehr.
  insert into public.game_terrain_cells(game_id,x,y,terrain_type,terrain_label,classified_at)
  values(p_game_id,p_x,p_y,t,left(coalesce(p_terrain_label,''),80),now())
  on conflict(game_id,x,y) do nothing;

  return jsonb_build_object('terrain_type',t,'x',p_x,'y',p_y);
end;
$$;

create or replace function public.cache_terrain_cells_v619(
  p_game_id uuid,
  p_cells jsonb
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

  with raw as (
    select
      (x->>'x')::int px,
      (x->>'y')::int py,
      lower(coalesce(x->>'terrain_type','unknown')) terrain_type,
      left(coalesce(x->>'terrain_label',''),80) terrain_label
    from jsonb_array_elements(coalesce(p_cells,'[]'::jsonb)) x
  ), clean as (
    select
      px,py,
      case when terrain_type in (
        'open','water','forest','grass','farmland','wetland','sand','rock',
        'park','residential','commercial','industrial','road','restricted','unknown'
      ) then terrain_type else 'unknown' end terrain_type,
      terrain_label
    from raw
    where px between 0 and g.width-1
      and py between 0 and g.height-1
    order by py,px
    limit 1600
  ), ins as (
    insert into public.game_terrain_cells(
      game_id,x,y,terrain_type,terrain_label,classified_at
    )
    select p_game_id,px,py,terrain_type,terrain_label,now()
    from clean
    on conflict(game_id,x,y) do nothing
    returning 1
  )
  select count(*)::int into inserted_count from ins;

  return inserted_count;
end;
$$;
revoke all on function public.cache_terrain_cells_v619(uuid,jsonb) from public;
grant execute on function public.cache_terrain_cells_v619(uuid,jsonb) to authenticated;

create or replace function public.terrain_access_allowed_v619(
  p_game_id uuid,p_user_id uuid,p_x int,p_y int
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  with tc as (
    select terrain_type
    from public.game_terrain_cells
    where game_id=p_game_id and x=p_x and y=p_y
  )
  select case
    -- Nicht vermessene Felder werden NICHT automatisch aufgedeckt.
    when not exists(select 1 from tc) then false
    when exists(
      select 1 from public.player_technologies
      where game_id=p_game_id and user_id=p_user_id and technology_id='ter7'
    ) then true
    when (select terrain_type from tc)='forest' then exists(
      select 1 from public.player_technologies
      where game_id=p_game_id and user_id=p_user_id and technology_id='ter2'
    )
    when (select terrain_type from tc)='water' then exists(
      select 1 from public.player_technologies
      where game_id=p_game_id and user_id=p_user_id and technology_id='ter4'
    )
    when (select terrain_type from tc)='wetland' then exists(
      select 1 from public.player_technologies
      where game_id=p_game_id and user_id=p_user_id and technology_id='ter5'
    )
    when (select terrain_type from tc) in ('industrial','restricted') then exists(
      select 1 from public.player_technologies
      where game_id=p_game_id and user_id=p_user_id and technology_id='ter6'
    )
    else true
  end;
$$;

create or replace function public.guard_terrain_insert_v619()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if coalesce(current_setting('app.terrain_bypass',true),'')='1' then
    return new;
  end if;

  if not public.terrain_access_allowed_v619(
    new.game_id,new.discovered_by,new.x,new.y
  ) then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists terrain_guard_v619 on public.explored_fields;
create trigger terrain_guard_v619
before insert on public.explored_fields
for each row execute function public.guard_terrain_insert_v619();


-- =========================================================
-- 3) ENTDECKT != GEBORGEN
-- =========================================================

create table if not exists public.treasure_claims_v619(
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  treasure_id uuid not null references public.gold_treasures(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  challenge_code text not null,
  status text not null default 'pending'
    check(status in ('pending','passed','failed','expired')),
  created_at timestamptz not null default now(),
  revealed_at timestamptz,
  expires_at timestamptz not null default now()+interval '90 seconds',
  resolved_at timestamptz
);

create unique index if not exists treasure_claim_pending_unique_v619
  on public.treasure_claims_v619(treasure_id)
  where status='pending';

create index if not exists treasure_claim_user_pending_v619
  on public.treasure_claims_v619(user_id,game_id,status,created_at);

alter table public.treasure_claims_v619 enable row level security;
drop policy if exists "own claims readable" on public.treasure_claims_v619;
create policy "own claims readable"
on public.treasure_claims_v619 for select to authenticated
using(user_id=auth.uid());

create or replace function public.intercept_treasure_claim_v619()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  code text:='';
  i int;
begin
  if old.found_by is null
     and new.found_by is not null
     and coalesce(current_setting('app.claim_finalize',true),'')<>'1' then

    for i in 1..6 loop
      code:=code||(1+floor(random()*4)::int)::text;
    end loop;

    insert into public.treasure_claims_v619(
      game_id,treasure_id,user_id,challenge_code,status,expires_at
    )
    values(old.game_id,old.id,new.found_by,code,'pending',now()+interval '90 seconds')
    on conflict do nothing;

    -- Schatz bleibt technisch unbeansprucht, bis die Bergungsprüfung bestanden ist.
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists intercept_treasure_claim_v619 on public.gold_treasures;
create trigger intercept_treasure_claim_v619
before update of found_by on public.gold_treasures
for each row execute function public.intercept_treasure_claim_v619();

create or replace function public.get_my_pending_claim_v619(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  c public.treasure_claims_v619%rowtype;
  gt public.gold_treasures%rowtype;
  visible_code text;
begin
  select * into c
  from public.treasure_claims_v619
  where game_id=p_game_id
    and user_id=auth.uid()
    and status='pending'
  order by created_at
  limit 1
  for update;

  if not found then return null; end if;

  if c.revealed_at is null then
    update public.treasure_claims_v619
    set revealed_at=now()
    where id=c.id
    returning * into c;
  end if;

  select * into gt from public.gold_treasures where id=c.treasure_id;

  -- Die Folge wird nur in den ersten vier Sekunden nach dem ersten Abruf geliefert.
  -- Neuladen der Seite zeigt sie danach nicht erneut.
  visible_code:=case
    when now()<=c.revealed_at+interval '4 seconds' then c.challenge_code
    else ''
  end;

  return jsonb_build_object(
    'id',c.id,
    'treasure_no',gt.treasure_no,
    'challenge_code',visible_code,
    'created_at',c.created_at,
    'revealed_at',c.revealed_at,
    'expires_at',c.expires_at,
    'share_bps',gt.share_bps,
    'amount_ug',gt.amount_ug
  );
end;
$$;
revoke all on function public.get_my_pending_claim_v619(uuid) from public;
grant execute on function public.get_my_pending_claim_v619(uuid) to authenticated;

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
begin
  select * into g from public.games where id=p_game_id;
  select x,y into oldx,oldy from public.gold_treasures where id=p_treasure_id;

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

create or replace function public.resolve_treasure_claim_v619(
  p_claim_id uuid,p_answer text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  c public.treasure_claims_v619%rowtype;
  gt public.gold_treasures%rowtype;
  g public.games%rowtype;
  remaining int;
  winner_id_v uuid;
  winner_name_v text;
  winner_moves_v bigint;
  winner_share_v int;
  player_count_v int;
  bonus bigint:=0;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;

  select * into c
  from public.treasure_claims_v619
  where id=p_claim_id and user_id=auth.uid()
  for update;

  if not found or c.status<>'pending' then
    raise exception 'Bergungsprüfung nicht mehr aktiv';
  end if;

  select * into gt
  from public.gold_treasures
  where id=c.treasure_id
  for update;

  select * into g from public.games where id=c.game_id for update;

  if now()>c.expires_at then
    update public.treasure_claims_v619
    set status='expired',resolved_at=now()
    where id=c.id;

    perform public.relocate_treasure_v619(gt.id,c.game_id);

    return jsonb_build_object(
      'passed',false,'reason','expired',
      'message','⏱️ Bergung zu spät – der Schatz wurde neu versteckt.'
    );
  end if;

  if coalesce(trim(p_answer),'')<>c.challenge_code then
    update public.treasure_claims_v619
    set status='failed',resolved_at=now()
    where id=c.id;

    perform public.relocate_treasure_v619(gt.id,c.game_id);

    return jsonb_build_object(
      'passed',false,'reason','wrong',
      'message','❌ Bergung misslungen – der Schatz wurde an anderer Stelle neu versteckt.'
    );
  end if;

  update public.treasure_claims_v619
  set status='passed',resolved_at=now()
  where id=c.id;

  perform set_config('app.claim_finalize','1',true);
  update public.gold_treasures
  set found_by=auth.uid(),found_at=now()
  where id=gt.id and found_by is null;

  update public.game_players
  set treasure_share_bps=treasure_share_bps+gt.share_bps,
      treasure_parts_found=treasure_parts_found+1,
      last_treasure_found_at=now()
  where game_id=c.game_id and user_id=auth.uid();

  if gt.amount_ug>0 then
    insert into public.gold_wallets(user_id) values(auth.uid())
    on conflict(user_id) do nothing;

    update public.gold_wallets
    set balance_ug=balance_ug+gt.amount_ug,updated_at=now()
    where user_id=auth.uid();

    update public.profiles
    set gold_found_ug=gold_found_ug+gt.amount_ug
    where id=auth.uid();

    insert into public.gold_transactions(
      user_id,game_id,amount_ug,transaction_type,note
    )
    values(
      auth.uid(),c.game_id,gt.amount_ug,
      case when g.game_type='sponsor' then 'sponsor_treasure_reward' else 'treasure_reward' end,
      'Schatz nach bestandener Bergungsprüfung'
    );

    update public.games
    set gold_prize_pool_ug=greatest(0,gold_prize_pool_ug-gt.amount_ug)
    where id=c.game_id;
  end if;

  select count(*)::int into remaining
  from public.gold_treasures
  where game_id=c.game_id
    and found_by is null
    and forfeited_at is null;

  if remaining=0 then
    select gp.user_id,p.display_name,gp.moves_used,gp.treasure_share_bps
    into winner_id_v,winner_name_v,winner_moves_v,winner_share_v
    from public.game_players gp
    join public.profiles p on p.id=gp.user_id
    where gp.game_id=c.game_id
    order by gp.treasure_share_bps desc,
             gp.last_treasure_found_at asc nulls last,
             gp.moves_used asc,gp.joined_at asc
    limit 1;

    update public.games
    set status='finished',
        winner_id=winner_id_v,
        closed_at=coalesce(closed_at,now()),
        close_reason=coalesce(close_reason,'completed')
    where id=c.game_id and status='active';

    select count(*) into player_count_v
    from public.game_players where game_id=c.game_id;

    if player_count_v>=2 then
      update public.profiles set wins=wins+1 where id=winner_id_v;
    end if;

    bonus:=public.award_winner_taler_gold_v613(c.game_id);
    perform public.emit_game_win_event_v6151(c.game_id);
  end if;

  return jsonb_build_object(
    'passed',true,
    'message','✅ Bergung geschafft – Schatz gesichert!',
    'share_bps',gt.share_bps,
    'amount_ug',gt.amount_ug,
    'treasure_no',gt.treasure_no,
    'remaining_treasures',remaining,
    'game_over',remaining=0,
    'winner_id',winner_id_v,
    'winner_name',winner_name_v,
    'winner_moves_used',coalesce(winner_moves_v,0),
    'winner_share_bps',coalesce(winner_share_v,0),
    'winner_taler_gold_ug',bonus
  );
end;
$$;
revoke all on function public.resolve_treasure_claim_v619(uuid,text) from public;
grant execute on function public.resolve_treasure_claim_v619(uuid,text) to authenticated;


-- =========================================================
-- 4) BARREN/PRÄMIEN – TECHNISCHE GRUNDLAGE, STANDARDMÄSSIG AUS
-- =========================================================

alter table public.platform_settings
  add column if not exists redemptions_enabled boolean not null default false,
  add column if not exists gold_bar_size_mg int not null default 1000,
  add column if not exists gold_bar_cost_ug bigint not null default 1000000;

create table if not exists public.gold_redemption_requests_v619(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_ug bigint not null,
  reward_type text not null default 'gold_bar',
  status text not null default 'pending'
    check(status in ('pending','approved','fulfilled','rejected','cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.gold_redemption_requests_v619 enable row level security;
drop policy if exists "own redemption requests readable" on public.gold_redemption_requests_v619;
create policy "own redemption requests readable"
on public.gold_redemption_requests_v619 for select to authenticated
using(user_id=auth.uid());

create or replace function public.request_gold_bar_v619()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  s public.platform_settings%rowtype;
  w public.gold_wallets%rowtype;
  rid uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into s from public.platform_settings where id=1;

  if not coalesce(s.redemptions_enabled,false) then
    raise exception 'Barren-/Prämieneinlösung ist noch nicht freigeschaltet';
  end if;

  select * into w from public.gold_wallets where user_id=auth.uid() for update;
  if not found or w.balance_ug<s.gold_bar_cost_ug then
    raise exception 'Nicht genug Goldstaub';
  end if;

  update public.gold_wallets
  set balance_ug=balance_ug-s.gold_bar_cost_ug,updated_at=now()
  where user_id=auth.uid();

  insert into public.gold_transactions(user_id,amount_ug,transaction_type,note)
  values(auth.uid(),-s.gold_bar_cost_ug,'redemption_request','Goldbarren-Prämie angefordert');

  insert into public.gold_redemption_requests_v619(user_id,amount_ug,reward_type)
  values(auth.uid(),s.gold_bar_cost_ug,'gold_bar')
  returning id into rid;

  return jsonb_build_object(
    'request_id',rid,
    'message','Prämienanfrage wurde angelegt',
    'bar_size_mg',s.gold_bar_size_mg
  );
end;
$$;
revoke all on function public.request_gold_bar_v619() from public;
grant execute on function public.request_gold_bar_v619() to authenticated;
