SCHATZSUCHE ONLINE V6.28

AKTUELLER STAND
- V6.27: Maschinen als schlanke virtuelle Schatzsuche
- V6.28: Assistent/Autopilot mit bis zu 20 Wegpunkten
- Assistent arbeitet nur bei aktiver Spielseite und nutzt normale Züge
- Keine Offline-Nachholung
- Satellitenansicht mit Straßen-/Ortsnamen
- Frei terminierbarer Spielstart

DEPLOY
1. Den Inhalt dieser ZIP als aktuellen Projektstand ins GitHub-Repo übernehmen.
2. .env.local nicht hochladen.
3. Für V6.28 ist KEINE neue SQL-Migration nötig.
4. Vercel deployt anschließend automatisch.

SUPABASE
Der Ordner /supabase wurde bewusst bereinigt.
Enthalten sind nur:
- setup.sql
- v6_27_migration.sql
- README.txt

Die vielen historischen Zwischenmigrationen wurden aus dieser Release-ZIP entfernt.
Die bestehende produktive Supabase-Datenbank bleibt davon unberührt.
