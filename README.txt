SCHATZSUCHE ONLINE V6.24

VORAUSSETZUNG
V6.23.6 installiert.

INSTALLATION
1. ZIP-Inhalt in GitHub ersetzen.
2. Supabase -> SQL Editor.
3. NUR supabase/v6_24_migration.sql einmal ausführen.
4. Keine älteren Migrationen erneut ausführen.
5. Vercel deployen lassen.
6. Version V6.24 prüfen.

NEU: LOBBY
- „Neues Spiel erstellen“ ist jetzt ein einklappbarer Bereich.
- Die Lobby zeigt zuerst die laufenden öffentlichen Spiele.
- Geschlossene Spiele sind ebenfalls einklappbar.
- Anzahl laufender/geschlossener Spiele wird kompakter dargestellt.
- Privatem Spiel beitreten bleibt separat einklappbar.

NEU: TUTORIAL
- führt zuerst durch Schatzsuche, Goldsuche und Sponsorspiel.
- simuliertes Raster jetzt 6x6 und ausführlicher.
- mehrere Felder öffnen, Taler verdienen, Technologie kaufen.
- Analysehinweis, Falle, Maschine und Schatzfund werden simuliert.
- Fallenpreis wird erklärt.
- Bergungsprüfung ist als eigene Testphase enthalten.
- Abschluss zeigt Wertung/Ranking.

FALLEN
- Fallen bleiben wiederverwendbar: ausgelöste Fallen geben einen Platz im Limit frei.
- JEDE neue Platzierung kostet jetzt Taler.
- Standardpreise:
  t1 2 T, t2 4 T, t3 7 T, t4 10 T, t5 16 T, t6 25 T.
- Der Preis ist in Schaltzentrale -> Technologien pro Fallen-Technologie editierbar.
- Preis wird direkt am Fallen-Button im Spiel angezeigt.
- Preis wird serverseitig atomar abgezogen.
- Fallen vor gemeinsamem Spielstart sind blockiert.

BERGUNG V6.24
- neue Claims nur noch eindeutige Vorwärts-/Rückwärts-Memory-Aufgaben.
- 120 Sekunden statt 90 Sekunden.
- Symbolfolge bleibt 6,5 Sekunden sichtbar.
- sichtbarer Countdown im Bergungsdialog.
- keine automatische Abgabe; Spieler prüft bewusst und bestätigt.
- serverseitiger Vergleich normalisiert die Eingabe auf Symbole 1-4.
- unvollständige Eingaben zählen NICHT als Fehlversuch.
- gestartete Claims können nach Browser-Reload sauber wieder aufgenommen werden.
- Polling setzt laufende Eingaben nicht zurück.
- alte memory_swap-Claims bleiben kompatibel.

WICHTIG
Der Server bleibt für Fallenpreis, Schatzlösung und Zeitlimit maßgeblich.
