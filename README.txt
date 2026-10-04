SCHATZSUCHE ONLINE V6.24.1 HOTFIX

ZWEI FEHLER BEHOBEN

1) BERGUNG
Ursache:
Anzeige-Code und erwartete Antwort wurden bisher getrennt gespeichert.
Bei alten/offenen Claims oder Versionswechseln konnten diese beiden Werte
auseinanderlaufen. Dann konnte ein Spieler die sichtbare Aufgabe korrekt
lösen und der Server trotzdem gegen einen anderen challenge_code prüfen.

V6.24.1:
- challenge_payload.display_code ist die einzige Quelle der Wahrheit.
- Der Server berechnet beim Absenden aus display_code + challenge_type
  die erwartete Lösung neu.
- Bestehende offene Memory-Claims werden einmalig synchronisiert.
- Alte Rechen-Claims werden beendet.
- Vorwärts und Rückwärts werden in der UI sehr deutlich beschriftet.
- Der Client entscheidet nie selbst über richtig/falsch.

2) TECHNOLOGIEN
Ursache:
Die V6.24-Spielseite fragte trap_place_cost als neue Tabellenspalte direkt ab.
Wenn diese Spalte/PostgREST-Schema noch nicht verfügbar war, lieferte die
gesamte Technologieabfrage einen Fehler. Dieser Fehler wurde bisher ignoriert
und die UI setzte technologies=[].

V6.24.1:
- neue RPC get_active_technologies_v6241()
- Fehler werden nicht mehr still verschluckt
- zusätzlicher Client-Fallback auf die alte Technologiespaltenliste
- trap_place_cost wird sicher mit IF NOT EXISTS ergänzt

INSTALLATION
1. ZIP-Inhalt in GitHub ersetzen.
2. Supabase SQL Editor:
   NUR supabase/v6_24_1_hotfix.sql
   einmal ausführen.
3. Keine alte Migration erneut ausführen.
4. Vercel deployen lassen.
5. Version V6.24.1 prüfen.
