SCHATZSUCHE ONLINE V6.25.1 – AUTOMATISCHE EXPLORED_FIELDS-BEREINIGUNG

- Standard-Aufbewahrung: 24 Stunden
- nur Spiele mit status='finished'
- nur wenn ein game_archive-Eintrag existiert
- gelöscht werden ausschließlich explored_fields der fertigen Spiele
- aktive Spiele bleiben unangetastet
- game_archive / Hall of Fame bleiben erhalten
- Bereinigung läuft über die bestehende Lobby-Wartung automatisch mit
- Aufbewahrungsfrist in der Schaltzentrale einstellbar: 1–720 Stunden

INSTALLATION
1. ZIP in GitHub ersetzen.
2. Supabase SQL Editor:
   NUR supabase/v6_25_1_migration.sql einmal ausführen.
3. Vercel deployen.
4. Optional testen:
   select public.cleanup_finished_explored_fields_v6251();

Kein VACUUM FULL erforderlich.
