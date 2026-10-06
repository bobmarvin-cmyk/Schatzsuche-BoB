#!/usr/bin/env python3
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parent
errors=[]
def read(rel):
    p=ROOT/rel
    if not p.exists(): errors.append('FEHLT: '+rel); return ''
    return p.read_text(encoding='utf-8',errors='ignore')
def req(c,m):
    if not c: errors.append(m)
def forbid(c,m):
    if c: errors.append(m)
admin=read('app/admin/page.js'); wa=read('app/admin/welt/page.js'); game=read('app/game/[id]/page.js')
lobby=read('app/lobby/page.js'); world=read('app/welt/page.js'); wm=read('components/WorldMap.js'); css=read('app/globals.css')
project=read('PROJECT_STATE.md'); nonneg=read('NON_NEGOTIABLES.md')
migs=sorted((ROOT/'supabase').glob('v*_migration.sql'))
req(len(migs)==1,f'Genau eine aktuelle Migration erwartet, gefunden {len(migs)}')
sql=migs[0].read_text(encoding='utf-8',errors='ignore') if migs else ''
low=sql.lower()

# Release hygiene
req('V7.2' in admin and 'V7.2' in wa and 'V7.2' in game and 'V7.2' in lobby and 'V7.2' in world,'V7.2 Buildstand fehlt')
for p in ROOT.rglob('.env.local'): errors.append('.env.local im Release')
req('V7.2' in project and 'V7.2' in nonneg,'Projektverträge nicht auf V7.2')

# Schatzsuche regression contracts
req('claim_player_catchup_v658' in game,'Aufholausgleich fehlt')
req('className="moveEnergy"' in game and '.moveEnergy' in css,'Energieanzeige fehlt')
forbid('avatar_emoji' in game or 'avatar_emoji' in lobby,'Bot-Icon Regression')
req('bots_min_per_game' in admin and 'bots_max_per_game' in admin,'Bot Min/Max fehlt')
req('24 Stunden' in project and '10 Minuten' in project,'Retention-Vertrag fehlt')
for tech in ['ter2','ter4','ter5','ter6','ter7']: req(tech in project,'Terrain-Vertrag '+tech+' fehlt')

# Welt old core
req('World_Imagery' in wm and 'terrainFromFeatures' in wm,'Satellit/Terrain fehlt')
req('world_create_sell_order_v71' in world and 'world_buy_order_v71' in world,'Goldbörse fehlt')
forbid('Welt-Taler' in world,'Welt-Taler wieder in Welt-UI')
req('world_set_parcel_style_v71' in world and 'styleFile' in world,'Grundstückspersonalisierung fehlt')

# Base and residences
req('create table if not exists public.world_homes_v72' in low,'world_homes_v72 fehlt')
req('alter table public.world_homes_v72 enable row level security' in low,'RLS world_homes_v72 fehlt')
req('revoke all on public.world_homes_v72 from anon,authenticated' in low,'Direktzugriff world_homes_v72 nicht entzogen')
req('world_set_base_v72' in sql and 'Hier kostenlos Base gründen' in world,'Kostenlose Base fehlt')
req('world_buy_second_home_v72' in sql and 'second_home_price_step_ug' in sql,'Progressive Zweitwohnsitze fehlen')
req('focusHome' in wm and 'focusHome={focusHome||base}' in world,'Zoom auf Base fehlt')
req('ältestes Grundstück als Base' in sql or 'ältestes Grundstück automatisch als Base' in project,'Migration bestehenden Besitzes zur Base fehlt')

# Connectivity
req('world_cell_connected_v72' in sql and 'world_buy_parcels_v72' in sql,'Verbindungsprüfung fehlt')
req('Alle Grundstücke müssen mit deiner Base' in sql,'Serverfehler für unverbundene Grundstücke fehlt')
req('world_buy_parcels_v72' in world,'Frontend nutzt nicht verbundenen Bulk-Kauf')

# Parcel uses
for v in ['production','compensation','trade','path']:
    req(v in sql and v in world,f'Grundstücksform {v} fehlt')
req("parcel_use='production'" in sql,'Produktion ist nicht auf Produktionsflächen beschränkt')

# Collection capacity
req('collection_level' in sql and 'world_collection_status_v72' in sql and 'world_upgrade_collection_v72' in sql,'Sammelkapazität/Skill fehlt')
req('least(elapsed_intervals,capacity_intervals)' in sql and 'elapsed_intervals-capacity_intervals' in sql,'Kapazität/Verfall serverseitig fehlt')
req('Sammelkapazität' in world and 'Kapazität erhöhen' in world,'Kapazitäts-UI fehlt')
req('Produktionsintervall' in world and 'Produktionsintervall' in wa,'Produktionsintervall-Begriff fehlt')
forbid('Produktionstick' in world or 'Produktionstick' in wa,'Alter Tick-Begriff noch sichtbar')

# Security/basic
req(sql.count('$$')%2==0,'SQL $$ unausgeglichen')
for rel,t in [('admin',admin),('world-admin',wa),('game',game),('lobby',lobby),('world',world),('map',wm),('css',css)]:
    req(t.count('{')==t.count('}'),f'{{}} Fehler {rel}')
    req(t.count('(')==t.count(')'),f'() Fehler {rel}')

print('BoBsSchatzsuche V7.2 Release Check')
print('='*40)
if errors:
    for e in errors: print('FEHLER:',e)
    print(f'ERGEBNIS: NICHT FREIGEGEBEN ({len(errors)} Fehler)')
    sys.exit(1)
print('ERGEBNIS: FREIGEGEBEN')
