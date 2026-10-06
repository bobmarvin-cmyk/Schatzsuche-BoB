'use client'
import {useEffect,useState} from 'react'
import {supabase} from '../../../lib/supabase-browser'
import {formatGold,mgToUg,ugToGoldMg} from '../../../lib/gold'

const NUM=v=>v===''?0:Number(v)

export default function WorldAdmin(){
 const [allowed,setAllowed]=useState(null)
 const [data,setData]=useState(null)
 const [msg,setMsg]=useState('')
 const [saving,setSaving]=useState(false)

 useEffect(()=>{init()},[])

 async function init(){
  const {data:{user}}=await supabase.auth.getUser()
  if(!user){location.replace('/login');return}
  const {data:isAdmin}=await supabase.rpc('is_admin_v67')
  if(!isAdmin){setAllowed(false);return}
  setAllowed(true)
  await load()
 }
 async function load(){
  const {data,error}=await supabase.rpc('admin_world_state_v70')
  if(error){setMsg(error.message);return}
  setData(data)
 }
 function setS(k,v){
  setData(d=>({...d,settings:{...(d?.settings||{}),[k]:v}}))
 }
 function setRate(i,v){
  setData(d=>({...d,rates:(d?.rates||[]).map((r,idx)=>idx===i?{...r,amount_per_tick:v}:r)}))
 }
 async function saveSettings(){
  setSaving(true);setMsg('')
  const s=data.settings
  const payload={
   enabled:!!s.enabled,
   entry_gold_ug:Math.max(0,Math.round(NUM(s.entry_gold_ug))),
   starter_taler:NUM(s.starter_taler),
   parcel_price_taler:NUM(s.parcel_price_taler),
   max_parcels_per_player:NUM(s.max_parcels_per_player),
   production_tick_minutes:NUM(s.production_tick_minutes),
   exchange_fee_bps:NUM(s.exchange_fee_bps),
   max_open_orders:NUM(s.max_open_orders),
   conflicts_enabled:!!s.conflicts_enabled,
   conflict_fee_taler:NUM(s.conflict_fee_taler),
   conflict_response_hours:NUM(s.conflict_response_hours),
   purchase_protection_days:NUM(s.purchase_protection_days),
   conflict_protection_days:NUM(s.conflict_protection_days),
   protected_min_parcels:NUM(s.protected_min_parcels),
   max_attacks_per_day:NUM(s.max_attacks_per_day)
  }
  const {data:r,error}=await supabase.rpc('admin_save_world_settings_v70',{p:payload})
  setSaving(false)
  setMsg(error?error.message:(r?.message||'Welt-Einstellungen gespeichert.'))
  if(!error)await load()
 }
 async function saveRate(i){
  const r=data.rates[i]
  setSaving(true);setMsg('')
  const {error}=await supabase.rpc('admin_save_world_rate_v70',{
   p_terrain_type:r.terrain_type,p_resource:r.resource,p_amount:NUM(r.amount_per_tick)
  })
  setSaving(false)
  setMsg(error?error.message:`${r.terrain_type} / ${r.resource} gespeichert.`)
  if(!error)await load()
 }

 if(allowed===null)return <main className="container"><div className="panel">Prüfe Berechtigung…</div></main>
 if(allowed===false)return <main className="container"><div className="panel">Kein Zugriff.</div></main>
 if(!data)return <main className="container"><div className="panel">Lade Welt-Schaltzentrale…</div></main>

 const s=data.settings||{},stats=data.stats||{}
 return <main className="container adminPage worldAdminPage">
  <div className="buildBadge">V7.0</div>
  <div className="topnav">
   <a className="btn" href="/admin">← Schaltzentrale</a>
   <a className="btn" href="/welt">🌍 Welt ansehen</a>
   <button className="btn" onClick={load}>↻ Neu laden</button>
  </div>

  <div className="panel adminHero">
   <div><div className="small">BoBsSchatzsuche V7</div><h1>🌍 Welt-Schaltzentrale</h1><p className="muted">Balancing und Regeln der permanenten gemeinsamen Welt.</p></div>
   <div className="adminStatus">SERVERSEITIG</div>
  </div>

  {msg&&<div className="noticeBar">{msg}</div>}

  <section className="panel">
   <h2>Weltstatus</h2>
   <div className="grid">
    <div className="card"><div className="small">Spieler</div><div className="stat">{stats.players||0}</div></div>
    <div className="card"><div className="small">Grundstücke</div><div className="stat">{stats.parcels||0}</div></div>
    <div className="card"><div className="small">Offene Orders</div><div className="stat">{stats.open_orders||0}</div></div>
    <div className="card"><div className="small">Trades</div><div className="stat">{stats.trades||0}</div></div>
   </div>
  </section>

  <section className="panel">
   <h2>🔑 Zugang & Grundstücke</h2>
   <label className="adminToggle"><input type="checkbox" checked={!!s.enabled} onChange={e=>setS('enabled',e.target.checked)}/> Welt aktiviert</label>
   <div className="adminGrid">
    <Field label="Weltzugang (mg Gold)" step="1" value={ugToGoldMg(s.entry_gold_ug||0)} onChange={v=>setS('entry_gold_ug',mgToUg(v))}/>
    <Field label="Startguthaben Welt-Taler" step="1" value={s.starter_taler} onChange={v=>setS('starter_taler',v)}/>
    <Read label="Grundstücksgröße" value={`${s.parcel_size_m} × ${s.parcel_size_m} m`}/>
    <Field label="Grundstückspreis (Taler)" step="0.1" value={s.parcel_price_taler} onChange={v=>setS('parcel_price_taler',v)}/>
    <Field label="Max. Grundstücke/Spieler" value={s.max_parcels_per_player} onChange={v=>setS('max_parcels_per_player',v)}/>
    <Field label="Produktionstick (Min.)" value={s.production_tick_minutes} onChange={v=>setS('production_tick_minutes',v)}/>
   </div>
  </section>

  <section className="panel">
   <h2>📈 Börse</h2>
   <div className="adminGrid">
    <Field label="Börsengebühr (Basispunkte)" value={s.exchange_fee_bps} onChange={v=>setS('exchange_fee_bps',v)}/>
    <Read label="Gebühr in %" value={`${(Number(s.exchange_fee_bps||0)/100).toFixed(2)} %`}/>
    <Field label="Max. offene Orders/Spieler" value={s.max_open_orders} onChange={v=>setS('max_open_orders',v)}/>
   </div>
  </section>

  <section className="panel">
   <h2>⚔️ Konflikte</h2>
   <label className="adminToggle"><input type="checkbox" checked={!!s.conflicts_enabled} onChange={e=>setS('conflicts_enabled',e.target.checked)}/> Konflikte aktiviert</label>
   <p className="small">V7.0 enthält Datenmodell und Balancing. Das eigentliche Geschicklichkeitsduell kommt als eigener Ausbau.</p>
   <div className="adminGrid">
    <Field label="Angriffsgebühr (Taler)" value={s.conflict_fee_taler} onChange={v=>setS('conflict_fee_taler',v)}/>
    <Field label="Reaktionszeit (h)" value={s.conflict_response_hours} onChange={v=>setS('conflict_response_hours',v)}/>
    <Field label="Schutz nach Kauf (Tage)" value={s.purchase_protection_days} onChange={v=>setS('purchase_protection_days',v)}/>
    <Field label="Schutz nach Konflikt (Tage)" value={s.conflict_protection_days} onChange={v=>setS('conflict_protection_days',v)}/>
    <Field label="Unangreifbarer Restbesitz" value={s.protected_min_parcels} onChange={v=>setS('protected_min_parcels',v)}/>
    <Field label="Max. Angriffe/Tag" value={s.max_attacks_per_day} onChange={v=>setS('max_attacks_per_day',v)}/>
   </div>
  </section>

  <div className="adminSaveBar"><button className="btn primary" disabled={saving} onClick={saveSettings}>{saving?'Speichert…':'Welt-Einstellungen speichern'}</button></div>

  <section className="panel">
   <h2>🌱 Rohstoffproduktion</h2>
   <p className="small">Menge pro Grundstück und globalem Produktionstick. Grundstück-Level multipliziert aktuell mit +25 % je Level.</p>
   <div className="worldRateTable">
    {(data.rates||[]).map((r,i)=><div className="worldRateRow" key={`${r.terrain_type}-${r.resource}`}>
     <span><b>{r.terrain_type}</b> → {r.resource}</span>
     <input className="input" type="number" min="0" step="0.01" value={r.amount_per_tick} onChange={e=>setRate(i,e.target.value)}/>
     <button className="miniBtn" disabled={saving} onClick={()=>saveRate(i)}>Speichern</button>
    </div>)}
   </div>
  </section>
 </main>
}

function Field({label,value,onChange,type='number',step='1'}){
 return <label className="adminField"><span>{label}</span><input className="input" type={type} step={step} value={value??''} onChange={e=>onChange(e.target.value)}/></label>
}
function Read({label,value}){
 return <div className="adminReadOnly"><span>{label}: <b>{value}</b></span></div>
}
