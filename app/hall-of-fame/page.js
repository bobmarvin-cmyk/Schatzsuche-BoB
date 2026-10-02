'use client'
import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase-browser'

export default function HallOfFame(){
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[msg,setMsg]=useState('')

 useEffect(()=>{load()},[])

 async function load(){
  const {data:{user}}=await supabase.auth.getUser()
  if(!user){location.replace('/login');return}
  const {data,error}=await supabase.rpc('list_game_archive_v683',{p_limit:150})
  if(error)setMsg(error.message)
  setRows(data||[])
  setLoading(false)
 }

 return <main className="container">
  <div className="topnav">
   <a className="btn" href="/lobby">← Lobby</a>
   <a className="btn" href="/legenden">🏆 Legenden</a>
  </div>

  <div className="panel hallHero">
   <div className="small">SPIELARCHIV</div>
   <h1>🏛️ Hall of Fame</h1>
   <p className="muted">Beendete Multiplayer-Spiele bleiben hier als dauerhafter Rückblick erhalten – inklusive Sieger, Endstand und Endkarte. Solo-Spiele zählen hier nicht.</p>
  </div>

  {msg&&<div className="noticeBar">{msg}</div>}

  <div className="hofGrid">
   {loading&&<div className="panel">Lade Spielarchiv…</div>}
   {!loading&&rows.length===0&&<div className="panel muted">Noch keine archivierten Spiele.</div>}
   {rows.map((r,i)=><a className="panel hofCard" href={'/archiv/'+r.game_id} key={r.game_id}>
    <div className="hofTop">
     <span className="hofNumber">#{rows.length-i}</span>
     <span className="gameBadge">{r.game_type==='pay'?'✨ PAY TEST':'🆓 STANDARD'}</span>
    </div>
    <h2>{r.name}</h2>
    <div className="hofWinner">
      {r.winner_name?<><span>🏆</span><strong>{r.winner_name}</strong></>:<span className="muted">Ohne Sieger beendet</span>}
    </div>
    <div className="hofFacts">
      <span>👥 {r.player_count} Spieler</span>
      <span>🎯 {Number(r.total_moves||0).toLocaleString('de-DE')} Züge</span>
      <span>🗺️ {Number(r.total_fields||0).toLocaleString('de-DE')} Felder</span>
    </div>
    <div className="small">Siegerwertung: {r.winner_share_bps!=null?`${(Number(r.winner_share_bps)/100).toFixed(2)}% Schatz`: '–'}{r.winner_moves_used!=null?` · ${Number(r.winner_moves_used).toLocaleString('de-DE')} manuelle Züge`:''}</div>
    <div className="small">{r.closed_at?new Date(r.closed_at).toLocaleString('de-DE'):'–'}</div>
   </a>)}
  </div>
 </main>
}
