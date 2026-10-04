SCHATZSUCHE ONLINE V6.23.2 – MAP VISIBILITY HOTFIX

VORAUSSETZUNG
V6.23.1 ist installiert.

INSTALLATION
KEIN SQL.

1. ZIP-Inhalt in GitHub ersetzen.
2. Keine Supabase-Migration ausführen.
3. Vercel deployen lassen.
4. Version V6.23.2 prüfen.

FIX
V6.23.1 konnte die Hintergrundkarte optisch zu stark abdunkeln.
V6.23.2 ändert ausschließlich die Darstellung:

- Canvas explizit transparent
- Coverage-Flächen sehr viel schwächer
- Spielerfarben im Detail halbtransparent
- Rasterlinien hell statt dunkel
- deutlich größere optische Rasterabstände beim starken Herauszoomen
- weniger Moiré-/Netzmuster
- Spielfeldrand dezenter
- MapLibre-Basiskarte bleibt voll sichtbar

Die V6.23-Architektur bleibt gleich:
- lokales Canvas
- 64x64-Chunks
- Versions-Deltas
- RLE-Kompression
- serverautoritatives Aufdecken

KEIN SQL erforderlich.
