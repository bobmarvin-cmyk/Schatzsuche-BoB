SCHATZSUCHE ONLINE V6.9 – MASCHINEN & DYNAMISCHE ZUGZEITEN

NEU 1: SCHALTZENTRALE → SPIELERSTELLUNG
Die Zugregenerations-Auswahl wird nicht mehr hart im Frontend festgelegt.

Wenn du in der Schaltzentrale z. B. einstellst:
  Minimum: 7 Sekunden
  Maximum: 60 Sekunden
  Standard: 15 Sekunden

dann bietet die Spielerstellung automatisch nur Werte innerhalb 7–60 Sekunden an
und startet mit 15 Sekunden.

Auch die tatsächliche serverseitige Regeneration respektiert jetzt das eingestellte
Minimum. Der alte feste 5-Sekunden-Untergrenzenwert wurde entfernt.

NEU 2: TECHNOLOGIEZWEIG „AUTOMATISIERUNG“
Standardmäßig enthalten:
- Vermessungsdrohne: 5 Felder/Takt
- Suchroboter: +15 Felder/Takt
- Drohnenschwarm: +50 Felder/Takt
- Autonomer Roverpark: +150 Felder/Takt
- Suchfabrik: +500 Felder/Takt

Die Leistungen addieren sich.

Beispiel:
Vermessungsdrohne + Suchroboter + Drohnenschwarm
= 70 automatische Felder pro Takt.

Alle Preise und Felder/Takt-Werte können in der Schaltzentrale geändert werden:
  Technologiebaum → Maschinenfelder pro Takt

NEU 3: KEIN OFFLINE-FARMING
Maschinen arbeiten NUR wenn:
- der Spieler Mitglied dieses Games ist
- das Game aktiv ist
- die Spielseite sichtbar geöffnet ist
- der Browser-Tab fokussiert ist
- die Seite innerhalb der letzten 20 Sekunden einen Presence-Heartbeat gesendet hat

Beim Verlassen des Spiels oder Wechsel in eine andere App / einen anderen Tab stoppt
die Automatisierung. Verpasste Takte werden später NICHT nachgeholt.

NEU 4: MASCHINEN-ZIELGEBIET
Maschinen arbeiten rund um den letzten Bereich, den der Spieler manuell auf der Karte
angeklickt hat. Dadurch bleibt Strategie wichtig:
Du entscheidest manuell, wo deine „Felderfabrik“ weiterarbeitet.

NEU 5: MASCHINEN-ÖKONOMIE
Automatisch aufgedeckte Felder können Taler erzeugen.

In der Schaltzentrale:
  Maschinen-Talerfaktor

Beispiele:
  0    = keine Taler durch Maschinen
  0.25 = 25 % des normalen Feldertrags
  1.0  = 100 % des normalen Feldertrags

Standard in V6.9: 0.25

Maschinen können auch einen Schatz finden, aber nur während der Spieler aktiv im Game ist.

INSTALLATION
1. Inhalt dieser ZIP in dein bestehendes GitHub-Repository hochladen und Dateien ersetzen.
2. Supabase → SQL Editor.
3. NUR:
   supabase/v6_9_migration.sql
   einmal vollständig ausführen.
4. Vercel deployt automatisch.

TEST
1. Schaltzentrale: Minimum Zugzeit z. B. auf 8 Sekunden setzen und speichern.
2. Lobby neu laden → Neues Spiel → Zugregeneration prüfen.
3. Testspiel starten.
4. Automatisierung → Vermessungsdrohne kaufen.
5. Ein Kartenfeld manuell anklicken.
6. Spielseite offen lassen → Maschine deckt pro Takt automatisch Felder im gewählten Gebiet auf.
7. Tab/App wechseln → nach spätestens ca. 20 Sekunden keine weitere Maschinenarbeit.
