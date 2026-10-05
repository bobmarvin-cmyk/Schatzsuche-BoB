SCHATZSUCHE ONLINE V6.42

BOT-AKTIVITÄT DEUTLICH ERHÖHT

Vorher:
- ein Bot wurde fällig
- machte effektiv einen kleinen Suchschritt
- danach längere Ruhe

Jetzt:
- Standardintervall: 12 Sekunden
- Standardmäßig 4 Suchimpulse pro fälligem Bot
- „locker“ etwas weniger
- „aktiv“ etwas mehr
- jeder Impuls nutzt die aktuelle reveal_power
- nach jedem Impuls kann direkt eine bezahlbare Technologie ausgebaut werden
- Schatzchance wird pro Suchimpuls geprüft

Schaltzentrale:
- „Aktion alle (Sekunden)“
- „Suchimpulse je Aktion“
- beide Werte frei einstellbar

Empfehlung für lebendige, aber nicht übertriebene Bots:
- 10–15 Sekunden
- 3–5 Suchimpulse

INSTALLATION:
1. supabase/v6_42_migration.sql einmal ausführen
2. V6.42 deployen
