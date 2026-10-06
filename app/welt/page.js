'use client'
import {useEffect,useMemo,useState} from 'react'
import {supabase} from '../../lib/supabase-browser'
import {formatGold} from '../../lib/gold'
import WorldMap from '../../components/WorldMap'

const RESOURCE_ICON={
 wood:'🪵',resin:'🟤',food:'🌾',plants:'🌿',water:'💧',
 fish:'🐟',stone:'🪨',ore:'⛏️',scrap:'🔩',metal:'⚙️'
}
const TERRAIN_LABEL={
 forest:'🌲 Wald',farmland:'🚜 Acker',grass:'🌾 Grünland',water:'🌊 Wasser',
 wetland:'🟫 Feuchtgebiet',rock:'🪨 Fels',industrial:'🏭 Industrie',
 commercial:'🏬 Gewerbe',residential:'🏙 Wohnen',park:'🌳 Park',
 sand:'🏖 Sand',road:'🛣 Verkehr',open:'🧭 Offen'
}

export default function WorldPage(){
 const [state,setState]=useState(null)
 const [parcels,setParcels]=useState([])
 const [selected,setSelected]=useState(null)
 const [market,setMarket]=useState([])
 const [msg,setMsg]=useState('')
 const [busy,setBusy]=useState(false)
 const [sellResource,setSellResource]=useState('wood')
 const [sellQty,setSellQty]=useState('1')
 const [sellPrice,setSellPrice]=useState('1')
 const [view,setView]=useState(null)

 useEffect(()=>{init()},[])

 async function init(){
   const {data:{user}}=await supabase.auth.getUser()
   if(!user){location.replace('/login');return}
   await Promise.all([loadState(),loadMarket()])
 }

 async function loadState(){
   const {data,error}=await supabase.rpc('world_get_state_v70')
   if(error){setMsg(error.message);return}
   setState(data)
 }
 async function loadMarket(){
   const {data,error}=await supabase.rpc('world_market_v70',{p_resource:null})
   if(!error)setMarket(data||[])
 }
 async function loadView(v=view){
   if(!v)return
   const {data,error}=await supabase.rpc('world_parcels_in_view_v70',{
     p_min_gx:v.minGx,p_max_gx:v.maxGx,p_min_gy:v.minGy,p_max_gy:v.maxGy,p_limit:5000
   })
   if(!error)setParcels(data||[])
 }
 async function viewport(v){
   setView(v)
   await loadView(v)
 }

 async function unlock(){
   setBusy(true);setMsg('')
   const {data,error}=await supabase.rpc('world_unlock_v70')
   setBusy(false)
   if(error){setMsg(error.message);return}
   setMsg(data?.already_unlocked?'Weltzugang ist bereits aktiv.':'🌍 Willkommen in der Welt!')
   await loadState()
 }

 async function buyParcel(){
   if(!selected||selected.occupied)return
   setBusy(true);setMsg('')
   const {data,error}=await supabase.rpc('world_buy_parcel_v70',{
     p_gx:selected.gx,p_gy:selected.gy,p_terrain_type:selected.terrain
   })
   setBusy(false)
   if(error){setMsg(error.message);return}
   setMsg(`Grundstück gekauft · ${TERRAIN_LABEL[data?.terrain]||data?.terrain}`)
   setSelected(null)
   await Promise.all([loadState(),loadView()])
 }

 async function claimProduction(){
   setBusy(true);setMsg('')
   const {data,error}=await supabase.rpc('world_claim_production_v70')
   setBusy(false)
   if(error){setMsg(error.message);return}
   setMsg(data?.parcels_updated?`Produktion eingesammelt · ${data.parcels_updated} Grundstücke aktualisiert.`:'Noch kein neuer Produktionstick verfügbar.')
   await loadState()
 }

 async function createSellOrder(){
   setBusy(true);setMsg('')
   const {data,error}=await supabase.rpc('world_create_sell_order_v70',{
     p_resource:sellResource,p_quantity:Number(sellQty),p_unit_price_taler:Number(sellPrice)
   })
   setBusy(false)
   if(error){setMsg(error.message);return}
   setMsg('Verkaufsorder eingestellt.')
   await Promise.all([loadState(),loadMarket()])
 }
 async function buyOrder(o){
   const raw=prompt(`Wie viel ${RESOURCE_ICON[o.resource]||''} ${o.resource} kaufen?`,String(Math.min(1,Number(o.remaining))))
   if(raw===null)return
   const qty=Number(String(raw).replace(',','.'))
   if(!(qty>0))return
   setBusy(true);setMsg('')
   const {data,error}=await supabase.rpc('world_buy_order_v70',{p_order_id:o.id,p_quantity:qty})
   setBusy(false)
   if(error){setMsg(error.message);return}
   setMsg(`Gekauft: ${Number(data.quantity).toLocaleString('de-DE')} für ${Number(data.cost).toLocaleString('de-DE')} Taler.`)
   await Promise.all([loadState(),loadMarket()])
 }
 async function cancelOrder(o){
   setBusy(true);setMsg('')
   const {error}=await supabase.rpc('world_cancel_order_v70',{p_order_id:o.id})
   setBusy(false)
   if(error){setMsg(error.message);return}
   setMsg('Order storniert, Restmenge liegt wieder im Lager.')
   await Promise.all([loadState(),loadMarket()])
 }

 if(!state)return <main className="container"><div className="panel">🌍 Welt wird geladen…</div></main>
 const s=state.settings||{}
 const inventory=state.inventory||[]
 const invResources=inventory.length?inventory.map(x=>x.resource):['wood','stone','food','water']

 return <main className="container worldPage">
  <div className="buildBadge">V7.0</div>
  <div className="topnav">
   <a className="btn" href="/lobby">🧭 Schatzsuche</a>
   <a className="btn primary" href="/welt">🌍 Welt</a>
   <a className="btn" href="/profile">Profil</a>
  </div>

  <div className="panel worldHero">
   <div>
    <div className="small">BoBsSchatzsuche V7</div>
    <h1>🌍 Welt</h1>
    <p className="muted">Eine gemeinsame permanente Welt. Kaufe reale 10×10-m-Parzellen, produziere Rohstoffe und handle mit anderen Spielern.</p>
   </div>
   {state.has_access&&<div className="worldHeroStats">
    <span><b>{Number(state.world_taler||0).toLocaleString('de-DE',{maximumFractionDigits:2})}</b> Taler</span>
    <span><b>{state.parcel_count||0}</b> / {s.max_parcels_per_player} Grundstücke</span>
   </div>}
  </div>

  {msg&&<div className="noticeBar">{msg}</div>}

  {!state.has_access?<section className="panel worldUnlock">
   <div className="worldUnlockIcon">🌐</div>
   <h2>Weltzugang freischalten</h2>
   <p>Der Zugang gilt dauerhaft für deinen Account.</p>
   <div className="worldUnlockPrice">{formatGold(s.entry_gold_ug||0)}</div>
   <div className="small">Dein Gold: {formatGold(state.gold_balance_ug||0)} · Startguthaben: {Number(s.starter_taler||0).toLocaleString('de-DE')} Welt-Taler</div>
   <button className="btn primary" disabled={busy||!s.enabled} onClick={unlock}>{s.enabled?'Welt betreten':'Welt derzeit deaktiviert'}</button>
  </section>:<>
   <section className="worldMainGrid">
    <div className="panel worldMapPanel">
     <div className="sectionTitleRow"><div><h2>Grundstücke</h2><p className="small">{s.parcel_size_m} × {s.parcel_size_m} m · Klick auf ein Feld zum Prüfen/Kaufen.</p></div><button className="miniBtn" onClick={()=>loadView()}>↻</button></div>
     <WorldMap parcelSize={Number(s.parcel_size_m||10)} parcels={parcels} selected={selected} onSelect={setSelected} onViewport={viewport}/>
    </div>
    <aside className="panel worldParcelPanel">
     <h2>📍 Grundstück</h2>
     {!selected?<p className="muted">Wähle ein Feld auf der Karte.</p>:<>
      <div className="worldParcelTerrain">{TERRAIN_LABEL[selected.terrain]||selected.terrain}</div>
      <div className="small mono">Raster {selected.gx} / {selected.gy}</div>
      {selected.occupied?
       <div className="worldOwnedInfo">
        <strong>{selected.occupied.is_mine?'Dein Grundstück':'Bereits vergeben'}</strong>
        <span>{selected.occupied.owner_name}</span>
        <span>Level {selected.occupied.level||0}</span>
       </div>
       :<>
        <div className="worldParcelPrice">{Number(s.parcel_price_taler||0).toLocaleString('de-DE')} Taler</div>
        <p className="small">Terrain wird beim Kauf aus der sichtbaren Kartenklassifizierung übernommen.</p>
        <button className="btn primary wideOnMobile" disabled={busy||state.parcel_count>=s.max_parcels_per_player} onClick={buyParcel}>Grundstück kaufen</button>
       </>}
     </>}
    </aside>
   </section>

   <section className="panel">
    <div className="sectionTitleRow"><div><h2>📦 Lager & Produktion</h2><p className="small">Produktion wird serverseitig nach globalen {s.production_tick_minutes}-Minuten-Ticks berechnet.</p></div>
     <button className="btn" disabled={busy} onClick={claimProduction}>Produktion einsammeln</button>
    </div>
    <div className="worldInventory">
     {inventory.length?inventory.map(x=><div className="worldResource" key={x.resource}>
       <span>{RESOURCE_ICON[x.resource]||'📦'} {x.label||x.resource}</span>
       <strong>{Number(x.amount).toLocaleString('de-DE',{maximumFractionDigits:3})}</strong>
      </div>):<div className="muted">Noch keine Rohstoffe im Lager.</div>}
    </div>
   </section>

   <section className="panel">
    <div className="sectionTitleRow"><div><h2>📈 Rohstoffbörse</h2><p className="small">Spieler handeln direkt miteinander · Gebühr {(Number(s.exchange_fee_bps||0)/100).toFixed(2)} %.</p></div><button className="miniBtn" onClick={loadMarket}>↻</button></div>
    <div className="worldSellForm">
     <select className="input" value={sellResource} onChange={e=>setSellResource(e.target.value)}>
      {[...new Set([...invResources,'wood','resin','food','plants','water','fish','stone','ore','scrap','metal'])].map(r=><option value={r} key={r}>{RESOURCE_ICON[r]||'📦'} {r}</option>)}
     </select>
     <input className="input" type="number" min="0.001" step="0.001" value={sellQty} onChange={e=>setSellQty(e.target.value)} placeholder="Menge"/>
     <input className="input" type="number" min="0.01" step="0.01" value={sellPrice} onChange={e=>setSellPrice(e.target.value)} placeholder="Taler/Stück"/>
     <button className="btn primary" disabled={busy} onClick={createSellOrder}>Verkaufen</button>
    </div>
    <div className="worldOrderBook">
     {market.length?market.map(o=><div className="worldOrder" key={o.id}>
      <div><strong>{RESOURCE_ICON[o.resource]||'📦'} {o.resource}</strong><span>{Number(o.remaining).toLocaleString('de-DE',{maximumFractionDigits:3})} verfügbar · {o.seller_name}</span></div>
      <div><strong>{Number(o.unit_price_taler).toLocaleString('de-DE')} Taler</strong>
       {o.is_mine?<button className="miniBtn" onClick={()=>cancelOrder(o)}>Stornieren</button>:<button className="miniBtn" onClick={()=>buyOrder(o)}>Kaufen</button>}
      </div>
     </div>):<div className="muted">Noch keine offenen Verkaufsorders.</div>}
    </div>
   </section>

   <section className="panel worldConflictPreview">
    <h2>⚔️ Grundstückskonflikte</h2>
    <p>{s.conflicts_enabled?'Konfliktsystem ist freigeschaltet. Das Geschicklichkeitsduell folgt als nächster Ausbau.':'Für V7.0 ist das Konfliktdatenmodell vorbereitet; die Kämpfe sind noch deaktiviert.'}</p>
    <div className="small">Geplant: 24-h-Herausforderung, Geschicklichkeit statt Zufall, Schutzzeiten und unangreifbarer Mindestbesitz.</div>
   </section>
  </>}
 </main>
}
