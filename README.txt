SCHATZSUCHE ONLINE V6.53.4

ROOT-CAUSE-FIX

Die Diagnose zeigte:
- Kandidaten vorhanden
- freie Felder vorhanden
- INSERT meldet 0 Zeilen

Ursache:
terrain_guard_v619 ist ein BEFORE INSERT Trigger auf explored_fields.
Menschen stehen in discovered_by.
Bots stehen in discovered_by_bot_id und haben discovered_by=NULL.

Der alte Trigger rief deshalb für Bots:
terrain_access_allowed_v619(game_id, NULL, x, y)
auf und verworf die Bot-Zeile mit RETURN NULL.

V6.53.4
- Terrain-Trigger erkennt Bot-Felder separat.
- Er liest die Techs des Bots.
- Wald benötigt ter2.
- Wasser benötigt ter4.
- Feuchtgebiet benötigt ter5.
- Industrie/Sondergebiet benötigt ter6.
- ter7 erlaubt alles.
- Menschenlogik bleibt unverändert.

INSTALLATION
1. supabase/v6_53_4_migration.sql EINMAL ausführen.
2. V6.53.4 deployen.
