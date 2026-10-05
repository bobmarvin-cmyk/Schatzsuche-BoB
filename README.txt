SCHATZSUCHE ONLINE V6.44

AUTOGAMES
- Neuer Schalter „Zufallsnamen verwenden“.
- Ist er aktiv, bekommt jedes automatisch erzeugte Spiel einen Namen aus dem bereits
  vorhandenen editierbaren Namenspool.
- Ist er aus, gilt weiterhin „Namenspräfix + Datum/Uhrzeit“.

ADAPTIVE SPIELAKTIVITÄT
- Neuer Aktivitätsindikator:
  ⚡ X Felder/min je Spieler
- Berechnung:
  alle von echten Spielern in den letzten 60 Sekunden aufgedeckten Felder
  geteilt durch die Zahl der menschlichen Teilnehmer.
- Der Wert wird serverseitig 10 Sekunden gecacht und ist daher günstig.

COMPUTER-SPIELER REAGIEREN AUF DAS SPIEL
- Bot-Tempo ist nicht mehr starr.
- Solltempo = menschlicher Felder/min-Durchschnitt × Aktivitäts-Verhältnis.
- Beispiel:
  menschlicher Durchschnitt 5 Felder/min
  Verhältnis 0,80
  → normaler Bot peilt ungefähr 4 Felder/min an.
- Schwierigkeit modifiziert das Tempo weiterhin leicht.
- Bei ruhigen Spielen gilt ein einstellbares Grundtempo.
- Maximaltempo ist ebenfalls einstellbar.
- Die nächste Aktion wird aus reveal_power und Solltempo berechnet.
- Bots bleiben weiterhin gleichzeitig nur in genau einem Spiel aktiv.

SCHALTZENTRALE
- Aktivitäts-Verhältnis
- Grundtempo Felder/min
- Max. Felder/min pro Bot
- Zufallsnamen für Autogames

PROFIL-LINKS
- Fehlender Link bei echten Spielern im Ingame-Ranking behoben.
- Damit sind dort jetzt sowohl echte Spieler als auch Computer-Spieler anklickbar.

LOBBY
- Öffentliche Spiele zeigen ebenfalls den Aktivitätswert in Felder/min.

INSTALLATION
1. supabase/v6_44_migration.sql EINMAL ausführen.
2. V6.44 deployen.
