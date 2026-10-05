SCHATZSUCHE ONLINE V6.32

NEU

1. SPIEL-CHANGELOG
- Jedes Spiel hat einen aufklappbaren Ereignisverlauf.
- Vorhandene game_events werden dauerhaft nachvollziehbar angezeigt.
- Neue Realtime-Ereignisse erscheinen sofort im Changelog.
- Bis zu 80 aktuelle Ereignisse werden angezeigt.

2. LOBBY-NEWS
- Neue Sektion "News & Änderungen" in der Lobby.
- Admin kann in der Schaltzentrale Beiträge veröffentlichen:
  News / Änderung / Wartung / Event.
- Beiträge können angeheftet und gelöscht werden.

3. TECHNOLOGIEN
- Aktuell kaufbare Technologien stehen jetzt OBEN.
- Maximal drei aktuelle Entscheidungen gleichzeitig.
- Darunter ein kompakter Entwicklungsbaum.
- Jeder Entwicklungszweig ist eine horizontale Kette.
- Erforscht = grün, aktuell möglich = gold, später = dunkel.
- Voraussetzungen werden direkt am Knoten angezeigt.
- Dadurch bleibt sichtbar, woher man kommt und worauf etwas aufbaut,
  ohne wieder einen langen Technologie-Scrollbereich zu erzeugen.

4. ANALYSE / HINWEISE
- Neue Analysehinweise speichern den Suchstandpunkt, an dem sie gekauft wurden.
- Im Hinweisbuch gibt es "📍 Standort zeigen".
- Die Karte springt zu diesem damaligen Punkt und markiert ihn pulsierend.
- Alte Hinweise vor V6.32 haben naturgemäß noch keinen gespeicherten Standort.

5. DESIGN
- Kein radikales Redesign in dieser Version.
- Neue Bereiche folgen der bestehenden dunklen Expeditionsoptik.
- Ein eigener UI-Design-Pass kann anschließend Buttons, Typografie,
  Panel-Hierarchie und Abstände vereinheitlichen, ohne die Identität zu verlieren.

DEPLOY
1. supabase/v6_32_migration.sql EINMAL ausführen.
2. Danach Projektdateien ins Repo übernehmen.
3. .env.local nicht hochladen.
4. Vercel deployen lassen.
