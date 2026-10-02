SCHATZSUCHE ONLINE V6.4

NEU
- Host bestimmt weiterhin die maximale Spielerzahl.
- Spiele können öffentlich oder privat erstellt werden.
- Private Spiele erscheinen nicht in der öffentlichen Lobby.
- Jedes Spiel erhält einen Einladungscode.
- Für private Spiele kann zusätzlich ein Passwort gesetzt werden.
- Passwörter werden serverseitig gehasht gespeichert.
- Beitritt zu privaten Spielen über Einladungscode + optionales Passwort.
- Copyright-/Footerbereich auf allen Seiten.
- Impressum, Datenschutz und Kontaktformular.
- Kontaktanfragen werden in Supabase in contact_messages gespeichert.
- deutlich verbesserte Handy-/Tablet-/Desktop-Darstellung.
- V6.3.1 Map-Liveupdate-Fix und V6.3.2 Pagination-Fix sind enthalten.

INSTALLATION
1. Den gesamten INHALT dieser V6.4 in dein bestehendes GitHub-Repository hochladen
   und gleichnamige Dateien ersetzen.
2. Supabase > SQL Editor.
3. NUR supabase/v6_4_migration.sql EINMAL ausführen.
4. Vercel deployed den neuen GitHub-Commit automatisch.

WICHTIG VOR ÖFFENTLICHER VERÖFFENTLICHUNG
Öffne lib/site-config.js und ersetze:
- Betreibername
- Straße/Hausnummer
- PLZ/Ort
- E-Mail
- ggf. Telefon und Umsatzsteuer-ID

Die Rechtstexte sind eine technische Vorlage und keine individuelle Rechtsberatung.
Vor einem geschäftlichen/öffentlichen Produktivbetrieb sollten sie an den tatsächlichen
Betreiber, Hosting-/Kartendienste und Datenflüsse angepasst und rechtlich geprüft werden.
