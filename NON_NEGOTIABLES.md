# NON_NEGOTIABLES – BoBsSchatzsuche V7.2

Diese Regeln dürfen nur auf ausdrücklichen Wunsch von Marvin geändert werden.

## Gesamtprojekt
1. Neue Versionen bauen auf der unmittelbar vorherigen Version auf.
2. Vorhandene Features werden nicht stillschweigend entfernt.
3. Schatzsuche und Welt bleiben getrennt weiterentwickelbare Segmente.

## Schatzsuche
4. Bots öffentlich nicht als Bots markieren.
5. Keine öffentlichen Bot-Icons.
6. Kein global verstreutes Bot-Aufdecken.
7. Bekannte Terrain-Gates bleiben erhalten.
8. Schatzpositionen bei Spielstart festlegen.
9. Bot-only-Siege ohne echte Menschen nicht Hall of Fame.
10. Standard/Sponsor ca. 10 Minuten live; Goldspiele 24 Stunden live.
11. Aufholausgleich und Energieanzeige erhalten.
12. Namenspool persistent und von Auto-Games verwendet.
13. Bot-Min/Max bleibt persistent.

## Welt
14. Eine gemeinsame permanente Welt.
15. Welt verwendet ausschließlich mg Gold, keine separate Weltwährung.
16. Satellitenanzeige darf Terrain-Hintergrundwerte nicht abschalten.
17. Erste Base ist kostenlos.
18. Normale Grundstücke müssen mit eigener Base/Zweitwohnsitz-Fläche verbunden sein.
19. Getrennte neue Gebiete dürfen nur über Zweitwohnsitze entstehen.
20. Zweitwohnsitze werden mit jedem weiteren teurer.
21. Die Erde wird nicht mit Milliarden Grundstückszeilen vorab gespeichert.
22. Produktion bleibt lazy/serverseitig.
23. Sammelkapazität begrenzt die ansammelbaren Produktionsintervalle; Überschuss verfällt.
24. Sammelkapazität ist hochskillbar und serverseitig bezahlt/geprüft.
25. Nur Produktionsflächen produzieren in V7.2 Rohstoffe.
26. Grundstücksformen production/compensation/trade/path bleiben unterscheidbar.
27. Verkaufsorders dürfen Inventar nicht negativ machen.
28. Goldkäufe dürfen Goldsaldo nicht negativ machen.
29. Grundstücksbilder erst ab konfigurierter zusammenhängender Mindestfläche.
30. Konflikte bleiben deaktiviert, bis Skill-Duell fertig ist.

## Sicherheit / Release
31. Neue Tabellen bekommen RLS.
32. Interne Tabellen entziehen anon/authenticated Direktzugriff.
33. setup.sql nie als Update ausführen.
34. `.env.local` und geheime Schlüssel nie ins Release-ZIP.
