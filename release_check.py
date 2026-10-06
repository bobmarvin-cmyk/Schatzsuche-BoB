#!/usr/bin/env python3
from pathlib import Path
import sys,re
ROOT=Path(__file__).resolve().parent
errors=[]
def read(rel):
 p=ROOT/rel
 if not p.exists(): errors.append("FEHLT: "+rel); return ""
 return p.read_text(encoding="utf-8",errors="ignore")
def req(c,m):
 if not c: errors.append(m)
def forbid(c,m):
 if c: errors.append(m)
admin=read("app/admin/page.js"); wa=read("app/admin/welt/page.js"); game=read("app/game/[id]/page.js")
lobby=read("app/lobby/page.js"); world=read("app/welt/page.js"); wm=read("components/WorldMap.js"); css=read("app/globals.css")
project=read("PROJECT_STATE.md")
migs=sorted((ROOT/"supabase").glob("v*_migration.sql"))
req(len(migs)==1,f"Genau eine aktuelle Migration erwartet, gefunden {len(migs)}")
sql=migs[0].read_text(encoding="utf-8",errors="ignore") if migs else ""
low=sql.lower()
req("V7.1" in admin and "V7.1" in world and "V7.1" in game and "V7.1" in lobby,"V7.1-Buildstand fehlt")
for p in ROOT.rglob(".env.local"): errors.append(".env.local im Release")
# Schatzsuche
req("claim_player_catchup_v658" in game,"Aufholausgleich fehlt")
req('className="moveEnergy"' in game and ".moveEnergy" in css,"Energieanzeige fehlt")
forbid("avatar_emoji" in game or "avatar_emoji" in lobby,"Bot-Icon Regression")
req("bots_min_per_game" in admin and "bots_max_per_game" in admin,"Bot Min/Max fehlt")
req("24 hours" in low and "game_type='pay'" in sql,"24h Goldspiel-Retention fehlt")
req("10 minutes" in low,"10-Minuten-Retention fehlt")
# Welt Satellit + Terrain
req("World_Imagery" in wm,"Satellitenkarte fehlt")
req("terrainFromFeatures" in wm and "fill-opacity" in wm,"Terrain-Hintergrundwerte fehlen")
# Mehrfachauswahl
req("Mehrfachauswahl" in world and "world_buy_parcels_v71" in world and "world_buy_parcels_v71" in sql and "world_parcels_in_view_v71" in world,"Mehrfachkauf fehlt")
# Nur Gold
req("gold_wallets" in sql and "world_buy_order_v71" in sql and "world_create_sell_order_v71" in sql and "world_market_v71" in sql,"Goldbörse fehlt")
forbid("world_taler" in world.lower(),"Welt-Taler noch in Welt-UI")
req("parcel_price_ug" in sql and "formatGold" in world,"Gold-Grundstückspreis fehlt")
# Styles
req("color_hex" in sql and 'type="color"' in world,"Grundstücksfarben fehlen")
req("world-parcel-art" in sql and "world_set_parcel_style_v71" in sql and "styleFile" in world,"Bildpersonalisierung fehlt")
req("world_connected_parcel_count_v71" in sql and "personalization_min_connected_parcels" in sql,"Größenschwelle für Bilder fehlt")
# RLS existing/new storage policies
for table in ["world_settings_v70","world_parcels_v70","world_orders_v70","world_trades_v70"]:
 req(table in low,table+" fehlt")
# Docs
req("V7.1" in project,"PROJECT_STATE nicht V7.1")
# delimiter sanity
for rel,t in [("admin",admin),("world-admin",wa),("game",game),("lobby",lobby),("world",world),("map",wm),("css",css)]:
 req(t.count("{")==t.count("}"),f"{{}} Fehler {rel}")
 req(t.count("(")==t.count(")"),f"() Fehler {rel}")
req(sql.count("$$")%2==0,"SQL $$ Fehler")
print("BoBsSchatzsuche V7.1 Release Check")
print("="*40)
if errors:
 for e in errors: print("FEHLER:",e)
 print("ERGEBNIS: NICHT FREIGEGEBEN")
 sys.exit(1)
print("ERGEBNIS: FREIGEGEBEN")
