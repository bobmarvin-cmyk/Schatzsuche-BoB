SCHATZSUCHE ONLINE V6.12

1. GIMMICK-MINIINFO IM SPIEL
Oben in der kompakten Spielanzeige steht jetzt z. B.:
  0,10 % · 37 / 1.000
  Gimmicks

Bedeutung:
- 0,10 % = eingestellte Dichte
- 37 = bisher gefundene Gimmicks
- 1.000 = für dieses Spiel geplante Gesamtzahl

Die geplante Gesamtzahl wird bei Spielstart aus Kartenfeldern × Gimmickdichte berechnet.

2. GIMMICK-POPUP
Das Popup schließt sich automatisch nach 1,5 Sekunden.
Man kann es weiterhin vorher anklicken.

3. GIMMICKDICHTE
Die Spielerstellung arbeitet jetzt in 0,01-%-Schritten.

Beispiele:
  0,01 %
  0,05 %
  0,10 %
  0,25 %

Bei Karten ab 100.000 Feldern und einer Dichte über 0,10 % erscheint vor dem Erstellen
eine Warnung, weil sehr viele Überraschungen den Spielfluss beeinträchtigen können.

Min/Max/Standard bleiben über die Schaltzentrale steuerbar.
Die Eingabegenauigkeit dort wurde ebenfalls auf 0,01 % erhöht.

4. TECHNOLOGIEN
Der separate Bereich „Basis“ entfällt.
„Grundlagen“ befindet sich jetzt direkt unter „Erkundung“.

Die Überschrift heißt weiterhin einfach:
  Technologien

5. HALL OF FAME / SOLO-PUSH
In der Hall of Fame werden nur Spiele mit mindestens 2 tatsächlichen Teilnehmern angezeigt.

Neue Solo-Spiele erhöhen außerdem die offizielle Siegeszahl nicht mehr.
Damit kann man die Wertung nicht durch selbst erstellte Einzelspieler-Partien pushen.

6. GOLDGAME-ENDABRECHNUNG
Bei beendeten Paygames zeigt das Archiv jetzt:
- jeden Spieler
- erhaltenes Test-Gold
- Schatzanteil in %
- gefundene Schatzteile
- insgesamt an Spieler ausgezahltes Test-Gold

Die Werte werden mit dem Spiel archiviert und nicht später aus dem aktuellen Wallet
zurückgerechnet.

7. PROFIL
Im eigenen und im öffentlichen Spielerprofil steht jetzt:
  Mitglied seit <Monat Jahr>

8. GLOBALERE ZUFALLSORTE
Zufallsspiele wählen jetzt aus einem wesentlich globaleren Pool, unter anderem:
- Europa
- Afrika
- Asien
- Australien / Neuseeland
- Nordamerika
- Mittelamerika
- Südamerika
- Inselregionen

Beispiele sind Reykjavík, Nairobi, Kapstadt, Delhi, Bangkok, Tokio, Bali, Sydney,
Auckland, Honolulu, Vancouver, Mexiko-Stadt, Lima, Rio und Buenos Aires.

9. MANUELLE ZÜGE BEI STARKEN MASCHINEN
Maschinen sperren während ihrer großen Feldsuche nicht mehr die game_players-Zeile.

Neu:
- eigener machine_runtime-Datensatz für die Taktreservierung
- maximal 6.000 Kandidaten pro Maschinentakt
- Kandidatenmenge hängt nur noch von der Maschinenleistung ab, nicht zusätzlich von
  einer eventuell extrem hohen manuellen Felder/Zug-Leistung
- manuelle Aufdeckung hat dadurch praktisch Vorrang
- Maschinen schreiben ihre Statistiken erst nach der Feldsuche kurz zurück

Das ist gezielt gegen das Problem gedacht, dass im Endgame mit starkem Maschinenpark
manuelle Felder irgendwann nicht mehr sinnvoll anklickbar waren.

INSTALLATION
1. Inhalt dieser ZIP in das bestehende GitHub-Repository hochladen und ersetzen.
2. Supabase → SQL Editor.
3. NUR:
   supabase/v6_12_migration.sql
   einmal vollständig ausführen.
4. Vercel deployt automatisch.

TESTEMPFEHLUNG
A) Gimmicks:
- neues Spiel mit 0,01 % testen
- großes Spiel (>100.000 Felder) mit >0,10 % wählen → Warnpopup prüfen
- Gimmick finden → Popup sollte nach 1,5 Sekunden verschwinden
- Zähler oben prüfen

B) Maschinen:
- starken Maschinenpark verwenden
- Maschinen laufen lassen
- gleichzeitig mehrfach manuell verschiedene Kartenfelder anklicken
- manuelle Klicks sollten weiter zeitnah reagieren

C) Hall of Fame:
- Solo-Spiel beenden → darf nicht in Hall of Fame auftauchen
- Zwei-Spieler-Spiel beenden → muss auftauchen

D) Paygame:
- Paygame beenden
- Archiv → Goldstaub-Verteilung prüfen

E) Profil:
- eigenes und öffentliches Profil → „Mitglied seit“ prüfen
