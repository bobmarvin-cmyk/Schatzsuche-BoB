# BoBsSchatzsuche – PROJECT_STATE

Aktueller verbindlicher Stand: V7.2

V7 ist die gemeinsame Weiterentwicklung der bestehenden Schatzsuche plus der permanenten Welt. Beide Segmente bleiben getrennt weiterentwickelbar.

## Versionslinie
- Letzter stabiler V6-Rückfallstand: V6.61.2.
- V7.0: permanente Welt gestartet.
- V7.1: Satellitenwelt, Mehrfachauswahl, Grundstücksfarben/Bilder, Weltwirtschaft nur in mg Gold, Goldspiele 24h sichtbar.
- V7.2: Base/Zweitwohnsitze, verbundene Erschließung, Sammelkapazität, Grundstücksformen.

## Schatzsuche – unverändert zu schützen
- Bestehender Spielkern bleibt vollständig erhalten und weiterentwickelbar.
- Schatzpositionen werden bei Spielstart serverseitig festgelegt.
- Bots bleiben lokal; kein globaler Scatter-Fallback.
- Bekannte Terrain-Gates gelten auch für Bots: ter2/ter4/ter5/ter6/ter7.
- Bots werden öffentlich nicht als Bots markiert und ohne Bot-Icons dargestellt.
- Bot-Min/Max, Join-Verzögerung und passives Botspiel bleiben erhalten.
- Bot-only-Runden ohne echte menschliche Aktivität kommen nicht in die Hall of Fame.
- Aufholausgleich darf den normalen Energiespeicher überschreiten.
- Energieanzeige erzeugt keine zusätzlichen Netzwerkrequests.
- Standard-/Sponsorspiele bleiben nach Ende ungefähr 10 Minuten live sichtbar.
- Goldspiele bleiben nach Ende 24 Stunden unter geschlossenen Spielen sichtbar.
- Auto-Game-Zufallsnamen kommen aus dem persistenten editierbaren Namenspool.

# V7 – WELT

## Grundprinzip
- Eine gemeinsame permanente Weltkarte für alle Spieler.
- Standardkarte Satellit; Vektor-/Terrainwerte bleiben unsichtbar im Hintergrund aktiv.
- Weltwirtschaft verwendet ausschließlich mg Gold aus `gold_wallets`.
- Keine separate Welt-Taler-Währung mehr.
- Grundstücksgröße Standard 10 × 10 m.
- Die Erde wird nicht vollständig als Grundstückstabelle vorab angelegt.

## Zugang und Base
- Weltzugang kann einmalig Gold kosten.
- Nach Freischaltung setzt der Spieler seine erste Base selbst auf ein freies Grundstück.
- Das Base-Grundstück kostet nichts.
- Die Base ist das primäre Zuhause und der erste Erschließungsanker.
- Beim Öffnen der Welt zoomt die Karte auf die eigene Base.
- Bestehende V7.1-Spieler mit Grundstücken bekommen ihr ältestes Grundstück automatisch als Base.

## Zweitwohnsitze
- Spieler können zusätzliche Zweitwohnsitze auf freien Feldern gründen.
- Ein Zweitwohnsitz darf unabhängig vom bestehenden Grundstücksnetz gesetzt werden und eröffnet einen neuen Erschließungsanker.
- Der erste Zweitwohnsitz kostet einen konfigurierbaren Goldbetrag.
- Jeder weitere Zweitwohnsitz wird um einen konfigurierbaren Goldbetrag teurer.
- Standard: 50 mg erster Zweitwohnsitz, +50 mg je weiterem.

## Erschließung / Verbindung
- Normale Grundstücke dürfen nur gekauft werden, wenn sie orthogonal an eigenes erschlossenes Gelände anschließen.
- Mehrfachkäufe dürfen als zusammenhängende Kette vom bestehenden Besitz aus erworben werden.
- Neue getrennte Gebiete können nur über einen Zweitwohnsitz begonnen werden.
- Diagonale Berührung allein zählt nicht als Verbindung.

