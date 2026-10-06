#!/usr/bin/env python3
from pathlib import Path
import sys, re

ROOT=Path(__file__).resolve().parent
errors=[]
warnings=[]

def read(rel):
    p=ROOT/rel
    if not p.exists():
        errors.append(f"FEHLT: {rel}")
        return ""
    return p.read_text(encoding="utf-8",errors="ignore")

def require(cond,msg):
    if not cond:
        errors.append(msg)

def forbid(cond,msg):
    if cond:
        errors.append(msg)

admin=read("app/admin/page.js")
game=read("app/game/[id]/page.js")
lobby=read("app/lobby/page.js")
css=read("app/globals.css")
project=read("PROJECT_STATE.md")
nonneg=read("NON_NEGOTIABLES.md")

migrations=sorted((ROOT/"supabase").glob("v*_migration.sql"))
require(len(migrations)==1, f"Supabase-Release muss genau 1 aktuelle Migration enthalten, gefunden: {len(migrations)}")
migration=migrations[0].read_text(encoding="utf-8",errors="ignore") if migrations else ""

# Version / release hygiene
require("V6.61.2" in admin and "V6.61.2" in game and "V6.61.2" in lobby, "V6.61.2-Buildbadge fehlt in einer Hauptseite")
for p in ROOT.rglob(".env.local"):
    errors.append(".env.local darf nicht im Release liegen")

# Canonical admin persistence
require("project_runtime_config_v661" in migration, "Kanonische V6.61.2-Konfiguration fehlt")
require("add column if not exists bots_min_per_game int" in migration.lower(), "Kompatibilitäts-Spalte bots_min_per_game wird nicht vor Nutzung abgesichert")
require("add column if not exists bots_max_per_game int" in migration.lower(), "Kompatibilitäts-Spalte bots_max_per_game wird nicht vor Nutzung abgesichert")
require("alter table public.project_runtime_config_v661 enable row level security" in migration.lower(), "RLS fehlt auf project_runtime_config_v661")
require("revoke all on public.project_runtime_config_v661 from anon,authenticated" in migration.lower(), "Direkter Clientzugriff auf project_runtime_config_v661 wurde nicht entzogen")
require("admin_save_name_pool_v661" in migration and "admin_save_name_pool_v661" in admin, "Namenspool nutzt nicht den V6.61.2-Speicherpfad")
require("random_game_name_v6151" in migration and "project_runtime_config_v661" in migration, "Auto-Zufallsnamen sind nicht an kanonische Konfiguration gebunden")
require("admin_save_bot_settings_v661" in migration and "admin_save_bot_settings_v661" in admin, "Bot-Einstellungen nutzen nicht den V6.61.2-Speicherpfad")
require("bots_min_per_game" in admin and "bots_max_per_game" in admin, "Bot-Min/Max fehlen in der Admin-Oberfläche")
require("bot_min_per_game" in migration and "bot_max_per_game" in migration, "Kanonische Bot-Range fehlt")
require("rebalance_game_bots_v656" in migration and "project_runtime_config_v661" in migration, "Bot-Rebalance ist nicht an kanonische Range gebunden")

# Public bot UX / no icon regression
for rel,txt in [("game",game),("lobby",lobby)]:
    forbid("avatar_emoji" in txt, f"Bot-Icon-Regression in {rel}")

# Bot locality contract
require("kein globales Scatter" in project or "Kein Rückfall" in project, "Projektvertrag für lokalen Bot-Suchmodus fehlt")
forbid("999999999" in migration, "Verdächtiger globaler Bot-Scatter-Fallback in aktueller Migration")

# Terrain contract
for tech in ["ter2","ter4","ter5","ter6","ter7"]:
    require(tech in project, f"Terrain-Vertrag {tech} fehlt im PROJECT_STATE")

# Catchup / energy UI contract
require("claim_player_catchup_v658" in game, "Aufholausgleich ist nicht mehr im Spielclient verdrahtet")
require('className="moveEnergy"' in game and ".moveEnergy" in css, "Energieanzeige fehlt")
require("Aufholenergie +" in game, "Aufholenergie-Überhang wird nicht angezeigt")

# Lobby / lifecycle contract
require("Nächstes Spiel" in game, "UI-Regression: 'Nächstes Spiel' fehlt")
forbid("Felder/min</span>" in lobby, "Lobby-Regression: Felder/min wieder in Spieleübersicht")
require("10 Minuten" in project, "10-Minuten-Cleanup fehlt im Projektvertrag")
require("Bot-only" in project or "Bot-only" in nonneg, "Bot-only Hall-of-Fame-Regel fehlt im Projektvertrag")

# Docs
for rel in ["PROJECT_STATE.md","NON_NEGOTIABLES.md","RELEASE_CHECKLIST.md"]:
    require((ROOT/rel).exists(), f"{rel} fehlt")

# Basic delimiter sanity
for rel,txt in [
    ("app/admin/page.js",admin),
    ("app/game/[id]/page.js",game),
    ("app/lobby/page.js",lobby),
    ("app/globals.css",css),
]:
    if txt:
        require(txt.count("{")==txt.count("}"), f"Klammerfehler {{}} in {rel}")
        require(txt.count("(")==txt.count(")"), f"Klammerfehler () in {rel}")

if migration:
    require(migration.count("$$")%2==0, "SQL $$-Delimiter unausgeglichen")

print("BoBs Schatzsuche Release Check")
print("="*34)
if warnings:
    for w in warnings:
        print("WARN:",w)
if errors:
    for e in errors:
        print("FEHLER:",e)
    print(f"\nERGEBNIS: NICHT FREIGEGEBEN ({len(errors)} Fehler)")
    sys.exit(1)

print("ERGEBNIS: FREIGEGEBEN")
sys.exit(0)
