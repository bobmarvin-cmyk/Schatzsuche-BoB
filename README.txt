SCHATZSUCHE ONLINE V6.53.2

AUSGANGSLAGE
Die Diagnose meldete:
- Kandidaten vorhanden
- freie Felder vorhanden
- trotzdem opened=0

Damit lag der Fehler nicht mehr bei Timer, Terrain oder Zielwahl, sondern direkt zwischen freier Kandidatenmenge und INSERT.

V6.53.2
- Kandidaten werden in einer temporären Tabelle gesammelt.
- freie Felder kommen in eine zweite temporäre Tabelle.
- Schatzmarkierung wird separat vorbereitet.
- explored_fields wird anschließend mit einem normalen INSERT ... SELECT geschrieben.
- get diagnostics row_count misst sofort die wirklich eingefügten Zeilen.

Wenn danach weiterhin 0 geschrieben werden, zeigt last_error:
Insert 0 trotz Kandidaten. Kandidaten=X, frei=Y, insert=0

INSTALLATION
1. supabase/v6_53_2_migration.sql EINMAL ausführen.
2. V6.53.2 deployen.
