SCHATZSUCHE ONLINE V6.16a.5 – MASCHINEN/PERFORMANCE HOTFIX

1. Kartenkopf
„Weltkarte“ wurde ersetzt durch:
  SPIELNAME · ORT
Beispiel:
  Wüstenodyssee · Dubai

2. Maschinen-Batching
Ursache der Timeouts:
Die Maschinenfunktion versuchte bei hoher Leistung sehr viele Kandidaten in einem
einzigen SQL-Lauf zu suchen, zu sortieren, gegen explored_fields zu prüfen und einzufügen.

Neu:
- nominale Maschinenleistung bleibt sichtbar
- ein einzelner Datenbanklauf verarbeitet maximal 800 Felder
- hohe Maschinenleistung wird auf häufigere kurze Pakete verteilt
- Kandidatenmenge pro Lauf von bis zu 6000 auf maximal 1800 reduziert
- zusätzlicher Index auf explored_fields(game_id,x,y)

Beispiel:
Maschine 2.000 Felder / 5 s
=> statt eines großen 2.000er-Laufs:
mehrere kurze Pakete mit bis zu 800 Feldern und kürzerem Intervall.

Dadurch wird ein einzelnes Statement wesentlich kleiner und die Wahrscheinlichkeit
für „canceling statement due to statement timeout“ sinkt stark.

3. Kartendarstellung
TARGET_VISIBLE_BUCKETS wurde von 2600 auf 1400 reduziert.
Bei weitem Zoom werden dadurch weniger GeoJSON-Polygone gleichzeitig an MapLibre gegeben.
Beim Hineinzoomen bleiben einzelne Rasterfelder weiterhin sichtbar.

4. Bestehende Funktionen bleiben erhalten
- globaler Felder-übrig-Zähler
- Live-State
- Online-Anzeige
- Tutorial
- Karten-HUD
- Zentrierbutton
- globale Events
- Analysepreise

INSTALLATION
1. ZIP-Inhalt in GitHub ersetzen.
2. Vercel deployen lassen.
3. Supabase SQL Editor:
   NUR
   supabase/v6_16a_5_migration.sql
   einmal ausführen.
4. Danach muss unten rechts V6.16a.5 stehen.

VORAUSSETZUNG
v6_16a_migration.sql muss bereits installiert sein.

HINWEIS
Bei extremen Maschinenleistungen wird bewusst nicht mehr versucht, tausende Felder
in einem einzigen Datenbankstatement zu verarbeiten. Das ist eine Schutzgrenze für
flüssiges Multiplayer-Spiel.
