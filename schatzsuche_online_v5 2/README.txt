SCHATZSUCHE ONLINE V5

1. SUPABASE EINRICHTEN
- Öffne dein Supabase-Projekt.
- Gehe zu SQL Editor.
- Öffne supabase/setup.sql aus diesem Projekt.
- Kopiere den gesamten Inhalt hinein und klicke Run.

2. LOKAL STARTEN
- Node.js installieren
- Terminal im Projektordner öffnen
- npm install
- npm run dev
- Browser: http://localhost:3000

3. VERCEL
- Projekt in GitHub hochladen
- In Vercel importieren
- Environment Variables setzen:
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY

HINWEIS
Die aktuelle Online-Version kann bereits:
- Registrierung / Login
- Profile
- Lobby
- Spiele erstellen
- Spielen beitreten
- Gemeinsame Karte
- Live-Updates
- serverseitige Schatzposition
- Taler / Züge
- Restfelder-Counter

Noch nicht aus V4 übernommen:
- kompletter Technologiebaum
- automatische Rundenschaltung
- Mehrfeld-Aufdeckung

Diese drei Punkte sollten als nächster Schritt serverseitig ergänzt werden.
