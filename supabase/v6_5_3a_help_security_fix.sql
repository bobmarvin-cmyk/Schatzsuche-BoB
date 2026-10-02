-- V6.5.3a – Erste-Login-Hilfe, sicherer Fix
-- Kann auch ausgeführt werden, wenn v6_5_3_migration.sql bereits gelaufen ist.
-- EINMAL ausführen.

alter table public.profiles
add column if not exists help_intro_seen boolean not null default false;

-- Alte/breite direkte UPDATE-Policies entfernen.
-- Dadurch kann ein normaler Client nicht einfach wins, gold_found_ug,
-- total_games usw. im eigenen Profil manipulieren.
drop policy if exists "profile self update" on public.profiles;
drop policy if exists "profiles self update" on public.profiles;

-- Das Hilfe-Flag wird nur über diese gezielte Serverfunktion gesetzt.
create or replace function public.mark_help_intro_seen_v653()
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  update public.profiles
  set help_intro_seen=true
  where id=auth.uid();
end;
$$;

revoke all on function public.mark_help_intro_seen_v653() from public;
grant execute on function public.mark_help_intro_seen_v653() to authenticated;

-- Lesepolicy sicherstellen, damit das Popup prüfen kann,
-- ob die Einführung schon gesehen wurde.
drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable"
on public.profiles
for select
to authenticated
using (true);
