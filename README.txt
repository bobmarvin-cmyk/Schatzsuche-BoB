SCHATZSUCHE ONLINE V6.53.3

EXAKTER FEHLER AUS DER DIAGNOSE
23505: duplicate key value violates unique constraint "bot_free_v6532_pkey"

URSACHE
Die temporäre Tabelle bot_free_v6532 hatte versehentlich nur x als Primary Key.
Felder (x=10,y=20) und (x=10,y=21) galten deshalb fälschlich als Duplikat.

FIX
Primary Key ist jetzt korrekt (x,y).

Keine weitere Architekturänderung.

INSTALLATION
1. supabase/v6_53_3_migration.sql EINMAL ausführen.
2. V6.53.3 deployen.
