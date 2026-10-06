# BoBsSchatzsuche – PROJECT_STATE

Aktueller verbindlicher Stand: V7.0

V7 ist die gemeinsame Weiterentwicklung der bisherigen Schatzsuche.
Die bestehende Schatzsuche bleibt vollständig erhalten und weiterhin separat weiterentwickelbar.
Die neue permanente „Welt“ ist ein zusätzliches Segment mit eigener Datenbasis und eigener Schaltzentrale.

## Versionslinie
- Letzter stabiler V6-Stand: V6.61.2.
- V7.0: Start der permanenten gemeinsamen Welt.
- Neue V7-Releases dürfen Schatzsuche und Welt unabhängig voneinander erweitern.
- Eine Änderung in einem Segment darf das andere Segment nicht stillschweigend beschädigen.

## Schatzsuche – bestehender Kern
- Reale Weltkarte mit Rasterfeldern.
- Schatzteile werden serverseitig bereits bei Spielbeginn fest auf Felder gelegt.
- Schatzpositionen werden nicht nachträglich absichtlich nach hinten verschoben.
- Mehrteilige Schatzspiele enden erst, wenn alle Teile vergeben/geborgen sind.
- Gewinner ist nach aktueller Regel der größte Schatzanteil.
- Spieltypen: Schatzsuche, Goldgame, Sponsorspiel.
- 3 Sekunden Zugzeit ist als Mindestoption zulässig.
- Technologien, Maschinen, Fallen, Analyse, Gimmicks und Terrain-Technologien bleiben Bestandteil.
- MapLibre/OpenFreeMap + Satellitenansicht.
- Chunk-/Canvas-Darstellung für große Karten.
- Feld-Deckkraft lokal einstellbar.

## Schatzsuche – Terrain
- Wald: ter2 oder ter7.
- Wasser: ter4 oder ter7.
- Feuchtgebiet: ter5 oder ter7.
- Industrie/Restricted: ter6 oder ter7.
- ter7 umgeht Terrain-Sperren.
- Bekannte Terrain-Klassifizierung gilt auch für Bots.
- Unklassifiziertes Terrain ist für Bots vorläufig offen, bis eine serverseitige Klassifizierungslösung existiert.

## Schatzsuche – Bots
- Bots werden öffentlich wie normale Spieler dargestellt.
- Nie öffentlich als „Bot“ markieren.
- Keine Bot-Icons mehr anzeigen.
- Profile/Statistiken dürfen wie bei normalen Spielern anklickbar sein.
- Bots suchen lokal, nicht global verstreut.
- Kein Rückfall zum alten globalen Scatter-Fallback.
- Suchgebiete dürfen organisch, fleckig und leicht wandernd sein.
- Botanzahl pro Spiel wird einmal zufällig aus Min/Max gewählt und bleibt für die Runde stabil.
- Bot-Beitrittsverzögerung bleibt erhalten.
- Aktives und passives Tempo bleiben getrennt steuerbar.
- Passivspiel läuft serverseitig weiter.
- Bot-only-Runden ohne echte menschliche Aktivität werden nicht in der Hall of Fame gespeichert.

## Schatzsuche – Lobby/Lebenszyklus
- „Neues Spiel erstellen“ bleibt deutlich hervorgehoben.
- Mobile Spieltyp-Labels stehen sauber oberhalb des Spielnamens.
- „Felder/min“ bleibt aus der Lobby-Spieleübersicht entfernt.
- „Nächstes Spiel“ bleibt so benannt.
- Beendete/geschlossene Spiele bleiben ungefähr 10 Minuten in den Live-Daten und werden danach bereinigt.
- Hall-of-Fame-Archive echter Runden bleiben erhalten.

## Schatzsuche – Auto-Games
- Einladevorlauf bleibt erhalten.
- Bots sammeln während des Vorlaufs keine virtuelle Vorlaufzeit.
- Zufallsorte verwenden den erweiterten globalen Ortspool.
- Derselbe Zufallsort soll möglichst 30 Tage nicht wiederholt werden.
- Zufallsnamen werden aus dem editierbaren Namenspool der Schaltzentrale erzeugt.
- Namenspool ist serverseitig persistent und ab V7.0 nach dem Speichern verifizierbar.

## Schatzsuche – Aufholausgleich
- Neueinsteiger und Rückkehrer können konfigurierbare Aufholzüge erhalten.
- Aufholzüge dürfen den normalen Zugspeicher überschreiten.
- Normale Regeneration darf Aufhol-Überhang nicht abschneiden.
- Präsenz wird serverseitig verfolgt.
- Zugvorrat wird zusätzlich als Energie-/Mana-Balken dargestellt.
- Der Balken erzeugt keine zusätzlichen Requests.

# V7 – WELT

