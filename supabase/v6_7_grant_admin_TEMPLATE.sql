-- V6.7 – DIR SELBST ADMINRECHTE GEBEN
-- WICHTIG: Ersetze DEINE_LOGIN_EMAIL durch exakt die E-Mail-Adresse,
-- mit der du dich im Spiel anmeldest, und führe diese eine Zeile im SQL Editor aus.

insert into public.admin_users(user_id)
select id
from auth.users
where lower(email)=lower('DEINE_LOGIN_EMAIL')
on conflict(user_id) do nothing;

-- Kontrolle:
select u.email,a.created_at
from public.admin_users a
join auth.users u on u.id=a.user_id;
