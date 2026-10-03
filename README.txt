SCHATZSUCHE ONLINE V6.16a.5.1 – MASCHINEN SQL HOTFIX

Fehler:
  Maschinen: for SELECT DISTINCT, ORDER BY expressions must appear in select list

Ursache:
Die Focus-Maschinensuche verwendete SELECT DISTINCT x,y zusammen mit einer
ORDER-BY-Distanzberechnung. PostgreSQL erlaubt das so nicht.

Fix:
Die Abfrage läuft jetzt in zwei Schritten:
1. distinct_candidates dedupliziert x/y.
2. candidates sortiert die eindeutigen Felder nach Distanz und begrenzt sie.

INSTALLATION
Wenn V6.16a.5 bereits läuft:

1. ZIP-Inhalt in GitHub ersetzen.
2. Supabase SQL Editor.
3. NUR:
   supabase/v6_16a_5_1_hotfix.sql
   einmal ausführen.
4. Vercel deployen lassen.

Alte Migrationen NICHT erneut ausführen.

Nach erfolgreichem Deploy steht unten rechts:
  V6.16a.5.1
