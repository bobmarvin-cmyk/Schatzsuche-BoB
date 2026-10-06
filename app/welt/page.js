'use client'
import {useEffect,useMemo,useState} from 'react'
import {supabase} from '../../lib/supabase-browser'
import {formatGold,mgToUg} from '../../lib/gold'
import WorldMap from '../../components/WorldMap'

const RESOURCE_ICON={wood:'🪵',resin:'🟤',food:'🌾',plants:'🌿',water:'💧',fish:'🐟',stone:'🪨',ore:'⛏️',scrap:'🔩',metal:'⚙️'}
const TERRAIN_LABEL={forest:'🌲 Wald',farmland:'🚜 Acker',grass:'🌾 Grünland',water:'🌊 Wasser',wetland:'🟫 Feuchtgebiet',rock:'🪨 Fels',industrial:'🏭 Industrie',commercial:'🏬 Gewerbe',residential:'🏙 Wohnen',park:'🌳 Park',sand:'🏖 Sand',road:'🛣 Verkehr',open:'🧭 Offen'}
const USE_LABEL={production:'🏭 Produktionsfläche',compensation:'🌱 Ausgleichsfläche',trade:'🏪 Handelsfläche',path:'🛣 Wegeparzelle'}

export default function WorldPage(){
 const [state,setState]=useState(null),[parcels,setParcels]=useState([]),[selected,setSelected]=useState([])
 const [market,setMarket]=useState([]),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false),[view,setView]=useState(null)
 const [multi,setMulti]=useState(false),[buyColor,setBuyColor]=useState('#22c55e'),[parcelUse,setParcelUse]=useState('production')
 const [sellResource,setSellResource]=useState('wood'),[sellQty,setSellQty]=useState('1'),[sellPriceMg,setSellPriceMg]=useState('1')
 const [styleColor,setStyleColor]=useState('#22c55e'),[styleFile,setStyleFile]=useState(null)
 const [focusHome,setFocusHome]=useState(null)

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
   const {data,error}=await supabase.rpc('world_market_v71',{p_resource:null})
   if(!error)setMarket(data||[])
 }
 async function loadView(v=view){
   if(!v)return
   const {data,error}=await supabase.rpc('world_parcels_in_view_v72',{
     p_min_gx:v.minGx,p_max_gx:v.maxGx,p_min_gy:v.minGy,p_max_gy:v.maxGy,p_limit:5000
   })
   if(!error)setParcels(data||[])
 }
 async function viewport(v){setView(v);await loadView(v)}
 function pick(cell){
   const key=`${cell.gx}:${cell.gy}`
   if(!multi){
     setSelected([cell])
     if(cell.occupied?.is_mine)setStyleColor(cell.occupied.color_hex||'#22c55e')
     return
   }
   setSelected(list=>{
     const exists=list.some(x=>`${x.gx}:${x.gy}`===key)
     return exists?list.filter(x=>`${x.gx}:${x.gy}`!==key):[...list,cell].slice(-250)
   })
 }
 async function unlock(){
   setBusy(true);setMsg('')
   const {error}=await supabase.rpc('world_unlock_v70')
   setBusy(false)
   if(error){setMsg(error.message);return}
   setMsg('🌍 Weltzugang freigeschaltet. Jetzt suchst du dir kostenlos den Standort deiner Base aus.')
   await loadState()
 }
 async function setBase(){
   const cell=selected.length===1?selected[0]:null
   if(!cell||cell.occupied)return
   setBusy(true);setMsg('')
   const {data,error}=await supabase.rpc('world_set_base_v72',{
     p_gx:cell.gx,p_gy:cell.gy,p_terrain_type:cell.terrain,p_color_hex:buyColor
   })
   setBusy(false)
   if(error){setMsg(error.message);return}
   setMsg('🏠 Base gegründet. Von hier aus kannst du deine Fläche erschließen.')
   setSelected([])
   await Promise.all([loadState(),loadView()])
   setFocusHome({gx:data.gx,gy:data.gy,home_type:'base',home_no:0})
 }
 async function buySecondHome(){
   const cell=selected.length===1?selected[0]:null
   if(!cell||cell.occupied)return
   setBusy(true);setMsg('')
   const {data,error}=await supabase.rpc('world_buy_second_home_v72',{
     p_gx:cell.gx,p_gy:cell.gy,p_terrain_type:cell.terrain,p_color_hex:buyColor
   })
   setBusy(false)
   if(error){setMsg(error.message);return}
   setMsg(`🏡 Zweitwohnsitz #${data.home_no} gegründet · ${formatGold(data.price_ug)}`)
   setSelected([]);await Promise.all([loadState(),loadView()])
 }
 async function buySelected(){
   const free=selected.filter(x=>!x.occupied)
   if(!free.length)return
   setBusy(true);setMsg('')
   const {data,error}=await supabase.rpc('world_buy_parcels_v72',{
     p_cells:free.map(x=>({gx:x.gx,gy:x.gy,terrain:x.terrain,color:buyColor,parcel_use:parcelUse}))
   })
   setBusy(false)
   if(error){setMsg(error.message);return}
   setMsg(`${data.count} verbundene Grundstück(e) gekauft · ${USE_LABEL[parcelUse]} · ${formatGold(data.total_ug)}`)
   setSelected([]);await Promise.all([loadState(),loadView()])
 }
 async function claimProduction(){
   setBusy(true);setMsg('')
   const {data,error}=await supabase.rpc('world_claim_production_v70')
   setBusy(false)
   if(error){setMsg(error.message);return}
   const lost=Number(data?.intervals_expired||0)
   setMsg(data?.parcels_updated
     ?`Produktion eingesammelt · ${data.intervals_collected||0} Intervalle${lost>0?` · ⚠️ ${lost} Intervalle waren über der Sammelkapazität und sind verfallen`:''}.`
     :'Noch kein neues Produktionsintervall verfügbar.')
   await loadState()
 }
 async function upgradeCollection(){
   setBusy(true);setMsg('')
   const {data,error}=await supabase.rpc('world_upgrade_collection_v72')
   setBusy(false)
   if(error){setMsg(error.message);return}
   setMsg(`📦 Sammelkapazität auf Stufe ${data.level} erhöht · ${formatGold(data.paid_ug)}`)
   await loadState()
 }
 async function createSellOrder(){
   setBusy(true);setMsg('')
   const {error}=await supabase.rpc('world_create_sell_order_v71',{
     p_resource:sellResource,p_quantity:Number(sellQty),p_unit_price_ug:mgToUg(sellPriceMg)
   })
   setBusy(false)
   if(error){setMsg(error.message);return}
   setMsg('Verkaufsorder eingestellt.');await Promise.all([loadState(),loadMarket()])
 }
 async function buyOrder(o){
   const raw=prompt(`Wie viel ${o.resource} kaufen?`,String(Math.min(1,Number(o.remaining))))
   if(raw===null)return
   const qty=Number(String(raw).replace(',','.')); if(!(qty>0))return
   setBusy(true);setMsg('')
   const {data,error}=await supabase.rpc('world_buy_order_v71',{p_order_id:o.id,p_quantity:qty})
   setBusy(false)
   if(error){setMsg(error.message);return}
   setMsg(`Gekauft: ${Number(data.quantity).toLocaleString('de-DE')} für ${formatGold(data.cost_ug)}.`)
   await Promise.all([loadState(),loadMarket()])
 }
 async function cancelOrder(o){
   setBusy(true);setMsg('')
   const {error}=await supabase.rpc('world_cancel_order_v70',{p_order_id:o.id})
   setBusy(false)
   if(error){setMsg(error.message);return}
   setMsg('Order storniert.');await Promise.all([loadState(),loadMarket()])
 }
 async function saveStyle(){
   const mine=selected.length===1?selected[0]:null
   if(!mine?.occupied?.is_mine)return
   setBusy(true);setMsg('')
   let imageUrl=mine.occupied.image_url||null
   try{
     if(styleFile){
       const {data:{user}}=await supabase.auth.getUser()
       const ext=(styleFile.name.split('.').pop()||'webp').toLowerCase().replace(/[^a-z0-9]/g,'')
       const path=`${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
       const {error:upErr}=await supabase.storage.from('world-parcel-art').upload(path,styleFile,{upsert:false,contentType:styleFile.type})
       if(upErr)throw upErr
       imageUrl=supabase.storage.from('world-parcel-art').getPublicUrl(path).data.publicUrl
     }
     const {error}=await supabase.rpc('world_set_parcel_style_v71',{p_gx:mine.gx,p_gy:mine.gy,p_color_hex:styleColor,p_image_url:imageUrl})
     if(error)throw error
     setMsg(styleFile?'Grundstücksbild gespeichert.':'Grundstücksfarbe gespeichert.')
     setStyleFile(null);await loadView()
   }catch(e){setMsg(e.message||'Personalisierung fehlgeschlagen')}
   setBusy(false)
 }

 if(!state)return <main className="container"><div className="panel">🌍 Welt wird geladen…</div></main>
 const s=state.settings||{},inventory=state.inventory||[],homes=state.homes||[],collection=state.collection||{}
 const base=homes.find(h=>h.home_type==='base')||null
 const freeCount=selected.filter(x=>!x.occupied).length
 const single=selected.length===1?selected[0]:null
 const totalBuyUg=freeCount*Number(s.parcel_price_ug||10000)
 const capHours=(Number(collection.capacity_intervals||0)*Number(collection.interval_minutes||0))/60
 const storedHours=(Number(collection.stored_intervals||0)*Number(collection.interval_minutes||0))/60

 return <main className="container worldPage">
  <div className="buildBadge">V7.2</div>
  <div className="topnav"><a className="btn" href="/lobby">🧭 Schatzsuche</a><a className="btn primary" href="/welt">🌍 Welt</a><a className="btn" href="/profile">Profil</a></div>

  <div className="panel worldHero">
   <div><div className="small">BoBsSchatzsuche V7</div><h1>🌍 Welt</h1><p className="muted">Grundstücke · Rohstoffe · Handel in mg Gold.</p></div>
   {state.has_access&&<div className="worldHeroStats"><span><b>{formatGold(state.gold_balance_ug||0)}</b></span><span><b>{state.parcel_count||0}</b> / {s.max_parcels_per_player} Grundstücke</span></div>}
  </div>

  {msg&&<div className="noticeBar">{msg}</div>}

  {!state.has_access?<section className="panel worldUnlock">
   <div className="worldUnlockIcon">🌐</div><h2>Weltzugang freischalten</h2>
   <div className="worldUnlockPrice">{formatGold(s.entry_gold_ug||0)}</div>
   <div className="small">Dein Gold: {formatGold(state.gold_balance_ug||0)}</div>
   <button className="btn primary" disabled={busy||!s.enabled} onClick={unlock}>{s.enabled?'Welt betreten':'Welt derzeit deaktiviert'}</button>
  </section>:<>
   {!base&&<section className="panel worldBaseCallout"><h2>🏠 Setze deine Base</h2><p>Dein erstes Grundstück ist dein Zuhause und kostet nichts. Alle normalen Grundstücke müssen später über zusammenhängende eigene Flächen mit deiner Base oder einem Zweitwohnsitz verbunden sein.</p></section>}

   {base&&<section className="panel worldHomesPanel">
    <div className="sectionTitleRow"><div><h2>🏠 Zuhause</h2><p className="small">Die Welt startet an deiner Base. Zweitwohnsitze eröffnen neue Erschließungsgebiete und werden mit jedem weiteren teurer.</p></div></div>
    <div className="worldHomesList">{homes.map(h=><button className="miniBtn" key={h.id} onClick={()=>setFocusHome({...h,_t:Date.now()})}>{h.home_type==='base'?'🏠 Base':`🏡 Zweitwohnsitz ${h.home_no}`}</button>)}</div>
   </section>}

   <section className="worldMainGrid">
    <div className="panel worldMapPanel">
     <div className="sectionTitleRow"><div><h2>Grundstücke</h2><p className="small">{s.parcel_size_m} × {s.parcel_size_m} m · normale Grundstücke müssen an dein bestehendes Netz anschließen.</p></div><button className="miniBtn" onClick={()=>loadView()}>↻</button></div>
     <div className="worldSelectionBar">
      <label className="adminToggle"><input type="checkbox" checked={multi} onChange={e=>{setMulti(e.target.checked);setSelected([])}}/> Mehrfachauswahl</label>
      <label className="worldColorPick">Farbe <input type="color" value={buyColor} onChange={e=>setBuyColor(e.target.value)}/></label>
      {base&&<select className="input worldUseSelect" value={parcelUse} onChange={e=>setParcelUse(e.target.value)}>
       <option value="production">🏭 Produktionsfläche</option><option value="compensation">🌱 Ausgleichsfläche</option><option value="trade">🏪 Handelsfläche</option><option value="path">🛣 Wegeparzelle</option>
      </select>}
      {selected.length>0&&<span>{selected.length} ausgewählt · {freeCount} frei</span>}
      {base&&freeCount>0&&<button className="btn primary" disabled={busy} onClick={buySelected}>{freeCount} kaufen · {formatGold(totalBuyUg)}</button>}
      {selected.length>0&&<button className="miniBtn" onClick={()=>setSelected([])}>Auswahl löschen</button>}
     </div>
     <WorldMap parcelSize={Number(s.parcel_size_m||10)} parcels={parcels} selected={selected} onSelect={pick} onViewport={viewport} focusHome={focusHome||base}/>
    </div>

    <aside className="panel worldParcelPanel">
     <h2>📍 Grundstück</h2>
     {!single?<p className="muted">{selected.length>1?`${selected.length} Grundstücke ausgewählt.`:'Wähle ein Feld auf der Karte.'}</p>:<>
      <div className="worldParcelTerrain">{TERRAIN_LABEL[single.terrain]||single.terrain}</div>
      <div className="small mono">Raster {single.gx} / {single.gy}</div>
      {single.occupied?<div className="worldOwnedInfo">
        <strong>{single.occupied.home_type==='base'?'🏠 Base':single.occupied.home_type==='residence'?`🏡 Zweitwohnsitz ${single.occupied.home_no}`:single.occupied.is_mine?'Dein Grundstück':'Bereits vergeben'}</strong>
        <span>{single.occupied.owner_name}</span><span>{USE_LABEL[single.occupied.parcel_use]||single.occupied.parcel_use} · Level {single.occupied.level||0}</span>
        {single.occupied.is_mine&&<div className="worldStyleEditor">
          <label>Farbe <input type="color" value={styleColor} onChange={e=>setStyleColor(e.target.value)}/></label>
          <label>Bild <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setStyleFile(e.target.files?.[0]||null)}/></label>
          <div className="small">Bild ab {s.personalization_min_connected_parcels||25} zusammenhängenden eigenen Grundstücken.</div>
          <button className="btn" disabled={busy} onClick={saveStyle}>Personalisierung speichern</button>
        </div>}
       </div>:!base?<button className="btn primary wideOnMobile" disabled={busy} onClick={setBase}>🏠 Hier kostenlos Base gründen</button>:<>
        <div className="worldParcelPrice">{formatGold(s.parcel_price_ug||10000)}</div>
        <button className="btn primary wideOnMobile" disabled={busy} onClick={buySelected}>Verbundenes Grundstück kaufen</button>
        <button className="btn wideOnMobile" disabled={busy} onClick={buySecondHome}>🏡 Zweitwohnsitz hier gründen · {formatGold(state.second_home_price_ug||0)}</button>
       </>}
     </>}
    </aside>
   </section>

   <section className="panel">
    <div className="sectionTitleRow"><div><h2>📦 Lager & Produktion</h2><p className="small">Ein Produktionsintervall dauert {s.production_tick_minutes} Minuten. Nur Produktionsflächen erzeugen Rohstoffe.</p></div><button className="btn" disabled={busy} onClick={claimProduction}>Produktion einsammeln</button></div>
    <div className="collectionCapacity">
     <div className="collectionCapacityHead"><span>Sammelkapazität · Stufe {collection.level||0}</span><strong>{storedHours.toLocaleString('de-DE',{maximumFractionDigits:1})} / {capHours.toLocaleString('de-DE',{maximumFractionDigits:1})} Std.</strong></div>
     <div className="collectionCapacityTrack"><span style={{width:`${Math.min(100,Number(collection.fill_percent||0))}%`}}/></div>
     <div className="collectionCapacityFoot"><span>{collection.capacity_intervals||0} Produktionsintervalle speicherbar{Number(collection.expired_intervals||0)>0?` · ⚠️ aktuell ${collection.expired_intervals} darüber`:''}</span>{Number(collection.level||0)<Number(collection.max_level||0)&&<button className="miniBtn" disabled={busy} onClick={upgradeCollection}>Kapazität erhöhen · {formatGold(collection.next_upgrade_ug||0)}</button>}</div>
    </div>
    <div className="worldUseInfo"><span>🏭 Produktionsfläche: Rohstoffe</span><span>🌱 Ausgleichsfläche: für Öko-/Ausgleichssysteme</span><span>🏪 Handelsfläche: für Handelsausbau</span><span>🛣 Wegeparzelle: Erschließung/Verbindung</span></div>
    <div className="worldInventory">{inventory.length?inventory.map(x=><div className="worldResource" key={x.resource}><span>{RESOURCE_ICON[x.resource]||'📦'} {x.label||x.resource}</span><strong>{Number(x.amount).toLocaleString('de-DE',{maximumFractionDigits:3})}</strong></div>):<div className="muted">Noch keine Rohstoffe im Lager.</div>}</div>
   </section>

   <section className="panel">
    <div className="sectionTitleRow"><div><h2>📈 Rohstoffbörse</h2><p className="small">Alle Preise ausschließlich in mg Gold · Gebühr {(Number(s.exchange_fee_bps||0)/100).toFixed(2)} %.</p></div><button className="miniBtn" onClick={loadMarket}>↻</button></div>
    <div className="worldSellForm">
     <select className="input" value={sellResource} onChange={e=>setSellResource(e.target.value)}>{['wood','resin','food','plants','water','fish','stone','ore','scrap','metal'].map(r=><option value={r} key={r}>{RESOURCE_ICON[r]||'📦'} {r}</option>)}</select>
     <input className="input" type="number" min="0.001" step="0.001" value={sellQty} onChange={e=>setSellQty(e.target.value)} placeholder="Menge"/>
     <input className="input" type="number" min="0.001" step="0.001" value={sellPriceMg} onChange={e=>setSellPriceMg(e.target.value)} placeholder="mg Gold/Stück"/>
     <button className="btn primary" disabled={busy} onClick={createSellOrder}>Verkaufen</button>
    </div>
    <div className="worldOrderBook">{market.length?market.map(o=><div className="worldOrder" key={o.id}><div><strong>{RESOURCE_ICON[o.resource]||'📦'} {o.resource}</strong><span>{Number(o.remaining).toLocaleString('de-DE',{maximumFractionDigits:3})} · {o.seller_name}</span></div><div><strong>{formatGold(o.unit_price_ug)} / Stück</strong>{o.is_mine?<button className="miniBtn" onClick={()=>cancelOrder(o)}>Stornieren</button>:<button className="miniBtn" onClick={()=>buyOrder(o)}>Kaufen</button>}</div></div>):<div className="muted">Noch keine offenen Verkaufsorders.</div>}</div>
   </section>

   <section className="panel worldConflictPreview"><h2>⚔️ Grundstückskonflikte</h2><p>{s.conflicts_enabled?'Konfliktsystem ist freigeschaltet.':'Noch deaktiviert, bis das Geschicklichkeitsduell umgesetzt ist.'}</p></section>
  </>}
 </main>
}
