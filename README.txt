SCHATZSUCHE ONLINE V6.29

AKTUELLER STAND
- V6.27: Maschinen als sehr schlanke virtuelle Schatzsuche
- V6.28: Assistent/Autopilot für normale Spielerzüge
- V6.29:
  - Assistent kostet einmalig 10 Taler pro Spiel
  - deutliche Meldung am Ende einer Route
  - abgearbeitete Wegpunkte bleiben erhalten
  - Route kann direkt erneut abgefahren werden
  - ungenutzte Hybrid-Technologien werden entfernt

ASSISTENT
- maximal 20 Wegpunkte
- AN: Kartenklick setzt Wegpunkte
- AUS: Kartenklick erkundet normal
- höchstens ein Assistentenschritt pro normalem Zugtakt
- nutzt exakt die normale reveal_power und Reveal-Logik
- keine Offline-Nachholung
- läuft nur bei sichtbarer/aktiver Spielseite
- Route und Fortschritt bleiben lokal im Browser
- Maschinenlogik bleibt davon getrennt

DEPLOY V6.29
1. ZUERST in Supabase SQL Editor EINMAL ausführen:
   supabase/v6_29_migration.sql
2. Danach Projektdateien ins GitHub-Repo übernehmen.
3. .env.local nicht hochladen.
4. Vercel deployen lassen.

SUPABASE-ORDNER
Bewusst klein gehalten:
- setup.sql
- v6_27_migration.sql
- v6_29_migration.sql
- README.txt

Alte Zwischenmigrationen sind aus dieser Release-ZIP entfernt.
