SCHATZSUCHE ONLINE V6.53

WARUM DIESER UMBAU
Die bisherigen Bot-Versionen waren zu stark an moves_left, last_regen_at und Client-Ticks gekoppelt.
Dadurch konnten Bots sichtbar im Spiel sein, aber praktisch trotzdem stehenbleiben.

V6.53
- Bots besitzen weiterhin ihre Profile, Taler, Techs, Reveal-Power und Schatzanteile.
- Ihre Aktivität hängt aber NICHT mehr von moves_left ab.
- Stattdessen gilt:
  vergangene Zeit / effektive Zugzeit = virtuelle Bot-Züge.
- Neue Bots erhalten sofort einen vollen virtuellen Startspeicher.
- Während ein echter Spieler das Spiel offen hat, wird die Simulation alle 2 Sekunden angestoßen.
- Bei mehreren Spielern verhindert ein PostgreSQL Advisory Lock doppelte Bot-Züge.

AKTIV
- Aktiv-Leistung 100 % = normales Spieltempo.
- Optional kann die Leistung in der Schaltzentrale erhöht oder reduziert werden.
- Alle fälligen virtuellen Züge werden in einer gemeinsamen Feldoperation verarbeitet.

LEERES SPIEL
- Minuten-Cron bleibt bestehen.
- Dort gilt der Sparmodus-Prozentsatz.

DIAGNOSE
Schaltzentrale zeigt:
- fällige virtuelle Züge
- letzter Simulationslauf
- Felder im letzten Lauf
- Reveal-Power
- Felder gesamt
- Techs
- Taler
- Zahl der Simulationsläufe
- letzter Fehler

INSTALLATION
1. supabase/v6_53_migration.sql EINMAL ausführen.
2. V6.53 deployen.
