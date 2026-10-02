SCHATZSUCHE ONLINE V6.8.2 – MOBILE/MULTIPLAYER MAP STABILITY

WARUM DIE KARTE HING
Bei hohen Technologie-Stufen werden inzwischen 1.000–2.000+ Felder pro Zug entdeckt.
Bis V6.8.1 hielt jeder Browser die komplette Feldhistorie im Speicher und baute bei
Änderungen daraus tausende einzelne GeoJSON-Polygone. Auf Smartphones kann das den
JavaScript-Hauptthread stark blockieren. Dann wirken Karte UND andere UI-Bereiche leer.

NEU IN V6.8.2
- Die Karte lädt NICHT mehr alle jemals entdeckten Felder.
- Es wird nur der aktuell sichtbare Kartenausschnitt aus Supabase geladen.
- Bei weitem Zoom fasst der Server viele Einzelzellen automatisch zu Anzeige-Blöcken zusammen.
- Ziel: grob nur wenige tausend Kartenpolygone gleichzeitig, unabhängig von der Gesamtspielgröße.
- Beim Hineinzoomen werden die Felder wieder genauer bis hin zu einzelnen Rasterzellen.
- Realtime-INSERTs von Mitspielern lösen nur noch einen gebündelten Reload des sichtbaren Ausschnitts aus.
- reveal_area_v682 gibt nicht mehr tausende Feldobjekte an den Browser zurück.
- games.explored_count speichert serverseitig die Gesamtzahl entdeckter Felder.
- Statement-Level-Trigger hält explored_count auch bei älteren Reveal-Funktionen aktuell.
- "Felder übrig" benötigt deshalb keine komplette Feldliste mehr.
- Karten-Ladeanzeige eingebaut.
- Wenn der normale Kartenstil nach einigen Sekunden nicht lädt, versucht der Client automatisch
  eine einfache OpenStreetMap-Rasterkarte als Fallback.

INSTALLATION
1. Inhalt dieser ZIP in das bestehende GitHub-Repository hochladen und vorhandene Dateien ersetzen.
2. Supabase > SQL Editor öffnen.
3. NUR supabase/v6_8_2_migration.sql EINMAL vollständig ausführen.
4. Vercel deployt automatisch.
5. Danach das laufende Testspiel auf dem iPhone neu öffnen.

WICHTIG
- V6.8.2 baut auf V6.8.1 / V6.8.1a auf.
- Die Migration führt einmalig eine Zählung vorhandener explored_fields durch, um explored_count
  für bestehende Spiele korrekt zu initialisieren.
- Bei weit herausgezoomter Karte ist die farbige Darstellung bewusst zusammengefasst. Beim
  Hineinzoomen wird sie präziser. Das ist Absicht und verhindert Browser-Freezes.
