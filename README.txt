SCHATZSUCHE ONLINE V6.52

WARUM V6.51 NOCH LAHM WIRKTE
V6.51 hatte zwar Batches, führte intern aber weiterhin jeden einzelnen Zug
nacheinander durch. Dadurch blieben viele SQL-Schritte pro Bot bestehen.

V6.52
- Ein Bot-Tick berechnet alle aktuell nutzbaren Züge zusammen.
- Daraus entsteht EIN gemeinsames Feldbudget.
- Freie Felder werden in EINER Kandidatenmenge gesucht.
- explored_fields wird in EINEM Bulk-Insert geschrieben.
- Schatzprüfung und Statistik werden gesammelt verarbeitet.
- Technologien werden vor und nach dem Bulk-Zug aktualisiert.

AKTIVE SPIELER
- Sobald mindestens ein echter Spieler aktiv ist, nutzt der Bot grundsätzlich
  alle aktuell verfügbaren Züge.
- Nur der Sicherheitsdeckel „Max. Bot-Felder pro Tick“ kann einen extrem großen
  Block auf mehrere unmittelbar folgende Ticks verteilen.
- Standard: 6.000 Felder pro Bot/Tick.

SPARMODUS
- Ohne echte Spieler bleibt der prozentuale Sparmodus erhalten.

KARTE
- Aktivitätsanzeige über der Karte entfernt.
- Terrain/Wald/Wasser aus V6.51 bleibt erhalten.
- persönliche Feld-Deckkraft bleibt erhalten.

BOT-VERWALTUNG
- Iconauswahl und Löschen/Archivieren aus V6.51 bleiben erhalten.

INSTALLATION
1. supabase/v6_52_migration.sql EINMAL ausführen.
2. V6.52 deployen.
