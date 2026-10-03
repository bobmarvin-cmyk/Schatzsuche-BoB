SCHATZSUCHE ONLINE V6.13

1. GOLDSTAUB-BILANZ IN DER SCHALTZENTRALE
Unter „Goldstaub-Testökonomie“ steht jetzt eine Übersicht mit:
- aktuellem Goldbestand aller Spieler-Wallets
- Schatz-Auszahlungen gesamt
- Community-Ausschüttungen gesamt
- Gewinner-Taler → Gold gesamt
- vom Game / der Plattform vereinnahmtem Gold
- Community-Reserve
- aktuell insgesamt bilanziertem Gold
- durch Test-Grants erzeugtem Gold

Damit ist sichtbar, wo das Test-Gold im System steckt.

2. SCHATZTEIL-POPUP
Wird ein Schatzteil gefunden, erscheint ein eigenes Popup:
- gefundener Prozentanteil
- Anzahl der Teile, falls mehrere gleichzeitig gefunden wurden
- bei Paygames: erhaltenes Test-Gold

3. MASCHINENMODUS „LETZTE SUCHE“
Der Fokusbereich ist nicht mehr dauerhaft ein gleich großes Quadrat.
Mit jedem Maschinentakt erweitert sich das Gebiet um die letzte manuelle Suche schrittweise.

Dadurch können die Maschinen auch nach vielen bereits aufgedeckten Feldern weiterarbeiten,
ohne sofort auf „Zufällig“ umgestellt werden zu müssen.

Die Kandidatenzahl bleibt begrenzt, damit die SQL-Abfrage nicht wieder explodiert.

4. LEGENDEN → REICHTUM
Neue Bestenliste:
  💰 Reichtum

„Goldfunde“ = insgesamt gefundenes / verdientes Test-Gold.
„Reichtum“ = aktueller tatsächlicher Wallet-Bestand.

5. GOLDGAME-ENDABRECHNUNG
Im Archiv eines Paygames steht jetzt zusätzlich:
- Schatz-Auszahlung je Spieler
- Community-Gold insgesamt
- Zahl der Community-Empfänger
- durchschnittlicher Community-Anteil je Empfänger
- Community-Anteil eines teilnehmenden Spielers aus genau diesem Game
- Gewinner-Taler→Gold-Bonus

6. SATELLITENANSICHT
In der laufenden Karte gibt es:
  🗺️ Karte
  🛰️ Satellit

Raster, Spielerfarben, erkundete Felder und Analysezonen bleiben darüber sichtbar.
Falls die Satellitenquelle nicht lädt, versucht die Karte automatisch zurückzuschalten.

7. „NÄCHSTES GAME“
Oben im laufenden Spiel gibt es:
  ↪ Nächstes Game

Der Button springt zyklisch zum nächsten aktiven Spiel, an dem der eingeloggte Spieler
selbst teilnimmt. Bei nur einem aktiven Spiel ist er deaktiviert.

8. GEWINNER-TALER → GOLD
Beim regulären Spielende werden die restlichen Taler des Gewinners in Test-Gold umgerechnet.

Standard:
  1.000 Taler = 10 µg = 0,000010 g Test-Gold

Der Faktor ist in der Schaltzentrale veränderbar:
  Gewinner-Gold µg / 1.000 Taler

Der Bonus:
- wird genau einmal vergeben
- erscheint im Gewinner-Endpopup
- wird in der Goldtransaktion protokolliert
- wird im Spielarchiv gespeichert
- gilt nur für Spiele mit mindestens zwei Teilnehmern

Solo-Games können dadurch nicht zum Gold-Farmen benutzt werden.

INSTALLATION
1. Inhalt dieser ZIP in dein bestehendes GitHub-Repository hochladen und vorhandene Dateien ersetzen.
2. Supabase → SQL Editor.
3. NUR:
   supabase/v6_13_migration.sql
   einmal vollständig ausführen.
4. Vercel deployt automatisch.

TESTEMPFEHLUNG
A) Schaltzentrale:
- Goldbilanz ansehen.
- Gewinner-Gold auf 10 µg / 1.000 Taler lassen.

B) Schatzteil:
- Teil finden → eigenes Schatzteil-Popup prüfen.

C) Maschinen:
- „Letzte Suche“ mit hohem Maschinenwert über viele Takte laufen lassen.
- prüfen, ob sich die Suche weiter nach außen ausbreitet.

D) Legenden:
- „Reichtum“ öffnen → aktueller Walletbestand muss sortiert angezeigt werden.

E) Goldgame:
- mit mindestens zwei Spielern beenden.
- Archiv → Schatz- und Community-Verteilung prüfen.

F) Karte:
- zwischen Karte und Satellit wechseln.

G) Mehrere Spiele:
- in zwei oder mehr Games teilnehmen.
- „Nächstes Game“ mehrmals drücken.

H) Gewinnerbonus:
- Multiplayer-Spiel beenden.
- Gewinner-Endpopup und Wallet prüfen.
