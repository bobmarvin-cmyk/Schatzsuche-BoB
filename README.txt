SCHATZSUCHE ONLINE V6.20.2 – BERGUNG HOTFIX 2

ÄNDERUNGEN
- Rechenaufgaben für NEUE Schatzfunde entfernt.
- Neue Varianten:
  1. Symbolfolge normal
  2. Symbolfolge rückwärts
  3. Paare vertauschen: 2-1 / 4-3 / 6-5
- laufende Bergungsprüfung wird durch Maschinen-/Live-Nachladen nicht mehr zurückgesetzt
- Eingabe bleibt stehen
- Symbolfolge wird weiterhin bewusst mit „Antwort prüfen“ bestätigt

WICHTIG
Eine bereits vor dem Hotfix erzeugte Rechenaufgabe bleibt als bestehender Claim bestehen.
Nach Abschluss/Fehlschlag entstehen nur noch die neuen Symbolaufgaben.

INSTALLATION AB V6.20.1
1. ZIP-Inhalt in GitHub ersetzen.
2. Supabase SQL Editor:
   supabase/v6_20_2_hotfix.sql
   EINMAL ausführen.
3. Keine ältere Migration erneut ausführen.
4. Vercel deployen lassen.
5. Version: V6.20.2