## Grundstücksformen
Jedes Grundstück hat neben Terrain eine Nutzungsform:
- `production`: Produktionsfläche – erzeugt Rohstoffe.
- `compensation`: Ausgleichsfläche – Grundlage für spätere Umwelt-/Ausgleichsmechaniken.
- `trade`: Handelsfläche – Grundlage für spätere Handelsgebäude/-boni.
- `path`: Wegeparzelle – Erschließung und Verbindung.

Alle Formen zählen als eigene erschlossene Fläche. In V7.2 produzieren nur Produktionsflächen Rohstoffe.

## Grundstücksdarstellung / Personalisierung
- Jedes Grundstück besitzt eine eigene Farbe.
- Besitzer können Farben ändern.
- Grundstücksbilder können aus `world-parcel-art` hinterlegt werden.
- Bilder sind erst ab einer konfigurierbaren Zahl zusammenhängender eigener Grundstücke erlaubt; Standard 25.
- Base/Zweitwohnsitze sowie Grundstücksformen werden auf der Karte gekennzeichnet.

## Terrain / Rohstoffe
- Terrain wird beim Kauf aus der weiter aktiven Kartenklassifizierung übernommen.
- Hauptterrain: Wald, Acker, Grünland, Wasser, Feuchtgebiet, Fels, Industrie, Gewerbe, Wohnen, Park, Sand, Verkehr, Offen.
- Ressourcen: Holz, Harz, Nahrung, Pflanzen, Wasser, Fisch, Stein, Erz, Schrott, Metall.
- Produktionsraten sind administrierbar.

## Produktionsintervall und Sammelkapazität
- Der frühere sichtbare Begriff „Produktionstick“ heißt ab V7.2 `Produktionsintervall`.
- Standardintervall bleibt konfigurierbar (V7.1: 60 Minuten).
- Produktion wird weiterhin lazy serverseitig anhand verstrichener Intervalle berechnet.
- Jeder Spieler besitzt eine maximale Sammelkapazität in Produktionsintervallen.
- Nur bis zu dieser Kapazität können Rohstoffe vor dem Einsammeln angesammelt werden.
- Ältere Intervalle oberhalb der Kapazität verfallen beim nächsten Einsammeln.
- Sammelkapazität hat ein Skill-Level und kann gegen mg Gold erhöht werden.
- Standard: 24 Intervalle Basis, +12 Intervalle je Level, max. Level 20.
- Standard-Upgradekosten: 10 mg für Level 1, danach +10 mg je weiterem Level.
- Nur Produktionsflächen erzeugen Rohstoffe.

## Börse
- Spieler-Verkaufsorders bleiben erhalten.
- Rohstoffe werden beim Einstellen reserviert.
- Käufe/Verkäufe laufen ausschließlich über mg Gold.
- Gebühren sind administrierbar.

## Konflikte
- Datenmodell/Balancing vorbereitet.
- Kein Pay-to-Win.
- Konflikte bleiben deaktiviert, bis das Geschicklichkeitssystem umgesetzt ist.

## Welt-Schaltzentrale
Eigene Route `/admin/welt`. Konfigurierbar sind u. a.:
- Weltzugang
- Grundstückspreis
- Grundstückslimit
- Produktionsintervall
- Rohstoffraten
- Börsengebühr
- Bild-Personalisierungsschwelle
- Zweitwohnsitz-Grundpreis und Preissteigerung
- Sammelkapazität, Skill-Zuwachs, Upgradekosten und Max-Level
- Konfliktparameter

## Datenstrukturen
Zusätzlich zu V7.0/V7.1:
- `world_homes_v72`
- `world_access_v70.collection_level`
- `world_parcels_v70.parcel_use`

## Release-Regel
1. Immer unmittelbar vorherige Version als Basis.
2. PROJECT_STATE und NON_NEGOTIABLES vor Änderungen prüfen.
3. Schatzsuche und Welt separat auf Regressionen prüfen.
4. release_check.py muss erfolgreich sein.
5. Genau eine aktuelle Migration im Supabase-Releaseordner.
6. setup.sql nicht erneut ausführen.
7. `.env.local` und Geheimnisse niemals paketieren.
