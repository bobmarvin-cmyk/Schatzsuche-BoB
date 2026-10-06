SCHATZSUCHE ONLINE V6.61.2

Dies ist bewusst ein Stabilitätsrelease.

FEHLERBEHEBUNG
1. Zufallsnamen-Pool:
   Ab V6.61.2 existiert eine einzige kanonische Speicherquelle.
   Speichern, erneutes Laden und Auto-Game-Generierung lesen denselben Stand.

2. Bot-Min/Max:
   Die Range wird ebenfalls kanonisch gespeichert.
   Admin-Laden und reale Bot-Verteilung lesen denselben Stand.

SCHUTZ VOR REGRESSIONEN
- PROJECT_STATE.md dokumentiert den aktuellen Sollzustand.
- NON_NEGOTIABLES.md enthält Regeln, die nicht stillschweigend entfernt werden dürfen.
- RELEASE_CHECKLIST.md ist vor jedem neuen Release abzuarbeiten.
- release_check.py muss vor Ausgabe eines neuen ZIP erfolgreich sein.

INSTALLATION
1. supabase/v6_61_migration.sql EINMAL ausführen.
2. V6.61.2 deployen.
3. setup.sql und ältere Migrationen NICHT erneut ausführen.
