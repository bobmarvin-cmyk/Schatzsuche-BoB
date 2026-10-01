-- SCHATZSUCHE ONLINE V6
-- EINMAL im Supabase SQL Editor nach dem V5-Setup ausführen.

create table if not exists public.technologies(
 id text primary key,name text not null,branch text not null,cost numeric(14,4) not null,
 reveal_power_bonus int not null default 0,reward_bonus numeric(10,4) not null default 0,
 moves_bonus int not null default 0,analysis_level int not null default 0,round_mod int,
 requires text[] not null default '{}');

create table if not exists public.player_technologies(
 game_id uuid not null references public.games(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 technology_id text not null references public.technologies(id) on delete cascade,
 researched_at timestamptz not null default now(),
 primary key(game_id,user_id,technology_id));

alter table public.game_players add column if not exists reward_multiplier numeric(10,4) not null default 1;
alter table public.game_players add column if not exists analysis_level int not null default 0;

alter table public.technologies enable row level security;
alter table public.player_technologies enable row level security;
drop policy if exists "technologies readable" on public.technologies;
create policy "technologies readable" on public.technologies for select to authenticated using(true);
drop policy if exists "player technologies readable" on public.player_technologies;
create policy "player technologies readable" on public.player_technologies for select to authenticated using(true);

insert into public.technologies values
('root','Grundlagen','Basis',.05,1,0,0,0,null,'{}'),
('e1','Fernglas I','Erkundung',.15,2,0,0,0,null,'{root}'),
('e2','Fernglas II','Erkundung',.45,5,0,0,0,null,'{e1}'),
('e3','Suchtrupp','Erkundung',.60,8,0,0,0,null,'{e1}'),
('e4','Geländefahrzeuge','Erkundung',1.80,20,0,0,0,null,'{e2}'),
('e5','Expeditionsteam','Erkundung',2.20,25,0,0,0,null,'{e3}'),
('e6','Drohnen','Erkundung',5.50,50,0,0,0,null,'{e4}'),
('e7','Präzisionssuche','Erkundung',5.50,35,.15,0,0,null,'{e5}'),
('e8','Luftaufklärung','Erkundung',14,100,0,0,0,null,'{e6}'),
('e9','Rasteroptimierung','Erkundung',14,75,.25,0,0,null,'{e7}'),
('e10','Satellitenbilder','Erkundung',35,250,0,0,0,null,'{e8}'),
('end1','Planetare Suche','Erkundung',260,1000,0,0,0,null,'{e10}'),
('a1','Kartografie','Analyse',.40,0,0,0,1,null,'{root}'),
('a2','Spurenanalyse','Analyse',1.20,0,0,0,2,null,'{a1}'),
('a3','Sektorscan','Analyse',3.50,0,0,0,3,null,'{a2}'),
('a4','Radar','Analyse',8,0,0,0,4,null,'{a3}'),
('a5','Geodatenanalyse','Analyse',20,0,0,0,5,null,'{a4}'),
('a6','KI-Auswertung','Analyse',55,0,0,0,6,null,'{a5}'),
('l1','Logistik I','Logistik',.12,0,0,0,0,3,'{root}'),
('l2','Basislager','Logistik',.45,0,0,0,0,2,'{l1}'),
('l3','Versorgungsnetz','Logistik',1.40,0,0,1,0,null,'{l2}'),
('l4','Automatisierte Teams','Logistik',3.50,0,0,2,0,null,'{l3}'),
('l5','Expeditionsautomatik','Logistik',9,0,0,3,0,null,'{l4}'),
('w1','Förderprogramm','Wirtschaft',5,0,.5,0,0,null,'{e7}'),
('w2','Forschungsfonds','Wirtschaft',12,0,1,0,0,null,'{a5}'),
('h1','Drohnen + Radar','Hybrid',12,120,0,0,5,null,'{e8,a4}'),
('h2','Satelliten-KI','Hybrid',55,350,0,0,6,null,'{e10,a6}')
on conflict(id) do nothing;

create or replace function public.recompute_player_stats(gid uuid,uid uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 update game_players gp set
 reveal_power=1+coalesce((select sum(t.reveal_power_bonus) from player_technologies pt join technologies t on t.id=pt.technology_id where pt.game_id=gid and pt.user_id=uid),0),
 reward_multiplier=1+coalesce((select sum(t.reward_bonus) from player_technologies pt join technologies t on t.id=pt.technology_id where pt.game_id=gid and pt.user_id=uid),0),
 analysis_level=coalesce((select max(t.analysis_level) from player_technologies pt join technologies t on t.id=pt.technology_id where pt.game_id=gid and pt.user_id=uid),0)
 where gp.game_id=gid and gp.user_id=uid;
end $$;

create or replace function public.moves_for_round(gid uuid,uid uuid,rnd int)
returns int language plpgsql security definer set search_path=public as $$
declare m int:=1;x record;
begin
 for x in select t.moves_bonus,t.round_mod from player_technologies pt join technologies t on t.id=pt.technology_id where pt.game_id=gid and pt.user_id=uid loop
  m:=m+x.moves_bonus;
  if x.round_mod is not null and mod(rnd,x.round_mod)=0 then m:=m+1; end if;
 end loop;
 return m;
end $$;

create or replace function public.buy_technology(p_game_id uuid,p_technology_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare gp game_players%rowtype;t technologies%rowtype;r text;
begin
 select * into gp from game_players where game_id=p_game_id and user_id=auth.uid() for update;
 if not found then raise exception 'Nicht im Spiel'; end if;
 select * into t from technologies where id=p_technology_id;
 if not found then raise exception 'Technologie nicht gefunden'; end if;
 if exists(select 1 from player_technologies where game_id=p_game_id and user_id=auth.uid() and technology_id=p_technology_id) then raise exception 'Bereits erforscht'; end if;
 foreach r in array t.requires loop
  if not exists(select 1 from player_technologies where game_id=p_game_id and user_id=auth.uid() and technology_id=r) then raise exception 'Voraussetzung fehlt'; end if;
 end loop;
 if gp.coins<t.cost then raise exception 'Nicht genug Taler'; end if;
 update game_players set coins=coins-t.cost where game_id=p_game_id and user_id=auth.uid();
 insert into player_technologies(game_id,user_id,technology_id) values(p_game_id,auth.uid(),p_technology_id);
 perform recompute_player_stats(p_game_id,auth.uid());
 return jsonb_build_object('message',t.name||' erforscht');
end $$;

create or replace function public.advance_if_finished(gid uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare g games%rowtype;p record;
begin
 select * into g from games where id=gid for update;
 if not found or g.status<>'active' then return false; end if;
 if (select coalesce(sum(moves_left),0) from game_players where game_id=gid)>0 then return false; end if;
 update games set round_no=round_no+1 where id=gid returning * into g;
 for p in select user_id from game_players where game_id=gid loop
  update game_players set moves_left=moves_for_round(gid,p.user_id,g.round_no) where game_id=gid and user_id=p.user_id;
 end loop;
 return true;
end $$;

create or replace function public.reveal_area(p_game_id uuid,p_x int,p_y int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare gp game_players%rowtype;g games%rowtype;opened int:=0;rad int:=0;dx int;dy int;nx int;ny int;
 hit boolean:=false;rew numeric;hint text:='';dist numeric;dir text:='';adv boolean:=false;
begin
 select * into g from games where id=p_game_id for update;
 if not found then raise exception 'Spiel nicht gefunden'; end if;
 select * into gp from game_players where game_id=p_game_id and user_id=auth.uid() for update;
 if not found then raise exception 'Nicht im Spiel'; end if;
 if g.status<>'active' then raise exception 'Spiel beendet'; end if;
 if gp.moves_left<=0 then raise exception 'Keine Züge mehr'; end if;

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

 if gp.analysis_level>0 then
  dist:=sqrt(power(g.treasure_x-p_x,2)+power(g.treasure_y-p_y,2));
  dir:=case when g.treasure_x>=p_x then 'Osten' else 'Westen' end||'/'||case when g.treasure_y>=p_y then 'Süden' else 'Norden' end;
  hint:=' Richtung: '||dir||'.';
  if gp.analysis_level>=2 then hint:=hint||' Distanz ~'||(round(dist/20)*20)::int||'.'; end if;
  if gp.analysis_level>=4 then hint:=hint||' Radar ~'||(round(dist/10)*10)::int||'.'; end if;
  if gp.analysis_level>=5 then hint:=hint||' Geo ~'||(round(dist/5)*5)::int||'.'; end if;
  if gp.analysis_level>=6 then hint:=hint||' KI ~'||round(dist)::int||'.'; end if;
 end if;

 adv:=advance_if_finished(p_game_id);
 return jsonb_build_object(
  'message',opened||' Felder aufgedeckt. +'||to_char(opened*rew,'FM999999990.00')||' Taler.'||hint||case when adv then ' Neue Runde gestartet.' else '' end,
  'won',false,'opened',opened,'round_advanced',adv
 );
end $$;

grant execute on function public.buy_technology(uuid,text) to authenticated;
grant execute on function public.reveal_area(uuid,int,int) to authenticated;
