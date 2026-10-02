-- OPTIONAL:
-- Nur nötig, wenn du in Supabase die Erweiterung pg_cron erst NACH V6.6 aktivierst.
-- Danach dieses SQL einmal ausführen.

select cron.schedule(
  'schatzsuche-v66-maintenance',
  '0 * * * *',
  'select public.run_game_maintenance_v66();'
);
