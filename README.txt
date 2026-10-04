SCHATZSUCHE ONLINE V6.24.4 – BERGUNGS-HOTFIX

FEHLER GEFUNDEN
V6.24.2 machte die Bergung nach mehreren Fehlversuchen absichtlich leichter:
ab Stufe 2 werden nur noch 5 Symbole verwendet.

In resolve_treasure_claim_v620 war aber noch eine alte Prüfung:
length(display_code) <> 6

Damit wurden 5-Symbol-Prüfungen serverseitig als inkonsistent abgewiesen.

FIX
- 5 und 6 Symbole sind jetzt gültig
- erwartete Eingabelänge entspricht exakt der erzeugten Aufgabe
- bestehende laufende 5-Symbol-Claims müssen NICHT gelöscht werden
- adaptive Bergung bleibt vollständig erhalten
- richtige Lösung nach Fehlversuch bleibt erhalten
- auffällige Rückwärts-Anzeige bleibt erhalten

INSTALLATION
1. ZIP in GitHub ersetzen.
2. Supabase SQL Editor:
   NUR supabase/v6_24_4_hotfix.sql
   einmal ausführen.
3. Vercel neu deployen.
4. Version V6.24.4 prüfen.
