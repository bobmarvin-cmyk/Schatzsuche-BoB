SCHATZSUCHE ONLINE V6.58

NEU: AUFHOLAUSGLEICH

Neue Spieler:
Ein einstellbarer Prozentsatz der theoretisch seit Spielstart verpassten Züge wird beim ersten tatsächlichen Betreten gutgeschrieben.

Rückkehrer:
Nach einer einstellbaren Mindest-Abwesenheit wird ein Prozentsatz der theoretisch während der Abwesenheit verpassten Züge gutgeschrieben.

Standardwerte:
- Neueinsteiger 50 %
- Rückkehrer 50 %
- Mindest-Abwesenheit 10 Minuten
- maximal 500 Bonuszüge

Beispiel:
60 Minuten Laufzeit, 10 Sekunden je Zug = 360 theoretische Züge.
Bei 50 % erhält ein Neueinsteiger 180 Aufholzüge.

TECHNIK
- Präsenz-Heartbeat alle 30 Sekunden während die Spielseite geöffnet ist.
- Bonus serverseitig und nur einmal pro Abwesenheitszeitraum.
- Bonuszüge dürfen den normalen Zugspeicher überschreiten.
- refresh_player_moves kappt diesen Überhang nicht.
- Gimmick-Zugboni zerstören vorhandene Aufholzüge ebenfalls nicht.

INSTALLATION
1. supabase/v6_58_migration.sql EINMAL ausführen.
2. V6.58 deployen.
