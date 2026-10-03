SCHATZSUCHE ONLINE V6.15

NEU / GEÄNDERT

1. ORTSSUCHE REPARIERT
Die Ortssuche hatte zwei Probleme:
- bei ausgewählten Orten wurden die gefundenen Koordinaten beim Erstellen nicht korrekt an den Server übergeben
- der Geocoding-Endpunkt war zu empfindlich

V6.15:
- ausgewählter Ort wird korrekt als Koordinaten-Game erstellt
- ausgewählter Ort wird sichtbar bestätigt
- serverseitige Ortssuche mit Nominatim
- Fallback auf Photon, falls Nominatim keinen Treffer liefert oder nicht erreichbar ist
- keine Live-Autovervollständigung, nur bewusste Suche per Button

2. SYNCHRONER FELDER-ZÄHLER PRO SPIELER
Jeder Teilnehmer hat jetzt serverseitig:
  fields_revealed

Der Wert wird automatisch bei jedem wirklich neu aufgedeckten Feld aktualisiert.
Das gilt für:
- manuelle Suche
- Maschinen
- alle Spieler

Wichtig:
Dafür wird kein zusätzlicher Dauer-Polling-Traffic erzeugt.
Die bereits vorhandenen Realtime-Updates der game_players-Tabelle verteilen den neuen Wert.

3. INGAME-RANKING
Neues einklappbares Menü:
  🏁 Ingame-Ranking

Vergleichbar sind:
- 💰 Taler
- 🧠 Ausbau
- 🔎 Suchfläche (Felder/Zug)
- 🗺️ aufgedeckte Felder
- 🧩 Schatzanteil

Die Rangliste aktualisiert sich während des Spiels.

4. NEUE SPIELNAMEN
Interne Datenbankwerte bleiben unverändert, nur die sichtbaren Namen ändern sich:

standard -> Schatzsuche
pay      -> Goldgame / Goldsuche

Dadurch müssen bestehende Spiele nicht migriert werden.

5. ADMIN: SPIELE BEENDEN / LÖSCHEN
Neue Sektion:
  🎮 Spielverwaltung

Dort siehst du:
- Spielname
- Schatzsuche oder Goldgame
- Status
- Spielerzahl
- aufgedeckte Felder

Möglichkeiten:
- aktives Spiel administrativ beenden
- Spiel löschen

Bei einem aktiven Goldgame wird beim Löschen zuerst sauber beendet und Restgold nach den
bestehenden Serverregeln verteilt.
Vor dem Löschen wird der Hall-of-Fame-Endstand gespeichert.

6. SCHALTZENTRALE AUFGERÄUMT
Neu:
- kompakte Sprungnavigation oben:
  Spiele / Auto / Gold / Regeln / Technologien
- Spielverwaltung direkt erreichbar
- Technologien standardmäßig als großer einklappbarer Bereich
- kompaktere Admin-Spielkarten
- mobile Darstellung verbessert

7. IMPRESSUM
Der alte Vorlagen-/Hinweistext wurde vollständig entfernt.

Das Impressum enthält jetzt:
- Anbietername
- vollständige Anschrift
- E-Mail
- Kontaktformular
- ggf. Umsatzsteuer-ID, falls später in site-config.js hinterlegt

Überschrift:
  Anbieterkennzeichnung gemäß § 5 DDG und § 18 Abs. 1 MStV

8. LEGENDEN
Der alte Satz
  „Goldwerte beziehen sich in V6.5 ausschließlich auf Test-Goldstaub.“
wurde entfernt.

9. GESCHLOSSENE SPIELE – MOBIL
Der Button wurde kompakter:
  🏁 Endstand

Er nimmt auf dem Handy nicht mehr die komplette Kartenbreite ein.

10. PRIVATEM SPIEL BEITRETEN
Der Bereich ist jetzt ein Slide-down / Details-Feld.

Standardmäßig sieht man nur:
  🔒 Privatem Spiel beitreten

Erst nach dem Öffnen werden Code- und Passwortfelder überhaupt gerendert.
Das reduziert auch unerwünschtes Passwort-Autofill durch Browser/Passwortmanager.

INSTALLATION

1. Inhalt dieser ZIP in dein bestehendes GitHub-Repository hochladen.
2. Vorhandene Dateien ersetzen.
3. .env.local NICHT hochladen.
4. Supabase -> SQL Editor.
5. NUR:
   supabase/v6_15_migration.sql
   einmal vollständig ausführen.
6. Vercel deployt automatisch.

VORAUSSETZUNG
V6.14.1 und alle davor genannten Hotfixes müssen bereits installiert sein.

TESTEMPFEHLUNG

A) Ortssuche
- Neues Spiel
- „Ort suchen“
- z. B. „St. Wendel, Saarland“
- Treffer anklicken
- prüfen, ob gewählter Ort angezeigt wird
- Game erstellen und Kartenmittelpunkt prüfen

B) Synchroner Felderzähler
- mit zwei Spielern in ein Game
- Spieler A deckt Felder auf
- bei Spieler B prüfen, ob A's Felderzahl automatisch steigt
- dasselbe mit Maschinen testen

C) Ingame-Ranking
- Taler / Ausbau / Suchfläche / Felder / Schatz durchschalten
- mit zwei Spielern prüfen

D) Admin
- Schaltzentrale öffnen
- Spielverwaltung
- Testgame beenden
- danach ein Testgame löschen
- Hall of Fame prüfen

E) Lobby mobil
- Privates Spiel beitreten muss standardmäßig geschlossen sein
- Geschlossenes Spiel: kompakter Endstand-Button
