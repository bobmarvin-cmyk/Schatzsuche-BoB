SCHATZSUCHE ONLINE V6.23.1 – LOW-DISK CHUNK MAP

WARUM DIESE VERSION
Die ursprüngliche V6.23-Migration hat versucht, ALLE bestehenden explored_fields
einmalig in die neue Chunkstruktur zu übertragen und zusätzlich einen weiteren großen
Index auf explored_fields anzulegen. Bei einer bereits großen Supabase-Datenbank kann
dies kurzfristig sehr viel zusätzlichen Speicher benötigen.

Fehler:
ERROR 53100: could not extend file ... No space left on device

V6.23.1 entfernt genau diese speicherintensiven Schritte.

WICHTIG
Wenn v6_23_migration.sql mit "No space left on device" fehlgeschlagen ist:
NICHT erneut ausführen.

STATTDESSEN
1. Prüfe zuerst, ob deine Supabase-Datenbank überhaupt wieder Schreibplatz hat.
   Falls wirklich 100 % belegt, müssen alte/unnötige Daten gelöscht oder das
   Datenbank-Limit erhöht werden, bevor irgendeine Migration schreiben kann.

2. ZIP-Inhalt V6.23.1 in GitHub ersetzen.

3. Supabase -> SQL Editor:
   NUR supabase/v6_23_1_migration.sql
   einmal ausführen.

4. Keine V6.23-Migration mehr ausführen.

WAS V6.23.1 ÄNDERT
- kein globaler Backfill aller Spiele
- kein zusätzlicher großer explored_fields(game_id,y,x)-Index
- bestehende Spiele werden erst beim tatsächlichen Öffnen einzeln initialisiert
- neue Aufdeckungen werden danach inkrementell in 64x64-Chunks gepflegt
- Canvas/RLE/Chunk-Versionierung aus V6.23 bleibt erhalten

HINWEIS
Das erstmalige Öffnen eines SEHR großen alten Spiels kann weiterhin etwas DB-Arbeit
erzeugen, aber nur für genau dieses Spiel und ohne den globalen Speicherpeak.
Neue Spiele benötigen keinen Altbestands-Backfill.
