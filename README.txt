SCHATZSUCHE ONLINE V6.17.1 – GOLDANZEIGE IN MILLIGRAMM

ÄNDERUNG
Alle sichtbaren Goldstaubwerte werden jetzt in Milligramm (mg) angezeigt.

Beispiele:
0,2500 g -> 250 mg
0,005 g  -> 5 mg
1,000 g  -> 1.000 mg

WICHTIG
Die interne Speicherung bleibt unverändert in Mikrogramm (µg).

Dadurch:
- keine Goldbestände verändern sich
- keine Umrechnung in der Datenbank nötig
- keine bestehende Ökonomie wird verändert
- nur die Darstellung wird schöner und leichter lesbar

Die zentrale Funktion formatGold() gibt jetzt mg aus.
Damit werden Profil, Lobby, Spiel, Archiv, Legenden und Admin-Goldwerte automatisch
in Milligramm dargestellt.

INSTALLATION
Wenn V6.17 noch NICHT installiert wurde:
1. Direkt diese V6.17.1 verwenden.
2. ZIP-Inhalt in GitHub ersetzen.
3. Supabase:
   NUR supabase/v6_17_migration.sql
   einmal ausführen.
4. Vercel deployen lassen.

Wenn V6.17 bereits installiert wäre:
- kein zusätzliches SQL nötig
- nur Frontend-Dateien ersetzen

Nach erfolgreichem Deploy steht unten rechts:
V6.17.1
