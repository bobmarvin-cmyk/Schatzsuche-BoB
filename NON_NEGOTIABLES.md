# NON_NEGOTIABLES – BoBsSchatzsuche V7

Diese Regeln dürfen nur auf ausdrücklichen Wunsch von Marvin geändert oder entfernt werden.

## Gesamtprojekt
1. Neue Versionen bauen auf der unmittelbar vorherigen Version auf.
2. Vorhandene Features werden nicht stillschweigend entfernt.
3. Schatzsuche und Welt sind getrennte Segmente desselben Projekts.
4. Änderungen an der Welt dürfen die Schatzsuche nicht ungefragt verändern und umgekehrt.
5. V6.61.2 bleibt der dokumentierte letzte stabile V6-Rückfallstand.

## Schatzsuche
6. Bots werden öffentlich nicht als Bots gekennzeichnet.
7. Bot-Icons bleiben öffentlich entfernt.
8. Bots dürfen nicht wieder global zufällig über die ganze Karte verstreut aufdecken.
9. Bekannte Terrain-Gates gelten auch für Bots.
10. Schatzpositionen werden zu Spielbeginn serverseitig festgelegt.
11. Bot-only-Siege ohne echte menschliche Aktivität kommen nicht in die Hall of Fame.
12. Beendete Live-Spiele werden nach ungefähr 10 Minuten bereinigt.
13. Aufholausgleich darf den normalen Zugspeicher überschreiten.
14. Der Energie-Balken erzeugt keine zusätzlichen Polling-/Netzwerkrequests.
15. Auto-Game-Zufallsnamen kommen aus dem editierbaren persistenten Namenspool.
16. Bot-Min/Max ist eine echte Range und wird pro Spiel einmal zufällig gewählt.

## Welt
17. Es gibt genau eine gemeinsame permanente Welt für alle Spieler.
18. Standard-Grundstücksgröße V7.1 ist 10 × 10 m.
19. Die gesamte Erde wird niemals als Milliarden vorab angelegte Grundstückszeilen gespeichert.
20. Weltgrundstücke werden erst bei Kauf/Interaktion persistent.
21. Welt-Taler sind V7.1 getrennt von Rundentalern der Schatzsuche.
22. Produktion wird lazy berechnet; keine ständigen Schreib-Ticks über alle Grundstücke.
23. Rohstoffhandel zwischen Spielern darf keine negativen Inventare oder negativen Welt-Taler erzeugen.
24. Verkaufte Rohstoffe werden bei Ordererstellung reserviert.
25. Kämpfe um Grundstücke dürfen nicht Pay-to-Win werden.
26. Konflikte bleiben deaktiviert, bis ein serverseitig plausibilisiertes Geschicklichkeitssystem vorhanden ist.
27. Grundstücksschutz und Mindestbesitz dürfen nicht stillschweigend entfernt werden.

## Sicherheit/Release
28. Neue öffentliche Tabellen bekommen RLS.
29. Interne Tabellen ohne direkte Browsernutzung entziehen anon/authenticated direkten Zugriff.
30. setup.sql wird bei bestehenden Installationen niemals erneut als Migration ausgeführt.
31. .env.local und geheime Schlüssel kommen niemals ins Release-ZIP.

32. Goldspiele bleiben nach Ende 24 Stunden in den Live-Daten sichtbar.
33. Die Welt verwendet ab V7.1 nur mg Gold, keine separate Weltwährung.
34. Satellitenanzeige darf Terrain-Hintergrundwerte nicht abschalten.
35. Grundstücksbilder sind erst ab der konfigurierten Mindestgröße zusammenhängender eigener Fläche zulässig.
