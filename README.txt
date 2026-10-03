SCHATZSUCHE ONLINE V6.13.2 – HOTFIX

BEHEBT 1:
Maschinenfehler:
  for SELECT DISTINCT, ORDER BY expressions must appear in select list

Ursache:
Im Fokusmodus wurde SELECT DISTINCT(x,y) verwendet, aber nach einer zusätzlich
berechneten Entfernung sortiert. PostgreSQL erlaubt das in dieser Form nicht.

Fix:
- Kandidaten werden zuerst eindeutig gemacht.
- Die Entfernung wird dabei ausdrücklich mitgeführt.
- Erst danach wird nach Entfernung sortiert und limitiert.

BEHEBT 2:
Bei großen manuellen Aufdeckungen kamen am Rand bereits erforschter Flächen irgendwann
keine neuen Felder mehr dazu.

Ursache:
Die manuelle Suche erzeugte nur ein Quadrat, dessen Radius im Wesentlichen aus
sqrt(Felder/Zug) berechnet wurde. Wenn dieses Quadrat innen bereits erforscht war,
konnte die Abfrage freie Felder außerhalb des Quadrats gar nicht erreichen.

Fix:
Die manuelle Suche verwendet jetzt drei begrenzte quadratische Spiralen:
- nah: Schrittweite 1
- mittel: Schrittweite 4
- weit: Schrittweite 16

Dadurch sucht ein Klick zuerst direkt um das angeklickte Feld und kann bei stark
erforschten Bereichen schrittweise deutlich weiter nach außen springen.

WICHTIG:
Die Kandidatenzahl bleibt begrenzt. Es wird also NICHT wieder ein riesiges Quadrat
erzeugt, das Statement-Timeouts verursachen kann.

INSTALLATION:
1. Inhalt der ZIP in das bestehende GitHub-Repository hochladen und Dateien ersetzen.
2. Supabase → SQL Editor.
3. NUR:
   supabase/v6_13_2_migration.sql
   einmal vollständig ausführen.
4. Vercel deployt automatisch.

Es sind keine neuen Tabellen und keine Datenlöschung nötig.
Bestehende Spiele können danach direkt weitergespielt werden.
