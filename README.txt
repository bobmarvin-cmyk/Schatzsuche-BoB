SCHATZSUCHE ONLINE V6.21 – DEDUKTIONSSUCHE

VORAUSSETZUNG
V6.20.2 ist installiert.

INSTALLATION
1. ZIP-Inhalt in GitHub ersetzen.
2. Supabase -> SQL Editor.
3. NUR:
   supabase/v6_21_migration.sql
   einmal ausführen.
4. Alte Migrationen NICHT erneut ausführen.
5. Vercel deployen lassen.
6. Version V6.21 prüfen.

NEU: SCHATZPROFIL
Jedes offene Schatzteil besitzt serverseitig ein Profil aus realen/geometrischen Merkmalen:
- Karten-Sektor
- Quadrant
- Entfernung zum Kartenmittelpunkt
- Entfernung zur nächsten Spielfeldgrenze
- Terrain des Schatzfelds, sobald kartografisch bekannt
- Entfernung zu bekannten Wasserflächen
- Entfernung zu bekannten Waldflächen
- Entfernung zu bekannten Siedlungs-/Nutzflächen
- Entfernung zu bekannten Verkehrsflächen

Die exakte Schatzkoordinate wird dem Browser dabei nicht offengelegt.

NEU: PERSÖNLICHES HINWEISBUCH
Gekaufte Analysen werden dauerhaft pro Spieler und Schatzteil gespeichert.
Dadurch können Hinweise tatsächlich kombiniert werden.

ANALYSE-STUFEN
Stufe 1: Sektor + danach Grobpeilungen
Stufe 2: zusätzlicher Zentrumring
Stufe 3: Terrain bzw. Randlage
Stufe 4: präzisere Peilungen von selbst gewählten Suchpunkten
Stufe 5: Umgebung / bekannte Geodaten
Stufe 6: einmalige Präzisionszone; danach weitere Peilungen

WICHTIG
Feste Profilhinweise werden nicht endlos erneut verkauft.
Nach den verfügbaren einmaligen Profilinformationen erzeugen neue Analysen Peilungen
vom aktuellen, selbst gewählten Suchpunkt. Dadurch wird Triangulation zu einer
zentralen Spielerfähigkeit.

TERRAIN-DATEN
V6.21 nutzt die bereits vorhandenen Terrain-Klassifizierungen des Spiels.
Nicht kartierte Merkmale werden nicht erfunden. Wenn die Terrainlage des Schatzfelds
noch unbekannt ist, liefert die Analyse stattdessen eine sichere geometrische Randlage.

BERGUNG / NEUVERSTECKEN
Scheitert eine Bergungsprüfung und wird der Schatz neu platziert:
- altes Schatzprofil wird gelöscht
- alte Hinweise zu diesem Schatzteil werden gelöscht
- dafür bezahlte Taler werden den Spielern vollständig erstattet
- die neue Position erhält beim nächsten Analysieren ein neues Profil

WARUM DAS SPIELERISCH WICHTIG IST
Der optimale Ablauf ist nun:
Information beschaffen -> Hinweise kombinieren -> Messpunkte strategisch wählen ->
triangulieren -> Suchraum reduzieren -> Schatz entdecken -> Bergungsprüfung bestehen.

V6.21 ist damit bewusst als Deduktions-/Geschicklichkeitssystem aufgebaut.
Die rechtliche Einordnung realer Einsätze oder Auszahlungen bleibt trotzdem eine
separate rechtliche Frage und wird durch die Software allein nicht garantiert.
