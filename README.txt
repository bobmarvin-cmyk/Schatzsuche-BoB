SCHATZSUCHE ONLINE V6.3

NEU
- echte, zoombare Weltkarte unter dem Raster (MapLibre + OpenFreeMap)
- Spiel kann an einem zufälligen echten Ort erstellt werden
- alternativ eigene Koordinaten ("Zuhause spielen")
- Ortsname kann für kartografische Hinweise angegeben werden
- Feldgröße in realen Metern wählbar
- bis ungefähr 50.000.000 Rasterfelder
- Raster passt sich geografisch an die Feldgröße an
- Spieler können laufenden Spielen jederzeit beitreten und starten ohne Technologien
- gemeinsame Runden wurden durch individuelle Zugregeneration ersetzt
- Spielersteller wählt Regenerationszeit und maximal speicherbare Züge
- ungenutzte Züge sammeln sich nur bis zum Speicherlimit
- Logistik-Techs erhöhen Speicher bzw. beschleunigen Regeneration
- Analyse-Techs verwenden den Kartenort in ihren Hinweisen
- Spielerfarben bleiben erhalten

UPDATE VON V6.2
1. Alle Dateien aus dieser ZIP in dein bestehendes GitHub-Repository hochladen und ersetzen.
2. Supabase > SQL Editor öffnen.
3. NUR supabase/v6_3_migration.sql einmal vollständig ausführen.
4. Vercel deployt nach dem GitHub-Commit automatisch.

WICHTIG
- setup.sql / v6_migration.sql / V6.1 / V6.2 nicht noch einmal ausführen.
- V6.3 setzt voraus, dass die bisherigen Migrationen bereits gelaufen sind.
- Bestehende Spiele bleiben technisch erhalten; neue V6.3-Karten sollten für den vollen Funktionsumfang neu erstellt werden.

KARTEN
Die App verwendet MapLibre GL JS und den OpenFreeMap-Liberty-Stil.