## Grundidee
- Eine einzige permanente gemeinsame Weltkarte für alle Spieler.
- Welt ist ein zusätzliches Segment; Schatzsuche bleibt unabhängig weiterentwickelbar.
- Weltzugang kann einmalig Gold kosten.
- V7.0 Standard: 100 mg Gold (= 0,1 g).
- Nach Freischaltung gilt der Zugang dauerhaft für den Account.

## Grundstücke
- Globales Web-Mercator-Raster.
- Standardgröße: 10 × 10 m.
- Grundstücke werden nicht global vorab gespeichert; Datensätze entstehen erst beim Kauf.
- Freie Felder können gekauft werden.
- Standardlimit: 100 Grundstücke pro Spieler.
- Standardpreis: 10 Welt-Taler.
- Welt-Taler sind in V7.0 bewusst von Rundentalern der Schatzsuche getrennt.
- Weltzugang gibt ein konfigurierbares Startguthaben Welt-Taler.
- Kauf erhält eine Schutzfrist.

## Terrain / Rohstoffe
- Terrain eines gekauften Feldes wird aus der sichtbaren Kartenklassifizierung übernommen.
- V7.0 Hauptterrain: Wald, Acker, Grünland, Wasser, Feuchtgebiet, Fels, Industrie, Gewerbe, Wohnen, Park, Sand, Verkehr, Offen.
- Ressourcen: Holz, Harz, Nahrung, Pflanzen, Wasser, Fisch, Stein, Erz, Schrott, Metall.
- Produktionsraten werden in world_resource_rates_v70 administriert.
- Grundstück-Level multipliziert V7.0 Produktion um +25 % je Level.
- Mischterrain ist im Datenmodell vorgesehen; V7.0 speichert beim Kauf zunächst den erkannten Haupttyp.

## Produktion
- Globaler konfigurierbarer Produktionstick, Standard 60 Minuten.
- Keine ständigen Cron-Gutschriften je Feld.
- Produktion wird serverseitig lazy anhand verstrichener voller Ticks berechnet.
- Dadurch entstehen keine permanenten Millionen Schreibvorgänge.

## Lager
- Jeder Weltspieler besitzt ein serverseitiges Rohstoffinventar.
- V7.0 hat noch kein hartes Lagerlimit.

## Börse
- V7.0 enthält echte Spieler-Verkaufsorders.
- Rohstoffe werden beim Einstellen der Verkaufsorder reserviert.
- Andere Spieler können Teilmengen kaufen.
- Verkäufer erhält Erlös abzüglich Börsengebühr.
- Restmengen können storniert und ins Lager zurückgegeben werden.
- Standardgebühr: 2 %.
- Preis entsteht durch Spielerangebote; keine künstlichen Festpreise.
- Vollständiges Bid/Ask-Orderbuch mit Kauforders kann später ergänzt werden.

## Konflikte
- Datenmodell und Admin-Balancing sind in V7.0 vorbereitet.
- Geschicklichkeitsduell wird noch nicht automatisch ausgetragen.
- Standardidee: Herausforderung, Reaktionsfrist, Skill-Spiel, Schutzzeiten.
- Kein Pay-to-Win-Kampf.
- Schutz nach Kauf: Standard 7 Tage.
- Schutz nach Konflikt: Standard 7 Tage.
- Unangreifbarer Mindestbesitz: Standard 10 Grundstücke.
- Standard max. 3 Angriffe/Tag.
- Konflikte sind in V7.0 standardmäßig deaktiviert, bis das Geschicklichkeitsspiel umgesetzt ist.

## Welt-Schaltzentrale
Eigene Route /admin/welt.
Konfigurierbar:
- Welt an/aus
- Weltzugang Gold
- Startguthaben
- Grundstückspreis
- Besitzlimit
- Produktionstick
- Rohstoffraten
- Börsengebühr
- offene Orders
- Konfliktparameter

## Technische Trennung
V7.0 eigene Tabellen:
- world_settings_v70
- world_resource_rates_v70
- world_access_v70
- world_wallets_v70
- world_inventory_v70
- world_parcels_v70
- world_orders_v70
- world_trades_v70
- world_conflicts_v70

Gemeinsam bleiben:
- Auth
- profiles
- gold_wallets / Goldsystem

## Release-Regel
Vor jedem Release:
1. unmittelbar vorherige Version als Basis,
2. PROJECT_STATE.md lesen,
3. NON_NEGOTIABLES.md prüfen,
4. RELEASE_CHECKLIST.md abarbeiten,
5. release_check.py erfolgreich ausführen,
6. Schatzsuche-Regressionen UND Welt-Regressionen prüfen,
7. nur aktuelle Migration + setup.sql + aktuelles Supabase-README,
8. .env.local niemals paketieren.
