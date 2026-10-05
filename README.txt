SCHATZSUCHE ONLINE V6.52.1

URSACHE DES ZEITLUPEN-EFFEKTS
Der Bulk-Executor funktionierte. Neue Bots starteten aber praktisch nur mit einem
einzigen Zug und mussten danach auf normale Regeneration warten. Deshalb erschien
oft erst sehr spät genau ein Feld.

FIX
- neue Bots starten mit dem normalen Zugspeicher der Runde
- bestehende aktive Bots werden beim Update einmalig auf diesen Speicher aufgefüllt
- danach gelten normale Zugzeiten und Technologieboni
- keine künstlichen Gratiszüge pro Sekunde
- V6.52-Bulk-Suche bleibt erhalten

DIAGNOSE
In der Schaltzentrale gibt es jetzt „Laufzeit-Diagnose“:
- Züge
- Reveal-Power
- Felder
- Techs
- Taler
- letzter Erfolg
- letzter Fehler

Damit lässt sich sofort unterscheiden:
kein Zug / kein Erfolg / SQL-Fehler / zu geringe Power.

INSTALLATION
1. supabase/v6_52_1_migration.sql EINMAL ausführen.
2. V6.52.1 deployen.
