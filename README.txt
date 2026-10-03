SCHATZSUCHE ONLINE V6.14

NEU 1 – FELDER PRO MINUTE
Im laufenden Spiel erscheint:
  Felder/Min

Der Wert wird aus allen Feldern berechnet, die der Spieler seit dem Öffnen dieser
Spielsession selbst erzeugt hat – manuell und durch eigene Maschinen.

NEU 2 – MOBILE WERTEÜBERSICHT
Auf dem Handy ist das Ingame-HUD standardmäßig klein eingeklappt.
Mit:
  📊 Werte
kann es geöffnet werden.

Dadurch bleibt deutlich mehr von der Karte sichtbar.

NEU 3 – MASCHINENMODUS KOMPAKTER
Statt des großen Maschinenkastens gibt es eine kleine Zeile:
  ⚙️ <Leistung>/Takt   📍 Fokus   🎲 Zufall

NEU 4 – ANALYSE ALS KARTENHINTERGRUND-HINWEIS
Der alte Fokus auf ein gelbes Zielgebiet wird ersetzt.

Der Button heißt:
  🌍 Kartenumgebung analysieren

Das Spiel untersucht Kartenmerkmale der ungefähren Schatzumgebung und formuliert daraus
allgemeine Hinweise, z. B.:
- Schatz liegt in oder bei einem Gewässer
- Wald-/Grüngebiet
- nahe einer Stadt/Siedlung
- Gebiet mit markanten Straßen/Wegen

Die gelbe Zielzone wird nicht mehr sichtbar dargestellt.

NEU 5 – EXKLUSIVE TECHNOLOGIEN
Technologien können in der Schaltzentrale als:
  Exklusiv pro Game
markiert werden.

Dann kann genau EIN Spieler pro Spiel diese Technologie besitzen.
Wer sie zuerst kauft, blockiert sie für alle anderen.

Beispiele:
- Pionierpatent
- Kartographenmonopol
- Automationspatent

Ein globales Spielevent meldet, wer eine exklusive Technologie gesichert hat.

NEU 6 – FALLEN
Neuer Technologie-Bereich:
  Fallen

Standard:
- Talerfalle
- Zugfalle
- Störsender

Nach Kauf einer Fallen-Technologie erscheinen oberhalb der Karte kleine Fallenbuttons.
Falle auswählen → auf ein noch verdecktes Kartenfeld klicken.

Regeln:
- nur noch nicht aufgedeckte Felder
- nur der Fallensteller sieht seine Fallen auf der Karte
- andere Spieler sehen sie nicht
- eigener Fallensteller kann seine eigene Falle nicht auslösen
- wird eine Falle getroffen, erscheint eine globale Meldung für das ganze Spiel
- auf einem Fallenfeld gibt es keinen normalen Felder-Talerbonus
- Talerfalle zieht zusätzlich Taler ab
- Zugfalle vernichtet gespeicherte Züge
- Störsender reduziert den nächsten manuellen Suchzug
- Stärke und maximal aktive Fallen sind in der Schaltzentrale je Technologie einstellbar

SCHATZ + FALLE:
Liegt zufällig ein Schatzteil unter einer Falle, wird der Schatzanteil auf alle aktiven
Spieler des Games verteilt – außer auf den Fallensteller.

Bei Paygames wird auch das dort liegende Test-Gold entsprechend aufgeteilt.

NEU 7 – GLOBALER EVENT-BANNER
Fallen und exklusive Technologie-Käufe erzeugen eine sichtbare Meldung im laufenden Game.

NEU 8 – CHAT ALS SLIDE-DOWN
Der Chat ist standardmäßig zugeklappt.

Oben bleibt nur:
  💬 Chat

Neue ungelesene Nachrichten erzeugen einen roten Zähler.
Antippen → Chat fährt auf.
Dadurch belegt er im normalen Spiel praktisch keinen Platz.

SCHALTZENTRALE
Bei jeder Technologie stehen zusätzlich zur Verfügung:
- Exklusiv pro Game
- Fallentyp
- Fallenstärke
- Max. aktive Fallen

INSTALLATION
1. Inhalt dieser ZIP in dein bestehendes GitHub-Repository hochladen und vorhandene Dateien ersetzen.
2. Supabase → SQL Editor.
3. NUR:
   supabase/v6_14_migration.sql
   einmal vollständig ausführen.
4. Vercel deployt automatisch.

WICHTIG:
V6.14 setzt voraus, dass der kleine V6.13.2a-Hotfix bereits ausgeführt wurde.

TESTEMPFEHLUNG
1. Zwei Spieler in ein Testgame.
2. Eine exklusive Technologie mit Spieler A kaufen.
3. Mit Spieler B dieselbe kaufen → muss blockiert werden.
4. Spieler A kauft Talerfalle und platziert sie auf verdecktem Feld.
5. Spieler B deckt dieses Feld auf → Event + Schaden prüfen.
6. Prüfen, dass A die Falle vorher auf der Karte sieht, B aber nicht.
7. Chat einklappen → Nachricht von B senden → Ungelesen-Zähler bei A prüfen.
8. Handy: Werte-HUD öffnen/schließen.
9. Analyse-Technologie verwenden → Kartenumgebungs-Hinweis prüfen.
