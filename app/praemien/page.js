'use client'
import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase-browser'
import {formatGold} from '../../lib/gold'

export default function Praemien(){
 const [wallet,setWallet]=useState(null)
 const [settings,setSettings]=useState(null)
 const [requests,setRequests]=useState([])
 const [msg,setMsg]=useState('')
 const [busy,setBusy]=useState(false)

 useEffect(()=>{load()},[])

 async function load(){
  const {data:{user}}=await supabase.auth.getUser()
  if(!user){location.href='/login';return}
  const [{data:w},{data:s},{data:r}]=await Promise.all([
    supabase.from('gold_wallets').select('balance_ug').eq('user_id',user.id).maybeSingle(),
    supabase.from('platform_settings').select('redemptions_enabled,gold_bar_size_mg,gold_bar_cost_ug').eq('id',1).single(),
    supabase.from('gold_redemption_requests_v619').select('id,amount_ug,reward_type,status,created_at').order('created_at',{ascending:false}).limit(20)
  ])
  setWallet(w);setSettings(s);setRequests(r||[])
 }

 async function requestBar(){
  setBusy(true);setMsg('')
  const {data,error}=await supabase.rpc('request_gold_bar_v619')
  setBusy(false)
  setMsg(error?error.message:(data?.message||'Anfrage angelegt'))
  if(!error)await load()
 }

 return <main className="container rewardsPage">
  <div className="buildBadge">V6.20.2</div>
  <div className="topnav"><a className="btn" href="/lobby">← Lobby</a></div>

  <section className="panel rewardHero">
   <div>
    <div className="small">GOLDSTAUB</div>
    <h1>🪙 Prämien & Barren</h1>
    <p className="muted">Technische Einlösung von erspieltem Gold. Die tatsächliche Ausgabe realer Prämien wird erst nach gesonderter rechtlicher und organisatorischer Freigabe aktiviert.</p>
   </div>
   <div className="goldWalletCard">
    <div className="small">Dein Bestand</div>
    <div className="goldBalance">✨ {formatGold(wallet?.balance_ug||0)}</div>
   </div>
  </section>

  {settings&&<section className="panel rewardCard">
   <h2>Goldbarren-Prämie</h2>
   <div className="rewardBarIcon">▰</div>
   <p><strong>{Number(settings.gold_bar_size_mg||1000).toLocaleString('de-DE')} mg Goldbarren</strong></p>
   <p className="small">Benötigter Spiel-Goldbestand: {formatGold(settings.gold_bar_cost_ug||0)}</p>
   {!settings.redemptions_enabled
    ? <div className="noticeBar">Noch nicht freigeschaltet. Die Funktion ist technisch vorbereitet, aber reale Ausgaben bleiben serverseitig deaktiviert.</div>
    : <button className="btn goldBtn" disabled={busy||Number(wallet?.balance_ug||0)<Number(settings.gold_bar_cost_ug||0)} onClick={requestBar}>
       {busy?'Wird angefragt…':'Barren anfordern'}
      </button>}
   {msg&&<p className="statusLine">{msg}</p>}
  </section>}

  <section className="panel">
   <h2>Meine Anfragen</h2>
   {requests.length===0?<div className="muted">Noch keine Prämienanfragen.</div>:
    <div className="rewardRequests">{requests.map(r=><div className="card" key={r.id}>
     <strong>🪙 Goldbarren</strong>
     <span>{formatGold(r.amount_ug)}</span>
     <span className="small">{new Date(r.created_at).toLocaleString('de-DE')} · {r.status}</span>
    </div>)}</div>}
  </section>
 </main>
}
