SCHATZSUCHE ONLINE V6.41

BOT-FIX + NORMALE SPIELERDARSTELLUNG

SPIELDARSTELLUNG
- Computer-Spieler werden im Spiel nicht mehr als „Bot“ gekennzeichnet.
- Sie erscheinen oben in derselben Mitspieler-Leiste wie alle anderen Spieler.
- gleiche Farbpunkte
- gleicher grüner Online-Punkt
- individuelle Profil-Icons wirken wie normale Avatare
- Ranking ohne Bot-Badge
- Teilnehmerkarten ohne „Bot“-Kennzeichnung
- öffentliche Computer-Spieler-Profile sehen wie normale Spielerprofile aus
- im Archiv keine besondere Bot-Markierung

BOT-AKTIVITÄT
- Bot-Zuglogik komplett robuster aufgebaut.
- Bewegung ist von Technologie- und Schatzlogik getrennt.
- Ein Fehler beim Technologieausbau oder Schatztest rollt die bereits aufgedeckten
  Felder nicht mehr zurück.
- Bestehende Bots werden beim Update sofort wieder aktionsbereit.
- Der Client stößt weiterhin regelmäßig an; leere Spiele laufen zusätzlich über Cron,
  sofern pg_cron verfügbar ist.
- Fehler werden je Spieler intern gespeichert, statt unbemerkt den kompletten Tick zu stoppen.

SPIELERPLÄTZE
- Computer-Spieler belegen nur freie Plätze.
- Wenn echte Spieler beitreten, werden überzählige Computer-Spieler automatisch
  deaktiviert und machen Platz.
- Bei wieder freien Plätzen können sie wieder aufgefüllt werden.
- „Bots sperren“ bei der Spielerstellung bleibt erhalten.
- Gold- und Sponsorspiele bleiben ohne Computer-Spieler.

INSTALLATION
1. supabase/v6_41_migration.sql EINMAL ausführen.
2. V6.41 deployen.
