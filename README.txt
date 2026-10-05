SCHATZSUCHE ONLINE V6.30.1

MOBILE-HOTFIX
- Handyansicht hart auf eine Spalte begrenzt.
- Kein Spielelement darf breiter als der Bildschirm werden.
- Assistentenleiste auf Mobilgeräten kompakt als 2-spaltiges Raster.
- Route-beendet-Meldung mobil sauber gestapelt.
- Endgame-Ausbaukarten mobil einspaltig.
- Technologiebuttons und lange Texte dürfen sauber umbrechen.
- Karte und Kartencontainer auf 100 % Bildschirmbreite begrenzt.
- Auf sehr schmalen Geräten wird das Karten-HUD auf 3 Spalten / 2 Reihen verteilt.
- Keine SQL-Änderung gegenüber V6.30.

DEPLOY
Wenn v6_30_migration.sql bereits ausgeführt wurde:
1. KEIN weiteres SQL ausführen.
2. Projektdateien hochladen.
3. Vercel deployen lassen.

Wenn V6.30 noch gar nicht installiert wurde:
1. supabase/v6_30_migration.sql einmal ausführen.
2. Danach V6.30.1 deployen.
