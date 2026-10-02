SCHATZSUCHE ONLINE V6.11

DIESE VERSION BEHEBT ZWEI KONKRETE FEHLER UND ERWEITERT DAS GAMEPLAY.

1. PAYGAME-FEHLER „UPDATE requires a WHERE clause“
Ursache war die Community-Ausschüttung, die absichtlich alle vorhandenen Test-Wallets
aktualisiert hatte. Supabase Safe Update blockiert ein UPDATE ohne WHERE.

V6.11:
- explizite WHERE-Bedingung
- Paygame-Erstellung und Community-Verteilung funktionieren mit Safe Update

2. MASCHINEN-TIMEOUT
Fehler:
  Maschinen: canceling statement due to statement timeout

V6.11 erzeugt keine unkontrolliert großen Suchquadrate mehr.
Pro Maschinentakt gibt es eine harte Obergrenze von 12.000 Kandidaten.

Zwei Suchmodi sind jetzt im laufenden Spiel wählbar:
- 📍 Letzte Suche
  Maschinen arbeiten um den letzten manuellen Kartenklick.
- 🎲 Zufällig
  Maschinen wählen Kandidaten verteilt über die ganze Spielkarte.

Beide Modi:
- nur solange das jeweilige Spiel sichtbar/fokussiert geöffnet ist
- kein Offline-Farming
- keine nachträgliche Aufholung verpasster Takte
- Timer wird nach jedem fälligen Maschinentakt sauber neu gestartet

3. KARTEN-GIMMICKS
Bei der Spielerstellung kann der Host einen Prozentsatz für Überraschungsfelder wählen.

Standard:
  1,0 %

Die erlaubten Grenzen kommen aus der Schaltzentrale.

Erste drei Gimmick-Arten:
- 💰 Taler-Kiste
- ⚡ Extra-Zug
- 📡 Scanner-Boost für den nächsten manuellen Zug

Bei einem Fund erscheint ein Popup.

In der Schaltzentrale einstellbar:
- Minimum Gimmicks %
- Maximum Gimmicks %
- Standard Gimmicks %
- Taler-Bonus
- Extra-Züge
- zusätzliche Felder durch Scanner

Technisch wird die Chance ausschließlich beim erstmaligen Aufdecken eines neuen Feldes
serverseitig ausgewertet. Dadurch kann ein Feld nicht wiederholt für Gimmicks gefarmt werden.

4. KOMPAKTERES INGAME-DESIGN
- wichtige Werte oben in einer kompakten horizontalen Statusleiste
- Statusbereich bleibt beim Scrollen an der Karte sichtbar
- Schatzbereich ist standardmäßig eingeklappt
- Schatzanteil / offene Teile / Paygame-Pool sind trotzdem sofort sichtbar
- Technologien statt „Technologiebaum“
- Maschinenmodus direkt im Game umschaltbar

5. HALL OF FAME
Die missverständliche Formulierung „Sieger benötigte X ...“ wurde ersetzt.

Jetzt:
  Siegerwertung: XX,XX % Schatz · YY manuelle Züge

Im detaillierten Endstand bleiben zusätzlich Felder, Maschinentakte und Spielerwerte sichtbar.

6. KOMPAKTERE SPIELERSTELLUNG
Der Bereich wurde enger formatiert.
Neu ist dort außerdem der Gimmick-Prozentregler.

7. IMPRESSUM
Zentrale Betreiberangaben sind jetzt eingetragen:
- Marvin Reipert
- Herrenwald 2
- 66640 Namborn
- Deutschland
- bobmarvin@gmx.de

Die Platzhalter-Warnung im Impressum wurde entfernt.

INSTALLATION
1. Inhalt dieser ZIP in dein bestehendes GitHub-Repository hochladen und vorhandene Dateien ersetzen.
2. Supabase → SQL Editor.
3. NUR:
   supabase/v6_11_migration.sql
   einmal vollständig ausführen.
4. Vercel deployt automatisch.

TESTEMPFEHLUNG
A) Paygame mit kleinem Testeinsatz erstellen.
   Der Safe-Update-Fehler darf nicht mehr erscheinen.

B) Maschine kaufen:
   - „Letzte Suche“ mehrere Takte testen.
   - dann auf „Zufällig“ wechseln.
   - beide sollten ohne SQL-Timeout weiterlaufen.

C) In der Schaltzentrale Gimmicks z. B. testweise auf 10 % stellen.
   Neues Testspiel erstellen und mehrere Felder aufdecken.
   Popup und Bonuswerte prüfen.

D) Hall of Fame und Impressum öffnen.
