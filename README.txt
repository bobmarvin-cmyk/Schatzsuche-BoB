SCHATZSUCHE ONLINE V6.31

NEU / KORRIGIERT

ASSISTENT
- Kaufstatus stabilisiert: nach erfolgreicher Freischaltung springt die UI nicht mehr
  zwischen "kaufen" und AN/AUS hin und her.
- Während der Kaufstatus noch geladen wird, erscheint kein falscher Kaufen-Button.
- Der Assistent darf über bereits erforschte/belegte Bereiche weiterlaufen.
- In bereits erforschtem Gebiet sucht er einfach nach noch erreichbaren freien Feldern.
- Findet er an einem Schritt nichts Neues, bleibt die Route trotzdem nicht hängen.
- Keine Offline-Nachholung; weiterhin höchstens ein Schritt pro normalem Zugtakt.

ENTWICKLUNG
- Der lange Technologie-Scrollbereich wurde durch eine kompakte Entwicklungszentrale ersetzt.
- Pro Entwicklungszweig sieht man Fortschritt und den zuletzt erreichten Stand.
- Alte und zukünftige Stufen bleiben als Fortschrittsleiste sichtbar.
- Es werden nur die aktuell möglichen nächsten bis zu 3 Entwicklungen als Kaufkarten gezeigt.
- Endgame-Ausbau bleibt nach vollständigem normalen Techbaum sichtbar.

ANALYSE / HINWEISE
- Lange Stufenübersicht aus der Hauptansicht entfernt.
- Neue kompakte "Suchzentrale".
- Ein klarer Button für den nächsten Hinweis.
- Aktueller Hinweis direkt sichtbar.
- Bisherige Hinweise kompakt aufklappbar.
- Die bestehende serverseitige Hinweislogik bleibt unverändert; geändert wurde der
  unübersichtliche Aufbau der Oberfläche.

SQL
- V6.31 benötigt KEINE neue Migration.
- Wenn V6.30 bereits installiert ist: kein SQL ausführen.
- Wenn V6.30 noch nicht installiert ist: supabase/v6_30_migration.sql einmal ausführen.

DEPLOY
1. Projektdateien ins Repo übernehmen.
2. .env.local nicht hochladen.
3. Vercel deployen lassen.
