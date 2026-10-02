SCHATZSUCHE ONLINE V6.6

NEU
- Spiele werden nach standardmäßig 24 Stunden ohne echten Zug automatisch geschlossen.
- Nur eine tatsächliche Feld-Aufdeckung zählt als Aktivität.
- Geschlossene/beendete Spiele werden standardmäßig nach 72 Stunden (= 3 Tagen) gelöscht.
- Bei automatisch geschlossenen Paygames wird noch nicht gefundener Test-Goldstaub aufgeteilt:
  Standard: 50 % Community / 50 % Plattform.
- Diese Werte sind serverseitig einstellbar.
- Laufende und geschlossene Spiele werden in der Lobby getrennt dargestellt.
- Profile können personalisiert werden:
  - Spielername
  - Infotext bis 500 Zeichen
  - Profilbild
- Avatar-Upload über Supabase Storage:
  JPG / PNG / WebP, maximal 2 MB.
- Profiländerungen laufen über eine gezielte RPC, damit Statistiken nicht manipuliert werden können.
- Hilfeseite um Inaktivitätsregeln und Profilinfos erweitert.

INSTALLATION
1. Gesamten Inhalt der ZIP in dein bestehendes GitHub-Repository hochladen und vorhandene Dateien ersetzen.
2. Supabase > SQL Editor öffnen.
3. NUR supabase/v6_6_migration.sql EINMAL vollständig ausführen.
4. Vercel deployt nach dem GitHub-Commit automatisch.
5. Danach am besten Lobby, Profilbild-Upload und ein neues Testspiel prüfen.

SERVERSEITIGE EINSTELLUNGEN
Tabelle: public.platform_settings, Zeile id=1

game_inactivity_hours
  Standard: 24
  Nach wie vielen Stunden ohne Zug ein Spiel automatisch geschlossen wird.

closed_game_retention_hours
  Standard: 72
  Wie lange geschlossene Spiele gespeichert bleiben.

inactive_community_share_bps
  Standard: 5000 = 50 %
  Anteil des offenen Rest-Schatzes, der bei Inaktivität an die Gemeinschaft geht.

inactive_platform_share_bps
  Standard: 5000 = 50 %
  Anteil des offenen Rest-Schatzes, der bei Inaktivität an die Plattform geht.

Die beiden Inaktivitätsanteile müssen zusammen 10.000 Basispunkte (=100 %) ergeben.

AUTOMATISCHE WARTUNG
V6.6 ruft die Wartungsfunktion beim Öffnen der Lobby und beim Öffnen eines Spiels auf.
Damit werden überfällige Spiele spätestens beim nächsten Website-Besuch geschlossen/gelöscht.

Falls die Supabase-Erweiterung pg_cron bereits aktiviert ist, versucht die Migration zusätzlich,
die Wartung stündlich einzuplanen.

Wenn du pg_cron erst später aktivierst:
  danach supabase/v6_6_optional_cron.sql einmal ausführen.

WICHTIG
Goldstaub bleibt in dieser Version weiterhin reines TEST-GOLD ohne Echtgeldwert,
ohne Kaufmöglichkeit und ohne physische Auszahlung.
