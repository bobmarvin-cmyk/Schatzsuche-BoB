SCHATZSUCHE ONLINE V6.16a.3 – STABILITÄTS-HOTFIX

Ziel:
Die sichtbaren V6.16a-Funktionen bleiben erhalten, aber die Game-Seite soll nicht mehr
durch unnötige Render-/Reload-Schleifen einfrieren.

WESENTLICHE ÄNDERUNGEN

1. Live-State langsamer und ruhiger
- Polling jetzt ca. alle 7 Sekunden statt 5 Sekunden.
- Kein Poll während gerade ein manueller Reveal oder Maschinenlauf arbeitet.
- Doppelte Polls werden verhindert.

2. Spielerwerte nur aktualisieren, wenn sie sich wirklich geändert haben
Vorher wurde bei JEDEM Live-State die komplette players-Liste durch ein neues Array ersetzt.
Dadurch renderten HUD, Ranking, Spielerkarten und GameMap immer neu.

Jetzt:
- Signaturvergleich
- setPlayers nur bei echten Änderungen
- setCompetition nur bei echten Rankingänderungen

3. Karte wird NICHT mehr wegen Taler/Zügen neu gezeichnet
GameMap reagierte vorher auf das komplette players-Objekt.
Das bedeutete:
  Züge ändern sich -> komplette GeoJSON-Karte neu
  Taler ändern sich -> komplette GeoJSON-Karte neu

Jetzt reagiert die Karte nur noch auf:
- tatsächlich veränderte sichtbare Felder
- geänderte Spielerfarben

4. Sichtbarer Kartenausschnitt gedrosselt
- maximal ungefähr ein Reload pro 700 ms
- mehrere schnelle Änderungen werden zusammengefasst
- identische Felddaten werden nicht erneut in React-State geschrieben

5. Maschinen entkoppelt
- redundanter machine_presence-Aufruf direkt vor jedem Maschinenlauf entfernt
- separater Presence-Heartbeat bleibt bestehen
- nach Maschinenlauf kein kompletter Players/Game-Reload mehr
- Live-State übernimmt die Metadaten etwas später

6. Presence
Online-Spielerliste wird nur noch aktualisiert, wenn sich die tatsächlichen Online-IDs ändern.

7. Version
Unten rechts muss nach erfolgreichem Deploy:
  V6.16a.3
stehen.

INSTALLATION
- Nur ZIP-Inhalt nach GitHub hochladen und Dateien ersetzen.
- KEIN neues SQL nötig, wenn v6_16a_migration.sql bereits ausgeführt wurde.
- Vercel deployen lassen.
- Prüfen, dass V6.16a.3 unten rechts angezeigt wird.

TEST
1. Game zunächst ohne Maschinen 2–3 Minuten offen lassen.
2. Karte bewegen/zoomen.
3. Mit zwei Spielern gleichzeitig einige große Suchzüge machen.
4. Danach Maschinen aktivieren.
5. Beobachten, ob Browser weiterhin flüssig bleibt.
