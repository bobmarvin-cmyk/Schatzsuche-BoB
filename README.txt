V6.5.3 – ERSTE-LOGIN-HILFE

Neu:
- Beim ersten Besuch der Lobby nach dem Login erscheint automatisch ein Hilfe-Overlay.
- Es erklärt kurz:
  - Spielziel
  - Felder erkunden
  - Taler
  - Technologien
  - Schatzsuche
  - Standardspiele
  - Paygames im Testmodus
- Button „Verstanden – los geht's“
- Button zur ausführlichen Hilfe
- Nach dem Schließen wird serverseitig gespeichert, dass der Nutzer die Einführung gesehen hat.
- Das Popup erscheint danach nicht mehr automatisch.
- Die normale Hilfe bleibt jederzeit über den Footer erreichbar.

Installation:
1. Gesamten Inhalt dieser ZIP in GitHub hochladen und ersetzen.
2. Supabase > SQL Editor.
3. NUR supabase/v6_5_3_migration.sql EINMAL ausführen.
4. Vercel deployt automatisch.

Test:
Für ein bereits bestehendes Testkonto kannst du in Supabase in profiles
help_intro_seen wieder auf false setzen. Dann erscheint das Popup beim nächsten Lobby-Aufruf erneut.
