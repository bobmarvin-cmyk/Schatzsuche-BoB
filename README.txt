SCHATZSUCHE ONLINE V6.39.1

SECURITY-HOTFIX VOR INSTALLATION

Diese Version ersetzt V6.39, falls V6.39 noch NICHT ausgeführt wurde.

- Enthält weiterhin V6.38 Auto-Entwicklung + V6.39 Bots.
- Alle neuen Bot-/Bot-Historie-/Bot-Map-/Bot-Archivtabellen haben jetzt explizit RLS aktiviert.
- anon und authenticated erhalten keinen direkten Tabellenzugriff.
- Zugriff erfolgt ausschließlich über die vorgesehenen SECURITY DEFINER RPCs.
- Dadurch ist die Supabase-RLS-Warnung fachlich behoben.

INSTALLATION AB PRODUKTIVSTAND V6.33:
1. NUR supabase/v6_39_migration.sql EINMAL ausführen.
2. NICHT zusätzlich v6_38_migration.sql ausführen.
3. Danach V6.39.1 deployen.

Hinweis:
Supabase kann weiterhin vor „destructive operations“ warnen, weil die Migration
bestehende Trigger/Funktionen mit DROP TRIGGER / CREATE OR REPLACE aktualisiert.
Das ist für dieses Update beabsichtigt; es werden dabei keine Spieltabellen gelöscht.
