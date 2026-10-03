SCHATZSUCHE ONLINE V6.16a

WICHTIG
Diese Version ersetzt die noch NICHT installierte V6.16.
Die Goldbarren-Funktion wurde vollständig wieder entfernt.

1. MOBILE INGAME-WERTE ALS KARTEN-HUD
Auf Mobilgeräten wird die große Wertebox nicht mehr oberhalb der Karte angezeigt.

Stattdessen liegt direkt am oberen Kartenrand ein kleines halbtransparentes HUD mit:
- Taler
- Züge
- Felder/Zug
- Felder/Minute
- Felder übrig
- Analyse
- Maschinenleistung
- Schatzanteil

Das HUD ist nicht klickbar und liegt nur am Kartenrand, sodass es die Bedienung der Karte
möglichst wenig stört. Desktop bleibt bei der normalen Werteübersicht.

2. TUTORIAL / SIMULIERTES TESTSPIEL
Neue Seite:
  /tutorial

Neue Nutzer bekommen im bestehenden Willkommensfenster zusätzlich:
  🎓 Tutorial starten

Das Tutorial ist komplett lokal simuliert:
- Felder erkunden
- Taler erhalten
- Technologie kaufen
- Analysehinweis kaufen
- Falle platzieren
- Ranking ansehen
- Schatz finden

Es verbraucht keine echten Züge, Taler oder Gold und verändert kein echtes Spiel.
Das Tutorial kann später jederzeit erneut geöffnet werden.

3. GOLD-BEZEICHNUNGEN
Der Begriff „Test“ wurde aus allen sichtbaren Gold-Bezeichnungen entfernt.

Sichtbar heißt es jetzt nur noch:
- Goldstaub
- Goldgame
- Gold
- Goldstaub-Ökonomie

Interne Datenbanknamen wie test_grant_ug bleiben aus Kompatibilitätsgründen unverändert.

4. ONLINE-ANZEIGE
Aktive Spieler werden über Supabase Realtime Presence erkannt.

Vorteile:
- kein Datenbank-Heartbeat
- keine zusätzlichen UPDATEs alle paar Sekunden
- Spielerkarte wird grün hervorgehoben
- „● online“ im Spielerbereich
- Online-Markierung auch im Ranking
- Kartenlegende zeigt aktive Spieler deutlicher

5. AUTHENTIFIZIERUNGSMAIL / BRANDING
Das lässt sich nicht sinnvoll nur im App-Code ändern.

Empfohlen:
Supabase Dashboard -> Authentication -> SMTP Settings

Eigenen SMTP-Anbieter eintragen, z. B.:
- Resend
- Postmark
- SendGrid
- Amazon SES

Dann:
Sender name:
  BoBs Schatzsuche

Absenderadresse z. B.:
  login@deinedomain.de

Danach unter:
Authentication -> Email Templates

Betreff und HTML für:
- Registrierung bestätigen
- Passwort zurücksetzen
- Magic Link
- Einladungen

brandgerecht anpassen.

6. PERFORMANCE FÜR GROSSE SPIELE
V6.16a reduziert die Realtime-Last weiter.

Vorher wurden unter anderem game_players, games und Technologien als Postgres-Changes
an jeden offenen Client verteilt.

Jetzt:
- nur seltene globale Ereignisse bleiben als unmittelbare Realtime-Events
- Presence übernimmt ausschließlich „wer ist online“
- ein kompakter Live-State wird alle 5 Sekunden abgefragt
- dieser Live-State enthält in EINER Antwort:
  - globale Feldzahl
  - Feldversion
  - Spielstatus
  - Spielerwerte
  - Rankingwerte
  - nachzuholende globale Events
- sichtbare Kartenfelder werden nur neu geladen, wenn field_version wirklich geändert wurde
- zusätzliche Datenbank-Indizes für häufige Multiplayer-Abfragen

Bei 100 verbundenen Spielern bedeutet das ungefähr 20 kleine Live-State-Abfragen pro Sekunde,
statt potenziell tausender Feld-/Spieler-Realtime-Nachrichten.

7. „FELDER ÜBRIG“ GLOBAL
Der Wert kommt aus games.explored_count.
Jeder Suchvorgang erhöht zusätzlich field_version.

Andere Clients übernehmen den Wert über den gemeinsamen Live-State.
Sie müssen dafür nicht selbst klicken.

8. GLOBALE POPUPS
Realtime bleibt für schnelle Anzeige erhalten.
Der Live-State dient zusätzlich als zuverlässiger Nachholmechanismus.

Damit werden folgende Ereignisse robuster:
- Schatzteil gefunden
- Falle ausgelöst
- Schatz unter Falle
- einzigartige Technologie gesichert
- Spiel gewonnen/verloren

9. ANALYSEPREISE
Jede Analysestufe hat weiterhin ihren eigenen Preis in der Schaltzentrale:
- Stufe 1
- Stufe 2
- Stufe 3
- Stufe 4
- Stufe 5
- Stufe 6+

10. ZUM SPIELFELD
Der Kartenbutton
  ◎ Zum Spielfeld
bleibt enthalten und zoomt auf das vollständige Spielraster zurück.

INSTALLATION
1. V6.16 NICHT vorher installieren.
2. Inhalt dieser ZIP in dein bestehendes GitHub-Repository hochladen.
3. Vorhandene Dateien ersetzen.
4. .env.local NICHT hochladen.
5. Supabase -> SQL Editor.
6. NUR:
   supabase/v6_16a_migration.sql
   einmal vollständig ausführen.
7. Vercel deployt automatisch.

VORAUSSETZUNG
V6.15.1 muss bereits installiert sein.

EMPFOHLENE TESTS
A) Zwei Browser öffnen dasselbe Game.
B) Spieler A deckt große Feldmengen auf.
C) Spieler B klickt nichts:
   Felder übrig / Ranking / Spielerwerte müssen trotzdem nachziehen.
D) Beide Browser offen lassen und Schatz/Falle/exklusive Tech testen.
E) Prüfen, ob Online-Spieler grün/„online“ angezeigt werden.
F) Handy: HUD über Kartenrand prüfen.
G) Neuer Nutzer: Tutorial starten und komplett durchlaufen.
