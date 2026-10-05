SCHATZSUCHE ONLINE V6.30

NEU
- Wiederholbarer Endgame-Ausbau erscheint erst nach komplettem normalen Techbaum.
- Exklusive Technologien blockieren die Endgame-Freischaltung nicht.
- Expeditionsausbau erhöht Felder/Zug dauerhaft im aktuellen Spiel.
- Maschinenoptimierung erhöht die virtuelle Maschinenleistung dauerhaft im aktuellen Spiel.
- Beide Upgrades sind beliebig oft kaufbar.
- Preis steigt nach Formel:
  Startpreis × Preisfaktor ^ bisherige Käufe
- Startpreis, Preisfaktor und Bonus je Kauf sind in der Schaltzentrale einstellbar.
- Schatzsicherungs-Statistik in der Schaltzentrale:
  Gesamtversuche, bestanden, falsch, abgelaufen, Lösungsquote,
  Durchschnittsversuche pro Schatz und Werte je Aufgabentyp.
- Maschinen bleiben technisch weiterhin die schlanke V6.27-Wahrscheinlichkeitssuche.
  Der Endgame-Ausbau addiert lediglich virtuelle Suchleistung.

DEPLOY
1. ZUERST supabase/v6_30_migration.sql EINMAL ausführen.
2. Danach Projektdateien ins Repo übernehmen.
3. .env.local nicht hochladen.
4. Vercel deployen lassen.

RELEASE-ORDNER
Bewusst bereinigt. Im Supabase-Ordner liegen nur:
- setup.sql
- v6_30_migration.sql
- README.txt
