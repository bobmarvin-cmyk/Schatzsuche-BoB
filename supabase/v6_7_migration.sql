-- SCHATZSUCHE ONLINE V6.7 – MASTER-SCHALTZENTRALE
-- Nach V6.6 EINMAL vollständig im Supabase SQL Editor ausführen.

-- =========================================================
-- 1) ADMIN-BERECHTIGUNG
-- =========================================================

create table if not exists public.admin_users(
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
-- Keine Client-Policies. Der Zugriff erfolgt nur über SECURITY DEFINER Funktionen.

create or replace function public.is_admin_v67()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select auth.uid() is not null
     and exists(select 1 from public.admin_users a where a.user_id=auth.uid());
$$;

revoke all on function public.is_admin_v67() from public;
grant execute on function public.is_admin_v67() to authenticated;

-- =========================================================
-- 2) ZENTRALE MASTERWERTE
-- =========================================================

alter table public.platform_settings add column if not exists min_game_fields bigint not null default 100;
alter table public.platform_settings add column if not exists max_game_fields bigint not null default 50000000;
alter table public.platform_settings add column if not exists max_game_players int not null default 100;
alter table public.platform_settings add column if not exists min_cell_size_m numeric(12,2) not null default 5;
alter table public.platform_settings add column if not exists max_cell_size_m numeric(12,2) not null default 5000;
alter table public.platform_settings add column if not exists min_regen_seconds int not null default 5;
alter table public.platform_settings add column if not exists max_regen_seconds int not null default 86400;
alter table public.platform_settings add column if not exists max_stored_moves_limit int not null default 100;
alter table public.platform_settings add column if not exists exploration_reward numeric(14,6) not null default .01;
alter table public.platform_settings add column if not exists min_entry_gold_ug bigint not null default 1000;
alter table public.platform_settings add column if not exists max_entry_gold_ug bigint not null default 1000000000;

