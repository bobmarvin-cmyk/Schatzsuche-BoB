SCHATZSUCHE ONLINE V6.46

DIESES RELEASE ENTHÄLT V6.45.
Wenn dein produktiver Stand V6.44 ist, nur v6_46_migration.sql ausführen.

LOBBY-NEWS-VORLAGEN
In der Schaltzentrale unter „Lobby-News“ gibt es jetzt fertige Release-Vorlagen:
- V6.46
- V6.45
- V6.44
- V6.43

Mit „… übernehmen“ werden Titel, Kategorie und Text in den News-Editor geladen.
Danach lässt sich alles frei bearbeiten, kürzen oder ergänzen, bevor du veröffentlichst.

STARTGOLD → STARTBONUS
- Das bisherige Test-/Startgold heißt jetzt Startbonus.
- Der Bonus wird ganz normal im Gold-Wallet gutgeschrieben.
- Er kann innerhalb des Spiels verwendet werden.
- Solange niemand eine reale/physische Auszahlung anfragt, passiert nichts.
- Beim ERSTEN physischen Auszahlungswunsch wird der noch offene Startbonus einmalig
  aus dem frei verfügbaren Goldstaub zurückgeführt.
- Danach ist der Bonus erledigt und wird niemals erneut abgezogen.
- Reicht der freie Goldbestand zum Zurückführen des Bonus nicht aus, wird die
  Auszahlungsanfrage noch nicht angenommen. Das System zeigt den fehlenden Betrag.
- Digitale Barren bleiben weiterhin möglich; relevant wird der Bonus erst bei
  einer tatsächlichen physischen Auszahlung.

ANZEIGE
- Lobby zeigt, welcher Anteil des Wallets noch Startbonus ist.
- Profil zeigt enthaltenen Startbonus.
- Prämien-/Barrenseite erklärt den einmaligen Abzug vor physischer Auszahlung.

AUSSERDEM ENTHALTEN
- V6.45 gen_salt/pgcrypto Tutorial-Fix
- stärkeres Bot-/Mitspieler-Verhalten
- Such-Power Multiplikator und Aktivitäts-Boost

INSTALLATION
1. supabase/v6_46_migration.sql EINMAL ausführen.
2. V6.46 deployen.
3. V6.45 NICHT separat ausführen.
