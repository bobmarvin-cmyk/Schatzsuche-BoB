SCHATZSUCHE ONLINE V6.50

BOT-ARCHITEKTUR 2.0

Das bisherige Bot-System wurde grundlegend geändert.

VORHER
- Bots bekamen künstliche Suchleistung.
- Schatzfunde wurden teilweise statistisch simuliert.
- Bot-Anteile und normale Spieler-Siegerlogik konnten auseinanderlaufen.
- Dadurch konnte z. B. ein Mensch mit 0,00 % als Sieger erscheinen, obwohl Bots Schatzanteile besaßen.

JETZT
1. ECHTE ZÜGE
- Jeder Bot besitzt moves_left und last_regen_at.
- Züge regenerieren wie bei Menschen.
- Zugspeicher-Technologien erhöhen die Kapazität.
- Regenerations-Technologien verkürzen die Zugzeit.

2. VOLLGAS WENN SPIELER ONLINE
- Ist mindestens ein echter Spieler aktiv, spielt jeder Bot ALLE verfügbaren Züge.
- Keine künstlichen Power- oder Catch-up-Multiplikatoren mehr notwendig.

3. SPARMODUS OHNE SPIELER
- Wenn niemand aktiv ist, wird nur ein einstellbarer Prozentsatz der verfügbaren Bot-Züge verbraucht.
- Standard: 10 %.
- Dadurch bleiben leere Spiele lebendig, ohne alleine durchzulaufen.

4. ECHTE FELDSUCHE
- Ein Bot-Zug sucht eine zusammenhängende Fläche um einen echten Zielpunkt.
- Anzahl der Felder entspricht seiner reveal_power.
- Terrain-Technologien werden berücksichtigt.
- Aufgedeckte Felder landen normal in explored_fields und damit in der Karten-/Chunkdarstellung.

5. ECHTE SCHATZFELDER
- Keine statistischen Schatztreffer mehr.
- Ein Bot kann einen Schatz nur finden, wenn sein echter Suchbereich das Schatzfeld trifft.
- Bei erfolgreicher Sicherung wird dieses konkrete Feld is_treasure=true.
- Bot-Name und Schatzanteil erscheinen in der Schatzanzeige.
- Scheitert die Bot-Sicherung, wird der Schatz wie bei Menschen neu versteckt.

6. TECHNOLOGIEN
- Vor der Suche und nach jedem Zug kauft ein Bot alle aktuell bezahlbaren und freigeschalteten Technologien.
- Voraussetzungsketten werden berücksichtigt.
- Suchleistung, Zugspeicher, Regeneration, Talerbonus, Analyse und Maschinenwerte werden aus dem Techstand berechnet.
- Exklusive Technologien können auch Bots sichern.

7. GEMEINSAME SIEGERLOGIK
- Menschliche Spieler und Bots werden nach Schatzanteil gemeinsam verglichen.
- Bei Gleichstand zählt zunächst die Zahl der Schatzteile.
- Ein Mensch mit 0,00 % gewinnt nicht mehr gegen einen Bot mit echtem Schatzanteil.
- Auch wenn ein Mensch den letzten Schatz sichert, werden vorhandene Bot-Anteile bei der Siegerermittlung berücksichtigt.

SCHALTZENTRALE
Bot-Regeln sind wieder einfacher:
- Mitspieler je Spiel
- Sparmodus ohne echte Spieler (%)
- Schatzsicherungsquote
- optional reale durchschnittliche Sicherungsquote

NEWS
- V6.50-Vorlage wurde ergänzt.

FELD-DECKKRAFT
- Die persönliche 10–100-%-Einstellung aus V6.49.1 bleibt erhalten.

INSTALLATION
1. supabase/v6_50_migration.sql EINMAL ausführen.
2. V6.50 deployen.