create or replace function public.admin_update_settings_v67(p_settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  prize int;
  community int;
  platform int;
  inactive_community int;
  inactive_platform int;
begin
  if not public.is_admin_v67() then
    raise exception 'Keine Admin-Berechtigung';
  end if;

  prize:=(p_settings->>'prize_share_bps')::int;
  community:=(p_settings->>'community_share_bps')::int;
  platform:=(p_settings->>'platform_share_bps')::int;
  inactive_community:=(p_settings->>'inactive_community_share_bps')::int;
  inactive_platform:=(p_settings->>'inactive_platform_share_bps')::int;

  if prize+community+platform<>10000 then
    raise exception 'Gold-Verteilung muss zusammen 100%% ergeben';
  end if;
  if inactive_community+inactive_platform<>10000 then
    raise exception 'Inaktivitäts-Verteilung muss zusammen 100%% ergeben';
  end if;

  if (p_settings->>'min_game_fields')::bigint < 100 then
    raise exception 'Minimum Kartenfelder zu klein';
  end if;
  if (p_settings->>'max_game_fields')::bigint < (p_settings->>'min_game_fields')::bigint then
    raise exception 'Maximale Kartenfelder müssen größer als das Minimum sein';
  end if;
  if (p_settings->>'max_game_players')::int < 2 then
    raise exception 'Mindestens 2 Spieler müssen erlaubt sein';
  end if;
  if (p_settings->>'min_cell_size_m')::numeric <= 0
     or (p_settings->>'max_cell_size_m')::numeric < (p_settings->>'min_cell_size_m')::numeric then
    raise exception 'Ungültige Feldgrößen-Grenzen';
  end if;
  if (p_settings->>'min_regen_seconds')::int < 1
     or (p_settings->>'max_regen_seconds')::int < (p_settings->>'min_regen_seconds')::int then
    raise exception 'Ungültige Regenerations-Grenzen';
  end if;
  if (p_settings->>'max_stored_moves_limit')::int < 1 then
    raise exception 'Ungültiges Zugspeicher-Limit';
  end if;
  if (p_settings->>'exploration_reward')::numeric < 0 then
    raise exception 'Feldbelohnung darf nicht negativ sein';
  end if;
  if (p_settings->>'min_entry_gold_ug')::bigint < 0
     or (p_settings->>'max_entry_gold_ug')::bigint < (p_settings->>'min_entry_gold_ug')::bigint then
    raise exception 'Ungültige Paygame-Einsatzgrenzen';
  end if;

  update public.platform_settings set
    prize_share_bps=prize,
    community_share_bps=community,
    platform_share_bps=platform,
    multi_treasure_threshold_ug=(p_settings->>'multi_treasure_threshold_ug')::bigint,
    max_treasures=(p_settings->>'max_treasures')::int,
    test_grant_ug=(p_settings->>'test_grant_ug')::bigint,
    gold_price_cents_per_001g=(p_settings->>'gold_price_cents_per_001g')::int,
    game_inactivity_hours=(p_settings->>'game_inactivity_hours')::int,
    closed_game_retention_hours=(p_settings->>'closed_game_retention_hours')::int,
    inactive_community_share_bps=inactive_community,
    inactive_platform_share_bps=inactive_platform,
    min_game_fields=(p_settings->>'min_game_fields')::bigint,
    max_game_fields=(p_settings->>'max_game_fields')::bigint,
    max_game_players=(p_settings->>'max_game_players')::int,
    min_cell_size_m=(p_settings->>'min_cell_size_m')::numeric,
    max_cell_size_m=(p_settings->>'max_cell_size_m')::numeric,
    min_regen_seconds=(p_settings->>'min_regen_seconds')::int,
    max_regen_seconds=(p_settings->>'max_regen_seconds')::int,
    max_stored_moves_limit=(p_settings->>'max_stored_moves_limit')::int,
    exploration_reward=(p_settings->>'exploration_reward')::numeric,
    min_entry_gold_ug=(p_settings->>'min_entry_gold_ug')::bigint,
    max_entry_gold_ug=(p_settings->>'max_entry_gold_ug')::bigint,
    updated_at=now()
  where id=1;

  return jsonb_build_object('message','Globale Masterwerte gespeichert');
end;
$$;

revoke all on function public.admin_update_settings_v67(jsonb) from public;
grant execute on function public.admin_update_settings_v67(jsonb) to authenticated;

-- =========================================================
-- 3) TECHNOLOGIEBAUM VOLLSTÄNDIG SERVERGESTEUERT
-- =========================================================

alter table public.technologies add column if not exists description text not null default '';
alter table public.technologies add column if not exists sort_order int not null default 100;
alter table public.technologies add column if not exists is_active boolean not null default true;

update public.technologies set
  description=case id
    when 'root' then '+1 Feld pro Zug'
    when 'e1' then '+2 Felder/Zug'
    when 'e2' then '+5 Felder/Zug'
    when 'e3' then '+8 Felder/Zug'
    when 'e4' then '+20 Felder/Zug'
    when 'e5' then '+25 Felder/Zug'
    when 'e6' then '+50 Felder/Zug'
    when 'e7' then '+35 Felder/Zug · +15% Talerbonus'
    when 'e8' then '+100 Felder/Zug'
    when 'e9' then '+75 Felder/Zug · +25% Talerbonus'
    when 'e10' then '+250 Felder/Zug'
    when 'end1' then '+1.000 Felder/Zug'
    when 'a1' then 'Lage relativ zum Kartenort'
    when 'a2' then 'Grobe Entfernung zum Kartenort'
    when 'a3' then 'Kartenquadrant'
    when 'a4' then 'Entfernung zur Suchposition ~10 Felder'
    when 'a5' then 'Entfernung ~5 Felder'
    when 'a6' then 'Sehr präzise Kartenanalyse'
    when 'l1' then '+1 speicherbarer Zug'
    when 'l2' then '+2 speicherbare Züge'
    when 'l3' then 'Zugregeneration 10% schneller'
    when 'l4' then '+3 Speicher · weitere 10% schneller'
    when 'l5' then 'weitere 20% schnellere Regeneration'
    when 'w1' then '+50% Erkundungsbonus'
    when 'w2' then '+100% Erkundungsbonus'
    when 'h1' then '+120 Felder/Zug + Analyse'
    when 'h2' then '+350 Felder/Zug + KI-Analyse'
    else description end,
  sort_order=case id
    when 'root' then 10
    when 'e1' then 100 when 'e2' then 110 when 'e3' then 120 when 'e4' then 130
    when 'e5' then 140 when 'e6' then 150 when 'e7' then 160 when 'e8' then 170
    when 'e9' then 180 when 'e10' then 190 when 'end1' then 200
    when 'a1' then 300 when 'a2' then 310 when 'a3' then 320 when 'a4' then 330
    when 'a5' then 340 when 'a6' then 350
    when 'l1' then 400 when 'l2' then 410 when 'l3' then 420 when 'l4' then 430 when 'l5' then 440
    when 'w1' then 500 when 'w2' then 510
    when 'h1' then 600 when 'h2' then 610
    else sort_order end;

