'use client'
import {useEffect,useState} from 'react'
import {useParams} from 'next/navigation'
import {supabase} from '../../../lib/supabase-browser'
import GameMap from '../../../components/GameMap'
import {formatGold} from '../../../lib/gold'

const PAGE_SIZE=1000

async function loadAllFields(gameId){
  const all=[]
  let from=0
  while(true){
    const {data,error}=await supabase
      .from('explored_fields')
      .select('x,y,discovered_by,is_treasure,discovered_at')
      .eq('game_id',gameId)
      .order('discovered_at',{ascending:true})
      .range(from,from+PAGE_SIZE-1)

    if(error)throw error
    const batch=data||[]
    all.push(...batch)

    if(batch.length<PAGE_SIZE)break
    from+=PAGE_SIZE
  }
  return all
}

export default function Game(){
 const {id}=useParams()
 const [user,setUser]=useState(null),[game,setGame]=useState(null),[players,setPlayers]=useState([])
 const [fields,setFields]=useState([]),[owned,setOwned]=useState([]),[branch,setBranch]=useState('Erkundung'),[technologies,setTechnologies]=useState([])
 const [msg,setMsg]=useState(''),[regenInfo,setRegenInfo]=useState(null),[wallet,setWallet]=useState(null),[goldTreasures,setGoldTreasures]=useState([])
 const [joinState,setJoinState]=useState('checking'),[joinPassword,setJoinPassword]=useState('')

 useEffect(()=>{
  init()
  const ch=supabase.channel('game-'+id)
   .on('postgres_changes',{event:'*',schema:'public',table:'explored_fields',filter:`game_id=eq.${id}`},load)
   .on('postgres_changes',{event:'*',schema:'public',table:'game_players',filter:`game_id=eq.${id}`},load)
   .on('postgres_changes',{event:'*',schema:'public',table:'games',filter:`id=eq.${id}`},load)
   .on('postgres_changes',{event:'*',schema:'public',table:'player_technologies',filter:`game_id=eq.${id}`},load)
   .subscribe()
  const timer=setInterval(()=>refreshMoves(),1000)
  return()=>{supabase.removeChannel(ch);clearInterval(timer)}
 },[id])

 async function init(){
  const {data:{user}}=await supabase.auth.getUser()
  if(!user){location.href='/login';return}
  await supabase.rpc('run_game_maintenance_v66')
  setUser(user)

  const stored=sessionStorage.getItem('game_password_'+id)
  const {error}=await supabase.rpc('join_game_v65',{p_game_id:id,p_password:stored||null})
  if(error){
    if(error.message?.toLowerCase().includes('passwort')){
      setJoinState('password')
      setMsg('Dieses Spiel ist passwortgeschützt.')
      return
    }
    setJoinState('error');setMsg(error.message);return
  }

  setJoinState('joined')
  await refreshMoves()
  await load()
 }

 async function submitGamePassword(){
  const {error}=await supabase.rpc('join_game_v65',{p_game_id:id,p_password:joinPassword||null})
  if(error){setMsg(error.message);return}
  sessionStorage.setItem('game_password_'+id,joinPassword)
  setJoinState('joined');setMsg('')
  await refreshMoves();await load()
 }

 async function refreshMoves(){
  if(joinState==='password'||joinState==='error')return
  const {data}=await supabase.rpc('refresh_player_moves',{p_game_id:id})
  if(data){setRegenInfo(data);load(false)}
 }

 async function load(){
  const {data:{user}}=await supabase.auth.getUser()
  try{
    const [g,p,t,f,w,gt,tech]=await Promise.all([
      supabase.from('games').select('*').eq('id',id).single(),
      supabase.from('game_players').select('user_id,coins,moves_left,reveal_power,reward_multiplier,analysis_level,player_color,move_capacity_bonus,regen_reduction,last_regen_at,profiles(display_name)').eq('game_id',id).order('joined_at'),
      supabase.from('player_technologies').select('technology_id').eq('game_id',id).eq('user_id',user?.id||'00000000-0000-0000-0000-000000000000'),
      loadAllFields(id),
      supabase.from('gold_wallets').select('balance_ug').eq('user_id',user?.id||'00000000-0000-0000-0000-000000000000').maybeSingle(),
      supabase.rpc('get_gold_treasure_status_v65',{p_game_id:id}),
      supabase.from('technologies').select('id,name,branch,cost,reveal_power_bonus,reward_bonus,analysis_level,capacity_bonus,regen_reduction,requires,description,sort_order,is_active').eq('is_active',true).order('sort_order',{ascending:true}).order('id',{ascending:true})
    ])

    setGame(g.data)
    setPlayers(p.data||[])
    setOwned((t.data||[]).map(x=>x.technology_id))
    setFields(f)
    setWallet(w.data)
    setGoldTreasures(gt.data||[])
    setTechnologies(tech.data||[])
  }catch(err){
    setMsg('Fehler beim Laden der Karte: '+(err?.message||String(err)))
  }
 }

 async function reveal(x,y){
  const {data,error}=await supabase.rpc('reveal_area_v66',{p_game_id:id,p_x:x,p_y:y})
  setMsg(error?error.message:(data?.message||'Gebiet untersucht'))
  await refreshMoves()
  await load()
 }

 async function buy(t){
  const {data,error}=await supabase.rpc('buy_technology',{p_game_id:id,p_technology_id:t.id})
  setMsg(error?error.message:(data?.message||'Erforscht'))
  await refreshMoves()
  await load()
 }

 const me=players.find(p=>p.user_id===user?.id)
 const left=game?Math.max(0,game.width*game.height-fields.length):0
 const has=x=>owned.includes(x)
 const cap=game?Number(game.max_stored_moves||4)+Number(me?.move_capacity_bonus||0):4
 const effectiveRegen=game?Math.max(5,Math.round(Number(game.regen_seconds||30)*(1-Number(me?.regen_reduction||0)))):30
 const branches=[...new Set(technologies.map(t=>t.branch))]
 const activeBranch=branches.includes(branch)?branch:(branches[0]||'Erkundung')

 function techEffect(t){
  if(t.description)return t.description
  const effects=[]
  if(Number(t.reveal_power_bonus))effects.push(`+${t.reveal_power_bonus} Felder/Zug`)
  if(Number(t.reward_bonus))effects.push(`+${Math.round(Number(t.reward_bonus)*100)}% Talerbonus`)
  if(Number(t.analysis_level))effects.push(`Analyse Stufe ${t.analysis_level}`)
  if(Number(t.capacity_bonus))effects.push(`+${t.capacity_bonus} Zugspeicher`)
  if(Number(t.regen_reduction))effects.push(`${Math.round(Number(t.regen_reduction)*100)}% schnellere Regeneration`)
  return effects.join(' · ')||'Keine direkte Wirkung'
 }

 if(joinState==='password'){
  return <main className="container authGate">
   <div className="panel compactPanel">
    <h1>🔒 Privates Spiel</h1>
    <p className="muted">Gib das vom Host festgelegte Passwort ein.</p>
    <input className="input" type="password" value={joinPassword} onChange={e=>setJoinPassword(e.target.value)}
      onKeyDown={e=>{if(e.key==='Enter')submitGamePassword()}} autoFocus/>
    <button className="btn primary wideOnMobile" onClick={submitGamePassword}>Spiel betreten</button>
    <p>{msg}</p>
    <a className="textLink" href="/lobby">← Zur Lobby</a>
   </div>
  </main>
 }
 if(joinState==='error'){
  return <main className="container authGate"><div className="panel compactPanel"><h1>Spiel nicht verfügbar</h1><p>{msg}</p><a className="btn" href="/lobby">Zur Lobby</a></div></main>
 }

 return <main className="container">
  <div className="topnav"><a className="btn" href="/lobby">← Lobby</a><a className="btn" href="/profile">Profil</a><a className="btn" href="/legenden">🏆 Legenden</a></div>

  <div className="panel"><h1>{game?.name||'Spiel'}</h1>
   <div className="worldMeta">
    <span>📍 {game?.center_label||'Kartenmittelpunkt'} · {game?.cell_size_m||100} m pro Feld · echte Weltkarte</span>
    {game?.invite_code&&<span className="inviteChip">Einladungscode: <strong>{game.invite_code}</strong>{game.is_private?' · 🔒 privat':''}</span>}
   </div>
   <div className="grid">
    {[
     [Number(me?.coins||0).toFixed(2),'Taler'],
     [`${me?.moves_left??0} / ${cap}`,'Züge'],
     [`${effectiveRegen}s`,'Regeneration'],
     [me?.reveal_power??1,'Felder/Zug'],
     [(me?.reward_multiplier??1)+'×','Bonus'],
     ['Stufe '+(me?.analysis_level??0),'Analyse'],
     [left.toLocaleString('de-DE'),'Felder übrig']
    ].map((v,i)=><div className="card" key={i}><div className="small">{v[1]}</div><div className="stat">{v[0]}</div></div>)}
   </div>
   <div className="regenBarText">Ungenutzte Züge werden bis zum Speicherlimit gesammelt; darüber hinaus verfallen sie.</div>
  </div>

  {game?.game_type==='pay'&&<div className="panel goldGamePanel">
   <div className="goldGameHeader">
    <div><div className="small">PAYGAME · TESTMODUS</div><h2>✨ Goldstaub-Schatzsuche</h2></div>
    <div className="goldBalance">Wallet: {formatGold(wallet?.balance_ug||0)}</div>
   </div>
   <div className="grid goldStats">
    <div className="card"><div className="small">Einsatz pro Spieler</div><div className="stat">{formatGold(game.entry_gold_ug)}</div></div>
    <div className="card"><div className="small">Schatzpool aktuell</div><div className="stat">{formatGold(game.gold_prize_pool_ug)}</div></div>
    <div className="card"><div className="small">Goldschätze offen</div><div className="stat">{goldTreasures.filter(t=>!t.found_by).length} / {goldTreasures.length}</div></div>
   </div>
   <div className="treasurePills">{goldTreasures.map((t,i)=><span key={t.id} className={'treasurePill '+(t.found_by?'found':'')}>
    {t.found_by?'✅':'✨'} Schatz {i+1}: {formatGold(t.amount_ug)}
   </span>)}</div>
   <div className="small">Test-Goldstaub hat in V6.5 keinen Echtgeldwert und kann weder gekauft noch ausgezahlt werden.</div>
  </div>}

  <div className="gameLayout">
   <section className="panel">
    <div className="mapHeader"><div><h2>Weltkarte</h2><div className="small">Zoomen und verschieben ist möglich. Klick auf ein Rasterfeld = erkunden.</div></div>
     <div className="mapLegend">{players.map(p=><div className="legendItem" key={p.user_id}><span className="colorDot" style={{background:p.player_color||'#35516d'}}></span>{p.profiles?.display_name||'Spieler'}</div>)}</div>
    </div>
    {game&&<GameMap game={game} fields={fields} players={players} onReveal={reveal}/>}
    <p className="statusLine">{msg}</p>
   </section>

   <aside className="panel">
    <h2>Technologiebaum</h2>
    <div className="branchTabs">{branches.map(b=><button key={b} className={'branchTab '+(activeBranch===b?'active':'')} onClick={()=>setBranch(b)}>{b}</button>)}</div>
    <div className="techList">{technologies.filter(t=>t.branch===activeBranch).map(t=>{
     const req=t.requires||[]
     const bought=has(t.id),unlocked=req.every(has),enough=Number(me?.coins||0)>=Number(t.cost)
     return <div key={t.id} className={'techCard '+(bought?'bought':unlocked?'available':'locked')}>
      <strong>{bought?'✅ ':''}{t.name}</strong><div className="small">{techEffect(t)}</div>
      <div className="small">Benötigt: {req.length?req.join(', '):'–'}</div>
      <div className="techBottom"><b>{Number(t.cost).toFixed(2)} T</b><button className="btn primary" disabled={bought||!unlocked||!enough} onClick={()=>buy(t)}>{bought?'Erforscht':'Erforschen'}</button></div>
     </div>
    })}</div>
   </aside>
  </div>

  <div className="panel"><h2>Spieler</h2><div className="grid">{players.map(p=><div className="card" key={p.user_id}>
   <div className="playerNameLine"><span className="colorDot large" style={{background:p.player_color||'#35516d'}}></span><strong>{p.profiles?.display_name||'Spieler'}</strong></div>
   <div className="small">{Number(p.coins).toFixed(2)} T · {p.moves_left} gespeicherte Züge · {p.reveal_power} Felder/Zug</div>
  </div>)}</div></div>
 </main>
}
