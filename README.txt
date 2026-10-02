SCHATZSUCHE ONLINE V6.5 – GOLDSTAUB TESTÖKONOMIE

WICHTIG
Diese Version enthält bewusst KEINEN Echtgeldkauf und KEINE physische Auszahlung.
Goldstaub ist ausschließlich Test-Gold ohne Echtgeldwert.

NEU
- Test-Goldstaub-Wallet pro Spieler
- einmalig 0,25 g Test-Gold zum Ausprobieren
- Standardspiele bleiben kostenlos
- Paygames (Test) mit Goldstaub-Einsatz
- Host zahlt denselben Einsatz wie alle anderen
- serverseitig gesteuerte Verteilung, standardmäßig:
  90 % Schatzpool
  5 % Community-Ausschüttung an alle bestehenden Gold-Wallets
  5 % Plattform-Testanteil
- Verteilungsquoten nur serverseitig in platform_settings änderbar
- mehrere Goldschätze: 1 / 3 / 5 oder automatisch
- automatische Schatzanzahl basiert auf einem serverseitigen Schwellenwert
- jeder neu beitretende Spieler vergrößert den noch offenen Schatzpool
- bereits gefundene Schätze werden bei späteren Beitritten nicht nachträglich erhöht
- Goldfunde werden direkt dem Test-Wallet gutgeschrieben
- Gold-Ledger / Transaktionshistorie in der Datenbank
- Legenden-Bestenliste:
  Siege, erkundete Felder, gefundener Test-Goldstaub, Spiele
- Lobby zeigt Einsatz, Schatzanzahl und aktuellen offenen Schatzpool transparent
- alle bisherigen V6.4-Funktionen bleiben erhalten

INSTALLATION
1. Gesamten Inhalt der V6.5-ZIP ins bestehende GitHub-Repository hochladen und ersetzen.
2. Supabase > SQL Editor.
3. NUR supabase/v6_5_migration.sql EINMAL ausführen.
4. Vercel deployt automatisch.
5. Für den Paygame-Test neue Spiele erstellen.
6. In der Lobby einmalig „0,25 g Test-Gold holen“ anklicken.

SERVERSEITIGE ÖKONOMIE
In Supabase Tabelle platform_settings (id=1) können administrativ geändert werden:
- prize_share_bps             9000 = 90 %
- community_share_bps          500 = 5 %
- platform_share_bps           500 = 5 %
- multi_treasure_threshold_ug  Schwelle für mehrere Schätze
- max_treasures                maximal erlaubte Schatzanzahl
- test_grant_ug                einmaliges Testguthaben
- gold_price_cents_per_001g    nur Referenzwert; KEINE Kauf-Funktion

Die Summe der drei Anteile muss 10.000 Basispunkte (=100 %) ergeben.

TECHNISCH
Gold wird intern in Mikrogramm als Ganzzahl gespeichert:
1 g = 1.000.000 µg
0,01 g = 10.000 µg

Die Positionen der Goldschätze werden niemals an den Browser übertragen.
