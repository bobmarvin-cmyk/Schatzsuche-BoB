# BoBsSchatzsuche V7.0

V7.0 ist der erste große Versionssprung mit zwei getrennt weiterentwickelbaren Segmenten:

1. Schatzsuche – der bisherige komplette Spielkern bleibt erhalten.
2. Welt – neue permanente gemeinsame Grundstücks-/Rohstoff-/Handelsebene.

## V7.0 Welt-MVP
- einmaliger Weltzugang gegen konfigurierbares Gold
- gemeinsame Weltkarte
- 10×10-m-Grundstücke
- Terrainbasierte Rohstoffe
- serverseitige Lazy-Produktion
- Welt-Lager
- Welt-Taler
- Spieler-Verkaufsbörse
- eigene Welt-Schaltzentrale
- Konfliktdatenmodell vorbereitet, Kämpfe noch deaktiviert

## Zusätzlich
Der Zufallsnamen-Pool wird in V7.0 beim Speichern serverseitig hart verifiziert und zeigt den letzten Server-Speicherzeitpunkt in der Schaltzentrale.

## Installation
1. Voraussetzung: V6.61.2 installiert.
2. `supabase/v7_0_migration.sql` EINMAL ausführen.
3. V7.0 deployen.
4. `setup.sql` und ältere Migrationen NICHT erneut ausführen.
