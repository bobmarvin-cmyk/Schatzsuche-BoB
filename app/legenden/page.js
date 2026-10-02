'use client'
import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase-browser'
import {formatGold} from '../../lib/gold'

const TABS=[
 ['wins','🏆 Siege'],
 ['fields','🗺️ Erkundung'],
 ['gold','✨ Goldfunde'],
 ['games','🎮 Spiele']
]

export default function Legenden(){
 const [tab,setTab]=useState('wins'),[rows,setRows]=useState([]),[loading,setLoading]=useState(true)

 useEffect(()=>{load()},[tab])

 async function load(){
  setLoading(true)
  const {data,error}=await supabase.rpc('leaderboard_v65',{p_metric:tab,p_limit:50})
  setRows(error?[]:(data||[]))
  setLoading(false)
 }

 function value(r){
  if(tab==='gold')return formatGold(r.metric_value)
  return Number(r.metric_value||0).toLocaleString('de-DE')
 }

 return <main className="container">
  <div className="topnav"><a className="btn" href="/lobby">← Lobby</a><a className="btn" href="/hall-of-fame">🏛️ Hall of Fame</a></div>
  <div className="panel">
   <h1>🏆 Legenden</h1>
   <p className="muted">Bestenlisten nach unterschiedlichen Errungenschaften. Goldwerte beziehen sich in V6.5 ausschließlich auf Test-Goldstaub.</p>
   <div className="legendTabs">{TABS.map(t=><button key={t[0]} className={'branchTab '+(tab===t[0]?'active':'')} onClick={()=>setTab(t[0])}>{t[1]}</button>)}</div>
   <div className="leaderTable">
    <div className="leaderRow header"><span>Rang</span><span>Spieler</span><span>Wert</span></div>
    {loading&&<div className="muted">Lade Bestenliste…</div>}
    {!loading&&rows.map((r,i)=><div className={'leaderRow '+(i<3?'top top'+(i+1):'')} key={r.user_id}>
     <span className="rank">{i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1)}</span>
     <strong><a className="profileLink" href={'/spieler/'+r.user_id}>{r.display_name||'Spieler'}</a></strong>
     <span>{value(r)}</span>
    </div>)}
   </div>
  </div>
 </main>
}
