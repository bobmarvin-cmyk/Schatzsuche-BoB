SCHATZSUCHE ONLINE V6.20.1 – BERGUNG HOTFIX

Fehlerbild:
Korrekt eingegebene Symbolfolgen konnten auf Desktop trotzdem als falsch gewertet werden.

Ursache:
Die Symbolprüfung wurde beim sechsten Klick automatisch ausgelöst. Bei sehr schnellen
Klickfolgen konnte React noch mit einem älteren Eingabestand arbeiten.

Fix:
- kein Auto-Submit mehr
- Eingabe nutzt funktionale React-State-Updates
- nach 6 Symbolen wird NICHT automatisch geprüft
- Spieler sieht alle 6 eingegebenen Symbole
- erst Button „Antwort prüfen“ sendet exakt die sichtbare Folge an den Server
- Symbolbuttons werden nach 6 Eingaben gesperrt
- Eingabe kann vor Prüfung gelöscht und neu eingegeben werden

INSTALLATION
Wenn V6.20 bereits installiert ist:
1. ZIP-Inhalt in GitHub ersetzen.
2. KEIN neues SQL nötig.
3. Vercel deployen lassen.
4. Unten rechts muss V6.20.1 stehen.

Die serverseitigen Bergungsregeln aus V6.20 bleiben unverändert.
