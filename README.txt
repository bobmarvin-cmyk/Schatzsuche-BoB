SCHATZSUCHE ONLINE V6.8.3

1. TIMEOUT-FIX FÜR GROSSE ZÜGE
Der Fehler
  canceling statement due to statement timeout
kam bei hohen Felder/Zug-Werten durch einen zu großen SQL-Kandidatenbereich.

Vorher:
Bei rund 2.000 Feldern/Zug konnten mehr als 140.000 Kandidaten erzeugt und geprüft werden.

V6.8.3:
Der Suchbereich wird auf ungefähr 4 x reveal_power begrenzt.
Bei ca. 2.000 Feldern/Zug sind das nur noch grob 8.000 Kandidaten.
Die eigentliche Aufdeckung bleibt weiterhin eine mengenbasierte Batch-Operation.

2. HALL OF FAME / SPIELARCHIV
Beendete Spiele bleiben dauerhaft als kompakter Rückblick erhalten:
- Spielname
- Gewinner
- Gewinner-Züge
- Spielerzahl
- Züge insgesamt
- erkundete Felder
- Spieler-Endstände
- kompakte farbige Endkarte

Neue Seiten:
  /hall-of-fame
  /archiv/<SPIEL-ID>

Private Spiele sind im Archiv weiterhin nur für ihre Teilnehmer sichtbar.

3. 3-TAGE-LÖSCHUNG BLEIBT SINNVOLL
Nach der bisherigen Aufbewahrungsfrist können die großen Live-Spieldaten weiterhin
gelöscht werden. Das kompakte Spielarchiv und die Endkarte bleiben davon unabhängig erhalten.

4. SCHÖNE SIEGERMELDUNG
Wer in einem Standardspiel den Schatz findet, bekommt jetzt ein großes Sieger-Overlay mit:
- Pokal
- Glückwunsch
- Anzahl eigener Züge
- Felder im Gewinnzug
- direktem Link zum Endstand / zur Endkarte

5. ZÜGE PRO SPIELER
game_players.moves_used zählt ab V6.8.3 jeden tatsächlich verbrauchten Zug mit.
Für Spiele, die bereits vor dieser Migration begonnen haben, werden frühere Züge nicht
rückwirkend exakt rekonstruiert; ab Installation wird korrekt weitergezählt.

INSTALLATION
1. Inhalt dieser ZIP in dein bestehendes GitHub-Repository hochladen und Dateien ersetzen.
2. Supabase > SQL Editor öffnen.
3. NUR:
   supabase/v6_8_3_migration.sql
   einmal vollständig ausführen.
4. Vercel deployt automatisch.

WICHTIG ZUR MIGRATION
Beim ersten Ausführen wird für bestehende Spiele einmal eine kompakte Endkartenstruktur
aus den bereits entdeckten Feldern erzeugt. Dafür setzt die Migration ihr SQL-Zeitlimit
temporär auf 60 Sekunden und danach wieder zurück.

TEST
- "Abendrunde 2" erneut öffnen und mehrere große Züge testen.
- Ein kleines Testspiel beenden.
- Sieger-Overlay prüfen.
- /hall-of-fame öffnen.
- Endkarte des beendeten Spiels aufrufen.
