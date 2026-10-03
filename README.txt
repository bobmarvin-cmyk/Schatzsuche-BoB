SCHATZSUCHE ONLINE V6.16a.1 – SICHTBARKEITS-/DEPLOY-HOTFIX

Warum diese Version?
Beim Prüfen von V6.16a wurde festgestellt:
- Tutorial-Seite war vorhanden
- Tutorial-Link in der Lobby war aber nicht zuverlässig eingefügt
- einige mobile CSS-Regeln konnten durch ältere Regeln überlagert werden

V6.16a.1 behebt das.

NEU:
1. Tutorial-Link garantiert sichtbar in der Lobby.
2. Mobiles Karten-HUD greift jetzt bis 900 px Viewportbreite.
3. „Zum Spielfeld“-Button wird mobil ausdrücklich sichtbar gehalten.
4. Online-Markierung wird mobil ausdrücklich sichtbar gehalten.
5. Kleines Build-Badge „V6.16a.1“ unten rechts in:
   - Lobby
   - Game
   - Schaltzentrale

WICHTIG:
Wenn nach dem Deploy unten rechts NICHT „V6.16a.1“ steht, liefert Vercel noch nicht den
neuen Build. Dann liegt das Problem nicht an der App-Funktion, sondern am Deploy/Cache.

INSTALLATION:
- ZIP-Inhalt ins bestehende GitHub-Repository hochladen und ersetzen.
- KEIN neues SQL nötig, wenn v6_16a_migration.sql bereits erfolgreich ausgeführt wurde.
- Falls V6.16a SQL noch NICHT ausgeführt wurde: einmal supabase/v6_16a_migration.sql ausführen.
- Danach Vercel-Deploy abwarten/prüfen.

SCHNELLTEST:
1. Lobby öffnen -> unten rechts muss V6.16a.1 stehen.
2. Lobby -> 🎓 Tutorial sichtbar.
3. Game auf Handy -> Werte direkt über der Karte.
4. Karte -> ◎ Zum Spielfeld sichtbar.
5. Zwei Nutzer im Game -> online-Markierung sichtbar.
