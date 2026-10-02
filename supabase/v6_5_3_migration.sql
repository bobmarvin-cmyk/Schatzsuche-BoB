-- V6.5.3 – Hilfe-Popup beim ersten Login
-- Nach V6.5 EINMAL ausführen.

alter table public.profiles
add column if not exists help_intro_seen boolean not null default false;

-- Bestehende RLS-Policy auf profiles muss dem Nutzer bereits erlauben,
-- sein eigenes Profil zu lesen/ändern. Falls UPDATE bislang nicht erlaubt ist:
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update"
on public.profiles
for update
to authenticated
using(id=auth.uid())
with check(id=auth.uid());
