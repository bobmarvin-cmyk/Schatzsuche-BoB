SCHATZSUCHE ONLINE V6.23.5 – NEXT.JS VIEWPORT HOTFIX

KEIN SQL.

ÄNDERUNG
Next.js erwartet viewport nicht mehr innerhalb des metadata-Exports.
app/layout.js verwendet jetzt einen separaten export const viewport.

INSTALLATION
1. ZIP-Inhalt in GitHub ersetzen.
2. Keine Supabase-Migration ausführen.
3. Vercel neu deployen lassen.
4. Version V6.23.5 prüfen.
