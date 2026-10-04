SCHATZSUCHE ONLINE V6.21.1
Ruhige Karte + Geodatenprüfer + Goldbarrenschmelze

VORAUSSETZUNG
V6.21 ist installiert.

INSTALLATION
1. ZIP-Inhalt in GitHub ersetzen.
2. Supabase -> SQL Editor.
3. NUR:
   supabase/v6_21_1_migration.sql
   einmal ausführen.
4. Keine ältere Migration erneut ausführen.
5. Vercel deployen lassen.
6. Version V6.21.1 prüfen.

1) RUHIGE KARTE / FESTES RASTER
Das echte Spielfeldraster verändert seine Geometrie nicht mehr.

Detailmodus:
- ab Zoom 12
- echte 1x1-Spielzellen
- echte Feldgrenzen
- Viewport wird mit step=1 geladen

Übersichtsmodus:
- beim Herauszoomen erst unter Zoom 11 (Hysterese)
- keine scheinbar vergrößerten Rasterfelder
- aggregierte DB-Daten werden als gleich große Übersichtspunkte dargestellt
- keine Gitterlinien
- erheblich weniger Geometrie

Dadurch bleibt die Karte ruhig. Die serverseitige Aggregation darf weiter Leistung sparen,
verändert aber optisch nicht mehr die Größe eines Spielfeldes.

2) GEODATEN- & HINTERGRUNDPRÜFER IN DER SCHALTZENTRALE
Neue Sektion „🌍 Geodaten“.

Pro Spiel + Rasterfeld X/Y zeigt sie:
- reale Kartenkoordinate
- gecachtes Terrain
- erforscht / unerforscht
- Abstand zu bekanntem Wasser
- Abstand zu bekanntem Wald
- Abstand zu Siedlungs-/Nutzflächen
- Abstand zu Verkehrsflächen
- Anzahl gecachter Terrainfelder

Nur für Admin sichtbar:
- Abstand zum nächsten offenen Schatz
- Nummer des nächsten Schatzteils
- komplette serverseitige Schatzprofile
- Sektor / Quadrant
- Zentrum- und Randdistanz
- Terrain- und Umgebungswerte

Damit kann die Spielleitung Deduktionshinweise direkt gegen die zugrunde liegenden Daten prüfen.

3) GOLD BAR SMELTER
Neue technische Goldbarrenschmelze unter /praemien.

Spieler können freies Gold in digitale Barren gießen:
- 100 mg
- 250 mg
- 500 mg
- 1.000 mg
- 2.500 mg
- 5.000 mg
(Standardgrößen; in der Schaltzentrale änderbar)

Beim Gießen:
- exakt dieselbe Goldmenge wird aus dem Wallet gebunden
- kein Zufallsfaktor
- keine Schmelzgebühr
- jeder Barren bekommt eine eindeutige BOB-Seriennummer

Solange der Barren den Status „minted“ hat:
- kann er kostenlos wieder zu Goldstaub eingeschmolzen werden
- dabei wird exakt die gebundene Menge zurückgebucht

4) PHYSISCHE AUSGABE
Digitale Schmelze und reale Ausgabe sind getrennt.

platform_settings:
- smelting_enabled: digitale Barren gießen
- redemptions_enabled: physische Ausgabe anfordern

Physische Ausgabe bleibt standardmäßig AUS.
Wenn redemptions_enabled aktiviert wird, kann ein frei verfügbarer digitaler Barren
in eine Ausgabeforderung überführt werden.

5) SCHALTZENTRALE GOLD
Neu:
- Schmelze an/aus
- physische Ausgabe an/aus
- erlaubte Barrengrößen in mg
- Statistik zu digitalen Barren
- Statistik zu angefragten Ausgaben
- Statistik zu ausgegebenen Barren

RECHTLICHER HINWEIS
V6.21/V6.21.1 gestaltet die Schatzsuche technisch wesentlich stärker als
Deduktions-/Geschicklichkeitssystem. Das ist keine automatische behördliche oder
gerichtliche Einstufung. Reale Kauf-, Rücktausch- oder Sachpreisfunktionen sollten
vor öffentlicher Freischaltung separat rechtlich geprüft werden.
