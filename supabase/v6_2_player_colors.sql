-- SCHATZSUCHE V6.2 - SPIELERFARBEN
-- Einmal im Supabase SQL Editor ausführen.

alter table public.game_players
add column if not exists player_color text;

create or replace function public.assign_player_color(p_game_id uuid,p_user_id uuid)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  colors text[] := array[
    '#3b82f6','#22c55e','#a855f7','#ef4444','#f59e0b',
    '#06b6d4','#ec4899','#84cc16','#f97316','#8b5cf6',
    '#14b8a6','#eab308','#64748b','#10b981','#0ea5e9',
    '#d946ef','#e11d48','#65a30d','#c2410c','#7c3aed'
  ];
  idx int;
  chosen text;
begin
  select count(*)+1 into idx
  from public.game_players
  where game_id=p_game_id
    and player_color is not null;

  chosen := colors[((idx-1) % array_length(colors,1))+1];

  update public.game_players
  set player_color=chosen
  where game_id=p_game_id
    and user_id=p_user_id
    and player_color is null;

  return chosen;
end
$$;

-- Bereits vorhandenen Spielern Farben zuweisen.
do $$
declare
  g record;
  p record;
begin
  for g in select id from public.games loop
    for p in
      select user_id
      from public.game_players
      where game_id=g.id
      order by joined_at
    loop
      perform public.assign_player_color(g.id,p.user_id);
    end loop;
  end loop;
end
$$;

-- join_game erweitern, damit neue Spieler automatisch eine feste Farbe bekommen.
create or replace function public.join_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  cnt int;
  mx int;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  if not exists(select 1 from public.games where id=p_game_id) then
    raise exception 'Spiel nicht gefunden';
  end if;

  if exists(
    select 1 from public.game_players
    where game_id=p_game_id and user_id=auth.uid()
  ) then
    perform public.assign_player_color(p_game_id,auth.uid());
    perform public.ensure_active_round(p_game_id);
    return;
  end if;

  select count(*), max(g.max_players)
  into cnt,mx
  from public.game_players gp
  join public.games g on g.id=gp.game_id
  where gp.game_id=p_game_id;

  if cnt>=mx then
    raise exception 'Spiel ist voll';
  end if;

  insert into public.game_players(game_id,user_id)
  values(p_game_id,auth.uid());

  perform public.assign_player_color(p_game_id,auth.uid());

  update public.profiles
  set total_games=total_games+1
  where id=auth.uid();

  perform public.ensure_active_round(p_game_id);
end
$$;

grant execute on function public.assign_player_color(uuid,uuid) to authenticated;
grant execute on function public.join_game(uuid) to authenticated;
