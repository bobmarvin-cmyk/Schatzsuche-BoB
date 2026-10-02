-- SCHATZSUCHE ONLINE V6.4
-- Nach den bisherigen Migrationen EINMAL im Supabase SQL Editor ausführen.

create extension if not exists pgcrypto;

alter table public.games add column if not exists is_private boolean not null default false;
alter table public.games add column if not exists invite_code text;

create unique index if not exists games_invite_code_unique
on public.games(invite_code)
where invite_code is not null;

create table if not exists public.game_secrets(
  game_id uuid primary key references public.games(id) on delete cascade,
  password_hash text
);
alter table public.game_secrets enable row level security;
-- Absichtlich keine SELECT-Policy: Passworthashes werden nicht an Clients ausgegeben.

create table if not exists public.contact_messages(
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
-- Ebenfalls keine SELECT-Policy für normale Nutzer.

-- Private Spiele sind nur für Mitglieder/Ersteller sichtbar.
drop policy if exists "games readable" on public.games;
drop policy if exists "games visible" on public.games;
create policy "games visible" on public.games
for select to authenticated
using(
  is_private=false
  or created_by=auth.uid()
  or exists(
    select 1 from public.game_players gp
    where gp.game_id=games.id and gp.user_id=auth.uid()
  )
);

create or replace function public.generate_invite_code()
returns text language plpgsql volatile as $$
declare code text;
begin
 loop
  code:=upper(substr(md5(random()::text||clock_timestamp()::text),1,6));
  exit when not exists(select 1 from public.games where invite_code=code);
 end loop;
 return code;
end $$;

create or replace function public.create_game_v64(
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
 p_password text default null
) returns uuid
language plpgsql security definer set search_path=public as $$
declare
 gid uuid; cols int; rows int; tx int; ty int; choice int;
 lat numeric; lon numeric; label text; code text;
begin
 if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
 if p_max_players<2 or p_max_players>100 then raise exception 'Spielerzahl muss zwischen 2 und 100 liegen'; end if;
 if p_field_count<100 or p_field_count>50000000 then raise exception 'Feldanzahl muss zwischen 100 und 50.000.000 liegen'; end if;
 if p_cell_size_m<5 or p_cell_size_m>5000 then raise exception 'Ungültige Feldgröße'; end if;
 if p_regen_seconds<5 or p_regen_seconds>86400 then raise exception 'Regeneration muss 5 Sekunden bis 24 Stunden betragen'; end if;
 if p_max_stored_moves<1 or p_max_stored_moves>100 then raise exception 'Ungültiges Zuglimit'; end if;
 if p_password is not null and length(trim(p_password))>0 and length(trim(p_password))<4 then raise exception 'Passwort muss mindestens 4 Zeichen haben'; end if;

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

 tx:=floor(random()*cols)::int;
 ty:=floor(random()*rows)::int;
 code:=generate_invite_code();

 insert into public.games(
  name,width,height,max_players,treasure_x,treasure_y,created_by,
  center_lat,center_lon,center_label,cell_size_m,location_mode,
  regen_seconds,max_stored_moves,is_private,invite_code
 )
 values(
  p_name,cols,rows,p_max_players,tx,ty,auth.uid(),
  lat,lon,label,p_cell_size_m,p_location_mode,
  p_regen_seconds,p_max_stored_moves,p_is_private,code
 )
 returning id into gid;

 if p_is_private then
  insert into public.game_secrets(game_id,password_hash)
  values(
   gid,
   case when p_password is null or length(trim(p_password))=0
        then null
        else crypt(p_password,gen_salt('bf'))
   end
  );
 end if;

 insert into public.game_players(game_id,user_id,moves_left,last_regen_at)
 values(gid,auth.uid(),1,now());

 perform public.assign_player_color(gid,auth.uid());
 update public.profiles set total_games=total_games+1 where id=auth.uid();

 return gid;
end $$;

create or replace function public.join_game_v64(p_game_id uuid,p_password text default null)
returns void
language plpgsql security definer set search_path=public as $$
declare
 g public.games%rowtype;
 secret public.game_secrets%rowtype;
 cnt int;
begin
 if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;

 if exists(
  select 1 from public.game_players
  where game_id=p_game_id and user_id=auth.uid()
 ) then
  perform public.assign_player_color(p_game_id,auth.uid());
  return;
 end if;

 select * into g from public.games where id=p_game_id;
 if not found then raise exception 'Spiel nicht gefunden'; end if;
 if g.status<>'active' then raise exception 'Spiel ist beendet'; end if;

 if g.is_private then
  select * into secret from public.game_secrets where game_id=p_game_id;
  if secret.password_hash is not null then
   if p_password is null or crypt(p_password,secret.password_hash)<>secret.password_hash then
    raise exception 'Passwort erforderlich oder falsch';
   end if;
  end if;
 end if;

 select count(*) into cnt from public.game_players where game_id=p_game_id;
 if cnt>=g.max_players then raise exception 'Spiel ist voll'; end if;

 insert into public.game_players(game_id,user_id,moves_left,last_regen_at)
 values(p_game_id,auth.uid(),1,now());

 perform public.assign_player_color(p_game_id,auth.uid());
 update public.profiles set total_games=total_games+1 where id=auth.uid();
end $$;

create or replace function public.join_game_by_code_v64(p_invite_code text,p_password text default null)
returns uuid
language plpgsql security definer set search_path=public as $$
declare gid uuid;
begin
 select id into gid from public.games where upper(invite_code)=upper(trim(p_invite_code));
 if not found then raise exception 'Einladungscode nicht gefunden'; end if;
 perform public.join_game_v64(gid,p_password);
 return gid;
end $$;

create or replace function public.submit_contact_message(p_name text,p_email text,p_message text)
returns void
language plpgsql security definer set search_path=public as $$
begin
 if length(trim(coalesce(p_name,'')))<1 or length(p_name)>100 then raise exception 'Bitte einen gültigen Namen eingeben'; end if;
 if length(trim(coalesce(p_email,'')))<3 or length(p_email)>200 or position('@' in p_email)=0 then raise exception 'Bitte eine gültige E-Mail-Adresse eingeben'; end if;
 if length(trim(coalesce(p_message,'')))<5 or length(p_message)>5000 then raise exception 'Nachricht muss zwischen 5 und 5000 Zeichen lang sein'; end if;

 insert into public.contact_messages(user_id,name,email,message)
 values(auth.uid(),trim(p_name),trim(p_email),trim(p_message));
end $$;

grant execute on function public.create_game_v64(text,bigint,numeric,int,text,numeric,numeric,text,int,int,boolean,text) to authenticated;
grant execute on function public.join_game_v64(uuid,text) to authenticated;
grant execute on function public.join_game_by_code_v64(text,text) to authenticated;
grant execute on function public.submit_contact_message(text,text,text) to anon,authenticated;
