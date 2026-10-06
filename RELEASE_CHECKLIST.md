# RELEASE_CHECKLIST

## Basis
- [ ] Unmittelbar vorheriges Release als Ausgangspunkt verwendet.
- [ ] PROJECT_STATE.md gelesen.
- [ ] NON_NEGOTIABLES.md gelesen.
- [ ] Nur ausdrücklich gewünschte Änderungen vorgenommen.

## Regressionen
- [ ] Bots öffentlich nicht als Bots markiert.
- [ ] Keine Bot-Icons in öffentlicher Oberfläche.
- [ ] Kein globaler Bot-Scatter-Fallback.
- [ ] Terrain-Gates nicht entfernt.
- [ ] Bot-Min/Max vorhanden und persistent.
- [ ] Bot-Join-Verzögerung vorhanden.
- [ ] Passives Botspiel vorhanden.
- [ ] Namenspool persistent und von Auto-Games verwendet.
- [ ] Schatzpositionen nicht nachträglich verschoben.
- [ ] Aufholausgleich vorhanden.
- [ ] Energieanzeige vorhanden.
- [ ] Bot-only-Hall-of-Fame-Sperre vorhanden.
- [ ] 10-Minuten-Cleanup-Regel vorhanden.
- [ ] Mobile Lobby-Fixes erhalten.

## Paket
- [ ] Versionsbadge aktualisiert.
- [ ] Neue Migration ist idempotent genug für einmalige Ausführung.
- [ ] Alte Migrationen nicht ins Supabase-Release-Verzeichnis übernommen.
- [ ] setup.sql nur als Referenz beigelegt.
- [ ] .env.local ausgeschlossen.
- [ ] ZIP-Test erfolgreich.
- [ ] release_check.py erfolgreich.
