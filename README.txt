SCHATZSUCHE ONLINE V6.19

VORAUSSETZUNG
V6.18 ist installiert.

INSTALLATION
1. ZIP-Inhalt in GitHub hochladen und vorhandene Dateien ersetzen.
2. Supabase -> SQL Editor.
3. NUR:
   supabase/v6_19_migration.sql
   einmal ausführen.
4. Alte Migrationen NICHT erneut ausführen.
5. Vercel deployen lassen.
6. Unten rechts muss V6.19 stehen.

HAUPTÄNDERUNGEN

1. SPONSORSPIELE
- neuer Spieltyp „🤝 Sponsorspiel“
- Sponsor stiftet den kompletten Gold-Pool aus seinem Wallet
- Teilnehmer zahlen keinen Einsatz
- Sponsorname + Pool werden in Lobby und Game angezeigt
- Goldwerte in mg
- Sponsor-Spiel kann öffentlich oder privat sein

2. SCHATZ: ENTDECKT != GEBORGEN
- Fund eines Schatzfelds zahlt den Schatz NICHT mehr sofort aus
- Server erstellt einen pending claim
- kurze Bergungsprüfung: 6 Symbole merken und korrekt wiederholen
- ein Versuch, 90 Sekunden
- Erfolg: Schatz wird endgültig zugeordnet + Gold/Anteil gutgeschrieben
- Fehlschlag/Timeout: Schatz wird auf ein neues, noch unerforschtes Feld versetzt
- Spielende/Siegerwertung erst nach erfolgreich geborgenen Schatzteilen

3. TERRAIN-FIX
- Terrain wird vor großen manuellen Suchzügen in einem Batch vermessen
- Server-Trigger verhindert, dass nicht vermessene oder nicht erlaubte Terrainfelder
  durch große Mehrfach-Aufdeckungen trotzdem geöffnet werden
- gesperrte Terraintypen beachten die gekauften Gelände-Techs
- Terrain-Cache schreibt bestehende Zeilen nicht mehr konkurrierend um
  (weniger Deadlock-Risiko)
- Maschinen können ebenfalls nur vermessene/erlaubte Felder aufdecken

4. FALLEN-FIX
- sichtbarer Button „Fallenmodus beenden“
- wenn das Fallenlimit erreicht ist, beendet sich der Modus automatisch
- Fehler „Maximale aktive Fallen“ lässt den Spieler nicht mehr im Platziermodus hängen

5. GOLD GLOBAL IN mg
- Spieleerstellung
- Lobby/Spieleauswahl
- Gewinnanzeigen
- Archiv
- Admin-Goldfelder
- Sponsor-Pool
- Prämienseite
- zentrale formatGold-Anzeige

6. PRÄMIEN/BARREN-GRUNDLAGE
- neue Seite /praemien
- technische Goldbarren-Anfrage vorbereitet
- serverseitig standardmäßig DEAKTIVIERT
- reale Ausgabe erst aktivieren, wenn rechtliche/organisatorische Prüfung abgeschlossen ist
- Einstellung: platform_settings.redemptions_enabled (default false)

WICHTIG ZUR BERGUNGSPRÜFUNG
Die aktuelle Gedächtnisprüfung ist eine funktionale Skill-Komponente und trennt
„Entdeckung“ von „Gewinn“. Sie ist aber ein Browser-Minispiel und damit noch nicht
als manipulationssichere Echtgeld-/Sachpreisprüfung zu betrachten.

WICHTIG ZUR RECHTLICHEN EINORDNUNG
Sponsor-Spiel + kostenlose Teilnahme + Skill-Bergung sind bewusst so gestaltet,
dass kein Spieler für die Sponsor-Gewinnchance zahlen muss. Das ist eine deutlich
andere Konstruktion als ein entgeltliches Zufallsspiel. Eine echte Auszahlung oder
Sachpreis-/Barren-Einlösung bleibt trotzdem ein eigener rechtlicher und regulatorischer
Prüfpunkt und ist deshalb in V6.19 standardmäßig nicht freigeschaltet.
