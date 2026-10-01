-- SCHATZSUCHE ONLINE V5 - SUPABASE SETUP
create extension if not exists pgcrypto;

create table if not exists public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Spieler',
  total_games int not null default 0,
  wins int not null default 0,
  total_fields_revealed bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.games(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  width int not null default 100,
  height int not null default 100,
  max_players int not null default 20,
  round_no int not null default 1,
  status text not null default 'active',
  treasure_x int not null,
  treasure_y int not null,
  winner_id uuid references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.game_players(
  game_id uuid references public.games(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  coins numeric(14,4) not null default 0,
  moves_left int not null default 1,
  reveal_power int not null default 1,
  joined_at timestamptz not null default now(),
  primary key(game_id,user_id)
);

create table if not exists public.explored_fields(
  game_id uuid references public.games(id) on delete cascade,
  x int not null,
  y int not null,
  discovered_by uuid references public.profiles(id),
  is_treasure boolean not null default false,
  discovered_at timestamptz not null default now(),
  primary key(game_id,x,y)
);

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.explored_fields enable row level security;

drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select to authenticated using (true);
drop policy if exists "profile self update" on public.profiles;
create policy "profile self update" on public.profiles for update to authenticated using (auth.uid()=id);

drop policy if exists "games readable" on public.games;
create policy "games readable" on public.games for select to authenticated using (true);

drop policy if exists "players readable" on public.game_players;
create policy "players readable" on public.game_players for select to authenticated using (true);

drop policy if exists "fields readable" on public.explored_fields;
create policy "fields readable" on public.explored_fields for select to authenticated using (true);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,display_name)
 values(new.id,coalesce(new.raw_user_meta_data->>'display_name','Spieler'))
 on conflict(id) do nothing;
 return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.create_game(p_name text,p_width int,p_height int,p_max_players int)
returns uuid language plpgsql security definer set search_path=public as $$
declare gid uuid; tx int; ty int;
begin
 if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
 tx:=floor(random()*p_width)::int; ty:=floor(random()*p_height)::int;
 insert into games(name,width,height,max_players,treasure_x,treasure_y,created_by)
 values(p_name,p_width,p_height,p_max_players,tx,ty,auth.uid()) returning id into gid;
 insert into game_players(game_id,user_id) values(gid,auth.uid());
 update profiles set total_games=total_games+1 where id=auth.uid();
 return gid;
end $$;

create or replace function public.join_game(p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare cnt int; mx int;
begin
 if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
 select count(*), max(max_players) into cnt,mx from game_players gp join games g on g.id=gp.game_id where gp.game_id=p_game_id;
 if exists(select 1 from game_players where game_id=p_game_id and user_id=auth.uid()) then return; end if;
 if cnt>=mx then raise exception 'Spiel ist voll'; end if;
 insert into game_players(game_id,user_id) values(p_game_id,auth.uid());
 update profiles set total_games=total_games+1 where id=auth.uid();
end $$;

create or replace function public.reveal_field(p_game_id uuid,p_x int,p_y int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare gp game_players%rowtype; g games%rowtype; is_hit boolean; reward numeric:=0.01;
begin
 if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
 select * into g from games where id=p_game_id for update;
 if not found then raise exception 'Spiel nicht gefunden'; end if;
 if g.status<>'active' then raise exception 'Spiel beendet'; end if;
 if p_x<0 or p_y<0 or p_x>=g.width or p_y>=g.height then raise exception 'Ungültiges Feld'; end if;
 select * into gp from game_players where game_id=p_game_id and user_id=auth.uid() for update;
 if not found then raise exception 'Nicht im Spiel'; end if;
 if gp.moves_left<=0 then raise exception 'Keine Züge mehr'; end if;
 if exists(select 1 from explored_fields where game_id=p_game_id and x=p_x and y=p_y) then raise exception 'Feld bereits erforscht'; end if;

 is_hit := (p_x=g.treasure_x and p_y=g.treasure_y);
 insert into explored_fields(game_id,x,y,discovered_by,is_treasure) values(p_game_id,p_x,p_y,auth.uid(),is_hit);
 update game_players set moves_left=moves_left-1,coins=coins + case when is_hit then 0 else reward end
 where game_id=p_game_id and user_id=auth.uid();
 update profiles set total_fields_revealed=total_fields_revealed+1 where id=auth.uid();

 if is_hit then
   update games set status='finished',winner_id=auth.uid() where id=p_game_id;
   update profiles set wins=wins+1 where id=auth.uid();
   return jsonb_build_object('message','🏆 Schatz gefunden!','won',true);
 end if;

 return jsonb_build_object('message','Leer. +0,01 Taler','won',false);
end $$;

grant execute on function public.create_game(text,int,int,int) to authenticated;
grant execute on function public.join_game(uuid) to authenticated;
grant execute on function public.reveal_field(uuid,int,int) to authenticated;

-- Realtime für Live-Updates
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.game_players;
alter publication supabase_realtime add table public.explored_fields;
