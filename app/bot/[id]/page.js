'use client'
import {useEffect,useState} from 'react'
import {useParams} from 'next/navigation'
import {supabase} from '../../../lib/supabase-browser'

export default function BotProfile(){
 const {id}=useParams()
 const [bot,setBot]=useState(null),[loading,setLoading]=useState(true),[msg,setMsg]=useState('')

 useEffect(()=>{load()},[id])

 async function load(){
  const {data:{user}}=await supabase.auth.getUser()
  if(!user){location.href='/login';return}
  const {data,error}=await supabase.rpc('get_bot_profile_v639',{p_bot_id:id})
  if(error)setMsg(error.message)
  setBot(data||null)
  setLoading(false)
 }

 if(loading)return <main className="container"><div className="panel">Lade Bot-Profil…</div></main>
 if(!bot)return <main className="container"><div className="panel"><h1>Bot nicht gefunden</h1><p>{msg}</p><a className="btn" href="/lobby">← Lobby</a></div></main>

 const success=Number(bot.treasure_attempts||0)>0
  ?100*Number(bot.treasure_successes||0)/Number(bot.treasure_attempts||1)
  :0

 return <main className="container publicProfilePage">
  <div className="topnav"><a className="btn" href="/lobby">← Lobby</a></div>

  <section className="panel publicProfileHero botProfileHero">
   <div className="profileAvatar avatarFallback botAvatar">{bot.avatar_emoji||'🤖'}</div>
   <div>
    <div className="eyebrow">BOT-PROFIL</div>
    <h1>{bot.display_name}</h1>
    <p className="profileBioView">Automatischer Mitspieler · Schwierigkeit: <strong>{bot.difficulty}</strong></p>
   </div>
  </section>

  <section className="grid profileStats">
   <div className="card"><div className="small">Spiele</div><div className="stat">{Number(bot.total_games||0)}</div></div>
   <div className="card"><div className="small">Erforschte Felder</div><div className="stat">{Number(bot.total_fields_revealed||0).toLocaleString('de-DE')}</div></div>
   <div className="card"><div className="small">Technologien</div><div className="stat">{Number(bot.total_technologies||0)}</div></div>
   <div className="card"><div className="small">Schatzsicherung</div><div className="stat">{success.toFixed(1)}%</div></div>
   <div className="card"><div className="small">Aktiv seit</div><div className="stat memberSince">{bot.created_at?new Date(bot.created_at).toLocaleDateString('de-DE',{month:'short',year:'numeric'}):'–'}</div></div>
  </section>

  <section className="panel">
   <h2>Historie</h2>
   <div className="botHistoryList">
    {(bot.history||[]).length===0&&<div className="muted">Noch keine Spiele.</div>}
    {(bot.history||[]).map(h=><div className="botHistoryRow" key={h.game_id}>
     <div><strong>{h.game_name}</strong><span className="small">{h.game_status} · {h.joined_at?new Date(h.joined_at).toLocaleString('de-DE'):'–'}</span></div>
     <div className="small">🗺️ {Number(h.fields_revealed||0).toLocaleString('de-DE')} · 🧠 {Number(h.technologies||0)} · 🧩 {(Number(h.treasure_share_bps||0)/100).toFixed(2)}%</div>
    </div>)}
   </div>
  </section>
 </main>
}
