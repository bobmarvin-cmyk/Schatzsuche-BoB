'use client'
import {useEffect,useState} from 'react'
import {useParams} from 'next/navigation'
import {supabase} from '../../../lib/supabase-browser'
import ArchiveMap from '../../../components/ArchiveMap'
import {formatGold} from '../../../lib/gold'

export default function ArchivedGame(){
 const {id}=useParams()
 const [archive,setArchive]=useState(null),[fields,setFields]=useState([]),[msg,setMsg]=useState('')

 useEffect(()=>{load()},[id])

 async function load(){
  const {data:{user}}=await supabase.auth.getUser()
  if(!user){location.replace('/login');return}

  const {data,error}=await supabase.rpc('get_game_archive_v683',{p_game_id:id})
  if(error){setMsg(error.message);return}
  setArchive(data?.archive||null)
  setFields(data?.fields||[])
 }

 if(msg)return <main className="container"><div className="panel"><h1>Spielarchiv</h1><p>{msg}</p><a className="btn" href="/hall-of-fame">← Hall of Fame</a></div></main>
 if(!archive)return <main className="container"><div className="panel">Lade Endstand…</div></main>

 const players=archive.players||[]

 return <main className="container">
  <div className="topnav">
   <a className="btn" href="/hall-of-fame">← Hall of Fame</a>
   <a className="btn" href="/lobby">Lobby</a>
  </div>

  <div className="panel archiveHero">
   <div>
    <div className="small">BEENDETES SPIEL</div>
    <h1>{archive.name}</h1>
    <p className="muted">📍 {archive.center_label||'Weltkarte'} · beendet {archive.closed_at?new Date(archive.closed_at).toLocaleString('de-DE'):''}</p>
   </div>
   {archive.winner_name&&<div className="archiveWinnerBadge">
    <span>🏆 Sieger</span>
    <strong>{archive.winner_bot_id
      ?<a className="profileLink" href={'/bot/'+archive.winner_bot_id}>{archive.winner_name}</a>
      :archive.winner_user_id
        ?<a className="profileLink" href={'/spieler/'+archive.winner_user_id}>{archive.winner_name}</a>
        :archive.winner_name}</strong>
    <small>Siegerwertung: {(Number(archive.winner_share_bps||0)/100).toFixed(2)}% Schatz{archive.winner_moves_used!=null?` · ${Number(archive.winner_moves_used).toLocaleString('de-DE')} manuelle Züge`:''}{Number(archive.winner_taler_gold_ug||0)>0?` · ${formatGold(archive.winner_taler_gold_ug)} Talerbonus`:''}</small>
   </div>}
  </div>

  <div className="grid archiveStats">
   <div className="card"><div className="small">Spieler</div><div className="stat">{archive.player_count}</div></div>
   <div className="card"><div className="small">Züge insgesamt</div><div className="stat">{Number(archive.total_moves||0).toLocaleString('de-DE')}</div></div>
   <div className="card"><div className="small">Erkundete Felder</div><div className="stat">{Number(archive.total_fields||0).toLocaleString('de-DE')}</div></div>
  </div>

  <section className="panel">
   <div className="mapHeader">
    <div><h2>🗺️ Endkarte</h2><div className="small">Die Farben zeigen, welcher Spieler die jeweiligen Bereiche erkundet hat. Gold markiert einen Schatzbereich.</div></div>
    <div className="mapLegend">{players.map(p=><div className="legendItem" key={p.user_id}><span className="colorDot" style={{background:p.player_color||'#35516d'}}></span><a className="profileLink" href={p.is_bot?'/bot/'+p.bot_id:'/spieler/'+p.user_id}>{p.avatar_emoji?`${p.avatar_emoji} `:''}{p.display_name||'Spieler'}</a></div>)}</div>
   </div>
   <ArchiveMap archive={archive} fields={fields}/>
  </section>

  {archive.game_type==='pay'&&<section className="panel">
   <h2>✨ Goldstaub-Verteilung</h2>
   <p className="small">Auszahlung der gefundenen Gold-Schatzteile in diesem Spiel. Insgesamt an Schatzfinder ausgezahlt: <strong>✨ {formatGold(players.reduce((sum,p)=>sum+Number(p.gold_received_ug||0),0))}</strong>.</p>
   <div className="goldDistributionSummary">
    <div className="card"><div className="small">Community gesamt</div><div className="stat">✨ {formatGold(archive.community_distributed_ug)}</div></div>
    <div className="card"><div className="small">Community-Empfänger</div><div className="stat">{Number(archive.community_recipient_count||0)}</div></div>
    <div className="card"><div className="small">Ø je Empfänger</div><div className="stat">✨ {formatGold(Number(archive.community_distributed_ug||0)/Math.max(1,Number(archive.community_recipient_count||0)))}</div></div>
   </div>
   <div className="archivePlayerList">
    {players.map(p=><div className="card archivePlayer" key={'gold-'+p.user_id}>
      <div className="playerNameLine"><span className="colorDot large" style={{background:p.player_color||'#35516d'}}></span><strong><a className="profileLink" href={p.is_bot?'/bot/'+p.bot_id:'/spieler/'+p.user_id}>{p.avatar_emoji?`${p.avatar_emoji} `:''}{p.display_name||'Spieler'}</a></strong></div>
      <div className="stat">✨ {formatGold(p.gold_received_ug)}</div>
      <div className="small">{(Number(p.treasure_share_bps||0)/100).toFixed(2)} % Schatzanteil · {Number(p.treasure_parts_found||0)} Teile</div>
      {Number(p.community_received_ug||0)>0&&<div className="small">Community-Anteil aus diesem Spiel: ✨ {formatGold(p.community_received_ug)}</div>}
      {Number(p.winner_conversion_ug||0)>0&&<div className="small">Gewinner-Taler → Gold: ✨ {formatGold(p.winner_conversion_ug)}</div>}
    </div>)}
   </div>
  </section>}

  <section className="panel">
   <h2>Endstand</h2>
   <div className="archivePlayerList">
    {players.map((p,i)=><div className={'card archivePlayer '+(p.user_id===archive.winner_user_id?'winner':'')} key={p.user_id}>
      <div className="playerNameLine">
       <span className="colorDot large" style={{background:p.player_color||'#35516d'}}></span>
       <strong><a className="profileLink" href={p.is_bot?'/bot/'+p.bot_id:'/spieler/'+p.user_id}>{p.avatar_emoji?`${p.avatar_emoji} `:''}{p.display_name||'Spieler'}</a></strong>
       {p.user_id===archive.winner_user_id&&<span>🏆</span>}
      </div>
      <div className="small">{Number(p.moves_used||0).toLocaleString('de-DE')} Züge · ⚙️ {Number(p.machine_ticks_used||0).toLocaleString('de-DE')} Maschinentakte · {Number(p.fields||0).toLocaleString('de-DE')} Felder · 🧩 {(Number(p.treasure_share_bps||0)/100).toFixed(2)}% Schatz · {Number(p.coins||0).toFixed(2)} Taler</div>
    </div>)}
   </div>
  </section>
 </main>
}
