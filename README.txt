SCHATZSUCHE ONLINE V6.15.1

1. FELDERZÄHLER REALTIME FIX
Problem:
Die serverseitige Zahl stieg korrekt, aber fremde Spieler sahen die Änderung oft erst,
wenn sie selbst wieder eine Aktion ausführten.

Fix:
- game_players wird sicher zur Supabase-Realtime-Publikation hinzugefügt
- Replica Identity für zuverlässige UPDATE-Ereignisse
- der bestehende Client hört bereits auf game_players
- dadurch aktualisieren sich Feldzahlen und Ingame-Ranking ohne zusätzliches Polling

Es entsteht also kein neuer dauernder Polling-Traffic.

2. INGAME-RANKING
„Suchfläche“ wurde entfernt.

Verbleibende Kategorien:
- Taler
- Ausbau / erworbene Technologien
- tatsächlich aufgedeckte Felder
- Schatzanteil

3. GLOBALE MELDUNG FÜR EXKLUSIVE TECHNOLOGIEN
Wenn ein Spieler eine exklusive Technologie zuerst sichert, erscheint bei allen
verbundenen Teilnehmern ein deutliches Popup.

4. GLOBALE ENDCARD
Wenn ein Spieler gewinnt, erhalten alle aktuell verbundenen Teilnehmer eine Endcard.

Sie zeigt:
- Gewinner
- Schatzanteil
- Züge des Gewinners
- Gewinner-Taler->Gold-Bonus, falls vorhanden

Der Gewinner sieht „Du hast gewonnen“, andere sehen den Namen des Gewinners.

5. GLEICHES SPIEL NOCHMAL
Die Endcard enthält:
  🔁 Gleiches Spiel nochmal

Damit erstellt der klickende Spieler ein neues Game mit denselben Einstellungen:
- Feldanzahl
- Feldgröße
- Spielerzahl
- Zugregeneration
- Zugspeicher
- Spieltyp
- Goldgame-Einsatz
- Schatzteile
- Gimmickdichte
- Standortmodus

Bei Zufallsspielen bleibt „Zufall“ die Einstellung, daher wird erneut ein neuer
Zufallsort gewählt.

6. KREATIVERE SPIELNAMEN
„Mein Spiel“ ist verschwunden.

Beim Öffnen der Lobby wird automatisch ein abwechslungsreicher Name erzeugt, z.B.:
- NebelJagd
- KompassQuest
- NordlichtExpedition
- DrachenSpur
- AtlasMission
- FjordAbenteuer

Der Nutzer kann den Namen weiterhin ganz normal überschreiben.

Auch „Gleiches Spiel nochmal“ erhält serverseitig einen neuen kreativen Namen.

7. ANALYSE NEU BALANCIERT
Analysehinweise erscheinen NICHT mehr automatisch nach jedem manuellen Zug.

Stattdessen:
- Analyse-Technologie erwerben
- manuell auf der Karte suchen
- separat „Hinweis kaufen“ drücken
- Taler bezahlen
- einmaligen Richtungs-/Entfernungshinweis erhalten

Für dieselbe letzte Suchposition kann kein zweiter Hinweis gekauft werden.
Erst nach einer neuen manuellen Suche ist eine weitere Analyse möglich.

Standardpreis:
  5 Taler × Analyse-Stufe

Beispiele:
- Analyse Stufe 1 = 5 Taler
- Stufe 2 = 10 Taler
- Stufe 5 = 25 Taler

Der Grundpreis ist in der Schaltzentrale veränderbar:
  Analyse-Grundpreis je Stufe (Taler)

Damit lässt sich Analyse Stufe 1 nicht mehr kostenlos Zug für Zug zur Schatzposition
nachführen.

INSTALLATION

1. Inhalt der ZIP in dein bestehendes GitHub-Repository hochladen.
2. Vorhandene Dateien ersetzen.
3. .env.local NICHT hochladen.
4. Supabase -> SQL Editor.
5. NUR:
   supabase/v6_15_1_migration.sql
   einmal vollständig ausführen.
6. Vercel deployt automatisch.

VORAUSSETZUNG
V6.15 muss bereits installiert sein.

TESTEMPFEHLUNG

A) Realtime Felder
- Zwei Browser / zwei Spieler öffnen
- Spieler A deckt Felder auf
- Spieler B darf NICHT selbst klicken müssen
- Feldzahl von A muss bei B automatisch steigen

B) Exklusive Technologie
- Spieler A kauft eine exklusive Fähigkeit
- bei Spieler B muss Popup erscheinen

C) Gewinn
- Spiel mit zwei Spielern beenden
- Gewinner und Verlierer müssen jeweils eine Endcard sehen

D) Gleiches Spiel
- Endcard -> „Gleiches Spiel nochmal“
- neues Game kontrollieren

E) Analyse
- Analyse-Tech besitzen
- manuell suchen
- Hinweis kaufen
- nochmal kaufen ohne neue Suche -> muss blockiert werden
- neu suchen -> nächster kostenpflichtiger Hinweis möglich

F) Namen
- Lobby mehrfach neu öffnen
- unterschiedliche vorgeschlagene Namen prüfen
