SCHATZSUCHE ONLINE V6.43

1. SPIELERNAMEN ALS PROFILLINK
- Kartenlegende: anklickbar
- Ranking: anklickbar
- Teilnehmerliste: anklickbar
- Chat: bereits anklickbar
- Archiv-Kartenlegende: anklickbar
- Gold-Verteilung im Archiv: anklickbar
- Endstand: anklickbar
- Sieger im Archiv: anklickbar
- Sieger in der Hall of Fame: anklickbar
- Computer-Spieler führen zu ihrem persistenten Profil
- echte Spieler führen zum normalen Spielerprofil

2. COMPUTER-SPIELER NUR IN EINEM SPIEL GLEICHZEITIG
- Datenbank erzwingt maximal eine aktive Runde pro Computer-Spieler.
- Bei Spielende wird der Spieler sofort freigegeben.
- Beitritt echter Spieler bleibt durch das vorhandene Rebalancing berücksichtigt.
- Der Pool wurde um weitere individuelle Profile erweitert, damit mehrere Spiele parallel besetzt werden können.

3. LEBENDIGERE SPIELER-AKTIVITÄT
- jeder Computer-Spieler hat jetzt seinen eigenen nächsten Aktionszeitpunkt
- nicht mehr alle synchron
- Standardintervall ca. 6 Sekunden plus individueller Zufallsversatz
- aktive Schwierigkeit schneller, lockere langsamer
- pro Aktivität mehrere Suchimpulse
- Client stößt bei geöffnetem Spiel ungefähr alle 2 Sekunden an
- leere Spiele können weiterhin über den serverseitigen Cron fortlaufen

4. ECHTES TUTORIAL-GAME
- alter 36-Felder-Dummy ersetzt
- „Tutorial starten“ erstellt eine echte normale Schatzsuche
- ungefähr 1.000 Felder
- privat und kostenlos
- maximal 3 Teilnehmer: neuer Nutzer + bis zu zwei verfügbare Mitspieler
- normale Karte, Taler, Technologien, Analyse, Ranking usw.
- im echten Spiel erscheint ein kleiner Tutorial-Coach
- Hinweise passen sich automatisch an den Fortschritt an
- eine laufende Tutorial-Runde kann später fortgesetzt werden

INSTALLATION
1. supabase/v6_43_migration.sql EINMAL ausführen.
2. V6.43 deployen.
