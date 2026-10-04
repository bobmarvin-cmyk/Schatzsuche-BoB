SCHATZSUCHE ONLINE V6.22 – CHUNK MAP

VORAUSSETZUNG
V6.21.1 ist installiert.

INSTALLATION
1. ZIP-Inhalt in GitHub ersetzen.
2. Supabase -> SQL Editor.
3. NUR:
   supabase/v6_22_migration.sql
   einmal ausführen.
4. Keine alte Migration erneut ausführen.
5. Vercel deployen lassen.
6. Version V6.22 prüfen.

ZIEL
Die Karte soll bei sehr großen Multiplayer-Spielen ruhig, verständlich und
trafficarm bleiben. Das echte Spielfeldraster darf sich beim Zoomen optisch
niemals vergrößern oder verkleinern.

1) ZWEI KLAR GETRENNTE KARTENEBENEN

NAHANSICHT / EINZELZELLEN
- ab ca. Zoom 12.25
- ausschließlich echte 1x1-Spielzellen
- kein Aggregat wird als Spielfeld dargestellt
- Raster wird lokal im Browser berechnet
- Rasterlinien verursachen keinen Datenbank-Traffic
- exakte Felder kommen über get_map_cells_v622

ÜBERSICHT / COVERAGE
- beim Herauszoomen unter ca. Zoom 11.25
- keine scheinbar größeren Spielfelder
- feste Flächen-Chunks zeigen nur den Erkundungsgrad eines Gebietes
- Transparenz = ungefährer Coverage-Anteil
- Farbe = dominanter Spieler in diesem Gebiet
- Chunkgröße bleibt während des gesamten Spiels konstant
- Chunks werden über get_map_chunks_v622 geladen

Die Lücke zwischen 11.25 und 12.25 ist Absicht (Hysterese).
Dadurch springt die Darstellung beim Zoomen nicht ständig zwischen Modi.

2) FESTE CHUNKGRÖSSE
Die Übersicht verwendet pro Spiel eine konstante Chunkgröße:
max(32 Felder, archive_step * 4).

Bei riesigen Karten werden Chunks automatisch größer, aber NICHT zoomabhängig.
Die Chunkgröße ändert sich also niemals, nur weil der Spieler hinein- oder
herauszoomt.

3) WENIGER TRAFFIC
Übersicht:
- nutzt die bereits vorhandene komprimierte game_archive_cell_counts-Struktur
- typischerweise nur wenige hundert Coverage-Flächen für die komplette Karte
- gesamte Übersicht wird im Browser gecacht
- bei unverändertem field_version kein neuer Request nötig

Nahansicht:
- nur sichtbarer Bereich
- Viewport wird auf stabile 64x64-Kachelgrenzen geschnappt
- kleine Kartenbewegungen treffen dadurch denselben Cache
- Cache hält bis zu 24 Detailausschnitte
- frische Detaildaten werden kurzfristig wiederverwendet

4) KEINE REQUESTS WÄHREND DER BEWEGUNG
Die Karte löst Datenanforderungen nur nach MapLibre "moveend" aus.
Ein separater zoomend-Request wurde entfernt.
Der vorhandene Debounce im Game-Client bleibt bestehen.

5) SERVER-RPCS
get_map_chunks_v622(...)
- kompakte feste Coverage-Chunks
- Coverage-Wert 0..1
- dominante Spieler-ID
- explored_count
- feste Chunkgröße

get_map_cells_v622(...)
- echte einzelne explored_fields
- size ist immer 1
- Sicherheitsgrenze: max. 60.000 Rasterpositionen pro Detailabfrage
- bei zu weitem Detailausschnitt fordert die UI weiteres Hineinzoomen an

6) DARSTELLUNG
Übersicht:
- halbtransparente zusammenhängende Coverage-Flächen
- keine großen Pseudo-Zellen
- keine Rasterlinien
- kein Punktwolken-Look

Nah:
- normale Spielfeldfarben
- echtes Raster
- echte Zellgrenzen

Damit gilt visuell immer:
SPIELFELD = SPIELFELD.
Eine Coverage-Fläche ist nur eine Übersicht über viele echte Spielfelder.

7) V6.21.1-FUNKTIONEN BLEIBEN ERHALTEN
- Deduktionssuche
- Geodatenprüfer
- Bergungsprüfung
- Sponsor-Spiele
- Turnierstart
- Goldbarrenschmelze
- Terrain-Technologien
- Maschinen-Stabilisierung

HINWEIS
V6.22 ersetzt nur die Karten-Datenpipeline. Die zugrunde liegenden
explored_fields und Spielkoordinaten bleiben unverändert.