create or replace function public.admin_update_technology_v67(
  p_id text,
  p_name text,
  p_branch text,
  p_description text,
  p_cost numeric,
  p_reveal_power_bonus int,
  p_reward_bonus numeric,
  p_analysis_level int,
  p_capacity_bonus int,
  p_regen_reduction numeric,
  p_requires text[],
  p_sort_order int,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  r text;
  x record;
begin
  if not public.is_admin_v67() then
    raise exception 'Keine Admin-Berechtigung';
  end if;

  if not exists(select 1 from public.technologies where id=p_id) then
    raise exception 'Technologie nicht gefunden';
  end if;
  if length(trim(coalesce(p_name,'')))<1 then raise exception 'Name fehlt'; end if;
  if length(trim(coalesce(p_branch,'')))<1 then raise exception 'Kategorie fehlt'; end if;
  if p_cost<0 then raise exception 'Preis darf nicht negativ sein'; end if;
  if p_reveal_power_bonus<0 or p_analysis_level<0 or p_capacity_bonus<0 then
    raise exception 'Bonuswerte dürfen nicht negativ sein';
  end if;
  if p_reward_bonus<0 then raise exception 'Talerbonus darf nicht negativ sein'; end if;
  if p_regen_reduction<0 or p_regen_reduction>.80 then
    raise exception 'Regenerationsbonus muss zwischen 0 und 0,80 liegen';
  end if;
  if p_id=any(coalesce(p_requires,'{}'::text[])) then
    raise exception 'Technologie kann sich nicht selbst voraussetzen';
  end if;

  foreach r in array coalesce(p_requires,'{}'::text[]) loop
    if not exists(select 1 from public.technologies where id=r) then
      raise exception 'Unbekannte Voraussetzung: %',r;
    end if;
  end loop;

  update public.technologies set
    name=trim(p_name),
    branch=trim(p_branch),
    description=left(coalesce(p_description,''),250),
    cost=p_cost,
    reveal_power_bonus=p_reveal_power_bonus,
    reward_bonus=p_reward_bonus,
    analysis_level=p_analysis_level,
    capacity_bonus=p_capacity_bonus,
    regen_reduction=p_regen_reduction,
    requires=coalesce(p_requires,'{}'::text[]),
    sort_order=p_sort_order,
    is_active=p_is_active
  where id=p_id;

  -- Bereits gekaufte Technologien übernehmen geänderte Wirkungen sofort.
  for x in
    select distinct game_id,user_id
    from public.player_technologies
    where technology_id=p_id
  loop
    perform public.recompute_player_stats(x.game_id,x.user_id);
  end loop;

  return jsonb_build_object('message',trim(p_name)||' gespeichert');
end;
$$;

revoke all on function public.admin_update_technology_v67(text,text,text,text,numeric,int,numeric,int,int,numeric,text[],int,boolean) from public;
grant execute on function public.admin_update_technology_v67(text,text,text,text,numeric,int,numeric,int,int,numeric,text[],int,boolean) to authenticated;

-- buy_technology bleibt der zentrale Kaufpunkt und respektiert jetzt "is_active".
create or replace function public.buy_technology(p_game_id uuid,p_technology_id text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  gp game_players%rowtype;
  t technologies%rowtype;
  r text;
begin
  select * into gp
  from game_players
  where game_id=p_game_id and user_id=auth.uid()
  for update;

  if not found then raise exception 'Nicht im Spiel'; end if;

  select * into t from technologies where id=p_technology_id;
  if not found then raise exception 'Technologie nicht gefunden'; end if;
  if not t.is_active then raise exception 'Technologie ist derzeit deaktiviert'; end if;

  if exists(
    select 1 from player_technologies
    where game_id=p_game_id and user_id=auth.uid() and technology_id=p_technology_id
  ) then
    raise exception 'Bereits erforscht';
  end if;

  foreach r in array t.requires loop
    if not exists(
      select 1 from player_technologies
      where game_id=p_game_id and user_id=auth.uid() and technology_id=r
    ) then
      raise exception 'Voraussetzung fehlt';
    end if;
  end loop;

  if gp.coins<t.cost then raise exception 'Nicht genug Taler'; end if;

  update game_players
  set coins=coins-t.cost
  where game_id=p_game_id and user_id=auth.uid();

  insert into player_technologies(game_id,user_id,technology_id)
  values(p_game_id,auth.uid(),p_technology_id);

  perform recompute_player_stats(p_game_id,auth.uid());

  return jsonb_build_object('message',t.name||' erforscht');
end;
$$;

create or replace function public.create_game_v67(
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
 select * into s from platform_settings where id=1;
 if p_game_type not in ('standard','pay') then raise exception 'Ungültiger Spieltyp'; end if;
 if p_max_players<2 or p_max_players>s.max_game_players then raise exception 'Spielerzahl liegt außerhalb der Servergrenzen'; end if;
 if p_field_count<s.min_game_fields or p_field_count>s.max_game_fields then raise exception 'Feldanzahl liegt außerhalb der Servergrenzen'; end if;
 if p_cell_size_m<s.min_cell_size_m or p_cell_size_m>s.max_cell_size_m then raise exception 'Feldgröße liegt außerhalb der Servergrenzen'; end if;
 if p_regen_seconds<s.min_regen_seconds or p_regen_seconds>s.max_regen_seconds then raise exception 'Regenerationszeit liegt außerhalb der Servergrenzen'; end if;
 if p_max_stored_moves<1 or p_max_stored_moves>s.max_stored_moves_limit then raise exception 'Zugspeicher liegt außerhalb der Servergrenzen'; end if;

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


 if p_game_type='pay' then
  if p_entry_gold_ug<s.min_entry_gold_ug or p_entry_gold_ug>s.max_entry_gold_ug then raise exception 'Paygame-Einsatz liegt außerhalb der Servergrenzen'; end if;
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

create or replace function public.reveal_area_v65(p_game_id uuid,p_x int,p_y int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 gp game_players%rowtype; g games%rowtype; s platform_settings%rowtype;
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

 select * into s from platform_settings where id=1;
 rew:=s.exploration_reward*gp.reward_multiplier;

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

-- Rechte für die neuen/ersetzten Funktionen.
revoke all on function public.create_game_v67(text,bigint,numeric,int,text,numeric,numeric,text,int,int,boolean,text,text,bigint,text) from public;
grant execute on function public.create_game_v67(text,bigint,numeric,int,text,numeric,numeric,text,int,int,boolean,text,text,bigint,text) to authenticated;

-- reveal_area_v65 wird absichtlich ersetzt:
-- V6.6 ruft diese Funktion über reveal_area_v66 auf und erhält damit automatisch
-- die zentrale exploration_reward aus platform_settings.
