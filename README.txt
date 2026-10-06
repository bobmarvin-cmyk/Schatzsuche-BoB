SCHATZSUCHE ONLINE V6.56

BOTS – STEUERUNG
- Bot-Icons sind aus Spiel, Profil, Archiv und Schaltzentrale entfernt.
- Spieltempo (%) wirkt jetzt direkt auf die Zeit pro Bot-Zug.
  50 % = ungefähr doppelte Zeit pro Zug.
  100 % = normales Bot-Tempo.
- Suchleistung (%) wirkt direkt auf die Felder pro Zug.
  Standard nach Update: 65 %.
- Individuelle Schwierigkeit wirkt zusätzlich:
  locker ≈ 75 % Suchfaktor
  normal = 100 %
  aktiv ≈ 120 %
- Max. Züge/Lauf und Max. Felder/Lauf bleiben harte Obergrenzen.

BOT-BEITRITTSVERZÖGERUNG
- Neue Einstellung „Bot-Beitritt nach (Minuten)“.
- Bei sofort startenden Spielen zählt die Zeit ab Spielerstellung.
- Bei Spielen mit Einladevorlauf zählt sie ab dem eigentlichen Startzeitpunkt.
- Vor Ablauf der Verzögerung erscheinen die Bots noch nicht als Teilnehmer.

PASSIVBETRIEB
- „Passivtempo ohne Spieler (%)“ ist jetzt echte Zeitstreckung.
- Beispiel: 10 % bedeutet ungefähr zehnfache Zeit pro Zug.
- Server-Cron simuliert aktive Standardspiele einmal pro Minute, auch ohne offenen Browser.

MOBILE UI
- GOLDGAME / SCHATZSUCHE / SPONSORSPIEL Labels auf Spielkarten stabilisiert.
- „Nächstes Game“ heißt jetzt „Nächstes Spiel“.

ZUFALLSKARTEN
- Neuer Pool mit über 130 Orten weltweit.
- Mischung aus Großstädten, kleineren Städten, Sehenswürdigkeiten, Inseln und Naturzielen.
- Kürzlich verwendete Orte werden für 7 Tage bevorzugt vermieden.

INSTALLATION
1. supabase/v6_56_migration.sql EINMAL ausführen.
2. V6.56 deployen.
3. Keine ältere Migration erneut ausführen.
4. setup.sql auf bestehender DB NICHT erneut ausführen.
