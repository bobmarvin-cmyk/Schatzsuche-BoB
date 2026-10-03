SCHATZSUCHE ONLINE V6.14.1

1. MOBILES INGAME-HUD
Die Werte verschwinden mobil nicht mehr komplett.

Standardmäßig bleibt permanent eine sehr kleine 4er-Leiste sichtbar:
- Taler
- Züge
- Felder/Zug
- Felder/Minute

Mit „📊 Werte“ klappt die vollständige Übersicht auf.
So bleiben die wichtigsten Werte immer im Blick, ohne viel Karte zu verdecken.

2. ANALYSE WIEDER EINFACHER
Der Landschafts-Analyseversuch aus V6.14 wurde vereinfacht.

Die Analyse zeigt wieder einen normalen Tipp mit:
- Himmelsrichtung
- je nach Analyse-Stufe grober/feiner Entfernung bzw. Kartenhinweis

Es wird keine sichtbare Zielzone benötigt.

3. STÄRKERE FALLEN
Zusätzlich zu den bisherigen Fallen gibt es:
- EMP-Falle: mehrere gespeicherte Züge weg
- Sabotagefalle: hoher Talerverlust
- Blackout-Störsender: starke Reduktion des nächsten manuellen Suchzuges

Alle Werte sind weiterhin über „Technologien“ in der Schaltzentrale veränderbar:
- Preis
- Fallentyp
- Stärke
- maximale aktive Anzahl

4. ORT DIREKT AUSWÄHLEN
Bei der Game-Erstellung gibt es jetzt drei Möglichkeiten:
- 🌍 Zufälliger echter Ort
- 🔎 Ort suchen
- 📍 Eigene Koordinaten

„Ort suchen“ funktioniert bewusst NICHT als Live-Autocomplete.
Der Nutzer schreibt z. B.:
  St. Wendel, Saarland
und drückt „Suchen“.

Danach erscheinen passende Treffer zum Anklicken.
Der ausgewählte Ort wird automatisch in Koordinaten + Ortsname übernommen.

Die Suche wird serverseitig über einen Geocoding-Endpunkt geleitet.
Standardmäßig ist Nominatim/OpenStreetMap eingetragen.
Optional kann in Vercel über
  GEOCODER_BASE_URL
ein anderer kompatibler Anbieter gesetzt werden, ohne neuen Code-Deploy.

WICHTIG FÜR NOMINATIM:
- keine Autocomplete-Anfragen
- nur bewusst vom Nutzer ausgelöste Suche
- Attribution bleibt sichtbar
- keine automatisierten Ortsabfragen

5. AUTOMATISCHE GAME-ERSTELLUNG
Neue Sektion in der Schaltzentrale:
  🤖 Automatische Games

Einstellbar:
- aktiv / deaktiviert
- alle X Minuten
- Namenspräfix
- Kartenfelder
- Feldkante
- maximale Spieler
- Zugintervall
- Zugspeicher
- Schatzteile
- Gimmickdichte
- Standardgame / Paygame
- Paygame-Testeinsatz
- Zufallsort global oder feste Koordinaten

Zusätzlich:
  „Jetzt Game erzeugen“

Damit kann das eingestellte Rezept sofort getestet werden.

AUTOMATISCHER BETRIEB:
V6.14.1 versucht pg_cron zu aktivieren und prüft alle 5 Minuten,
ob ein neues Auto-Game fällig ist.

Falls pg_cron in deinem Supabase-Projekt nicht verfügbar/erlaubt ist:
- die Einstellungen funktionieren trotzdem
- „Jetzt Game erzeugen“ funktioniert trotzdem
- lediglich der automatische Hintergrund-Zeitplan läuft dann nicht

Auto-Games werden unter dem beim Speichern hinterlegten Admin-Account als Host erstellt.
Bei Auto-Paygames muss dieser Host entsprechend genug Test-Gold im Wallet besitzen.

INSTALLATION
1. Inhalt dieser ZIP in dein GitHub-Repository hochladen und vorhandene Dateien ersetzen.
2. .env.local NICHT hochladen.
3. Supabase → SQL Editor.
4. NUR:
   supabase/v6_14_1_migration.sql
   einmal vollständig ausführen.
5. Vercel deployt automatisch.

VORAUSSETZUNG
V6.14 und der vorherige V6.13.2a-Fix müssen bereits installiert sein.

TEST
A) Handy:
- Game öffnen
- Mini-HUD muss immer Taler/Züge/Felder-Zug/Felder-Min zeigen
- „Werte“ auf-/zuklappen

B) Analyse:
- Analyse-Technologie besitzen
- manuell suchen
- Himmelsrichtungs-Hinweis prüfen

C) Fallen:
- EMP/Sabotage/Blackout kaufen und testen

D) Ort:
- Neues Game → „Ort suchen“
- z. B. „St. Wendel, Saarland“
- Treffer auswählen
- Game erstellen

E) Auto-Games:
- Schaltzentrale → automatische Games
- Rezept speichern
- „Jetzt Game erzeugen“
- anschließend Zeitplan aktivieren
