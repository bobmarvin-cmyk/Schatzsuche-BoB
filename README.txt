SCHATZSUCHE ONLINE V6.51

FLÜSSIGERE COMPUTER-MITSPIELER
- Der Browser stößt die Bot-Logik nun etwa jede Sekunde an.
- Gleichzeitige Bot-Ticks werden verhindert.
- Pro Bot werden mehrere echte gespeicherte Züge in einem kleinen Batch verarbeitet.
- Standard: 4 Züge pro Batch; in der Schaltzentrale 1–12 einstellbar.
- Das vermeidet riesige Einzel-SQL-Läufe und reduziert Statement-Timeout-Risiko.

ZIELGEBIETE
- Jeder Bot erhält ein aktuelles Zielgebiet.
- Er bleibt mehrere Züge dort und bewegt das Ziel leicht weiter.
- Ist das Gebiet leer, sucht er ein neues unbekanntes Gebiet.
- Die Karte sollte dadurch zusammenhängendere, menschlichere Suchspuren zeigen.

TECHNOLOGIEN
- Weiterhin echte Taler und echte Tech-Voraussetzungen.
- Vor dem Batch und nach jedem Zug werden alle bezahlbaren Entwicklungen geprüft.
- Die Charakter-/Persönlichkeitslogik wurde bewusst NICHT erweitert.

SPARMODUS
- Sind echte Spieler aktiv: schneller Batchbetrieb.
- Ist niemand aktiv: weiterhin nur der eingestellte Prozentanteil.

BOT-VERWALTUNG
- Icon weiterhin frei als Emoji eintragbar.
- Zusätzlich direkte Icon-Auswahl per Buttons.
- „Löschen“ ist möglich.
- Ist der Bot in einem laufenden Spiel aktiv, wird Löschen verhindert.
- Ohne Historie: echte Löschung.
- Mit Historie: Archivierung, damit alte Spielstände/Schatzfinder/Sieger erhalten bleiben.

NEWS
- V6.51-Vorlage ergänzt.

INSTALLATION
1. supabase/v6_51_migration.sql EINMAL ausführen.
2. V6.51 deployen.


TERRAIN / WALD / WASSER
- Terrain-Klassifizierung war im Code noch vorhanden, wirkte in der Standard-Satellitenansicht aber praktisch nicht mehr.
- Ursache: reine Raster-Satellitenkacheln liefern keine auswertbaren Wald-/Wasser-/Flächenmerkmale.
- V6.51 nutzt für die Satellitenansicht jetzt wieder die Vektorkarte als technische Basis und legt das Satellitenbild darunter.
- Dadurch bleiben Wald, Wasser, Feuchtgebiet, Industrie usw. für die Terrain-Regeln auswertbar, obwohl der Spieler weiterhin Satellitenbild sieht.
- Terrain-Technologien ter2/ter4/ter5/ter6/ter7 bleiben aktiv.
