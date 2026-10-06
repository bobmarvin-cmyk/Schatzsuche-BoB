# BoBs Schatzsuche – PROJECT_STATE

Aktueller verbindlicher Stand: V6.61.2

Diese Datei beschreibt den SOLLZUSTAND des Projekts.
Neue Releases bauen immer auf der unmittelbar vorherigen Version auf.
Eine Funktion gilt als vorhanden, bis Marvin ausdrücklich ihre Entfernung verlangt.

## Spielkern
- Reale Weltkarte mit Rasterfeldern.
- Schatzteile werden serverseitig bereits bei Spielbeginn fest auf Felder gelegt.
- Schatzpositionen werden nicht nachträglich absichtlich nach hinten verschoben.
- Mehrteilige Schatzspiele enden erst, wenn alle Teile vergeben/geborgen sind.
- Gewinner ist nach aktueller Regel der größte Schatzanteil.
- Spieltypen: Schatzsuche, Goldgame, Sponsorspiel.
- 3 Sekunden Zugzeit ist als Mindestoption zulässig.
- Technologien, Maschinen, Fallen, Analyse, Gimmicks und Terrain-Technologien bleiben Bestandteil.

## Karte / Performance
- MapLibre/OpenFreeMap + Satellitenansicht.
- Chunk-/Canvas-Darstellung für große Karten.
- Feld-Deckkraft lokal einstellbar.
- Keine unnötigen flächigen DB-Loads alter Kartenlogik wieder einführen.

## Terrain
- Wald: ter2 oder ter7.
- Wasser: ter4 oder ter7.
- Feuchtgebiet: ter5 oder ter7.
- Industrie/Restricted: ter6 oder ter7.
- ter7 umgeht Terrain-Sperren.
- Bekannte Terrain-Klassifizierung gilt auch für Bots.
- Unklassifiziertes Terrain ist für Bots vorläufig offen, bis eine serverseitige Klassifizierungslösung existiert.
- Diese Ausnahme darf nicht versehentlich als generelle Terrain-Freigabe interpretiert werden.

## Bots – öffentlich
- Bots werden öffentlich wie normale Spieler dargestellt.
- Nie öffentlich als „Bot“ markieren.
- Keine Bot-Icons mehr anzeigen.
- Profile/Statistiken dürfen wie bei normalen Spielern anklickbar sein.

## Bots – Verhalten
- Bots suchen lokal, nicht global verstreut.
- Kein Rückfall zum alten globalen Scatter-Fallback.
- Suchgebiete dürfen organisch, fleckig und leicht wandernd sein.
- Botanzahl pro Spiel wird einmal zufällig aus Min/Max gewählt und bleibt für die Runde stabil.
- Bot-Beitrittsverzögerung bleibt erhalten.
- Aktives und passives Tempo bleiben getrennt steuerbar.
- Passivspiel läuft serverseitig weiter.
- Suchleistung und Spieltempo bleiben steuerbar.
- Schatzbergung verwendet für alle Bots die globale Bergungswahrscheinlichkeit; individuelle Suchschwierigkeit verändert nicht die Bergungswahrscheinlichkeit.
- Bot-only-Runden ohne echte menschliche Aktivität werden nicht in der Hall of Fame gespeichert.

## Lobby / Lebenszyklus
- „Neues Spiel erstellen“ bleibt deutlich hervorgehoben.
- Mobile Spieltyp-Labels stehen sauber oberhalb des Spielnamens.
- „Felder/min“ bleibt aus der Lobby-Spieleübersicht entfernt.
- „Nächstes Spiel“ heißt nicht „Nächstes Game“.
- Beendete/geschlossene Spiele bleiben ungefähr 10 Minuten in den Live-Daten und werden danach bereinigt.
- Hall-of-Fame-Archive echter Runden bleiben erhalten.
- Reine Bot-only-Siege ohne echte menschliche Spielaktivität werden nicht archiviert.

## Auto-Games
- Einladevorlauf bleibt erhalten.
- Bots sammeln während des Vorlaufs keine virtuelle Vorlaufzeit.
- Zufallsorte verwenden den erweiterten globalen Pool aus Städten, kleineren Orten, Landmarken, Inseln und Naturzielen.
- Derselbe Zufallsort soll möglichst 30 Tage nicht wiederholt werden.
- Zufallsnamen werden aus dem editierbaren Namenspool der Schaltzentrale erzeugt.
- Namenspool und Bot-Min/Max werden ab V6.61.2 über project_runtime_config_v661 kanonisch persistiert.

## Aufholausgleich
- Neueinsteiger können einen einstellbaren Prozentsatz der seit Spielstart theoretisch verpassten Züge erhalten.
- Rückkehrer können nach Mindest-Abwesenheit einen einstellbaren Prozentsatz verpasster Züge erhalten.
- Maximaler Aufholbonus ist konfigurierbar.
- Standardwerte: 50 % / 50 % / 10 Minuten / 500 Züge.
- Aufholzüge dürfen den normalen Zugspeicher überschreiten.
- Normale Regeneration darf Aufhol-Überhang nicht abschneiden.
- Präsenz wird serverseitig verfolgt.

## Energieanzeige
- Zugvorrat wird zusätzlich als Energie-/Mana-Balken dargestellt.
- Der Balken verwendet bereits geladene Daten und erzeugt keinen zusätzlichen Netzwerkverkehr.
- Aufholenergie oberhalb des normalen Caps wird erkennbar angezeigt.

## Zufallsnamen
- Editierbar in der Schaltzentrale.
- Persistieren dauerhaft.
- Auto-Games verwenden genau diesen Pool.
- Ab V6.61.2 ist project_runtime_config_v661 die kanonische Quelle.
- game_name_parts_v625 wird nur noch als Kompatibilitätsspiegel verwendet.

## Admin / Konfiguration
- Bot-Min/Max persistiert dauerhaft und springt nach Refresh nicht zurück.
- Ab V6.61.2 ist project_runtime_config_v661 die kanonische Quelle für Bot-Min/Max.
- Bestehende Masterwerte dürfen durch neue Releases nicht stillschweigend auf Defaults zurückgesetzt werden.

## Release-Regel
Vor jedem Release:
1. unmittelbar vorherige Version als Basis,
2. PROJECT_STATE.md lesen,
3. NON_NEGOTIABLES.md prüfen,
4. RELEASE_CHECKLIST.md abarbeiten,
5. release_check.py erfolgreich ausführen,
6. nur aktuelle Migration + setup.sql + aktuelles Supabase-README in den Release-Ordner,
7. .env.local niemals paketieren.
