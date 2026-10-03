'use client'
import {useEffect,useRef,useState} from 'react'
import {useParams} from 'next/navigation'
import {supabase} from '../../../lib/supabase-browser'
import GameMap from '../../../components/GameMap'
import {formatGold} from '../../../lib/gold'
import GameChat from '../../../components/GameChat'

export default function Game(){
 const {id}=useParams()
 const [user,setUser]=useState(null),[game,setGame]=useState(null),[players,setPlayers]=useState([])
 const [fields,setFields]=useState([]),[owned,setOwned]=useState([]),[branch,setBranch]=useState('Erkundung'),[technologies,setTechnologies]=useState([])
 const [msg,setMsg]=useState(''),[regenInfo,setRegenInfo]=useState(null),[wallet,setWallet]=useState(null),[goldTreasures,setGoldTreasures]=useState([])
 const [joinState,setJoinState]=useState('checking'),[joinPassword,setJoinPassword]=useState(''),[analysisHint,setAnalysisHint]=useState(null),[analysisFeatures,setAnalysisFeatures]=useState([]),[analysisFocusToken,setAnalysisFocusToken]=useState(0),[tick,setTick]=useState(0),[winnerCelebration,setWinnerCelebration]=useState(null),[gimmickPopup,setGimmickPopup]=useState(null),[treasurePopup,setTreasurePopup]=useState(null),[activeGames,setActiveGames]=useState([])
 const moveRefreshBusy=useRef(false),revealBusy=useRef(false),machineBusy=useRef(false),viewportTimer=useRef(null),viewportSeq=useRef(0),currentViewport=useRef(null)

 useEffect(()=>{
  init()
  const ch=supabase.channel('game-'+id)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'explored_fields',filter:`game_id=eq.${id}`},()=>{
     // Nie mehr Tausende Einzelereignisse in die Karte schreiben.
     // Ein kurzer Debounce lädt nur den aktuell sichtbaren Kartenausschnitt neu.
     scheduleVisibleReload(180)
   })
   .on('postgres_changes',{event:'*',schema:'public',table:'game_players',filter:`game_id=eq.${id}`},()=>loadPlayersOnly())
   .on('postgres_changes',{event:'*',schema:'public',table:'games',filter:`id=eq.${id}`},()=>{loadGameOnly();loadActiveGames()})
   .on('postgres_changes',{event:'*',schema:'public',table:'player_technologies',filter:`game_id=eq.${id}`},()=>loadOwnedOnly())
   .subscribe()
  const timer=setInterval(()=>setTick(t=>t+1),1000)
  return()=>{supabase.removeChannel(ch);clearInterval(timer);clearTimeout(viewportTimer.current)}
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
  if(data){setRegenInfo(data);await loadPlayersOnly()}
 }

 async function loadPlayersOnly(){
  const {data}=await supabase.from('game_players').select('user_id,coins,moves_left,reveal_power,reward_multiplier,analysis_level,player_color,move_capacity_bonus,regen_reduction,last_regen_at,machine_last_run_at,auto_focus_x,auto_focus_y,treasure_share_bps,treasure_parts_found,machine_ticks_used,machine_mode,gimmick_reveal_bonus_pending,profiles(display_name,avatar_path)').eq('game_id',id).order('joined_at')
  if(data)setPlayers(data)
 }
 async function loadGameOnly(){
  const {data}=await supabase.from('games').select('*').eq('id',id).single()
  if(data)setGame(data)
 }
 async function loadOwnedOnly(){
  const {data:{user}}=await supabase.auth.getUser(); if(!user)return
  const {data}=await supabase.from('player_technologies').select('technology_id').eq('game_id',id).eq('user_id',user.id)
  if(data)setOwned(data.map(x=>x.technology_id))
 }
 async function loadGoldOnly(){
  const {data:{user}}=await supabase.auth.getUser(); if(!user)return
  const [w,gt]=await Promise.all([
   supabase.from('gold_wallets').select('balance_ug').eq('user_id',user.id).maybeSingle(),
   supabase.rpc('get_treasure_status_v610',{p_game_id:id})
  ])
  setWallet(w.data);setGoldTreasures(gt.data||[])
 }
 async function loadActiveGames(){
  const {data}=await supabase.rpc('my_active_games_v613')
  if(data)setActiveGames(data)
 }

 function nextGame(){
  if(activeGames.length<2)return
  const idx=activeGames.findIndex(g=>g.game_id===id)
  const next=activeGames[(idx>=0?idx+1:0)%activeGames.length]
  if(next?.game_id)location.href='/game/'+next.game_id
 }

 function handleTreasure(data,source='manual'){
  if(!data?.part_found)return
  const popup={
    parts:Number(data.parts_gained||1),
    share:Number(data.share_gained_bps||0),
    gold:Number(data.gold_won_ug||0),
    source
  }
  setTreasurePopup(popup)
  setTimeout(()=>setTreasurePopup(current=>current===popup?null:current),2200)
 }

 async function load(){
  const {data:{user}}=await supabase.auth.getUser()
  try{
    const [g,p,t,w,gt,tech]=await Promise.all([
      supabase.from('games').select('*').eq('id',id).single(),
      supabase.from('game_players').select('user_id,coins,moves_left,reveal_power,reward_multiplier,analysis_level,player_color,move_capacity_bonus,regen_reduction,last_regen_at,machine_last_run_at,auto_focus_x,auto_focus_y,treasure_share_bps,treasure_parts_found,machine_ticks_used,machine_mode,gimmick_reveal_bonus_pending,profiles(display_name,avatar_path)').eq('game_id',id).order('joined_at'),
      supabase.from('player_technologies').select('technology_id').eq('game_id',id).eq('user_id',user?.id||'00000000-0000-0000-0000-000000000000'),
      supabase.from('gold_wallets').select('balance_ug').eq('user_id',user?.id||'00000000-0000-0000-0000-000000000000').maybeSingle(),
      supabase.rpc('get_treasure_status_v610',{p_game_id:id}),
      supabase.from('technologies').select('id,name,branch,cost,reveal_power_bonus,reward_bonus,analysis_level,capacity_bonus,regen_reduction,machine_auto_fields,requires,description,sort_order,is_active').eq('is_active',true).order('sort_order',{ascending:true}).order('id',{ascending:true})
    ])

    setGame(g.data)
    setPlayers(p.data||[])
    setOwned((t.data||[]).map(x=>x.technology_id))
    setWallet(w.data)
    setGoldTreasures(gt.data||[])
    setTechnologies(tech.data||[])
    loadActiveGames()
  }catch(err){
    setMsg('Fehler beim Laden der Karte: '+(err?.message||String(err)))
  }
 }

 function scheduleVisibleReload(delay=120){
  clearTimeout(viewportTimer.current)
  viewportTimer.current=setTimeout(()=>{
   const v=currentViewport.current
   if(v)loadVisibleFields(v)
  },delay)
 }

 async function loadVisibleFields(v){
  currentViewport.current=v
  const seq=++viewportSeq.current
  const {data,error}=await supabase.rpc('get_visible_fields_v682',{
   p_game_id:id,p_x0:v.x0,p_x1:v.x1,p_y0:v.y0,p_y1:v.y1,p_step:v.step||1
  })
  if(seq!==viewportSeq.current)return
  if(error){setMsg('Kartenausschnitt konnte nicht geladen werden: '+error.message);return}
  setFields(data?.fields||[])
 }

 function handleViewport(v){
  currentViewport.current=v
  scheduleVisibleReload(100)
 }

 async function reveal(x,y){
  if(revealBusy.current)return
  revealBusy.current=true
  setMsg('Suche läuft…')
  try{
    await supabase.rpc('set_machine_focus_v690',{p_game_id:id,p_x:x,p_y:y})
    const {data,error}=await supabase.rpc('reveal_area_v613',{p_game_id:id,p_x:x,p_y:y})
    if(error){setMsg(error.message);return}

    setMsg(data?.message||'Gebiet untersucht')
    handleGimmicks(data?.gimmicks)
    handleTreasure(data,'manual')
    if(data?.game_over){
      setWinnerCelebration({
        won:!!data.won,
        name:data.winner_name||'Spieler',
        moves:Number(data.winner_moves_used||0),
        opened:Number(data.opened||0),
        share:Number(data.winner_share_bps||0),
        talerGold:Number(data.winner_taler_gold_ug||0)
      })
    }
    // Der Server schickt nicht mehr tausende Feldobjekte zurück.
    // Nur der sichtbare Ausschnitt wird einmal kompakt neu geladen.
    if(currentViewport.current)await loadVisibleFields(currentViewport.current)

    const {data:hint}=await supabase.rpc('get_analysis_hint_v68',{p_game_id:id,p_x:x,p_y:y})
    if(hint){setAnalysisHint(hint);setAnalysisFeatures([])}

    // Nur kleine Statusdaten nachladen. Die komplette Feldliste bleibt unangetastet.
    await Promise.all([loadPlayersOnly(),loadGameOnly(),loadGoldOnly()])
  }finally{
    revealBusy.current=false
  }
 }

 function handleGimmicks(g){
  if(!g)return
  const total=Number(g.total||0)
  if(total<=0)return
  const popup={
    total,
    taler:Number(g.taler_bonus||0),
    moves:Number(g.move_bonus||0),
    scanner:Number(g.reveal_bonus||0),
    source:g.source||'manual'
  }
  setGimmickPopup(popup)
  setTimeout(()=>setGimmickPopup(current=>current===popup?null:current),1500)
 }

 async function setMachineMode(mode){
  const {error}=await supabase.rpc('set_machine_mode_v611',{p_game_id:id,p_mode:mode})
  if(error){setMsg('Maschinenmodus: '+error.message);return}
  await loadPlayersOnly()
 }

 async function runMachines(){
  if(machineBusy.current||machinePower<=0||document.visibilityState!=='visible'||!document.hasFocus())return
  machineBusy.current=true
  try{
    await supabase.rpc('machine_presence_v690',{p_game_id:id})
    const {data,error}=await supabase.rpc('run_machines_game_v613',{p_game_id:id})
    if(error){
      if(!error.message?.includes('Noch nicht fällig'))setMsg('Maschinen: '+error.message)
      return
    }
    if(data?.message)setMsg(data.message)
    handleGimmicks(data?.gimmicks)
    handleTreasure(data,'machine')
    if(data?.opened>0&&currentViewport.current)await loadVisibleFields(currentViewport.current)
    await Promise.all([loadPlayersOnly(),loadGameOnly(),loadGoldOnly()])
    if(data?.game_over){
      setWinnerCelebration({
        won:!!data.won,
        name:data.winner_name||'Spieler',
        moves:Number(data.winner_moves_used||0),
        opened:Number(data.opened||0),
        share:Number(data.winner_share_bps||0),
        talerGold:Number(data.winner_taler_gold_ug||0)
      })
    }
  }finally{
    machineBusy.current=false
  }
 }

 async function buy(t){
  const {data,error}=await supabase.rpc('buy_technology',{p_game_id:id,p_technology_id:t.id})
  setMsg(error?error.message:(data?.message||'Erforscht'))
  await Promise.all([loadPlayersOnly(),loadOwnedOnly()])
 }

 const me=players.find(p=>p.user_id===user?.id)
 const left=game?Math.max(0,Number(game.width)*Number(game.height)-Number(game.explored_count||0)):0
 const has=x=>owned.includes(x)
 const cap=game?Number(game.max_stored_moves||4)+Number(me?.move_capacity_bonus||0):4
 const effectiveRegen=Number(regenInfo?.interval_seconds||game?.regen_seconds||30)
 const branches=[...new Set(technologies.map(t=>t.branch))]
 const activeBranch=branches.includes(branch)?branch:(branches[0]||'Erkundung')
 const machinePower=technologies
   .filter(t=>owned.includes(t.id))
   .reduce((sum,t)=>sum+Number(t.machine_auto_fields||0),0)
 const secondsUntilMachine=(()=>{
   if(!me||!game||machinePower<=0)return null
   if((me.machine_mode||'focus')==='focus'&&(me.auto_focus_x==null||me.auto_focus_y==null))return null
   const last=new Date(me.machine_last_run_at||Date.now()).getTime()
   const due=last+effectiveRegen*1000
   return Math.max(0,Math.ceil((due-Date.now())/1000))
 })()

 const secondsUntilMove=(()=>{
  if(!me||!game||Number(me.moves_left)>=cap)return null
  const last=new Date(me.last_regen_at||Date.now()).getTime()
  const due=last+effectiveRegen*1000
  return Math.max(0,Math.ceil((due-Date.now())/1000))
 })()
 useEffect(()=>{
  if(joinState!=='joined'||secondsUntilMove!==0||moveRefreshBusy.current)return
  moveRefreshBusy.current=true
  refreshMoves().finally(()=>{moveRefreshBusy.current=false})
 },[tick,joinState,secondsUntilMove])

 useEffect(()=>{
  if(joinState!=='joined'||machinePower<=0)return
  if(tick%10!==0)return
  if(document.visibilityState!=='visible'||!document.hasFocus())return
  supabase.rpc('machine_presence_v690',{p_game_id:id})
 },[tick,joinState,machinePower,id])

 useEffect(()=>{
  if(joinState!=='joined'||machinePower<=0||secondsUntilMachine!==0)return
  if(document.visibilityState!=='visible'||!document.hasFocus())return
  runMachines()
 },[tick,joinState,secondsUntilMachine,machinePower])

 function techEffect(t){
  const effects=[]
  if(t.description)effects.push(t.description)
  if(Number(t.reveal_power_bonus))effects.push(`+${t.reveal_power_bonus} Felder/Zug`)
  if(Number(t.reward_bonus))effects.push(`+${Math.round(Number(t.reward_bonus)*100)}% Talerbonus`)
  if(Number(t.analysis_level))effects.push(`Analyse Stufe ${t.analysis_level}`)
  if(Number(t.capacity_bonus))effects.push(`+${t.capacity_bonus} Zugspeicher`)
  if(Number(t.regen_reduction))effects.push(`${Math.round(Number(t.regen_reduction)*100)}% schnellere Regeneration`)
  if(Number(t.machine_auto_fields))effects.push(`${Number(t.machine_auto_fields).toLocaleString('de-DE')} automatische Felder/Takt`)
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
  <div className="topnav"><a className="btn" href="/lobby">← Lobby</a><button className="btn" onClick={nextGame} disabled={activeGames.length<2}>↪ Nächstes Game</button><a className="btn" href="/profile">Profil</a><a className="btn" href="/legenden">🏆 Legenden</a><a className="btn" href="/hall-of-fame">🏛️ Hall of Fame</a></div>

  <div className="panel gameTopPanel"><h1>{game?.name||'Spiel'}</h1>
   <div className="worldMeta">
    <span>📍 {game?.center_label||'Kartenmittelpunkt'} · {game?.cell_size_m||100} m pro Feld · echte Weltkarte</span>
    {game?.invite_code&&<span className="inviteChip">Einladungscode: <strong>{game.invite_code}</strong>{game.is_private?' · 🔒 privat':''}</span>}
   </div>
   <div className="gameQuickStats">
    {[
     [Number(me?.coins||0).toFixed(2),'Taler'],
     [`${me?.moves_left??0} / ${cap}`,'Züge'],
     [secondsUntilMove===null?`${effectiveRegen}s`: `${secondsUntilMove}s`,'Nächster Zug'],
     [me?.reveal_power??1,'Felder/Zug'],
     [(me?.reward_multiplier??1)+'×','Bonus'],
     ['Stufe '+(me?.analysis_level??0),'Analyse'],
     [machinePower>0?`${machinePower.toLocaleString('de-DE')} / ${secondsUntilMachine===null?'–':secondsUntilMachine+'s'}`:'0','Maschinenfelder / nächster Takt'],
     [`${Number(game?.gimmick_percent||0).toFixed(2)}% · ${Number(game?.gimmicks_found_count||0).toLocaleString('de-DE')}/${Number(game?.gimmick_target_count||0).toLocaleString('de-DE')}`,'Gimmicks'],
     [left.toLocaleString('de-DE'),'Felder übrig']
    ].map((v,i)=><div className="quickStat" key={i}><span>{v[1]}</span><strong>{v[0]}</strong></div>)}
   </div>
   <div className="regenBarText">Ungenutzte Züge werden bis zum Speicherlimit gesammelt; darüber hinaus verfallen sie.</div>
   {machinePower>0&&<div className="machineStatus">
    <div><strong>⚙️ Maschinen</strong> · arbeiten nur solange dieses Spiel sichtbar geöffnet ist.</div>
    <div className="machineModeRow">
     <span>Suchmodus:</span>
     <button className={'miniBtn '+((me?.machine_mode||'focus')==='focus'?'active':'')} onClick={()=>setMachineMode('focus')}>📍 Letzte Suche</button>
     <button className={'miniBtn '+(me?.machine_mode==='random'?'active':'')} onClick={()=>setMachineMode('random')}>🎲 Zufällig</button>
    </div>
   </div>}
  </div>

  {game&&<details className={'panel compactTreasurePanel '+(game.game_type==='pay'?'goldGamePanel':'treasureGamePanel')}>
   <summary>
    <span>🧩 Schatz</span>
    <strong>{(Number(me?.treasure_share_bps||0)/100).toFixed(2)}%</strong>
    <span>{goldTreasures.filter(t=>!t.found_by).length}/{goldTreasures.length||game.treasure_count||1} offen</span>
    {game.game_type==='pay'&&<span>{formatGold(game.gold_prize_pool_ug)}</span>}
   </summary>
   <div className="compactTreasureBody">
    <div className="treasurePills">{goldTreasures.map((t,i)=>{
     const finder=players.find(p=>p.user_id===t.found_by)
     return <span key={t.id} className={'treasurePill '+(t.found_by?'found':'')}>
       {t.found_by?'✅':'🧩'} {i+1}: {(Number(t.share_bps||0)/10000).toFixed(3)}
       {game.game_type==='pay'&&<> · {formatGold(t.amount_ug)}</>}
       {t.found_by&&<> · {finder?.profiles?.display_name||'gefunden'}</>}
     </span>
    })}</div>
    <div className="small">Gesamtschatz 1,000 · Spielende erst nach allen Teilen · größter Gesamtanteil gewinnt.</div>
   </div>
  </details>}

  <div className="gameLayout">
   <section className="panel">
    <div className="mapHeader"><div><h2>Weltkarte</h2><div className="small">Zoomen und verschieben ist möglich. Klick auf ein Rasterfeld = erkunden.</div></div>
     <div className="mapLegend">{players.map(p=><div className="legendItem" key={p.user_id}><span className="colorDot" style={{background:p.player_color||'#35516d'}}></span>{p.profiles?.display_name||'Spieler'}</div>)}</div>
    </div>
    {game&&<GameMap game={game} fields={fields} players={players} onReveal={reveal} analysisHint={analysisHint} onViewportChange={handleViewport} analysisFocusToken={analysisFocusToken} onAnalysisFeatures={setAnalysisFeatures}/>}
    {analysisHint&&<div className="analysisHintBox">
      <strong>🧭 Kartenanalyse Stufe {analysisHint.level}</strong>
      <div>{analysisHint.text}</div>
      <div className="analysisActions"><button className="btn" onClick={()=>setAnalysisFocusToken(v=>v+1)}>🗺️ Hinweisgebiet fokussieren</button></div>
      {analysisFeatures.length>0&&<div className="mapFeatureBox">
        <div className="small">Sichtbare Kartenmerkmale im Hinweisgebiet:</div>
        <div className="mapFeatureTags">{analysisFeatures.map((f,i)=><span key={i}><b>{f.name}</b>{f.kind&&<small>{f.kind}</small>}</span>)}</div>
      </div>}
      <div className="small">Der gelb markierte Bereich ist absichtlich ungenau. Nutze echte Straßen, Orte, Gewässer und andere Kartenmerkmale zur Orientierung.</div>
    </div>}
    <p className="statusLine">{msg}</p>
   </section>

   <aside className="panel">
    <h2>Technologien</h2>
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
   <div className="playerNameLine"><span className="colorDot large" style={{background:p.player_color||'#35516d'}}></span><strong><a className="profileLink" href={'/spieler/'+p.user_id}>{p.profiles?.display_name||'Spieler'}</a></strong></div>
   <div className="small">{Number(p.coins).toFixed(2)} T · {p.moves_left} gespeicherte Züge · {p.reveal_power} Felder/Zug · 🧩 {(Number(p.treasure_share_bps||0)/100).toFixed(2)}%</div>
  </div>)}</div></div>
  {game&&user&&<GameChat gameId={id} userId={user.id}/>}

  {treasurePopup&&<div className="treasureFoundOverlay" role="dialog" aria-modal="true">
   <div className="treasureFoundModal">
    <div className="treasureFoundIcon">🧩</div>
    <div className="small">SCHATZTEIL GEFUNDEN</div>
    <h2>+{(treasurePopup.share/100).toFixed(2)} %</h2>
    <p>{treasurePopup.parts>1?`${treasurePopup.parts} Schatzteile auf einmal!`:'Du hast einen Teil des Gesamtschatzes gefunden.'}</p>
    {treasurePopup.gold>0&&<div className="treasureGold">✨ {formatGold(treasurePopup.gold)} Test-Gold</div>}
    <button className="btn primary" onClick={()=>setTreasurePopup(null)}>Weiter</button>
   </div>
  </div>}

  {gimmickPopup&&<div className="gimmickOverlay" role="dialog" aria-modal="true">
   <div className="gimmickModal">
    <div className="gimmickIcon">🎁</div>
    <div className="small">ÜBERRASCHUNGSFELD</div>
    <h2>{gimmickPopup.total>1?`${gimmickPopup.total} Gimmicks gefunden!`:'Gimmick gefunden!'}</h2>
    <div className="gimmickRewards">
     {gimmickPopup.taler>0&&<div>💰 <strong>+{gimmickPopup.taler.toFixed(2)} Taler</strong></div>}
     {gimmickPopup.moves>0&&<div>⚡ <strong>+{gimmickPopup.moves} Zug{gimmickPopup.moves===1?'':'e'}</strong></div>}
     {gimmickPopup.scanner>0&&<div>📡 <strong>+{gimmickPopup.scanner} Felder beim nächsten manuellen Zug</strong></div>}
    </div>
    <button className="btn primary" onClick={()=>setGimmickPopup(null)}>Nice 😎</button>
   </div>
  </div>}

  {winnerCelebration&&<div className="winnerOverlay" role="dialog" aria-modal="true">
   <div className="winnerModal">
    <div className="winnerBurst">{winnerCelebration.won?'🏆':'🏁'}</div>
    <div className="small">ALLE SCHATZTEILE GEFUNDEN</div>
    <h1>{winnerCelebration.won?'Du hast gewonnen!':'Spiel beendet'}</h1>
    <p className="winnerLead">{winnerCelebration.won
      ? `Glückwunsch! Du hast mit ${(winnerCelebration.share/100).toFixed(2)}% den größten Anteil des Schatzes gefunden.`
      : `${winnerCelebration.name} gewinnt mit ${(winnerCelebration.share/100).toFixed(2)}% des Gesamtschatzes.`}</p>
    <div className="winnerStats">
      <div><span>🧩</span><strong>{(winnerCelebration.share/100).toFixed(2)}%</strong><small>Siegeranteil</small></div>
      <div><span>🎯</span><strong>{winnerCelebration.moves.toLocaleString('de-DE')}</strong><small>Züge des Siegers</small></div>
    </div>
    {winnerCelebration.talerGold>0&&<div className="winnerGoldBonus">✨ Gewinnerbonus: {formatGold(winnerCelebration.talerGold)} aus den Taler des Siegers</div>}
    <div className="winnerActions">
      <a className="btn primary" href={'/archiv/'+id}>🏛️ Endstand ansehen</a>
      <button className="btn" onClick={()=>setWinnerCelebration(null)}>Noch kurz hier bleiben</button>
    </div>
   </div>
  </div>}
 </main>
}
