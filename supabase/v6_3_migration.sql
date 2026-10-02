-- SCHATZSUCHE ONLINE V6.3
-- Nach V6, V6.1 und V6.2 EINMAL im Supabase SQL Editor ausführen.

alter table public.games add column if not exists center_lat numeric(10,6) not null default 49.520000;
alter table public.games add column if not exists center_lon numeric(10,6) not null default 7.140000;
alter table public.games add column if not exists center_label text not null default 'Kartenmittelpunkt';
alter table public.games add column if not exists cell_size_m numeric(12,2) not null default 100;
alter table public.games add column if not exists location_mode text not null default 'random';
alter table public.games add column if not exists regen_seconds int not null default 30;
alter table public.games add column if not exists max_stored_moves int not null default 4;

alter table public.game_players add column if not exists last_regen_at timestamptz not null default now();
alter table public.game_players add column if not exists move_capacity_bonus int not null default 0;
alter table public.game_players add column if not exists regen_reduction numeric(6,4) not null default 0;

alter table public.technologies add column if not exists capacity_bonus int not null default 0;
alter table public.technologies add column if not exists regen_reduction numeric(6,4) not null default 0;

-- Logistik wird für das neue kontinuierliche Zugsystem neu interpretiert.
update public.technologies set
 name='Felddepot', cost=.20, moves_bonus=0, round_mod=null, capacity_bonus=1, regen_reduction=0
 where id='l1';
update public.technologies set
 name='Großes Depot', cost=.75, moves_bonus=0, round_mod=null, capacity_bonus=2, regen_reduction=0
 where id='l2';
update public.technologies set
 name='Schnelllogistik', cost=2.50, moves_bonus=0, round_mod=null, capacity_bonus=0, regen_reduction=.10
 where id='l3';
update public.technologies set
 name='Automatisierte Versorgung', cost=7.50, moves_bonus=0, round_mod=null, capacity_bonus=3, regen_reduction=.10
 where id='l4';
update public.technologies set
 name='Expeditionsnetz', cost=25.00, moves_bonus=0, round_mod=null, capacity_bonus=0, regen_reduction=.20
 where id='l5';

