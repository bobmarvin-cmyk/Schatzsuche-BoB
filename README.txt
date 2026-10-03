SCHATZSUCHE ONLINE V6.20

VORAUSSETZUNG
V6.19 ist installiert.

INSTALLATION
1. ZIP-Inhalt in GitHub hochladen und vorhandene Dateien ersetzen.
2. Supabase -> SQL Editor.
3. NUR:
   supabase/v6_20_migration.sql
   einmal ausführen.
4. Alte Migrationen NICHT erneut ausführen.
5. Vercel deployen lassen.
6. Unten rechts muss V6.20 stehen.

ÄNDERUNGEN

1. GIMMICK-COUNTER
- der Serverzähler war korrekt, aber der Client-Live-State hat ihn nicht übernommen
- gimmicks_found_count und gimmick_target_count kommen jetzt im Live-State mit
- eigener Fund aktualisiert den sichtbaren Counter sofort
- Funde anderer Spieler ziehen über Live-State nach
- Gimmick-Lock-Reihenfolge wurde entschärft

2. GEMEINSAMER TURNIERSTART
Beim Erstellen eines Spiels kann gewählt werden:
- sofort
- 1 / 3 / 5 / 10 / 15 / 30 Minuten

Vor dem Start:
- Spieler dürfen bereits beitreten
- alle starten mit 1 Zug
- Zugregeneration beginnt für alle am gleichen Startzeitpunkt
- manuelle Suche wird serverseitig blockiert
- Maschinen werden serverseitig blockiert
- Countdown wird im Spiel angezeigt

Später beitretende Spieler können weiterhin teilnehmen und müssen den Nachteil aufholen.

3. MASCHINEN-STABILITÄT
- maximal 75 Felder pro DB-Mikrotakt statt 150
- Kandidatenmenge nochmals reduziert
- Maschinenläufe werden pro Spiel über PostgreSQL Advisory Lock serialisiert
- wenn schon ein Maschinenlauf arbeitet, überspringt ein anderer Client seinen Takt
- Player-Zeile wird vor Feldinsert gesperrt, damit Lock-Reihenfolge besser zu manuellen Zügen passt
- Client-Backoff bei busy / timeout / deadlock
- dadurch weniger parallele DB-Schreibstürme

4. ENDGAME-KARTE
Automatische LOD-Stufen:
- >50.000 erkundete Felder: weniger Kartenobjekte
- >150.000: noch gröber
- >500.000: starke Performance-Stufe

Zusätzlich:
- sichtbarer Ausschnitt wird im Endgame seltener nachgeladen
- Rasterlinien werden bei sehr großen Spielen reduziert
- manueller Zug wartet im Endgame nicht mehr zwingend auf den Kartenreload

5. BERGUNGSPRÜFUNG V2
Ablauf:
- Schatz entdeckt
- Popup erscheint
- Aufgabe startet ERST nach Klick auf „Bergung starten“
- danach 90 Sekunden, ein Versuch

Aufgaben werden zufällig variiert:
- Symbolfolge normal wiederholen
- Symbolfolge rückwärts wiederholen
- kurze Rechenaufgabe

Desktop-Fix:
- die Eingabeanzeige und Buttons bleiben während der Eingabe stabil sichtbar
- kein versteckter Starttimer mehr vor Klick auf „Bergung starten“
- Rechenaufgabe bleibt sichtbar

Fehlschlag / Zeitüberschreitung:
- Schatz wird wieder neu auf ein unerforschtes Feld gesetzt

6. SPONSORSPIELE
V6.19-Sponsorspiele bleiben erhalten.
Zusätzlich wird Sponsor-Gold in der Schatzlogik wie Goldgame-Gold behandelt,
aber Teilnehmer zahlen weiterhin keinen Einsatz.

7. SICHERHEIT BERGUNG
Die alten V6.19-Bergungs-RPCs werden für normale Nutzer gesperrt.
V6.20-Start/Resolve ist der gültige Ablauf.

HINWEIS PERFORMANCE
V6.20 reduziert die bisher größten bekannten Ursachen:
- parallele Maschinenläufe desselben Spiels
- zu große Maschinenpakete
- unnötig häufige Endgame-Kartenreloads
- inkonsistente Lock-Reihenfolge

Bei sehr großen Live-Spielen bleibt ein echter Lasttest mit vielen simulierten Spielern
der nächste sinnvolle Schritt.
