'use client'
import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase-browser'
import {formatGold} from '../../lib/gold'

export default function Praemien(){
 const [wallet,setWallet]=useState(null)
 const [settings,setSettings]=useState(null)
 const [bars,setBars]=useState([])
 const [requests,setRequests]=useState([])
 const [msg,setMsg]=useState('')
 const [busy,setBusy]=useState(false)

 useEffect(()=>{load()},[])

 async function load(){
  const {data:{user}}=await supabase.auth.getUser()
  if(!user){location.href='/login';return}
  const [{data:w},{data:s},{data:b},{data:r}]=await Promise.all([
    supabase.from('gold_wallets').select('balance_ug,startup_bonus_ug,startup_bonus_repaid_at').eq('user_id',user.id).maybeSingle(),
    supabase.from('platform_settings').select('redemptions_enabled,smelting_enabled,allowed_bar_sizes_mg,gold_bar_size_mg,gold_bar_cost_ug').eq('id',1).single(),
    supabase.from('gold_bars_v6211').select('id,size_mg,cost_ug,serial_no,status,created_at,updated_at').order('created_at',{ascending:false}),
    supabase.from('gold_redemption_requests_v619').select('id,amount_ug,reward_type,status,created_at,bar_id').order('created_at',{ascending:false}).limit(50)
  ])
  setWallet(w);setSettings(s);setBars(b||[]);setRequests(r||[])
 }

 async function smelt(size){
  setBusy(true);setMsg('')
  const {data,error}=await supabase.rpc('smelt_gold_bar_v6211',{p_size_mg:Number(size)})
  setBusy(false)
  setMsg(error?error.message:(data?.message||'Barren gegossen'))
  if(!error)await load()
 }

 async function remelt(barId){
  setBusy(true);setMsg('')
  const {data,error}=await supabase.rpc('remelt_gold_bar_v6211',{p_bar_id:barId})
  setBusy(false)
  setMsg(error?error.message:(data?.message||'Barren eingeschmolzen'))
  if(!error)await load()
 }

 async function requestPhysical(barId){
  setBusy(true);setMsg('')
  const {data,error}=await supabase.rpc('request_bar_redemption_v6211',{p_bar_id:barId})
  setBusy(false)
  setMsg(error?error.message:(data?.message||'Ausgabe angefragt'))
  if(!error)await load()
 }

 const available=bars.filter(b=>b.status==='minted')
 const sizes=settings?.allowed_bar_sizes_mg||[]

 return <main className="container rewardsPage">
  <div className="buildBadge">V7.1</div>
  <div className="topnav"><a className="btn" href="/lobby">← Lobby</a></div>

  <section className="panel rewardHero">
   <div>
    <div className="small">GOLDSTAUB</div>
    <h1>🔥 Goldbarrenschmelze</h1>
    <p className="muted">Forme deinen Goldstaub in digitale Barren mit eigener Seriennummer. Ein digitaler Barren kann jederzeit wieder zu Goldstaub eingeschmolzen werden, solange keine physische Ausgabe beantragt wurde.</p>
   </div>
   <div className="goldWalletCard">
    <div className="small">Freier Goldstaub</div>
    <div className="goldBalance">✨ {formatGold(wallet?.balance_ug||0)}</div>
   </div>
  </section>

  {settings&&<section className="panel rewardCard">
   <h2>🔥 Barren gießen</h2>
   {!settings.smelting_enabled
    ? <div className="noticeBar">Die Goldbarrenschmelze ist momentan deaktiviert.</div>
    : <>
      <p className="small">1 mg Barren bindet exakt 1 mg deines Spiel-Goldbestands. Es gibt beim Gießen keinen Zufallsfaktor und keine Gebühr.</p>
      <div className="barSizeGrid">
       {sizes.map(size=>{
        const costUg=Number(size)*1000
        const enough=Number(wallet?.balance_ug||0)>=costUg
        return <button className="barSmeltCard" key={size} disabled={busy||!enough} onClick={()=>smelt(size)}>
         <span className="barIcon">▰</span>
         <strong>{Number(size).toLocaleString('de-DE')} mg</strong>
         <small>{enough?'Gießen':'Nicht genug Goldstaub'}</small>
        </button>
       })}
      </div>
     </>}
   {msg&&<p className="statusLine">{msg}</p>}
  </section>}

  <section className="panel">
   <div className="sectionTitleRow">
    <div><h2>🪙 Meine Barren</h2><div className="small">{available.length} frei verfügbare digitale Barren</div></div>
   </div>
   {bars.length===0?<div className="muted">Du hast noch keinen Barren gegossen.</div>:
    <div className="myBarsGrid">{bars.map(b=><div className={'digitalBar '+b.status} key={b.id}>
     <div className="digitalBarFace">
      <span className="barIcon big">▰</span>
      <div><strong>{Number(b.size_mg).toLocaleString('de-DE')} mg</strong><small>{b.serial_no}</small></div>
     </div>
     <div className="small">Status: {barStatus(b.status)}</div>
     {b.status==='minted'&&<div className="barActions">
      <button className="miniBtn" disabled={busy} onClick={()=>remelt(b.id)}>♻️ Wieder einschmelzen</button>
      {settings?.redemptions_enabled
       ? <button className="btn goldBtn" disabled={busy} onClick={()=>requestPhysical(b.id)}>📦 Physisch anfordern</button>
       : <button className="miniBtn" disabled title="Noch nicht freigeschaltet">📦 Ausgabe noch gesperrt</button>}
     </div>}
    </div>)}</div>}
  </section>

  <section className="panel">
   <h2>📦 Physische Ausgabe</h2>
   {Number(wallet?.startup_bonus_ug||0)>0&&<div className="noticeBar">🎁 Vor deiner ersten physischen Auszahlung wird dein Startbonus einmalig aus dem frei verfügbaren Goldstaub zurückgeführt. Danach gibt es keinen weiteren Bonus-Abzug.</div>}
   {!settings?.redemptions_enabled&&<div className="noticeBar">Die technische Schmelze ist aktiv, aber reale Barren-/Prämienausgabe bleibt serverseitig deaktiviert. Das kann später in der Schaltzentrale separat freigeschaltet werden.</div>}
   {requests.length===0?<div className="muted">Noch keine Ausgabewünsche.</div>:
    <div className="rewardRequests">{requests.map(r=><div className="card" key={r.id}>
     <strong>🪙 Goldbarren</strong>
     <span>{formatGold(r.amount_ug)}</span>
     <span className="small">{new Date(r.created_at).toLocaleString('de-DE')} · {r.status}</span>
    </div>)}</div>}
  </section>

  <section className="panel">
   <h2>So funktioniert die Schmelze</h2>
   <div className="smelterFlow">
    <div><strong>1</strong><span>Goldstaub sammeln</span></div>
    <div><strong>2</strong><span>Barrengröße wählen</span></div>
    <div><strong>3</strong><span>Digitalen Barren gießen</span></div>
    <div><strong>4</strong><span>Behalten oder wieder einschmelzen</span></div>
    <div><strong>5</strong><span>Später optional physisch einlösen</span></div>
   </div>
  </section>
 </main>
}

function barStatus(status){
 return ({
  minted:'frei verfügbar',
  redemption_requested:'physische Ausgabe angefragt',
  redeemed:'physisch ausgegeben',
  remelted:'wieder eingeschmolzen',
  cancelled:'storniert'
 })[status]||status
}