create or replace function public.recompute_player_stats(gid uuid,uid uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 update game_players gp set
 reveal_power=1+coalesce((select sum(t.reveal_power_bonus) from player_technologies pt join technologies t on t.id=pt.technology_id where pt.game_id=gid and pt.user_id=uid),0),
 reward_multiplier=1+coalesce((select sum(t.reward_bonus) from player_technologies pt join technologies t on t.id=pt.technology_id where pt.game_id=gid and pt.user_id=uid),0),
 analysis_level=coalesce((select max(t.analysis_level) from player_technologies pt join technologies t on t.id=pt.technology_id where pt.game_id=gid and pt.user_id=uid),0),
 move_capacity_bonus=coalesce((select sum(t.capacity_bonus) from player_technologies pt join technologies t on t.id=pt.technology_id where pt.game_id=gid and pt.user_id=uid),0),
 regen_reduction=least(.80,coalesce((select sum(t.regen_reduction) from player_technologies pt join technologies t on t.id=pt.technology_id where pt.game_id=gid and pt.user_id=uid),0))
 where gp.game_id=gid and gp.user_id=uid;
end $$;

create or replace function public.assign_player_color(p_game_id uuid,p_user_id uuid)
returns text language plpgsql security definer set search_path=public as $$
declare
 colors text[]:=array['#3b82f6','#22c55e','#a855f7','#ef4444','#f59e0b','#06b6d4','#ec4899','#84cc16','#f97316','#8b5cf6','#14b8a6','#eab308','#64748b','#10b981','#0ea5e9','#d946ef','#e11d48','#65a30d','#c2410c','#7c3aed'];
 idx int; chosen text;
begin
 select count(*)+1 into idx from game_players where game_id=p_game_id and player_color is not null;
 chosen:=colors[((idx-1)%array_length(colors,1))+1];
 update game_players set player_color=chosen where game_id=p_game_id and user_id=p_user_id and player_color is null;
 return chosen;
end $$;

create or replace function public.create_game_v63(
 p_name text,
 p_field_count bigint,
 p_cell_size_m numeric,
 p_max_players int,
 p_location_mode text,
 p_center_lat numeric default null,
 p_center_lon numeric default null,
 p_center_label text default null,
 p_regen_seconds int default 30,
 p_max_stored_moves int default 4
) returns uuid
language plpgsql security definer set search_path=public as $$
declare
 gid uuid; cols int; rows int; tx int; ty int; choice int;
 lat numeric; lon numeric; label text;
begin
 if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
 if p_field_count<100 or p_field_count>50000000 then raise exception 'Feldanzahl muss zwischen 100 und 50.000.000 liegen'; end if;
 if p_cell_size_m<5 or p_cell_size_m>5000 then raise exception 'Ungültige Feldgröße'; end if;
 if p_regen_seconds<5 or p_regen_seconds>86400 then raise exception 'Regeneration muss 5 Sekunden bis 24 Stunden betragen'; end if;
 if p_max_stored_moves<1 or p_max_stored_moves>100 then raise exception 'Ungültiges Zuglimit'; end if;

 cols:=greatest(1,floor(sqrt(p_field_count::numeric))::int);
 rows:=greatest(1,floor(p_field_count::numeric/cols)::int);

 if p_location_mode='coords' then
  lat:=p_center_lat; lon:=p_center_lon; label:=coalesce(nullif(trim(p_center_label),''),'Kartenmittelpunkt');
  if lat is null or lon is null or lat<-85 or lat>85 or lon<-180 or lon>180 then raise exception 'Ungültige Koordinaten'; end if;
 else
  choice:=1+floor(random()*20)::int;
  case choice
   when 1 then lat:=49.521; lon:=7.140; label:='Namborn';
   when 2 then lat:=52.520; lon:=13.405; label:='Berlin';
   when 3 then lat:=48.137; lon:=11.575; label:='München';
   when 4 then lat:=50.110; lon:=8.682; label:='Frankfurt';
   when 5 then lat:=53.551; lon:=9.994; label:='Hamburg';
   when 6 then lat:=50.937; lon:=6.960; label:='Köln';
   when 7 then lat:=47.376; lon:=8.541; label:='Zürich';
   when 8 then lat:=48.208; lon:=16.373; label:='Wien';
   when 9 then lat:=28.414; lon:=-16.545; label:='Teneriffa';
   when 10 then lat:=40.416; lon:=-3.703; label:='Madrid';
   when 11 then lat:=48.856; lon:=2.352; label:='Paris';
   when 12 then lat:=51.507; lon:=-0.128; label:='London';
   when 13 then lat:=41.902; lon:=12.496; label:='Rom';
   when 14 then lat:=59.329; lon:=18.069; label:='Stockholm';
   when 15 then lat:=60.169; lon:=24.938; label:='Helsinki';
   when 16 then lat:=35.676; lon:=139.650; label:='Tokio';
   when 17 then lat:=40.712; lon:=-74.006; label:='New York';
   when 18 then lat:=37.774; lon:=-122.419; label:='San Francisco';
   when 19 then lat:=-33.868; lon:=151.209; label:='Sydney';
   else lat:=-33.925; lon:=18.424; label:='Kapstadt';
  end case;
 end if;

 tx:=floor(random()*cols)::int; ty:=floor(random()*rows)::int;

 insert into games(name,width,height,max_players,treasure_x,treasure_y,created_by,center_lat,center_lon,center_label,cell_size_m,location_mode,regen_seconds,max_stored_moves)
 values(p_name,cols,rows,p_max_players,tx,ty,auth.uid(),lat,lon,label,p_cell_size_m,p_location_mode,p_regen_seconds,p_max_stored_moves)
 returning id into gid;

 insert into game_players(game_id,user_id,moves_left,last_regen_at) values(gid,auth.uid(),1,now());
 perform assign_player_color(gid,auth.uid());
 update profiles set total_games=total_games+1 where id=auth.uid();
 return gid;
end $$;

create or replace function public.join_game(p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare cnt int; mx int;
begin
 if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
 if not exists(select 1 from games where id=p_game_id and status='active') then
  if exists(select 1 from game_players where game_id=p_game_id and user_id=auth.uid()) then return; end if;
  raise exception 'Spiel nicht verfügbar';
 end if;

 if exists(select 1 from game_players where game_id=p_game_id and user_id=auth.uid()) then
  perform assign_player_color(p_game_id,auth.uid());
  return;
 end if;

 select count(*),max(g.max_players) into cnt,mx from game_players gp join games g on g.id=gp.game_id where gp.game_id=p_game_id;
 if cnt>=mx then raise exception 'Spiel ist voll'; end if;

 insert into game_players(game_id,user_id,moves_left,last_regen_at) values(p_game_id,auth.uid(),1,now());
 perform assign_player_color(p_game_id,auth.uid());
 update profiles set total_games=total_games+1 where id=auth.uid();
end $$;

create or replace function public.refresh_player_moves(p_game_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 g games%rowtype; gp game_players%rowtype; cap int; interval_s int; elapsed numeric; gained int; new_moves int;
begin
 select * into g from games where id=p_game_id;
 if not found then raise exception 'Spiel nicht gefunden'; end if;
 select * into gp from game_players where game_id=p_game_id and user_id=auth.uid() for update;
 if not found then raise exception 'Nicht im Spiel'; end if;

 cap:=greatest(1,g.max_stored_moves+gp.move_capacity_bonus);
 interval_s:=greatest(5,round(g.regen_seconds*(1-gp.regen_reduction))::int);

 if gp.moves_left>=cap then
  update game_players set moves_left=cap,last_regen_at=now() where game_id=p_game_id and user_id=auth.uid();
  return jsonb_build_object('moves',cap,'capacity',cap,'interval_seconds',interval_s,'seconds_to_next',interval_s);
 end if;

 elapsed:=extract(epoch from (now()-gp.last_regen_at));
 gained:=floor(elapsed/interval_s)::int;

 if gained>0 then
  new_moves:=least(cap,gp.moves_left+gained);
  update game_players set
   moves_left=new_moves,
   last_regen_at=case when new_moves>=cap then now() else gp.last_regen_at+(gained*interval_s)*interval '1 second' end
  where game_id=p_game_id and user_id=auth.uid()
  returning * into gp;
 else
  new_moves:=gp.moves_left;
 end if;

 return jsonb_build_object(
  'moves',new_moves,'capacity',cap,'interval_seconds',interval_s,
  'seconds_to_next',greatest(0,ceil(interval_s-extract(epoch from (now()-gp.last_regen_at)))::int)
 );
end $$;

create or replace function public.reveal_area_v63(p_game_id uuid,p_x int,p_y int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 gp game_players%rowtype; g games%rowtype; opened int:=0; rad int:=0; dx int;dy int;nx int;ny int;
 hit boolean:=false; rew numeric; hint text:=''; dist_cells numeric; dist_center_m numeric; dir_center text; dir_click text;
begin
 perform refresh_player_moves(p_game_id);
 select * into g from games where id=p_game_id for update;
 select * into gp from game_players where game_id=p_game_id and user_id=auth.uid() for update;

 if not found then raise exception 'Nicht im Spiel'; end if;
 if g.status<>'active' then raise exception 'Spiel beendet'; end if;
 if gp.moves_left<=0 then raise exception 'Keine Züge verfügbar – der nächste Zug regeneriert automatisch'; end if;
 if p_x<0 or p_y<0 or p_x>=g.width or p_y>=g.height then raise exception 'Ungültiges Feld'; end if;

 rew:=.01*gp.reward_multiplier;

 while opened<gp.reveal_power and rad<greatest(g.width,g.height) loop
  for dy in -rad..rad loop
   for dx in -rad..rad loop
    if greatest(abs(dx),abs(dy))<>rad then continue; end if;
    nx:=p_x+dx; ny:=p_y+dy;
    if nx<0 or ny<0 or nx>=g.width or ny>=g.height then continue; end if;
    if exists(select 1 from explored_fields where game_id=p_game_id and x=nx and y=ny) then continue; end if;

    hit:=(nx=g.treasure_x and ny=g.treasure_y);
    insert into explored_fields(game_id,x,y,discovered_by,is_treasure) values(p_game_id,nx,ny,auth.uid(),hit);
    opened:=opened+1;

    if hit then exit;
    else update game_players set coins=coins+rew where game_id=p_game_id and user_id=auth.uid();
    end if;
    exit when opened>=gp.reveal_power;
   end loop;
   exit when hit or opened>=gp.reveal_power;
  end loop;
  exit when hit;
  rad:=rad+1;
 end loop;

 if opened=0 then raise exception 'Hier ist bereits alles erforscht'; end if;

 update game_players set moves_left=moves_left-1 where game_id=p_game_id and user_id=auth.uid();
 update profiles set total_fields_revealed=total_fields_revealed+opened where id=auth.uid();

 if hit then
  update games set status='finished',winner_id=auth.uid() where id=p_game_id;
  update profiles set wins=wins+1 where id=auth.uid();
  return jsonb_build_object('message','🏆 Schatz gefunden!','won',true,'opened',opened);
 end if;

 -- Kartenbasierte Hinweise, ohne Schatzkoordinaten an den Browser zu senden.
 if gp.analysis_level>0 then
  dir_center:=
   case when g.treasure_y < g.height/2 then 'nördlich' else 'südlich' end ||
   case when abs(g.treasure_x-g.width/2)>g.width*.08 then case when g.treasure_x<g.width/2 then ' / westlich' else ' / östlich' end else '' end;
  hint:=' 🗺️ Hinweis: Der Schatz liegt '||dir_center||' von '||g.center_label||'.';

  if gp.analysis_level>=2 then
   dist_center_m:=sqrt(power((g.treasure_x+.5-g.width/2)*g.cell_size_m,2)+power((g.height/2-(g.treasure_y+.5))*g.cell_size_m,2));
   hint:=hint||' Entfernung zu '||g.center_label||' ungefähr '||
    case when dist_center_m<1000 then round(dist_center_m/100)*100||' m' else round(dist_center_m/1000,1)||' km' end||'.';
  end if;

  if gp.analysis_level>=3 then
   hint:=hint||' Kartenbereich: '||
    case when g.treasure_y<g.height/2 then 'Nord' else 'Süd' end||
    case when g.treasure_x<g.width/2 then 'west' else 'ost' end||'.';
  end if;

  dist_cells:=sqrt(power(g.treasure_x-p_x,2)+power(g.treasure_y-p_y,2));
  dir_click:=case when g.treasure_x>=p_x then 'Ost' else 'West' end||'/'||case when g.treasure_y>=p_y then 'Süd' else 'Nord' end;
  if gp.analysis_level>=4 then hint:=hint||' Von deiner Suche: '||dir_click||', etwa '||(round(dist_cells/10)*10)::int||' Felder.'; end if;
  if gp.analysis_level>=5 then hint:=hint||' Geoanalyse: ~'||(round(dist_cells/5)*5)::int||' Felder.'; end if;
  if gp.analysis_level>=6 then hint:=hint||' KI: ~'||round(dist_cells)::int||' Felder.'; end if;
 end if;

 return jsonb_build_object(
  'message',opened||' Felder aufgedeckt. +'||to_char(opened*rew,'FM999999990.00')||' Taler.'||hint,
  'won',false,'opened',opened
 );
end $$;

grant execute on function public.create_game_v63(text,bigint,numeric,int,text,numeric,numeric,text,int,int) to authenticated;
grant execute on function public.refresh_player_moves(uuid) to authenticated;
grant execute on function public.reveal_area_v63(uuid,int,int) to authenticated;
grant execute on function public.join_game(uuid) to authenticated;

-- Bestehende Spielerwerte an das neue Logistikmodell anpassen.
do $$
declare p record;
begin
 for p in select game_id,user_id from game_players loop
  perform recompute_player_stats(p.game_id,p.user_id);
 end loop;
end $$;
