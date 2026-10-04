SCHATZSUCHE ONLINE V6.25

HAUPTÄNDERUNGEN

1) „BERGUNGSPRÜFUNG“ -> „SCHATZSICHERUNG“
Der Name beschreibt die Mechanik besser:
Der Schatz ist gefunden, aber noch nicht endgültig gesichert.

Fehlversuche:
- neue Sicherungsaufgabe darf wiederholt werden
- Aufgabe wird stufenweise leichter
- Untergrenze bleibt erhalten, also keine automatische Gratis-Lösung
- Schatz bleibt am gefundenen Feld
- kein Neuverstecken nötig

WURMLOCH:
Bewusst NICHT technisch eingebaut.
Wenn das letzte Feld der Schatz ist, kann derselbe Schatz durch einen neuen
Sicherungsversuch gewonnen werden. Eine neue Karte/Feld-Geometrie mitten im
Spiel würde Chunk-System, Terrain, Hinweise und Archiv unnötig komplizierter machen.
Ein Wurmloch kann später als rein kosmetischer Effekt ergänzt werden.

2) NEBENJOBS – ZEIT GEGEN TALER
Neue serverseitige Jobs:
- ♻️ Pfandflaschen sammeln
- 🔩 Altmetall ausgraben

Standard:
- 180 Sekunden
- 1,00 Taler

Nach Ablauf muss der Lohn aktiv abgeholt werden.
Danach kann erneut gearbeitet werden.

Die Werte sind in der Schaltzentrale änderbar:
- Jobdauer
- Talerlohn

Der bisherige kostenlose Terrain-Notzuschuss wird damit ersetzt.
Wenn nur noch gesperrtes Gelände übrig ist, weist das Spiel auf Nebenjobs hin.

3) LOBBY SORTIERBAR
Filter:
- Alle
- schnelle Runden
- Langzeitspiele
- Schatzsuchen
- Goldspiele
- Sponsorspiele

Sortieren:
- aktive Spieler
- Spielfortschritt
- Rundengeschwindigkeit
- Kartengröße
- neu/alt
- aufsteigend / absteigend

Zusätzlich zeigt jede Karte den Erkundungsfortschritt.

4) MOBILE KARTE
- technische Chunk-Anzeige entfernt
- Karten/Satelliten-Umschalter sitzt jetzt kompakt an dieser Stelle
- nur noch ein Umschaltknopf statt zwei großer Buttons

5) ZUFALLSNAMENSPOOL
Schaltzentrale -> „Jobs & Namen“
- linker Namensbaustein
- rechter Namensbaustein
- eine Zeile pro Begriff
- Lobby und serverseitige Zufallsnamen verwenden den bearbeitbaren Pool

6) MOBILE TALER
- Taler in der mobilen Kartenanzeige jetzt mit 2 Nachkommastellen

7) TUTORIAL
- Testspielfeld liegt jetzt auf einem echten Kartenhintergrund
- dadurch wird deutlicher, dass das Raster im richtigen Spiel über einer Weltkarte liegt
- sichtbare Kartenattribution ergänzt

8) AUTH-REPAIR
Für „Database error granting user“:
- public schema usage explizit wiederhergestellt
- benötigte Leserechte explizit gesetzt
- handle_new_user sauber als SECURITY DEFINER neu erstellt
- Trigger on_auth_user_created neu als AFTER INSERT angelegt
- fehlende profiles und gold_wallets für bestehende auth.users nachgezogen
- Join-/Move-RPC-Rechte erneut gesetzt

Falls Login danach NOCH fehlschlägt:
supabase/v6_25_auth_diagnose.sql ausführen und Ausgabe prüfen.
Diese Datei verändert nichts; sie zeigt nur zusätzliche Trigger/Funktionen auf auth.users.

INSTALLATION
1. ZIP-Inhalt in GitHub ersetzen.
2. Supabase SQL Editor:
   NUR supabase/v6_25_migration.sql einmal ausführen.
3. Vercel neu deployen.
4. Version V6.25 prüfen.
5. Login testen.
6. Nur falls weiterhin „Database error granting user“:
   supabase/v6_25_auth_diagnose.sql ausführen.
