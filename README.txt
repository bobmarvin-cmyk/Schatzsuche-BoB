SCHATZSUCHE ONLINE V6.23 – LOCAL CANVAS / VERSIONED CHUNKS

VORAUSSETZUNG
V6.22 ist installiert.

INSTALLATION
1. ZIP-Inhalt in GitHub ersetzen.
2. Supabase -> SQL Editor.
3. NUR:
   supabase/v6_23_migration.sql
   einmal ausführen.
4. Keine ältere Migration erneut ausführen.
5. Vercel deployen lassen.
6. Version V6.23 prüfen.

WARUM V6.23
Die Karte war bisher gleichzeitig:
- Hintergrundkarte
- Rasterrenderer
- explored_fields-Renderer
- Multiplayer-Synchronisation

Bei großen Spielen bedeutete das zu viel GeoJSON, zu viele Polygone und zu häufige
Viewport-Abfragen.

V6.23 trennt Darstellung und Serverzustand konsequent:

BROWSER
- MapLibre = nur Hintergrundkarte + wenige Speziallayer
- Canvas = Raster, erforschte Bereiche, Spielerfarben
- Klickkoordinate wird lokal berechnet
- lokaler Chunkcache

SERVER
- bleibt alleinige Wahrheit über explored_fields
- liefert nur Chunk-Versionen und kompakte Detaildaten
- entscheidet weiterhin über tatsächliche Aufdeckung, Schatzfund, Gimmicks, Terrain usw.

1) KEINE EXPLORED-FIELD-GEOJSON-POLYGONE MEHR
MapLibre bekommt keine einzelnen erforschten Spielfelder mehr.

Das Canvas zeichnet:
- Raster
- Spielerfarben
- belegte Felder
- Übersichtsdichte

Dadurch müssen nicht tausende Polygon-Features von MapLibre verwaltet werden.

2) RASTER KOMPLETT LOKAL
Das Raster benötigt keinerlei Supabase-Request.

Wenn echte Einzelzellen groß genug sind:
- jede Feldlinie wird gezeichnet

Wenn Felder beim Herauszoomen unter Pixelgröße fallen:
- jede 2./4./8./16... Linie wird als Hauptraster gezeichnet
- das Raster verschwindet also NICHT
- im Badge steht z. B. „Raster ×8“
- die tatsächliche Feldgröße im Spiel ändert sich niemals

Die Umschaltung Detail/Übersicht hängt nicht mehr an einer festen Zoomzahl,
sondern an der tatsächlichen Pixelgröße eines Spielfeldes auf dem jeweiligen Gerät.

3) FESTE 64x64 SERVER-CHUNKS
Ein Server-Chunk enthält 64 x 64 = 4.096 mögliche Felder.

game_map_chunks_v623 speichert nur:
- cx / cy
- Version
- Anzahl erforschter Felder
- Änderungszeit

game_map_chunk_players_v623 hält die kompakten Spieleranteile für die Übersicht.

4) EINMAL INITIAL + DANACH NUR DELTAS
get_map_chunk_changes_v623(...)

Beim ersten Laden:
- kleine Chunk-Landkarte des laufenden Spiels

Danach:
- Browser sendet den Zeitpunkt des letzten Abgleichs
- Server gibt ausschließlich seitdem veränderte Chunks zurück

Ein großes Multiplayer-Spiel benötigt deshalb nicht nach jedem Maschinenlauf
erneut die komplette Kartenübersicht.

Zusätzlich wird alle ca. 4 Sekunden ein sehr kleiner Änderungsabgleich gemacht,
solange die Seite sichtbar ist.

5) DETAILDATEN NUR FÜR SICHTBARE, GEÄNDERTE CHUNKS
get_map_chunk_payloads_v623(...)

Der Browser merkt sich:
Chunk 7:12 Version 44

Server meldet später:
Chunk 7:12 Version 45

Nur dann wird genau dieser Chunk neu geladen.

Beim Verschieben der Karte werden bereits bekannte Chunks direkt aus dem
Browsercache verwendet.

6) RLE STATT FELD-JSON
Detaildaten werden nicht mehr so übertragen:

{x:123,y:456,user_id:...}
{x:124,y:456,user_id:...}
{x:125,y:456,user_id:...}

Stattdessen als Runs:
[Startindex, Länge]

Beispiel:
[128, 27]

bedeutet 27 aufeinanderfolgende belegte Felder innerhalb des 64x64-Chunks.

Zusammenhängende Suchflächen werden dadurch sehr kompakt übertragen.

7) SERVER BLEIBT AUTORITATIV
Der Browser darf niemals selbst entscheiden, dass ein Feld wirklich aufgedeckt ist.

Der Spieler klickt lokal auf ein Rasterfeld.
Der Server verarbeitet weiterhin reveal_area_v620.
Erst die serverseitig akzeptierten explored_fields tauchen beim nächsten Chunk-Abgleich auf.

Damit können zwei Spieler gleichzeitig dasselbe Gebiet anklicken, ohne dass der Client
die Wahrheit über den Spielzustand bestimmt.

8) TERRAIN-TRAFFIC EBENFALLS REDUZIERT
Bisher konnte ein großer manueller Suchzug bis zu ca. 1.500 komplette JSON-Feldobjekte
für Terrain an Supabase senden.

V6.23 komprimiert zusammenhängende gleichartige Terrainfelder als:
[Startindex, Länge, Terrain-Typ, Label]

Neue RPC:
cache_terrain_runs_v623(...)

Die Terrainklassifizierung wird zusätzlich lokal im Browser gecacht.

9) CACHE-INVALIDIERUNG
INSERT explored_fields:
- nur betroffene 64x64-Chunks erhalten eine neue Version

UPDATE explored_fields:
- betroffene Chunks werden ebenfalls invalidiert
- wichtig z. B. wenn ein Schatz nach einer misslungenen Bergung neu versteckt wird

10) BESTEHENDE FUNKTIONEN
Unverändert erhalten:
- Deduktionssuche
- Terrain-Technologien
- Geodatenprüfer
- Bergungsprüfung
- Sponsor-/Goldspiele
- Turnierstart
- Maschinen
- Goldbarrenschmelze
- Chat / Ranking / Hall of Fame

HINWEIS ZUR MIGRATION
Für aktuell aktive bestehende Spiele wird die neue 64x64-Chunkstruktur EINMAL aus
explored_fields aufgebaut. Das ist ein einmaliger Migrationsaufwand.
Neue Aufdeckungen werden danach inkrementell gepflegt.
