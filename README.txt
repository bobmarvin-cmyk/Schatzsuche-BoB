SCHATZSUCHE ONLINE V6.24.5 – ENDGAME / SOFTLOCK FIX

1) BERGUNG WIRD NICHT MEHR NEU VERSTECKT
Bisher wurde ein Schatz nach falscher Bergung an ein neues freies Feld verschoben.
Das konnte scheitern, wenn praktisch alle Felder bereits aufgedeckt waren.

Neu:
- Schatz bleibt nach falscher oder abgelaufener Bergung am selben Feld.
- Er bleibt ungeborgen.
- Server erzeugt sofort einen neuen adaptiv leichteren Bergungsversuch.
- richtige Lösung wird weiterhin angezeigt.
- der neue Versuch wird erst geöffnet, nachdem der Spieler
  „Verstanden · neuer Versuch“ anklickt.
- damit funktioniert auch: LETZTES FELD = SCHATZ + Bergung falsch.

2) TERRAIN-SOFTLOCK-SCHUTZ
Wenn serverseitig:
- keine zugänglichen klassifizierten, unerforschten Felder mehr existieren
- aber noch gesperrte Terrainfelder vorhanden sind

dann wird die günstigste aktuell kaufbare Terrain-Technologie ermittelt.

Falls die Taler dafür nicht reichen:
- einmaliger Expeditions-Zuschuss exakt in Höhe der Differenz
- pro Spieler / Spiel / Technologie maximal einmal
- Technologie wird NICHT automatisch gekauft
- Spieler muss sie weiterhin bewusst im Tech-Baum erforschen

Damit bleibt die Progression erhalten, ohne dass ein Spiel unlösbar wird.

INSTALLATION
1. ZIP in GitHub ersetzen.
2. Supabase SQL Editor:
   NUR supabase/v6_24_5_migration.sql
   einmal ausführen.
3. Vercel neu deployen.
4. Version V6.24.5 prüfen.
