SCHATZSUCHE ONLINE V6.16a.2 – BUILD-FIX

Ursache des fehlgeschlagenen V6.16a.1 Deploys:
In app/admin/page.js war nach dem Entfernen der Goldbarren-Karte ein überzähliges </div>
stehen geblieben.

Dadurch brach Next.js beim Build mit:
  Expected '}', got 'className'
ab.

V6.16a.2:
- korrigiert genau diesen JSX-Fehler
- Build-Badge auf V6.16a.2 erhöht

WICHTIG:
Kein neues SQL nötig, wenn v6_16a_migration.sql bereits erfolgreich ausgeführt wurde.
Wenn das SQL noch NICHT ausgeführt wurde, weiterhin nur:
  supabase/v6_16a_migration.sql
einmal ausführen.

INSTALLATION:
1. ZIP-Inhalt ins bestehende GitHub-Repository hochladen.
2. Vorhandene Dateien ersetzen.
3. Vercel neu deployen lassen.
4. Nach erfolgreichem Deploy muss unten rechts V6.16a.2 stehen.

Dann sollten auch Tutorial, Karten-HUD, Online-Anzeige und Zentrierbutton sichtbar sein.
