SCHATZSUCHE ONLINE V6.34

NEU / KORRIGIERT

1. TALERFALLEN SKALIEREN
- Talerfallen ziehen keinen festen Betrag mehr ab.
- trap_power bedeutet bei Talerfallen jetzt Prozent vom aktuellen Talerbestand.
- Standard Talerfalle: 10 %
- Schwere Sabotagefalle: 25 %
- Der Prozentwert kann in der Schaltzentrale geändert werden.
- Dadurch bleibt die Falle im frühen und späten Spiel relevant.
- Talerbestand fällt durch die Falle nicht unter 0.
- Fallenereignis nennt Prozent und tatsächlich verlorene Taler.

2. ENTWICKLUNGSBAUM
- Kaufbare Entwicklungen bleiben oben.
- Der Baum darunter wurde stark vereinfacht.
- Keine großen Tech-Karten mehr im Baum.
- Jeder Zweig ist eine dezente horizontale Entwicklungslinie.
- Kleine Stufen zeigen:
  ✓ erforscht
  gold = aktuell erreichbar
  gedimmt = später
- Namen stehen kompakt direkt an der Stufe.
- Auf Mobilgeräten bleiben die Zweige schmal und horizontal scrollbar.

3. HINWEIS-STANDORT REPARIERT
- analysis_clues_v621 speicherte focus_x/focus_y bereits.
- V6.32 lieferte diese Werte nur nicht an den Client.
- V6.33 liest den tatsächlichen Suchstandpunkt direkt aus dem Hinweis.
- Neue Hinweise werden zusätzlich zuverlässig in der Positionstabelle gespiegelt.
- „📍 Standort zeigen“ markiert damit auch neu gekaufte Hinweise korrekt.
- Viele bereits vorhandene ältere V6.21+-Hinweise können ebenfalls wieder einen Standort haben.

4. POPUPS NICHT MEHR BEIM WIEDEREINTRITT
- Beim Betreten eines Spiels wird der aktuelle Ereignisstand als Baseline gesetzt.
- Alte Fallen-/Schatz-/Technologieereignisse bleiben im Changelog sichtbar.
- Sie werden aber NICHT erneut als Popup abgespielt.
- Nur Ereignisse, die nach dem Eintritt neu entstehen, erzeugen Popups.

5. DESIGN-POLISH
- Ruhigere Panels und weniger starke Rahmen.
- Buttons konsistenter und weniger „Standard-Webapp“.
- Entwicklungsbereich deutlich dezenter.
- Changelog wirkt mehr wie ein Log und weniger wie eine Kartenwand.
- Suchzentrale etwas ruhiger.
- Bestehende dunkle Expeditions-/Gold-Identität bleibt erhalten.

DEPLOY
1. supabase/v6_33_migration.sql EINMAL ausführen.
2. Projektdateien ins Repo übernehmen.
3. .env.local nicht hochladen.
4. Vercel deployen lassen.


V6.34 – TECHNOLOGIEN-UI
- Bereich wieder in „Technologien“ umbenannt.
- Untertitel „Oben deine nächsten Entscheidungen …“ entfernt.
- Neuer Stil nach Vorbild klassischer Strategiespiel-/Forschungstabs:
  - Branch-Tabs oben
  - aktuell gewählter Zweig im Fokus
  - aktuell verfügbare Technologien kompakt darüber
  - darunter ein klarer Technologiestrang in Spalten nach Stufen
- Kein neues SQL nötig, wenn V6.33 bereits vollständig installiert ist.
