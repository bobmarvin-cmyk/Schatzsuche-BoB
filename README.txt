SCHATZSUCHE ONLINE V6.53.1

DIAGNOSE AUS V6.53
Die Bot-Engine lief, aber einzelne Bots meldeten z. B.:
- 34 Simulationsläufe
- 1 virtueller Zug
- 0 geöffnete Felder

Damit war klar: Nicht Timer oder RPC waren das Problem, sondern die Feldkandidatensuche.

V6.53.1
- lokale Bot-Suche wird deterministisch als Rasterfenster um das Ziel aufgebaut
- zusätzlich globaler Fallback für freie Felder
- bei 0 geöffneten Feldern wird KEINE virtuelle Zeit mehr verbraucht
- bei 0 Feldern wird das Ziel verworfen
- Diagnose schreibt bei Stillstand:
  Kandidaten=X, frei=Y, bereits=Z, Terrain=T

INSTALLATION
1. supabase/v6_53_1_migration.sql EINMAL ausführen.
2. V6.53.1 deployen.
