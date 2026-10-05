SCHATZSUCHE ONLINE V6.40

BOTS – ÜBERARBEITUNG

1. BOTS IN NORMALEN SCHATZSUCHE-SPIELEN
- Bots sind nicht mehr auf automatisch erzeugte Spiele beschränkt.
- Neue normale Schatzsuchspiele erlauben Bots standardmäßig.
- Beim Erstellen gibt es die Option:
  „🤖 Bots sperren“
- Ist sie aktiviert, dürfen in dieser Runde keine Bots mitspielen.
- Goldgames und Sponsorspiele bleiben immer botfrei.
- Bereits laufende normale Schatzsuchspiele werden beim V6.40-Update einmalig
  mit Bots aufgefüllt, sofern sie nicht gesperrt sind.

2. BOT-AKTIVITÄT
- Client stößt den Bot-Tick häufiger an.
- Der Server entscheidet weiterhin, wann die nächste Aktion wirklich fällig ist.
- Dadurch entsteht kaum unnötige Datenbankarbeit.
- Bot-Fehler werden nicht mehr komplett verschluckt.
- Der Server speichert den letzten Bot-Fehler zur Diagnose.
- Leere Spiele können weiterhin über den vorhandenen Bot-Welt-Tick laufen.

3. ONLINE-STATUS
- Bots werden wie Teilnehmer mit Online-/Offline-Status dargestellt.
- „online“ basiert auf ihrer letzten Bot-Aktion.
- Nach längerer Inaktivität wechseln sie automatisch auf offline.

4. INDIVIDUELLE ICONS
- Jeder Bot hat ein eigenes Emoji/Icon.
- Standardbots erhalten unterschiedliche Icons.
- In der Schaltzentrale kann das Icon frei geändert werden.
- Neue Bots bekommen ebenfalls ein wählbares Icon.
- Icon erscheint in Teilnehmerliste, Ranking und Bot-Profil.

5. SCHALTZENTRALE
- Bot-Name
- Bot-Icon
- Farbe
- Schwierigkeit
- Aktivstatus
- laufende Standardspiele: Bots erlauben / Bots sperren

INSTALLATION
1. supabase/v6_40_migration.sql EINMAL ausführen.
2. Dateien deployen.
3. Kein anderes SQL erneut ausführen.
