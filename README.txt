SCHATZSUCHE ONLINE V6.8.1 – MULTIPLAYER PERFORMANCE

Dieses Update beschleunigt besonders Spiele mit mehreren Spielern und hohen Felder-pro-Zug-Werten.

NEU / OPTIMIERT
- Feldaufdeckung wird serverseitig als Batch berechnet statt Feld für Feld.
- Taler werden nur noch einmal pro Zug aktualisiert statt einmal pro aufgedecktem Feld.
- Verschiedene Spieler blockieren sich nicht mehr über einen globalen Game-Datenbank-Lock.
- Bereits belegte Felder werden über den Primärschlüssel/Index effizient ausgeschlossen.
- Die RPC gibt die neu geöffneten Felder direkt an den Browser zurück.
- Eigene neue Felder erscheinen dadurch unmittelbar nach der Serverantwort auf der Karte.
- Realtime-INSERTs anderer Spieler werden direkt in den lokalen Kartenstand gemischt.
- Kein erneutes Laden der kompletten explored_fields-Tabelle bei jedem Realtime-Ereignis.
- Zusätzliche Datenbankindexe für Multiplayer-Abfragen.

INSTALLATION
1. Inhalt der ZIP in dein bestehendes GitHub-Repository hochladen und Dateien ersetzen.
2. Supabase > SQL Editor.
3. NUR supabase/v6_8_1_migration.sql EINMAL vollständig ausführen.
4. Vercel deployt automatisch.

HINWEIS
Beim ersten Öffnen eines Spiels wird die bestehende Feldhistorie weiterhin vollständig geladen.
Während des laufenden Spiels werden danach aber nur noch neue Felder ergänzt. Das ist der entscheidende
Performance-Unterschied für Multiplayer.
