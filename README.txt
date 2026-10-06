SCHATZSUCHE ONLINE V6.60

1. ZUFALLSNAMEN
Der bisherige Fehler lag nicht primär beim Speichern:
Der Admin-Namenspool wurde gespeichert, aber die Auto-Game-Zufallsfunktion verwendete weiterhin alte fest eingebaute Namenslisten.

V6.60:
- random_game_name_v6151 liest direkt aus game_name_parts_v625
- Änderungen am Namenspool wirken damit tatsächlich auf neue Auto-Games
- leere Pools besitzen nur noch einen Notfall-Fallback

2. BOT-SUCHMUSTER
V6.59 war optisch zu schwach, weil die Kandidaten am Ende wieder stark nach Entfernung sortiert wurden.

V6.60:
- 3–5 lokale überlappende Suchlappen plus Kern
- deutlich unregelmäßigere Ränder
- kleine sichtbare Lücken
- stärkeres lokales Wandern des Suchzentrums
- weiterhin kein globales Scatter-Aufdecken

3. ENERGIEBALKEN
- Züge werden zusätzlich als Energie-/Mana-Balken angezeigt
- aktueller Wert / normales Speicherlimit
- bei Aufholzügen wird Überhang als „Aufholenergie +X“ angezeigt
- keine zusätzlichen Netzwerkabfragen

INSTALLATION
1. supabase/v6_60_migration.sql EINMAL ausführen.
2. V6.60 deployen.
