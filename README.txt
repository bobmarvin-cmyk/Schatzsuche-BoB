SCHATZSUCHE ONLINE V6.53.5

WARUM BOTS TROTZ FUNKTIONIERENDEM INSERT NUR 0–2 FELDER SCHAFFTEN

Menschen:
- Karte lädt Vektordaten
- Terrain wird clientseitig klassifiziert
- Feld wird danach aufgedeckt

Bots:
- kein Browser-Kartenclient
- viele Felder besitzen keinen game_terrain_cells-Eintrag
- Terrain-Trigger blockierte diese Felder

V6.53.5
- fehlende Terrain-Klassifikation gilt für Bots vorläufig als offenes Gelände
- bekannte Terrainwerte werden weiterhin korrekt gesperrt:
  Wald ter2
  Wasser ter4
  Feuchtgebiet ter5
  Industrie/Sondergebiet ter6
  ter7 alles

Menschen bleiben unverändert streng terrainbasiert.

INSTALLATION
1. supabase/v6_53_5_migration.sql EINMAL ausführen.
2. V6.53.5 deployen.
