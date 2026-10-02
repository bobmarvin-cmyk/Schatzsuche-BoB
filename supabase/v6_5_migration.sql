-- SCHATZSUCHE ONLINE V6.5 – GOLDSTAUB TESTÖKONOMIE
-- WICHTIG: ausschließlich Test-Gold ohne Echtgeldkauf/Auszahlung.
-- Nach V6.4 EINMAL im Supabase SQL Editor ausführen.

alter table public.profiles add column if not exists gold_found_ug bigint not null default 0;

create table if not exists public.gold_wallets(
 user_id uuid primary key references public.profiles(id) on delete cascade,
 balance_ug bigint not null default 0 check(balance_ug>=0),
 test_grant_claimed boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.gold_wallets enable row level security;
drop policy if exists "wallet self read" on public.gold_wallets;
create policy "wallet self read" on public.gold_wallets for select to authenticated using(user_id=auth.uid());

insert into public.gold_wallets(user_id)
select id from public.profiles
on conflict(user_id) do nothing;

create table if not exists public.gold_transactions(
 id bigserial primary key,
 user_id uuid references public.profiles(id) on delete set null,
 game_id uuid references public.games(id) on delete set null,
 amount_ug bigint not null,
 transaction_type text not null,
 note text,
 created_at timestamptz not null default now()
);
alter table public.gold_transactions enable row level security;
drop policy if exists "gold tx self read" on public.gold_transactions;
create policy "gold tx self read" on public.gold_transactions for select to authenticated using(user_id=auth.uid());

create table if not exists public.platform_settings(
 id int primary key default 1 check(id=1),
 prize_share_bps int not null default 9000,
 community_share_bps int not null default 500,
 platform_share_bps int not null default 500,
 multi_treasure_threshold_ug bigint not null default 500000,
 max_treasures int not null default 5,
 test_grant_ug bigint not null default 250000,
 gold_price_cents_per_001g int not null default 200,
 community_reserve_ug bigint not null default 0,
 platform_revenue_ug bigint not null default 0,
 updated_at timestamptz not null default now(),
 check(prize_share_bps+community_share_bps+platform_share_bps=10000)
);
insert into public.platform_settings(id) values(1) on conflict(id) do nothing;
alter table public.platform_settings enable row level security;
drop policy if exists "settings readable" on public.platform_settings;
create policy "settings readable" on public.platform_settings for select to authenticated using(true);

alter table public.games add column if not exists game_type text not null default 'standard' check(game_type in ('standard','pay'));
alter table public.games add column if not exists entry_gold_ug bigint not null default 0;
alter table public.games add column if not exists treasure_count int not null default 1;
alter table public.games add column if not exists gold_prize_pool_ug bigint not null default 0;

create table if not exists public.gold_treasures(
 id uuid primary key default gen_random_uuid(),
 game_id uuid not null references public.games(id) on delete cascade,
 treasure_no int not null,
 x int not null,
 y int not null,
 amount_ug bigint not null default 0,
 found_by uuid references public.profiles(id) on delete set null,
 found_at timestamptz,
 unique(game_id,treasure_no),
 unique(game_id,x,y)
);
alter table public.gold_treasures enable row level security;
-- Keine SELECT-Policy: x/y bleiben serverseitig geheim.

create or replace function public.get_gold_treasure_status_v65(p_game_id uuid)
returns table(id uuid,treasure_no int,amount_ug bigint,found_by uuid,found_at timestamptz)
language sql security definer set search_path=public as $$
 select gt.id,gt.treasure_no,gt.amount_ug,gt.found_by,gt.found_at
 from gold_treasures gt
 where gt.game_id=p_game_id
   and exists(select 1 from game_players gp where gp.game_id=p_game_id and gp.user_id=auth.uid())
 order by gt.treasure_no
$$;

create or replace function public.claim_test_gold_v65()
returns jsonb language plpgsql security definer set search_path=public as $$
declare s platform_settings%rowtype; w gold_wallets%rowtype;
begin
 if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
 select * into s from platform_settings where id=1;

 insert into gold_wallets(user_id) values(auth.uid()) on conflict(user_id) do nothing;
 select * into w from gold_wallets where user_id=auth.uid() for update;

 if w.test_grant_claimed then raise exception 'Test-Gold wurde bereits abgeholt'; end if;

 update gold_wallets
 set balance_ug=balance_ug+s.test_grant_ug,test_grant_claimed=true,updated_at=now()
 where user_id=auth.uid();

 insert into gold_transactions(user_id,amount_ug,transaction_type,note)
 values(auth.uid(),s.test_grant_ug,'test_grant','Einmaliges V6.5 Test-Gold');

 return jsonb_build_object('message','Test-Goldstaub gutgeschrieben','amount_ug',s.test_grant_ug);
end $$;

create or replace function public.distribute_community_gold_v65(p_amount_ug bigint,p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare cnt bigint; per_user bigint; distributed bigint;
begin
 if p_amount_ug<=0 then return; end if;

 select count(*) into cnt from gold_wallets;
 if cnt<=0 then
  update platform_settings set community_reserve_ug=community_reserve_ug+p_amount_ug where id=1;
  return;
 end if;

 per_user:=floor(p_amount_ug::numeric/cnt)::bigint;
 if per_user<=0 then
  update platform_settings set community_reserve_ug=community_reserve_ug+p_amount_ug where id=1;
  return;
 end if;

 update gold_wallets set balance_ug=balance_ug+per_user,updated_at=now();

 insert into gold_transactions(user_id,game_id,amount_ug,transaction_type,note)
 select user_id,p_game_id,per_user,'community_dividend','Community-Anteil aus Paygame'
 from gold_wallets;

 distributed:=per_user*cnt;
 update platform_settings
 set community_reserve_ug=community_reserve_ug+(p_amount_ug-distributed)
 where id=1;
end $$;

create or replace function public.apply_paygame_entry_v65(p_game_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare
 g games%rowtype; s platform_settings%rowtype; w gold_wallets%rowtype;
 prize bigint; community bigint; platform bigint; each bigint; rem bigint; tc int;
begin
 select * into g from games where id=p_game_id for update;
 if g.game_type<>'pay' then return; end if;

 select * into s from platform_settings where id=1;

 insert into gold_wallets(user_id) values(p_user_id) on conflict(user_id) do nothing;
 select * into w from gold_wallets where user_id=p_user_id for update;

 if w.balance_ug<g.entry_gold_ug then raise exception 'Nicht genug Test-Goldstaub'; end if;

 update gold_wallets
 set balance_ug=balance_ug-g.entry_gold_ug,updated_at=now()
 where user_id=p_user_id;

 insert into gold_transactions(user_id,game_id,amount_ug,transaction_type,note)
 values(p_user_id,p_game_id,-g.entry_gold_ug,'game_entry','Schürfrechte / Paygame-Einsatz');

 prize:=floor(g.entry_gold_ug*s.prize_share_bps/10000.0)::bigint;
 community:=floor(g.entry_gold_ug*s.community_share_bps/10000.0)::bigint;
 platform:=g.entry_gold_ug-prize-community;

 update games set gold_prize_pool_ug=gold_prize_pool_ug+prize where id=p_game_id;
 update platform_settings set platform_revenue_ug=platform_revenue_ug+platform where id=1;

 select count(*) into tc from gold_treasures where game_id=p_game_id and found_by is null;
 if tc<=0 then raise exception 'Keine offenen Goldschätze mehr'; end if;
 each:=floor(prize::numeric/tc)::bigint;
 rem:=prize-each*tc;

 update gold_treasures set amount_ug=amount_ug+each where game_id=p_game_id and found_by is null;
 if rem>0 then
  update gold_treasures set amount_ug=amount_ug+rem
  where id=(select id from gold_treasures where game_id=p_game_id and found_by is null order by treasure_no limit 1);
 end if;

 perform distribute_community_gold_v65(community,p_game_id);
end $$;

create or replace function public.create_game_v65(
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
 p_game_type text default 'standard',
 p_entry_gold_ug bigint default 0,
 p_treasure_mode text default '1'
) returns uuid
language plpgsql security definer set search_path=public as $$
declare
 gid uuid; cols int; rows int; tx int; ty int; choice int;
 lat numeric; lon numeric; label text; code text;
 s platform_settings%rowtype; tc int; projected bigint; i int; rx int; ry int;
begin
 if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
 if p_game_type not in ('standard','pay') then raise exception 'Ungültiger Spieltyp'; end if;
 if p_max_players<2 or p_max_players>100 then raise exception 'Spielerzahl muss zwischen 2 und 100 liegen'; end if;
 if p_field_count<100 or p_field_count>50000000 then raise exception 'Feldanzahl muss zwischen 100 und 50.000.000 liegen'; end if;
 if p_cell_size_m<5 or p_cell_size_m>5000 then raise exception 'Ungültige Feldgröße'; end if;
 if p_regen_seconds<5 or p_regen_seconds>86400 then raise exception 'Ungültige Regenerationszeit'; end if;
 if p_max_stored_moves<1 or p_max_stored_moves>100 then raise exception 'Ungültiges Zuglimit'; end if;

 cols:=greatest(1,floor(sqrt(p_field_count::numeric))::int);
 rows:=greatest(1,floor(p_field_count::numeric/cols)::int);

 if p_location_mode='coords' then
  lat:=p_center_lat; lon:=p_center_lon; label:=coalesce(nullif(trim(p_center_label),''),'Kartenmittelpunkt');
  if lat is null or lon is null or lat<-85 or lat>85 or lon<-180 or lon>180 then raise exception 'Ungültige Koordinaten'; end if;
 else
  choice:=1+floor(random()*10)::int;
  case choice
   when 1 then lat:=49.521;lon:=7.140;label:='Namborn';
   when 2 then lat:=52.520;lon:=13.405;label:='Berlin';
   when 3 then lat:=48.137;lon:=11.575;label:='München';
   when 4 then lat:=50.110;lon:=8.682;label:='Frankfurt';
   when 5 then lat:=53.551;lon:=9.994;label:='Hamburg';
   when 6 then lat:=50.937;lon:=6.960;label:='Köln';
   when 7 then lat:=48.856;lon:=2.352;label:='Paris';
   when 8 then lat:=51.507;lon:=-0.128;label:='London';
   when 9 then lat:=40.712;lon:=-74.006;label:='New York';
   else lat:=28.414;lon:=-16.545;label:='Teneriffa';
  end case;
 end if;

 tx:=floor(random()*cols)::int;
 ty:=floor(random()*rows)::int;
 code:=generate_invite_code();

 select * into s from platform_settings where id=1;

 if p_game_type='pay' then
  if p_entry_gold_ug<=0 then raise exception 'Paygame benötigt einen Einsatz'; end if;
  projected:=floor((p_entry_gold_ug::numeric*p_max_players*s.prize_share_bps)/10000)::bigint;

  if p_treasure_mode='auto' then
   if projected>=s.multi_treasure_threshold_ug*2 and s.max_treasures>=5 then tc:=5;
   elsif projected>=s.multi_treasure_threshold_ug and s.max_treasures>=3 then tc:=3;
   else tc:=1;
   end if;
  else
   tc:=p_treasure_mode::int;
   if tc not in (1,3,5) or tc>s.max_treasures then raise exception 'Diese Schatzanzahl ist serverseitig nicht erlaubt'; end if;
  end if;
 else
  tc:=1;
  p_entry_gold_ug:=0;
 end if;

 insert into games(
  name,width,height,max_players,treasure_x,treasure_y,created_by,
  center_lat,center_lon,center_label,cell_size_m,location_mode,
  regen_seconds,max_stored_moves,is_private,invite_code,
  game_type,entry_gold_ug,treasure_count
 )
 values(
  p_name,cols,rows,p_max_players,tx,ty,auth.uid(),
  lat,lon,label,p_cell_size_m,p_location_mode,
  p_regen_seconds,p_max_stored_moves,p_is_private,code,
  p_game_type,p_entry_gold_ug,tc
 )
 returning id into gid;

 if p_is_private then
  insert into game_secrets(game_id,password_hash)
  values(gid,case when p_password is null or trim(p_password)='' then null else crypt(p_password,gen_salt('bf')) end);
 end if;

 if p_game_type='pay' then
  for i in 1..tc loop
   loop
    rx:=floor(random()*cols)::int;
    ry:=floor(random()*rows)::int;
    exit when not exists(select 1 from gold_treasures where game_id=gid and x=rx and y=ry);
   end loop;
   insert into gold_treasures(game_id,treasure_no,x,y) values(gid,i,rx,ry);
  end loop;

  -- Host zahlt exakt denselben Einsatz.
  perform apply_paygame_entry_v65(gid,auth.uid());
 end if;

 insert into game_players(game_id,user_id,moves_left,last_regen_at)
 values(gid,auth.uid(),1,now());

 perform assign_player_color(gid,auth.uid());
 update profiles set total_games=total_games+1 where id=auth.uid();

 return gid;
end $$;

create or replace function public.join_paygame_v65(p_game_id uuid,p_password text default null)
returns void language plpgsql security definer set search_path=public as $$
declare g games%rowtype; secret game_secrets%rowtype; cnt int;
begin
 if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
 if exists(select 1 from game_players where game_id=p_game_id and user_id=auth.uid()) then return; end if;

 select * into g from games where id=p_game_id for update;
 if not found or g.game_type<>'pay' then raise exception 'Paygame nicht gefunden'; end if;
 if g.status<>'active' then raise exception 'Spiel ist beendet'; end if;

 if g.is_private then
  select * into secret from game_secrets where game_id=p_game_id;
  if secret.password_hash is not null and (p_password is null or crypt(p_password,secret.password_hash)<>secret.password_hash) then
   raise exception 'Passwort erforderlich oder falsch';
  end if;
 end if;

 select count(*) into cnt from game_players where game_id=p_game_id;
 if cnt>=g.max_players then raise exception 'Spiel ist voll'; end if;

 perform apply_paygame_entry_v65(p_game_id,auth.uid());

 insert into game_players(game_id,user_id,moves_left,last_regen_at)
 values(p_game_id,auth.uid(),1,now());

 perform assign_player_color(p_game_id,auth.uid());
 update profiles set total_games=total_games+1 where id=auth.uid();
end $$;

create or replace function public.join_game_v65(p_game_id uuid,p_password text default null)
returns void language plpgsql security definer set search_path=public as $$
declare gt text;
begin
 select game_type into gt from games where id=p_game_id;
 if not found then raise exception 'Spiel nicht gefunden'; end if;

 if gt='pay' then
  perform join_paygame_v65(p_game_id,p_password);
 else
  perform join_game_v64(p_game_id,p_password);
 end if;
end $$;

create or replace function public.join_game_by_code_v65(p_invite_code text,p_password text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare gid uuid;
begin
 select id into gid from games where upper(invite_code)=upper(trim(p_invite_code));
 if not found then raise exception 'Einladungscode nicht gefunden'; end if;
 perform join_game_v65(gid,p_password);
 return gid;
end $$;

create or replace function public.reveal_area_v65(p_game_id uuid,p_x int,p_y int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 gp game_players%rowtype; g games%rowtype;
 opened int:=0; rad int:=0; dx int; dy int; nx int; ny int;
 rew numeric; hint text:=''; dist_cells numeric; dir_center text; dir_click text;
 gold_hit gold_treasures%rowtype; is_gold_hit boolean:=false; gold_won bigint:=0;
 remaining_treasures int; legacy_hit boolean:=false;
begin
 perform refresh_player_moves(p_game_id);

 select * into g from games where id=p_game_id for update;
 if not found then raise exception 'Spiel nicht gefunden'; end if;

 select * into gp from game_players where game_id=p_game_id and user_id=auth.uid() for update;
 if not found then raise exception 'Nicht im Spiel'; end if;

 if g.status<>'active' then raise exception 'Spiel beendet'; end if;
 if gp.moves_left<=0 then raise exception 'Keine Züge verfügbar – der nächste Zug regeneriert automatisch'; end if;

 rew:=.01*gp.reward_multiplier;

 while opened<gp.reveal_power and rad<greatest(g.width,g.height) loop
  for dy in -rad..rad loop
   for dx in -rad..rad loop
    if greatest(abs(dx),abs(dy))<>rad then continue; end if;

    nx:=p_x+dx;
    ny:=p_y+dy;

    if nx<0 or ny<0 or nx>=g.width or ny>=g.height then continue; end if;
    if exists(select 1 from explored_fields where game_id=p_game_id and x=nx and y=ny) then continue; end if;

    is_gold_hit:=false;

    if g.game_type='pay' then
     select * into gold_hit
     from gold_treasures
     where game_id=p_game_id and x=nx and y=ny and found_by is null
     for update;
     is_gold_hit:=found;

     insert into explored_fields(game_id,x,y,discovered_by,is_treasure)
     values(p_game_id,nx,ny,auth.uid(),is_gold_hit);

     if is_gold_hit then
      update gold_treasures set found_by=auth.uid(),found_at=now() where id=gold_hit.id;
      update games set gold_prize_pool_ug=greatest(0,gold_prize_pool_ug-gold_hit.amount_ug) where id=p_game_id;

      insert into gold_wallets(user_id) values(auth.uid()) on conflict(user_id) do nothing;
      update gold_wallets
      set balance_ug=balance_ug+gold_hit.amount_ug,updated_at=now()
      where user_id=auth.uid();

      update profiles
      set gold_found_ug=gold_found_ug+gold_hit.amount_ug
      where id=auth.uid();

      insert into gold_transactions(user_id,game_id,amount_ug,transaction_type,note)
      values(auth.uid(),p_game_id,gold_hit.amount_ug,'treasure_reward','Goldschatz gefunden');

      gold_won:=gold_won+gold_hit.amount_ug;
     end if;
    else
     legacy_hit:=(nx=g.treasure_x and ny=g.treasure_y);

     insert into explored_fields(game_id,x,y,discovered_by,is_treasure)
     values(p_game_id,nx,ny,auth.uid(),legacy_hit);
    end if;

    opened:=opened+1;

    if g.game_type='standard' and legacy_hit then exit; end if;

    update game_players
    set coins=coins+rew
    where game_id=p_game_id and user_id=auth.uid();

    exit when opened>=gp.reveal_power;
   end loop;

   exit when (g.game_type='standard' and legacy_hit) or opened>=gp.reveal_power;
  end loop;

  exit when g.game_type='standard' and legacy_hit;
  rad:=rad+1;
 end loop;

 if opened=0 then raise exception 'Hier ist bereits alles erforscht'; end if;

 update game_players
 set moves_left=moves_left-1
 where game_id=p_game_id and user_id=auth.uid();

 update profiles
 set total_fields_revealed=total_fields_revealed+opened
 where id=auth.uid();

 if g.game_type='standard' and legacy_hit then
  update games set status='finished',winner_id=auth.uid() where id=p_game_id;
  update profiles set wins=wins+1 where id=auth.uid();

  return jsonb_build_object('message','🏆 Schatz gefunden!','won',true,'opened',opened);
 end if;

 if g.game_type='pay' then
  select count(*) into remaining_treasures
  from gold_treasures
  where game_id=p_game_id and found_by is null;

  if remaining_treasures=0 then
   update games set status='finished' where id=p_game_id;
  end if;
 end if;

 if gp.analysis_level>0 then
  if g.game_type='pay' then
   select * into gold_hit
   from gold_treasures
   where game_id=p_game_id and found_by is null
   order by treasure_no
   limit 1;

   if found then
    g.treasure_x:=gold_hit.x;
    g.treasure_y:=gold_hit.y;
   end if;
  end if;

  dir_center:=
   case when g.treasure_y<g.height/2 then 'nördlich' else 'südlich' end||
   case when abs(g.treasure_x-g.width/2)>g.width*.08
        then case when g.treasure_x<g.width/2 then ' / westlich' else ' / östlich' end
        else '' end;

  hint:=' 🗺️ Hinweis: Ziel liegt '||dir_center||' von '||g.center_label||'.';

  dist_cells:=sqrt(power(g.treasure_x-p_x,2)+power(g.treasure_y-p_y,2));
  dir_click:=case when g.treasure_x>=p_x then 'Ost' else 'West' end||'/'||
             case when g.treasure_y>=p_y then 'Süd' else 'Nord' end;

  if gp.analysis_level>=4 then
   hint:=hint||' Von deiner Suche: '||dir_click||', etwa '||(round(dist_cells/10)*10)::int||' Felder.';
  end if;
  if gp.analysis_level>=5 then hint:=hint||' Geoanalyse: ~'||(round(dist_cells/5)*5)::int||' Felder.'; end if;
  if gp.analysis_level>=6 then hint:=hint||' KI: ~'||round(dist_cells)::int||' Felder.'; end if;
 end if;

 return jsonb_build_object(
  'message',
   opened||' Felder aufgedeckt. +'||to_char(opened*rew,'FM999999990.00')||' Taler.'||
   case when gold_won>0
        then ' ✨ Goldschatz gefunden: '||trim(to_char(gold_won/1000000.0,'FM999990.000000'))||' g Test-Gold!'
        else '' end||hint,
  'won',false,
  'opened',opened,
  'gold_won_ug',gold_won
 );
end $$;

create or replace function public.leaderboard_v65(p_metric text,p_limit int default 50)
returns table(user_id uuid,display_name text,metric_value bigint)
language plpgsql security definer set search_path=public as $$
begin
 p_limit:=least(greatest(p_limit,1),100);

 if p_metric='wins' then
  return query
  select p.id,p.display_name,p.wins::bigint
  from profiles p
  order by p.wins desc,p.total_fields_revealed desc
  limit p_limit;

 elsif p_metric='fields' then
  return query
  select p.id,p.display_name,p.total_fields_revealed::bigint
  from profiles p
  order by p.total_fields_revealed desc
  limit p_limit;

 elsif p_metric='gold' then
  return query
  select p.id,p.display_name,p.gold_found_ug::bigint
  from profiles p
  order by p.gold_found_ug desc
  limit p_limit;

 elsif p_metric='games' then
  return query
  select p.id,p.display_name,p.total_games::bigint
  from profiles p
  order by p.total_games desc
  limit p_limit;

 else
  raise exception 'Unbekannte Bestenliste';
 end if;
end $$;

grant execute on function public.claim_test_gold_v65() to authenticated;
grant execute on function public.get_gold_treasure_status_v65(uuid) to authenticated;
grant execute on function public.create_game_v65(text,bigint,numeric,int,text,numeric,numeric,text,int,int,boolean,text,text,bigint,text) to authenticated;
grant execute on function public.join_paygame_v65(uuid,text) to authenticated;
grant execute on function public.join_game_v65(uuid,text) to authenticated;
grant execute on function public.join_game_by_code_v65(text,text) to authenticated;
grant execute on function public.reveal_area_v65(uuid,int,int) to authenticated;
grant execute on function public.leaderboard_v65(text,int) to authenticated;
