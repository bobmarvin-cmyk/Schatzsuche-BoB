SCHATZSUCHE ONLINE V6.8

NEU
- Performance-Optimierung im laufenden Spiel:
  * kein kompletter Spiel-Reload mehr jede Sekunde
  * Countdown läuft lokal im Browser
  * Serverzug-Abgleich erst wenn ein neuer Zug fällig ist
  * Realtime-Ereignisse laden nur den betroffenen Teil nach
  * Feldänderungen werden gebündelt/debounced
- Standard-Zugregeneration bei neuen Spielen: 5 Sekunden
- Die Standard-Zugzeit ist zusätzlich in der Admin-Schaltzentrale einstellbar.
- Spielerprofile sind anklickbar in Legendenliste und aktivem Spiel.
- Neue öffentliche Profilansicht /spieler/[id] mit Bio, Profilbild und Spielstatistiken.
- Spielchat mit Realtime-Nachrichten, nur für Teilnehmer des jeweiligen Spiels.
- Lobby zeigt Inhalte erst nach erfolgreicher Auth-Prüfung. Nicht eingeloggte Besucher werden zu /login geleitet.
- Neue ausführliche öffentliche Startseite.
- Loginseite optisch als Einstieg ins Spiel ausgebaut.
- E-Mail-Bestätigungslink wird bei neuen Registrierungen auf die Startseite zurückgeführt.
- Analyse-Technologien arbeiten stärker geografisch:
  * Richtung in Himmelsrichtungen
  * echte Meter/Kilometer statt nur Rasterfelder
  * gelber ungefährer Analysebereich direkt auf der Weltkarte
  * der Bereich wird mit höheren Analyseleveln kleiner
  * die exakte Schatzposition wird nicht an den Client ausgegeben

INSTALLATION
1. Gesamten Inhalt der ZIP in GitHub hochladen und vorhandene Dateien ersetzen.
2. Supabase > SQL Editor.
3. NUR supabase/v6_8_migration.sql EINMAL ausführen.
4. Vercel deployt automatisch.

E-MAIL-BESTÄTIGUNG
Die App setzt emailRedirectTo auf die jeweilige Startseite der laufenden Domain.
In Supabase muss deine Vercel-Adresse zusätzlich unter Authentication > URL Configuration als erlaubte Redirect URL eingetragen sein, z. B.:
https://schatzsuchebobi.vercel.app/**

PERFORMANCE
Mit 2-3 Spielern sollte die Seite deutlich reaktionsschneller sein. Bei sehr großen Mengen bereits erkundeter Felder bleibt die vollständige Karten-Geometrie später ein eigener Skalierungspunkt; dafür wäre als nächste Stufe ein serverseitiges Viewport-/Kachel-Laden sinnvoll.

Goldstaub bleibt weiterhin ausschließlich TEST-GOLD ohne Echtgeldwert, Kauf oder Auszahlung.
