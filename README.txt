SCHATZSUCHE ONLINE V6.47

TUTORIAL
- Fehler mit nicht vorhandener Spalte password_hash entfernt.
- Tutorial wird erst normal erstellt und danach serverseitig privat markiert.
- Keine Passwortspalte wird vorausgesetzt.

COMPUTER-SPIELER
Felder/min bleibt nur als Aktivitätsanzeige und steuert die Bots nicht mehr.

LEERLAUF:
- kein echter Spieler aktiv
- 1 Feld je Leerlauf-Aktion
- Standard 45 Sekunden
- keine aggressive Entwicklung

VOLLGAS:
- sobald ein echter Spieler die Runde geöffnet hat
- Bots werden sofort aufgeweckt
- Aktionszeit orientiert sich an regen_seconds des Spiels
- reveal_power/Techstand wird voll genutzt
- Such-Power-Multiplikator wirkt voll
- bis zu 3 bezahlbare Technologien pro Aktivität
- Ratio drosselt oder verstärkt

SCHALTZENTRALE
- Mitspieler je Spiel
- Vollgas-Ratio
- Such-Power Multiplikator
- Leerlauf-Aktion alle X Sekunden
- Schatzsicherungsquote
- Max. Felder/Aktion

V6.46 ebenfalls enthalten:
- Lobby-News-Vorlagen
- Startgold als rückzahlbarer Startbonus

INSTALLATION
1. supabase/v6_47_migration.sql EINMAL ausführen.
2. V6.47 deployen.
3. V6.45/V6.46 NICHT separat ausführen.
