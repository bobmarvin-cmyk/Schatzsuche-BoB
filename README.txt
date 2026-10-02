SCHATZSUCHE ONLINE V6.7 – MASTER-SCHALTZENTRALE

NEU
- Geschützte Admin-Seite: /admin
- Admin-Link erscheint in der Lobby nur für eingetragene Administratoren.
- Globale Spielwerte können direkt im Browser geändert werden.
- Technologiebaum ist nicht mehr hart im Frontend hinterlegt.
- Das Spiel lädt Technologie-Namen, Preise, Voraussetzungen und Wirkungen direkt aus Supabase.
- Änderungen am Technologiebaum benötigen danach KEINEN GitHub-/Vercel-Deploy mehr.
- Bereits gekaufte Technologien werden bei geänderten Bonuswerten serverseitig neu berechnet.

IN DER SCHALTZENTRALE EINSTELLBAR

SPIELGRENZEN
- minimale / maximale Feldanzahl
- maximale Spielerzahl
- minimale / maximale reale Feldgröße
- minimale / maximale Zugregeneration
- maximales Zugspeicherlimit
- Taler-Belohnung pro leerem Feld

GOLDSTAUB-TESTÖKONOMIE
- Schatzpool-Quote
- Community-Quote
- Plattform-Quote
- Test-Startguthaben
- Mehrschatz-Schwelle
- maximale Schatzanzahl
- minimaler / maximaler Paygame-Einsatz
- Referenzpreis
- Community-Reserve und Plattform-Testanteil werden angezeigt

SPIEL-LEBENSZYKLUS
- Stunden bis Inaktivitätsschließung
- Stunden bis Löschung geschlossener Spiele
- Verteilung offenen Restgoldes bei Inaktivität

TECHNOLOGIEBAUM
Für jede Technologie:
- Name
- Kategorie
- Beschreibung
- Preis
- Felder-pro-Zug-Bonus
- Talerbonus
- Analyse-Level
- Zugspeicher-Bonus
- Regenerationsbonus
- Voraussetzungen
- Sortierung
- aktiv / deaktiviert

INSTALLATION
1. Gesamten Inhalt dieser ZIP in dein bestehendes GitHub-Repository hochladen und vorhandene Dateien ersetzen.
2. Supabase > SQL Editor öffnen.
3. NUR supabase/v6_7_migration.sql EINMAL vollständig ausführen.
4. Danach musst du deinem eigenen Benutzer EINMAL Adminrechte geben:
   - Datei supabase/v6_7_grant_admin_TEMPLATE.sql öffnen
   - DEINE_LOGIN_EMAIL durch deine echte Login-E-Mail ersetzen
   - SQL im Supabase SQL Editor ausführen
5. Vercel deployt nach dem GitHub-Commit automatisch.
6. Neu in die Lobby gehen. Dort erscheint für dich „🎛️ Schaltzentrale“.

SICHERHEIT
- Normale Spieler können die Schaltzentrale nicht verwenden.
- Schreibzugriffe laufen über SECURITY-DEFINER-Funktionen mit zusätzlicher Adminprüfung.
- Die Tabelle admin_users hat keine Client-Schreibpolicy.
- Spielstatistiken und Technologie-Käufe bleiben serverseitig autoritativ.

WICHTIG
Die Schaltzentrale betrifft die Spielregeln global. Eine Änderung wirkt grundsätzlich
auf alle Spiele, die den betreffenden Wert danach verwenden. Technologie-Boni bereits
gekaufter Technologien werden nach einer Änderung neu berechnet.

Goldstaub bleibt weiterhin ausschließlich TEST-GOLD ohne Echtgeldwert, Kauf oder Auszahlung.
