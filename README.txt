SCHATZSUCHE ONLINE V6.23.4 – MAP INFO + MITGLIEDERVERWALTUNG

VORAUSSETZUNG
V6.23.1 SQL-Struktur oder neuer.

INSTALLATION
1. ZIP-Inhalt in GitHub ersetzen.
2. Supabase -> SQL Editor.
3. NUR:
   supabase/v6_23_4_migration.sql
   einmal ausführen.
4. Vercel Environment Variables:
   SUPABASE_SERVICE_ROLE_KEY
   mit dem Service-Role-Key des eigenen Supabase-Projekts anlegen.
   WICHTIG: KEIN NEXT_PUBLIC_ Präfix verwenden.
5. Neu deployen.
6. Version V6.23.4 prüfen.

KARTENINFO
- Spielmeldungen stehen jetzt direkt unten IN der Karte.
- Terrain-Legende ebenfalls direkt in der Karte.
- auf Mobile kompakt, damit kein Scrollen nur für Kartenstatus nötig ist.
- lange Meldungen werden gekürzt statt die Kartenhöhe zu verändern.

MITGLIEDERVERWALTUNG
Neue Sektion „👥 Mitglieder“ in der Schaltzentrale.

Admin kann:
- nach Name oder E-Mail suchen
- Anzeigename ändern
- Bio ändern
- Siege ändern
- Gesamtspiele ändern
- Gesamtfelder ändern
- gefundenes Gold ändern
- Wallet-Gold ändern
- Taler in einzelnen Spielen ändern
- gespeicherte Züge in einzelnen Spielen ändern
- neues Passwort für einen Benutzer setzen

NICHT direkt editierbar:
- reveal_power
- Analyse-Level
Diese Werte sollen weiterhin aus den gekauften Technologien entstehen, damit
der Spielzustand konsistent bleibt.

PASSWÖRTER
Bestehende Passwörter können niemals ausgelesen werden.
Die Schaltzentrale kann nur ein NEUES Passwort setzen.

Dafür nutzt V6.23.4:
app/api/admin/member-password/route.js

Die Route:
1. prüft das Login-Token
2. prüft is_admin_v67()
3. verwendet erst danach serverseitig den SUPABASE_SERVICE_ROLE_KEY
4. ruft Supabase Auth Admin updateUserById auf

Der Service-Role-Key wird niemals an den Browser geschickt.

GOLD-KORREKTUREN
Wenn das Wallet-Gold administrativ verändert wird, erzeugt das System eine
gold_transactions-Zeile mit transaction_type='admin_adjustment'.
So bleiben manuelle Korrekturen nachvollziehbar.
