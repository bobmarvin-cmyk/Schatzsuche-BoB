#!/usr/bin/env python3
from pathlib import Path
import sys,re

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
    if not cond: errors.append(msg)

def forbid(cond,msg):
    if cond: errors.append(msg)

admin=read("app/admin/page.js")
world_admin=read("app/admin/welt/page.js")
game=read("app/game/[id]/page.js")
lobby=read("app/lobby/page.js")
world=read("app/welt/page.js")
world_map=read("components/WorldMap.js")
css=read("app/globals.css")
project=read("PROJECT_STATE.md")
nonneg=read("NON_NEGOTIABLES.md")

migrations=sorted((ROOT/"supabase").glob("v*_migration.sql"))
require(len(migrations)==1,f"Supabase-Release muss genau 1 aktuelle Migration enthalten, gefunden: {len(migrations)}")
migration=migrations[0].read_text(encoding="utf-8",errors="ignore") if migrations else ""

# Release hygiene
for p in ROOT.rglob(".env.local"):
    errors.append(".env.local darf nicht im Release liegen")
require("V7.0" in admin and "V7.0" in game and "V7.0" in lobby and "V7.0" in world,"V7.0-Buildstand fehlt in einer Hauptseite")
require((ROOT/"PROJECT_STATE.md").exists() and (ROOT/"NON_NEGOTIABLES.md").exists() and (ROOT/"RELEASE_CHECKLIST.md").exists(),"Projekt-Sicherungsdateien fehlen")

# Schatzsuche: alte Kernfunktionen dürfen im Client nicht verschwinden
require("claim_player_catchup_v658" in game,"Aufholausgleich ist nicht mehr im Spielclient verdrahtet")
require('className="moveEnergy"' in game and ".moveEnergy" in css,"Energieanzeige fehlt")
require("Aufholenergie +" in game,"Aufholenergie-Überhang fehlt")
require("Nächstes Spiel" in game,"UI-Regression: Nächstes Spiel fehlt")
forbid("Felder/min</span>" in lobby,"Lobby-Regression: Felder/min wieder in Spieleübersicht")
for rel,txt in [("game",game),("lobby",lobby)]:
    forbid("avatar_emoji" in txt,f"Bot-Icon-Regression in {rel}")
require("bots_min_per_game" in admin and "bots_max_per_game" in admin,"Bot-Min/Max fehlen in der Zentrale")
require("admin_save_bot_settings_v661" in admin,"Persistenter Bot-Min/Max-Speicherpfad fehlt")
for tech in ["ter2","ter4","ter5","ter6","ter7"]:
    require(tech in project,f"Terrain-Vertrag {tech} fehlt")
require("10 Minuten" in project,"10-Minuten-Cleanup-Vertrag fehlt")
require("Bot-only" in project or "Bot-only" in nonneg,"Bot-only-Hall-of-Fame-Vertrag fehlt")
require("globalen Scatter" in project or "global verstreut" in project,"Lokale Bot-Suche ist nicht dokumentiert")

# Namenspool: V7 verified save + same canonical source
require("admin_save_name_pool_v70" in admin and "admin_save_name_pool_v70" in migration,"V7 Namenspool-Speicherpfad fehlt")
require("name_pool_updated_at" in migration and "saved_at" in migration,"Namenspool-Verifikation/Zeitstempel fehlt")
require("Namenspool konnte nicht dauerhaft verifiziert werden" in migration,"Harte Namenspool-Verifikation fehlt")
require("random_game_name_v6151" in migration and "project_runtime_config_v661" in migration,"Auto-Zufallsnamen nicht an kanonische Quelle gebunden")

# Welt routes
require(world.strip()!="","/welt fehlt")
require(world_admin.strip()!="","/admin/welt fehlt")
require(world_map.strip()!="","WorldMap fehlt")
require('href="/welt"' in lobby,"Welt-Link in Lobby fehlt")
require('href="/admin/welt"' in admin,"Welt-Schaltzentrale ist nicht verlinkt")

# Welt tables + RLS + direct access revoked
tables=[
 "world_settings_v70","world_resource_rates_v70","world_access_v70","world_wallets_v70",
 "world_inventory_v70","world_parcels_v70","world_orders_v70","world_trades_v70","world_conflicts_v70"
]
low=migration.lower()
for table in tables:
    require(f"create table if not exists public.{table}" in low,f"{table} fehlt")
    require(f"alter table public.{table} enable row level security" in low,f"RLS fehlt auf {table}")
    require(f"revoke all on public.{table} from anon,authenticated" in low,f"Direkter Clientzugriff nicht entzogen: {table}")

# Welt server authority
for fn in [
 "world_unlock_v70","world_claim_production_v70","world_buy_parcel_v70","world_get_state_v70",
 "world_parcels_in_view_v70","world_market_v70","world_create_sell_order_v70",
 "world_cancel_order_v70","world_buy_order_v70","admin_world_state_v70",
 "admin_save_world_settings_v70","admin_save_world_rate_v70"
]:
    require(f"function public.{fn}" in low,f"RPC fehlt: {fn}")

require("balance_ug>=s.entry_gold_ug" in migration,"Weltzugang schützt Goldsaldo nicht")
require("taler>=s.parcel_price_taler" in migration,"Grundstückskauf schützt Welt-Taler nicht")
require("count_v>=s.max_parcels_per_player" in migration,"Grundstückslimit wird serverseitig nicht geprüft")
require("unique(gx,gy)" in low,"Globale Grundstückseindeutigkeit fehlt")
require("floor(" in migration and "production_last_at" in migration,"Lazy-Produktion fehlt")
require("amount>=p_quantity" in migration,"Verkaufsorder schützt Inventar nicht")
require("taler>=cost" in migration,"Börsenkauf schützt Taler nicht")
require("conflicts_enabled boolean not null default false" in low,"Konflikte müssen in V7.0 standardmäßig deaktiviert sein")

# Basic delimiter sanity
for rel,txt in [
 ("app/admin/page.js",admin),("app/admin/welt/page.js",world_admin),
 ("app/game/[id]/page.js",game),("app/lobby/page.js",lobby),
 ("app/welt/page.js",world),("components/WorldMap.js",world_map),("app/globals.css",css)
]:
    if txt:
        require(txt.count("{")==txt.count("}"),f"Klammerfehler {{}} in {rel}")
        require(txt.count("(")==txt.count(")"),f"Klammerfehler () in {rel}")
        require(txt.count("[")==txt.count("]"),f"Klammerfehler [] in {rel}")

if migration:
    require(migration.count("$$")%2==0,"SQL $$-Delimiter unausgeglichen")

print("BoBsSchatzsuche V7 Release Check")
print("="*38)
for w in warnings: print("WARN:",w)
if errors:
    for e in errors: print("FEHLER:",e)
    print(f"\nERGEBNIS: NICHT FREIGEGEBEN ({len(errors)} Fehler)")
    sys.exit(1)
print("ERGEBNIS: FREIGEGEBEN")
