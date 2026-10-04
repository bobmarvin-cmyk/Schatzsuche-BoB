SCHATZSUCHE ONLINE V6.23.6 – TUTORIAL-RASTER HOTFIX

KEIN SQL.

Problem:
Das simulierte 5x5-Tutorialfeld hatte für den gesamten Rasterblock
aspect-ratio: 1.55. Ein 5x5-Raster ist geometrisch quadratisch.
Je nach Browserbreite, Zoom und Display-Skalierung konnten die Zellen
dadurch stark gestaucht erscheinen.

Fix:
- Gesamtkarte bekommt keine erzwungene 1.55-Form mehr.
- Jede der 25 Zellen hat aspect-ratio: 1 / 1.
- Grid-Spalten nutzen minmax(0,1fr).
- Buttons haben padding:0, min-width:0 und min-height:0.
- Breite wird responsiv auf maximal 560px begrenzt.
- Mobile bleibt ebenfalls quadratisch.
- Schriftgröße passt sich responsiv an.

INSTALLATION
ZIP-Inhalt in GitHub ersetzen.
Kein Supabase-SQL ausführen.
Vercel deployen lassen.
Version V6.23.6 prüfen.
