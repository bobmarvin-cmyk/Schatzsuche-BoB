# RELEASE_CHECKLIST – BoBsSchatzsuche V7

## Basis
- [ ] Unmittelbar vorheriges Release als Ausgangspunkt.
- [ ] PROJECT_STATE.md gelesen.
- [ ] NON_NEGOTIABLES.md gelesen.
- [ ] Nur ausdrücklich gewünschte Änderungen vorgenommen.

## Schatzsuche Regressionen
- [ ] Bots öffentlich nicht als Bots markiert.
- [ ] Keine öffentlichen Bot-Icons.
- [ ] Kein globaler Bot-Scatter-Fallback.
- [ ] Terrain-Gates nicht entfernt.
- [ ] Bot-Min/Max persistent.
- [ ] Bot-Join-Verzögerung vorhanden.
- [ ] Passives Botspiel vorhanden.
- [ ] Namenspool persistent und Auto-Games daran gebunden.
- [ ] Schatzpositionen nicht nachträglich verschoben.
- [ ] Aufholausgleich vorhanden.
- [ ] Energieanzeige vorhanden.
- [ ] Bot-only Hall-of-Fame-Sperre vorhanden.
- [ ] 10-Minuten-Cleanup-Regel dokumentiert.
- [ ] Mobile Lobby-Fixes erhalten.

## Welt Regressionen
- [ ] /welt vorhanden.
- [ ] /admin/welt vorhanden.
- [ ] Weltzugang serverseitig geprüft.
- [ ] Goldzugang kann keine negative Gold-Wallet erzeugen.
- [ ] Grundstückskauf serverseitig geprüft.
- [ ] Grundstücke global eindeutig per gx/gy.
- [ ] Besitzlimit serverseitig geprüft.
- [ ] Produktion serverseitig/lazy.
- [ ] Inventar kann nicht negativ werden.
- [ ] Verkaufsorders reservieren Bestand.
- [ ] Börsenkauf kann Welt-Taler nicht negativ machen.
- [ ] RLS auf allen neuen Welt-Tabellen.
- [ ] Konflikte standardmäßig deaktiviert bis Skill-System fertig.

## Paket
- [ ] Versionsbadge aktualisiert.
- [ ] Genau eine aktuelle Migration im Supabase-Releaseordner.
- [ ] setup.sql nur Referenz.
- [ ] .env.local ausgeschlossen.
- [ ] ZIP-Test erfolgreich.
- [ ] release_check.py erfolgreich.
