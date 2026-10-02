SCHATZSUCHE ONLINE V6.10 – SCHATZTEILE, MASCHINENFIX & MEHR KARTE

1. MASCHINEN-TIMER REPARIERT
Das Problem:
Der Timer lief einmal herunter, danach passierte häufig nichts mehr.

Ursache:
Die Maschine suchte nur in einem sehr kleinen Radius um den letzten manuellen Klick.
Wenn der manuelle Zug diesen Bereich bereits aufgedeckt hatte, fand die Maschine keine
freien Felder. Außerdem wurde der Clienttimer bei einem leeren Maschinentakt nicht immer
sauber mit dem Server synchronisiert.

V6.10:
- Maschinen erweitern ihren Suchradius automatisch.
- Die Größe berücksichtigt auch deine manuelle Felder/Zug-Leistung.
- Vor jedem automatischen Takt wird die aktive Spielpräsenz erneuert.
- Nach JEDEM fälligen Takt wird machine_last_run_at aktualisiert.
- Der Browser lädt danach den neuen Maschinenstatus nach.
- Findet die Maschine im größeren Gebiet trotzdem nichts, fordert das Spiel dich auf,
  mit einem manuellen Klick einen neuen Maschinenfokus zu setzen.
- Kein Offline-Catch-up bleibt bestehen.

2. 1,000 GESAMTSCHATZ – AUF MEHRERE TEILE AUFTEILBAR
Bei der Spielerstellung gibt es jetzt für Standard- UND Paygames:
  Schatzteile

Grundwert:
  1 Teil = 1,000 Schatz

Beispiele:
  2 Teile = 0,500 + 0,500
  3 Teile = ca. 0,333 + 0,333 + 0,334
  5 Teile = 5 × 0,200
  10 Teile = 10 × 0,100

Die Summe ist serverseitig IMMER exakt 1,000.

Die maximal erlaubte Teilezahl kommt aus:
  platform_settings.max_treasures
und kann über die Schaltzentrale geändert werden.
V6.10 setzt bestehende Installationen zunächst auf mindestens 10 erlaubte Teile.

3. NEUE SIEGERREGEL
Das Spiel endet NICHT mehr beim ersten Fund.

Es endet erst, wenn ALLE Schatzteile gefunden wurden.

Gewonnen hat:
  der Spieler mit dem größten aufsummierten Schatzanteil.

Bei exakt gleichem Anteil entscheidet als Tie-Breaker:
  1. wer seinen letzten Schatzanteil früher gefunden hat
  2. danach weniger manuelle Züge
  3. danach frühere Teilnahme am Spiel

4. PAYGAME
Auch der Test-Goldpool wird auf die Schatzteile verteilt.
Die Gesamtmenge steigt dadurch nicht.

Tritt später noch ein Spieler bei, wird dessen neuer Schatzpool-Anteil nur noch auf
die zu diesem Zeitpunkt offenen Schatzteile verteilt.

5. HALL OF FAME
Die Hall of Fame speichert jetzt zusätzlich:
- Schatzanteil jedes Spielers
- Anzahl gefundener Schatzteile
- Maschinentakte
- Schatzanteil des Gewinners

6. DIE REALE KARTE STÄRKER IM SPIEL
Analyse-Hinweise arbeiten weiterhin mit einer absichtlich ungenauen geografischen Zone.

Neu:
- Button „🗺️ Hinweisgebiet fokussieren“
- Karte zoomt direkt in die Analysezone
- soweit OpenFreeMap die Daten im sichtbaren Stil bereitstellt, liest das Spiel dort
  benannte Kartenmerkmale aus:
  - Straßen
  - Orte
  - Gewässer
  - weitere benannte Orientierungspunkte

Diese erscheinen unter dem Analysehinweis und sollen wirklich zum Kartenlesen animieren.

Wichtig:
Die exakte Schatzposition wird dadurch NICHT an den Browser übertragen.
Es werden nur Merkmale aus dem ohnehin sichtbaren ungefähren Hinweisgebiet gelesen.

INSTALLATION
1. Inhalt dieser ZIP in dein bestehendes GitHub-Repository hochladen und vorhandene Dateien ersetzen.
2. Supabase → SQL Editor.
3. NUR:
   supabase/v6_10_migration.sql
   einmal vollständig ausführen.
4. Vercel deployt automatisch.

TESTEMPFEHLUNG
1. Neues Standardspiel mit 3 Schatzteilen starten.
2. Prüfen, ob in der Spielanzeige Gesamtwert 1,000 und drei Teile erscheinen.
3. Mehrere Spieler verschiedene Teile finden lassen.
4. Prüfen, dass das Spiel bis zum letzten Teil aktiv bleibt.
5. Danach Sieger nach größtem Anteil prüfen.
6. Maschine kaufen → manuellen Fokus setzen → mehrere automatische Takte beobachten.
7. Analyse-Technologie kaufen → Hinweis erzeugen → „Hinweisgebiet fokussieren“ testen.
