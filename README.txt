SCHATZSUCHE ONLINE V6.18 – TERRAIN EXPERIMENT

NEU
- Terrain-Erkennung aus den geladenen OpenFreeMap/OpenMapTiles-Vektordaten
- erkannte Felder werden in Supabase gecacht
- Gelände-Legende im Spiel
- aktuelles Terrain wird beim Klick angezeigt
- gesperrtes Terrain verbraucht keinen Zug
- neuer Tech-Zweig „Gelände“
- Maschinen überspringen bereits klassifizierte Terrainfelder, wenn die passende Fähigkeit fehlt
- alle zentral formatierten Goldwerte bleiben in mg; zusätzliche sichtbare Gramm-Labels wurden auf mg umgestellt

TERRAINTYPEN
- Offen
- Wasser
- Wald
- Grünland
- Landwirtschaft
- Feuchtgebiet
- Sand
- Fels
- Park
- Wohngebiet
- Gewerbe
- Industrie
- Verkehrsfläche
- Sondergebiet

TERRAIN-TECHS
- Geländekunde
- Waldkunde
- Landexpedition
- Boot & Sonar
- Sumpfausrüstung
- Urban Explorer
- Universalexpedition

WICHTIG
V6.18 ist bewusst ein Terrain-Experiment.
Die Klassifizierung stammt zunächst aus den im Browser geladenen OpenFreeMap-Vektordaten
und wird anschließend serverseitig gecacht. Das ist gut zum Testen von Erkennung,
Spielgefühl und Performance, aber noch NICHT die endgültige manipulationssichere
Variante für Echtgeld-/Sponsor-Auszahlungen.

Die organische Kartenform wird in dieser ersten Terrain-Version noch nicht als
dauerhafte serverseitige Spielfeldmaske gespeichert. Erst sollen wir prüfen, wie
zuverlässig Wasser/Wald/Stadt usw. in echten Spielen erkannt werden.

INSTALLATION
Voraussetzung: V6.17 / V6.17.1.

1. ZIP-Inhalt in GitHub ersetzen.
2. Supabase SQL Editor.
3. NUR:
   supabase/v6_18_migration.sql
   einmal ausführen.
4. Alte Migrationen NICHT erneut ausführen.
5. Vercel deployen lassen.
6. Unten rechts muss V6.18 stehen.

TESTEMPFEHLUNG
- Spiel an einer Küste / See testen
- Waldgebiet testen
- Stadt/Industrie testen
- ohne Terrain-Tech auf gesperrtes Feld klicken: kein Zug darf verbraucht werden
- Fähigkeit kaufen und dasselbe Terrain erneut testen
- Maschine danach einige Minuten beobachten
