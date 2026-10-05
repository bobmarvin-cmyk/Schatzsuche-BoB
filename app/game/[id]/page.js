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
 const [mapChunks,setMapChunks]=useState([]),[mapRenderMode,setMapRenderMode]=useState('overview'),[owned,setOwned]=useState([]),[branch,setBranch]=useState('Erkundung'),[technologies,setTechnologies]=useState([])
 const [msg,setMsg]=useState(''),[regenInfo,setRegenInfo]=useState(null),[wallet,setWallet]=useState(null),[goldTreasures,setGoldTreasures]=useState([])
 const [joinState,setJoinState]=useState('checking'),[joinPassword,setJoinPassword]=useState(''),[analysisHint,setAnalysisHint]=useState(null),[analysisFeatures,setAnalysisFeatures]=useState([]),[analysisFocusToken,setAnalysisFocusToken]=useState(0),[analysisClue,setAnalysisClue]=useState(''),[tick,setTick]=useState(0),[winnerCelebration,setWinnerCelebration]=useState(null),[gimmickPopup,setGimmickPopup]=useState(null),[treasurePopup,setTreasurePopup]=useState(null),[activeGames,setActiveGames]=useState([]),[statsOpen,setStatsOpen]=useState(false),[sessionFields,setSessionFields]=useState(0),[ownTraps,setOwnTraps]=useState([]),[trapMode,setTrapMode]=useState(null),[gameEvent,setGameEvent]=useState(null),[competition,setCompetition]=useState([]),[rankOpen,setRankOpen]=useState(false),[rankMetric,setRankMetric]=useState('coins'),[globalPopup,setGlobalPopup]=useState(null),[analysisPrices,setAnalysisPrices]=useState({1:5,2:10,3:15,4:20,5:25,6:30}),[analysisBuying,setAnalysisBuying]=useState(false),[analysisClues,setAnalysisClues]=useState([]),[onlineIds,setOnlineIds]=useState([]),[terrainInfo,setTerrainInfo]=useState(null),[pendingClaim,setPendingClaim]=useState(null),[claimShow,setClaimShow]=useState(false),[claimInput,setClaimInput]=useState(''),[claimResolving,setClaimResolving]=useState(false),[claimChallenge,setClaimChallenge]=useState(null),[claimStarted,setClaimStarted]=useState(false),[claimTimeLeft,setClaimTimeLeft]=useState(null),[claimResult,setClaimResult]=useState(null),[job,setJob]=useState(null),[jobBusy,setJobBusy]=useState(false),[jobSettings,setJobSettings]=useState({bottlesSeconds:180,bottlesReward:1,scrapSeconds:900,scrapReward:7})
 const [assistantEnabled,setAssistantEnabled]=useState(false),[assistantWaypoints,setAssistantWaypoints]=useState([]),[assistantPosition,setAssistantPosition]=useState(null),[assistantNextIndex,setAssistantNextIndex]=useState(0),[assistantTarget,setAssistantTarget]=useState(null),[assistantUnlocked,setAssistantUnlocked]=useState(null),[assistantUnlockBusy,setAssistantUnlockBusy]=useState(false),[assistantRouteDone,setAssistantRouteDone]=useState(false)
 const [endgameStatus,setEndgameStatus]=useState(null),[endgameBusy,setEndgameBusy]=useState(false),[gameChangelog,setGameChangelog]=useState([]),[cluePositions,setCluePositions]=useState({}),[selectedClueMarker,setSelectedClueMarker]=useState(null),[autoDevelopEnabled,setAutoDevelopEnabled]=useState(false),[autoDevelopBusy,setAutoDevelopBusy]=useState(false),[botPlayers,setBotPlayers]=useState([]),[gameActivity,setGameActivity]=useState(null)

 const moveRefreshBusy=useRef(false),revealBusy=useRef(false),machineBusy=useRef(false),viewportTimer=useRef(null),viewportSeq=useRef(0),currentViewport=useRef(null),sessionStartedAt=useRef(Date.now()),lastFieldVersion=useRef(0),lastEventId=useRef(0),livePollBusy=useRef(false),playerReloadTimer=useRef(null),winnerHandledRef=useRef(false),lastPlayersSig=useRef(''),lastCompetitionSig=useRef(''),lastVisibleReloadAt=useRef(0),lastPollAt=useRef(0),lastMachineMapRefreshAt=useRef(0),claimTimerRef=useRef(null),machineRetryAfterRef=useRef(0),chunkSummaryRef=useRef(new Map()),chunkPayloadRef=useRef(new Map()),chunkSinceRef=useRef(null),chunkSyncPromiseRef=useRef(null)
 const assistantBusyRef=useRef(false),assistantLastStepAtRef=useRef(Date.now()),assistantPendingStepRef=useRef(null),assistantTokenRef=useRef(0)
 const eventPopupsReadyRef=useRef(false)


 useEffect(()=>{
  eventPopupsReadyRef.current=false
  lastEventId.current=0
  chunkSummaryRef.current.clear()
  chunkPayloadRef.current.clear()
  chunkSinceRef.current=null
  chunkSyncPromiseRef.current=null
  setMapChunks([])
  init()
  const ch=supabase.channel('game-'+id)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'game_events',filter:`game_id=eq.${id}`},payload=>handleRealtimeGameEvent(payload.new))
   .subscribe()
  const timer=setInterval(()=>setTick(t=>t+1),1000)
  const liveTimer=setInterval(()=>{if(document.visibilityState==='visible')pollLiveState()},7000)
  const chunkTimer=setInterval(()=>{
    if(document.visibilityState==='visible'&&currentViewport.current)scheduleVisibleReload(0)
  },4000)
  return()=>{
    supabase.removeChannel(ch)
    clearInterval(timer);clearInterval(liveTimer);clearInterval(chunkTimer)
    clearTimeout(viewportTimer.current);clearTimeout(playerReloadTimer.current);clearTimeout(claimTimerRef.current)
  }
 },[id])

 useEffect(()=>{
  try{
    const raw=sessionStorage.getItem('assistant_route_'+id)
    if(!raw)return
    const saved=JSON.parse(raw)
    setAssistantWaypoints(Array.isArray(saved.waypoints)?saved.waypoints.slice(0,20):[])
    setAssistantPosition(saved.position||null)
    setAssistantNextIndex(Math.max(0,Number(saved.nextIndex||0)))
    setAssistantEnabled(!!saved.enabled)
    assistantLastStepAtRef.current=Date.now()
  }catch{}
 },[id])

 useEffect(()=>{
  try{
    sessionStorage.setItem('assistant_route_'+id,JSON.stringify({
      enabled:assistantEnabled,
      waypoints:assistantWaypoints,
      position:assistantPosition,
      nextIndex:assistantNextIndex
    }))
  }catch{}
 },[id,assistantEnabled,assistantWaypoints,assistantPosition,assistantNextIndex])

 useEffect(()=>{
  if(!user?.id)return
  const presence=supabase.channel('presence-game-'+id,{
    config:{presence:{key:user.id}}
  })
  presence
   .on('presence',{event:'sync'},()=>{
     const next=Object.keys(presence.presenceState()||{}).sort()
     setOnlineIds(prev=>prev.length===next.length&&prev.every((x,i)=>x===next[i])?prev:next)
   })
   .on('presence',{event:'join'},()=>{
     const next=Object.keys(presence.presenceState()||{}).sort()
     setOnlineIds(prev=>prev.length===next.length&&prev.every((x,i)=>x===next[i])?prev:next)
   })
   .on('presence',{event:'leave'},()=>{
     const next=Object.keys(presence.presenceState()||{}).sort()
     setOnlineIds(prev=>prev.length===next.length&&prev.every((x,i)=>x===next[i])?prev:next)
   })
   .subscribe(async status=>{
     if(status==='SUBSCRIBED'){
       await presence.track({user_id:user.id,online_at:new Date().toISOString()})
     }
   })
  return()=>supabase.removeChannel(presence)
 },[id,user?.id])

 async function handleRealtimeGameEvent(evt){
  if(!evt)return
  setGameChangelog(prev=>{
    const next=[evt,...prev.filter(x=>String(x.id)!==String(evt.id))]
    return next.slice(0,80)
  })
  if(evt.id){
    const eid=Number(evt.id||0)
    if(eid<=lastEventId.current)return
    lastEventId.current=eid
  }
  if(!eventPopupsReadyRef.current)return
  if(evt.event_type==='game_won'){
    winnerHandledRef.current=true
    const {data:{user:meNow}}=await supabase.auth.getUser()
    const d=evt.details||{}
    setWinnerCelebration({
      won:meNow?.id===d.winner_id,
      name:d.winner_name||'Spieler',
      moves:Number(d.winner_moves_used||0),
      opened:0,
      share:Number(d.winner_share_bps||0),
      talerGold:Number(d.winner_taler_gold_ug||0)
    })
    await Promise.all([loadGameOnly(),loadPlayersOnly(),loadCompetition(),loadActiveGames()])
    return
  }
  if(evt.event_type==='exclusive_tech'||evt.event_type==='treasure_found'||evt.event_type==='trap'||evt.event_type==='trap_treasure'){
    const popup={
      type:evt.event_type,
      message:evt.message||'Im Spiel ist etwas passiert.'
    }
    setGlobalPopup(popup)
    setTimeout(()=>setGlobalPopup(current=>current===popup?null:current),4200)
    return
  }
  setGameEvent(evt)
  setTimeout(()=>setGameEvent(current=>current?.id===evt.id?null:current),7000)
 }

 function schedulePlayerMetaReload(){
  clearTimeout(playerReloadTimer.current)
  playerReloadTimer.current=setTimeout(()=>{loadPlayersOnly();loadCompetition()},220)
 }

 async function pollLiveState(){
  const now=Date.now()
  if(livePollBusy.current||joinState==='password'||joinState==='error')return
  if(now-lastPollAt.current<4500)return
  if(revealBusy.current||machineBusy.current)return
  lastPollAt.current=now
  livePollBusy.current=true
  try{
    const {data}=await supabase.rpc('get_game_live_state_v616',{
      p_game_id:id,p_after_event_id:lastEventId.current
    })
    if(!data)return

    const fv=Number(data.field_version||0)
    setGame(g=>{
      if(!g)return g
      const explored=Number(data.explored_count||0)
      if(Number(g.explored_count||0)===explored &&
         Number(g.field_version||0)===fv &&
         g.status===data.status &&
         g.winner_id===data.winner_id)return g
      return {...g,
        explored_count:explored,
        field_version:fv,
        status:data.status,
        winner_id:data.winner_id,
        gimmicks_found_count:Number(data.gimmicks_found_count??g.gimmicks_found_count??0),
        gimmick_target_count:Number(data.gimmick_target_count??g.gimmick_target_count??0),
        start_at:data.start_at??g.start_at
      }
    })

    if(Array.isArray(data.players)){
      const pSig=data.players.map(p=>[
        p.user_id,p.coins,p.moves_left,p.reveal_power,p.reward_multiplier,p.analysis_level,
        p.player_color,p.move_capacity_bonus,p.regen_reduction,p.machine_last_run_at,
        p.auto_focus_x,p.auto_focus_y,p.treasure_share_bps,p.treasure_parts_found,
        p.machine_ticks_used,p.machine_mode,p.gimmick_reveal_bonus_pending,p.fields_revealed,
        p.tech_count,p.profiles?.display_name,p.profiles?.avatar_path
      ].join(':')).join('|')

      if(pSig!==lastPlayersSig.current){
        lastPlayersSig.current=pSig
        setPlayers(data.players)
      }

      const comp=data.players.map(p=>({
        user_id:p.user_id,
        display_name:p.profiles?.display_name||'Spieler',
        coins:p.coins,
        fields_revealed:p.fields_revealed,
        treasure_share_bps:p.treasure_share_bps,
        tech_count:p.tech_count
      }))
      const cSig=comp.map(p=>[p.user_id,p.display_name,p.coins,p.fields_revealed,p.treasure_share_bps,p.tech_count].join(':')).join('|')
      if(cSig!==lastCompetitionSig.current){
        lastCompetitionSig.current=cSig
        setCompetition(comp)
      }
    }

    if(fv!==lastFieldVersion.current){
      lastFieldVersion.current=fv
      if(currentViewport.current)scheduleVisibleReload(
        currentViewport.current.mode==='detail'?100:500
      )
    }

    for(const evt of (data.events||[])){
      const eid=Number(evt.id||0)
      if(eid<=lastEventId.current)continue
      await handleRealtimeGameEvent(evt)
    }

    if(data.status==='finished'&&data.winner_id&&!winnerHandledRef.current){
      winnerHandledRef.current=true
      const {data:{user:meNow}}=await supabase.auth.getUser()
      setWinnerCelebration({
        won:meNow?.id===data.winner_id,
        name:data.winner_name||'Spieler',
        moves:Number(data.winner_moves_used||0),
        opened:0,
        share:Number(data.winner_share_bps||0),
        talerGold:Number(data.winner_taler_gold_ug||0)
      })
    }
  }finally{
    livePollBusy.current=false
  }
 }

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
  const {data}=await supabase.from('game_players').select('user_id,coins,moves_left,reveal_power,reward_multiplier,analysis_level,player_color,move_capacity_bonus,regen_reduction,last_regen_at,machine_last_run_at,auto_focus_x,auto_focus_y,treasure_share_bps,treasure_parts_found,machine_ticks_used,machine_mode,gimmick_reveal_bonus_pending,fields_revealed,assistant_unlocked,endgame_reveal_buys,endgame_machine_buys,endgame_reveal_power_bonus,endgame_machine_power_bonus,auto_develop_enabled,profiles(display_name,avatar_path)').eq('game_id',id).order('joined_at')
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
 async function loadEndgameStatus(){
  const {data,error}=await supabase.rpc('get_endgame_upgrade_status_v630',{p_game_id:id})
  if(!error)setEndgameStatus(data||null)
  return data||null
 }

 async function buyEndgame(kind){
  if(endgameBusy)return
  setEndgameBusy(true)
  const {data,error}=await supabase.rpc('buy_endgame_upgrade_v630',{p_game_id:id,p_kind:kind})
  setEndgameBusy(false)
  if(error){setMsg(error.message);return}
  setMsg(data?.message||'Endgame-Ausbau gekauft.')
  await Promise.all([loadPlayersOnly(),loadEndgameStatus()])
 }

 async function loadGameActivity(){
  const {data,error}=await supabase.rpc('get_game_activity_v644',{p_game_id:id})
  if(!error)setGameActivity(data||null)
  return data||null
 }

 async function loadGameBots(){
  const {data,error}=await supabase.rpc('get_game_bots_v641',{p_game_id:id})
  if(!error)setBotPlayers(Array.isArray(data)?data:[])
  return data||[]
 }

 async function runBots(){
  if(document.visibilityState!=='visible')return
  const {data,error}=await supabase.rpc('run_bot_game_tick_v645',{p_game_id:id})
  if(error){setMsg('Spieler-Automatik: '+error.message);return}
  if(data?.reason==='error'&&data?.error){setMsg('Spieler-Automatik: '+data.error);return}
  if(data&&data.human_fields_per_min!==undefined){
    setGameActivity(v=>({...v,fields_per_min:Number(data.human_fields_per_min||0)}))
  }
  if(Number(data?.errors||0)>0&&Number(data?.opened||0)===0){
    await loadGameBots()
  }
  if(Number(data?.actions||0)>0||Number(data?.opened||0)>0){
    await Promise.all([loadGameBots(),loadGameActivity()])
    if(currentViewport.current)scheduleVisibleReload(180)
    setTimeout(()=>pollLiveState(),250)
  }
 }

 async function loadCompetition(){
  const {data}=await supabase.rpc('get_game_competition_v615',{p_game_id:id})
  if(data)setCompetition(data)
 }

 async function loadJob(){
  const {data,error}=await supabase.rpc('get_my_job_v625',{p_game_id:id})
  if(!error)setJob(data||null)
  return data||null
 }

 async function startJob(jobType){
  if(jobBusy)return
  setJobBusy(true)
  const {data,error}=await supabase.rpc('start_job_v625',{p_game_id:id,p_job_type:jobType})
  setJobBusy(false)
  if(error){setMsg(error.message);return}
  setMsg(data?.message||'Job gestartet.')
  await loadJob()
 }

 async function claimJob(){
  if(jobBusy)return
  setJobBusy(true)
  const {data,error}=await supabase.rpc('claim_job_v625',{p_game_id:id})
  setJobBusy(false)
  if(error){setMsg(error.message);return}
  setMsg(data?.message||'Lohn abgeholt.')
  setJob(null)
  await loadPlayersOnly()
 }

 async function loadOwnTraps(){
  const {data}=await supabase.rpc('get_my_traps_v614',{p_game_id:id})
  if(data)setOwnTraps(data)
  return data||[]
 }

 async function placeTrap(x,y){
  if(!trapMode)return
  const selectedTrap=trapMode
  const {data,error}=await supabase.rpc('place_trap_v614',{p_game_id:id,p_x:x,p_y:y,p_technology_id:selectedTrap})
  if(error){
    setMsg('Falle: '+error.message)
    if(error.message?.includes('Maximale aktive Fallen'))setTrapMode(null)
    return
  }
  setMsg(data?.message||'Falle platziert')
  await loadPlayersOnly()
  const traps=await loadOwnTraps()
  const tech=technologies.find(t=>t.id===selectedTrap)
  const active=traps.filter(t=>t.technology_id===selectedTrap).length
  if(tech&&active>=Number(tech.trap_limit||0)){
    setTrapMode(null)
    setMsg((data?.message||'Falle platziert')+' · Limit erreicht, Fallenmodus beendet.')
  }
 }

 function clueTypeLabel(kind){
  return ({
    sector:'🧭 Sektor',
    center_ring:'📐 Zentrumring',
    terrain:'🌍 Terrain',
    edge_distance:'🗺️ Randlage',
    bearing:'📡 Peilung',
    proximity:'🧩 Umgebung',
    precision_zone:'🎯 Präzision'
  })[kind]||'🔎 Analyse'
 }

 function buildAnalysisClue(items){
  const text=(items||[]).map(x=>(x.name+' '+x.kind).toLowerCase()).join(' ')
  if(!text)return 'Die Kartenanalyse erkennt hier keine eindeutig benannten Landschaftsmerkmale.'
  const water=/lake|water|river|reservoir|stream|see|fluss|bach|teich|meer|bay/.test(text)
  const forest=/forest|wood|wald|nature|park/.test(text)
  const urban=/city|town|village|residential|place|stadt|dorf|suburb/.test(text)
  const road=/road|street|highway|straße|weg|motorway/.test(text)
  if(water&&forest)return 'Der Schatz liegt in einer Umgebung mit Wasser und Wald bzw. Grünfläche.'
  if(water&&urban)return 'Der Schatz liegt an oder nahe einem Gewässer in der Umgebung einer Siedlung.'
  if(forest&&urban)return 'Der Schatz liegt in einem Wald- oder Grüngebiet nahe einer Stadt bzw. Siedlung.'
  if(water)return 'Der Schatz liegt in oder unmittelbar bei einem Gewässer.'
  if(forest)return 'Der Schatz liegt in einem Wald-, Park- oder größeren Grüngebiet.'
  if(urban&&road)return 'Der Schatz liegt in einem bebauten Gebiet mit Straßen- bzw. Siedlungsstruktur.'
  if(urban)return 'Der Schatz liegt in der Nähe einer Stadt, eines Ortes oder bebauten Gebiets.'
  if(road)return 'Der Schatz liegt in einem Gebiet mit markanten Straßen oder Wegen.'
  return 'Die Umgebung besitzt markante Kartenmerkmale: '+items.slice(0,3).map(x=>x.name).join(', ')+'.'
 }

 async function loadAnalysisClues(){
  const {data,error}=await supabase.rpc('get_my_analysis_clues_v621',{p_game_id:id})
  if(!error)setAnalysisClues(data||[])
  return data||[]
 }

 async function loadGameChangelog(){
  const {data,error}=await supabase.rpc('get_game_changelog_v632',{p_game_id:id,p_limit:80})
  if(!error){
    const rows=Array.isArray(data)?data:[]
    setGameChangelog(rows)
    const newest=rows.reduce((m,e)=>Math.max(m,Number(e?.id||0)),0)
    lastEventId.current=Math.max(lastEventId.current,newest)
    eventPopupsReadyRef.current=true
  }
  return data||[]
 }

 async function loadCluePositions(){
  const {data,error}=await supabase.rpc('get_my_analysis_clue_positions_v632',{p_game_id:id})
  if(!error)setCluePositions(data||{})
  return data||{}
 }

 function showClueOnMap(clue){
  const fallback=cluePositions?.[String(clue.clue_no)]
  const x=clue?.focus_x??fallback?.x
  const y=clue?.focus_y??fallback?.y
  if(x===null||x===undefined||y===null||y===undefined){
    setMsg('Für diesen Hinweis ist kein Suchstandpunkt gespeichert.')
    return
  }
  setSelectedClueMarker({
    x:Number(x),
    y:Number(y),
    label:`Hinweis #${clue.clue_no}`,
    token:`clue:${clue.clue_no}:${Date.now()}`
  })
  setMsg(`📍 Suchstandpunkt von Hinweis #${clue.clue_no} markiert.`)
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
    const [g,p,t,w,gt,tech,ps]=await Promise.all([
      supabase.from('games').select('*').eq('id',id).single(),
      supabase.from('game_players').select('user_id,coins,moves_left,reveal_power,reward_multiplier,analysis_level,player_color,move_capacity_bonus,regen_reduction,last_regen_at,machine_last_run_at,auto_focus_x,auto_focus_y,treasure_share_bps,treasure_parts_found,machine_ticks_used,machine_mode,gimmick_reveal_bonus_pending,fields_revealed,endgame_reveal_buys,endgame_machine_buys,endgame_reveal_power_bonus,endgame_machine_power_bonus,assistant_unlocked,profiles(display_name,avatar_path)').eq('game_id',id).order('joined_at'),
      supabase.from('player_technologies').select('technology_id').eq('game_id',id).eq('user_id',user?.id||'00000000-0000-0000-0000-000000000000'),
      supabase.from('gold_wallets').select('balance_ug').eq('user_id',user?.id||'00000000-0000-0000-0000-000000000000').maybeSingle(),
      supabase.rpc('get_treasure_status_v610',{p_game_id:id}),
      supabase.rpc('get_active_technologies_v6241'),
      supabase.from('platform_settings').select('analysis_price_l1,analysis_price_l2,analysis_price_l3,analysis_price_l4,analysis_price_l5,analysis_price_l6,job_bottles_duration_seconds,job_bottles_reward_taler,job_scrap_duration_seconds,job_scrap_reward_taler,endgame_reveal_start_cost,endgame_reveal_price_factor,endgame_reveal_bonus,endgame_machine_start_cost,endgame_machine_price_factor,endgame_machine_bonus').eq('id',1).single()
    ])

    if(g.error)throw g.error
    if(p.error)throw p.error
    if(t.error)throw t.error
    if(w.error)throw w.error
    if(gt.error)throw gt.error
    if(ps.error)throw ps.error

    if(tech.error){
      // Notfall-Fallback: selbst wenn die neue RPC wegen eines noch nicht
      // aktualisierten Schema-Caches nicht erreichbar ist, bleiben die
      // Technologien im Spiel sichtbar.
      const fallback=await supabase.from('technologies')
        .select('id,name,branch,cost,reveal_power_bonus,reward_bonus,analysis_level,capacity_bonus,regen_reduction,machine_auto_fields,exclusive_per_game,trap_type,trap_power,trap_limit,requires,description,sort_order,is_active')
        .eq('is_active',true)
        .order('sort_order',{ascending:true})
        .order('id',{ascending:true})
      if(fallback.error)throw fallback.error
      tech.data=(fallback.data||[]).map(x=>({...x,trap_place_cost:0}))
    }

    setGame(g.data)
    lastFieldVersion.current=Number(g.data?.field_version||0)
    setPlayers(p.data||[])
    setOwned((t.data||[]).map(x=>x.technology_id))
    setWallet(w.data)
    setGoldTreasures(gt.data||[])
    setTechnologies(tech.data||[])
    if((tech.data||[]).length===0){
      setMsg('Technologien konnten nicht geladen werden – bitte Seite neu laden.')
    }
    setAnalysisPrices({
      1:Number(ps.data?.analysis_price_l1||5),
      2:Number(ps.data?.analysis_price_l2||10),
      3:Number(ps.data?.analysis_price_l3||15),
      4:Number(ps.data?.analysis_price_l4||20),
      5:Number(ps.data?.analysis_price_l5||25),
      6:Number(ps.data?.analysis_price_l6||30)
    })
    setJobSettings({
      bottlesSeconds:Number(ps.data?.job_bottles_duration_seconds||180),
      bottlesReward:Number(ps.data?.job_bottles_reward_taler||1),
      scrapSeconds:Number(ps.data?.job_scrap_duration_seconds||900),
      scrapReward:Number(ps.data?.job_scrap_reward_taler||7)
    })
    loadActiveGames();loadOwnTraps();loadCompetition();loadGameBots();loadGameActivity();loadPendingClaim();loadAnalysisClues();loadCluePositions();loadGameChangelog();loadJob();loadEndgameStatus()
  }catch(err){
    setMsg('Fehler beim Laden der Karte: '+(err?.message||String(err)))
  }
 }

 function scheduleVisibleReload(delay=180){
  clearTimeout(viewportTimer.current)
  const now=Date.now()
  const mode=currentViewport.current?.mode||'overview'
  const minGap=mode==='detail'?350:900
  const wait=Math.max(delay,minGap-(now-lastVisibleReloadAt.current))
  viewportTimer.current=setTimeout(()=>{
    const v=currentViewport.current
    if(!v)return
    lastVisibleReloadAt.current=Date.now()
    loadVisibleFields(v)
  },wait)
 }

 function chunkKey(cx,cy){return `${cx}:${cy}`}

 async function syncChunkChanges(){
  if(chunkSyncPromiseRef.current)return chunkSyncPromiseRef.current

  const run=(async()=>{
    const {data,error}=await supabase.rpc('get_map_chunk_changes_v623',{
      p_game_id:id,
      p_since:chunkSinceRef.current
    })
    if(error)throw error

    const changed=data?.chunks||[]
    for(const c of changed){
      const key=chunkKey(Number(c.cx),Number(c.cy))
      const prev=chunkSummaryRef.current.get(key)
      chunkSummaryRef.current.set(key,c)
      if(!prev||Number(prev.version)!==Number(c.version)){
        const payload=chunkPayloadRef.current.get(key)
        if(payload&&Number(payload.version)!==Number(c.version)){
          chunkPayloadRef.current.delete(key)
        }
      }
    }
    if(data?.as_of)chunkSinceRef.current=data.as_of
    return changed
  })()

  chunkSyncPromiseRef.current=run
  try{return await run}
  finally{chunkSyncPromiseRef.current=null}
 }

 function visibleChunkKeys(v){
  const keys=[]
  const cx0=Math.floor(Math.max(0,Number(v.x0||0))/64)
  const cx1=Math.floor(Math.max(0,Number(v.x1||0))/64)
  const cy0=Math.floor(Math.max(0,Number(v.y0||0))/64)
  const cy1=Math.floor(Math.max(0,Number(v.y1||0))/64)
  for(let cy=cy0;cy<=cy1;cy++){
    for(let cx=cx0;cx<=cx1;cx++)keys.push([cx,cy])
  }
  return keys
 }

 async function loadChunkPayloads(requested){
  if(!requested.length)return
  for(let i=0;i<requested.length;i+=64){
    const batch=requested.slice(i,i+64).map(([cx,cy])=>({cx,cy}))
    const {data,error}=await supabase.rpc('get_map_chunk_payloads_v623',{
      p_game_id:id,p_chunks:batch
    })
    if(error)throw error
    for(const c of data?.chunks||[]){
      chunkPayloadRef.current.set(
        chunkKey(Number(c.cx),Number(c.cy)),
        c
      )
    }
  }
 }

 function publishMapChunks(v){
  if((v?.mode||'overview')==='overview'){
    setMapChunks([...chunkSummaryRef.current.values()])
    return
  }

  const visible=[]
  for(const [cx,cy] of visibleChunkKeys(v)){
    const key=chunkKey(cx,cy)
    const summary=chunkSummaryRef.current.get(key)
    const payload=chunkPayloadRef.current.get(key)
    if(!summary)continue
    visible.push({...summary,...(payload||{}),cx,cy})
  }
  setMapChunks(visible)
 }

 async function loadVisibleFields(v){
  if(!v)return
  currentViewport.current=v
  const seq=++viewportSeq.current
  const mode=v.mode||'overview'
  setMapRenderMode(mode)

  try{
    await syncChunkChanges()
    if(seq!==viewportSeq.current)return

    if(mode==='detail'){
      const missing=[]
      for(const [cx,cy] of visibleChunkKeys(v)){
        const key=chunkKey(cx,cy)
        const summary=chunkSummaryRef.current.get(key)
        if(!summary)continue
        const payload=chunkPayloadRef.current.get(key)
        if(!payload||Number(payload.version)!==Number(summary.version)){
          missing.push([cx,cy])
        }
      }
      if(missing.length){
        await loadChunkPayloads(missing)
        if(seq!==viewportSeq.current)return
      }
    }

    publishMapChunks(v)
  }catch(error){
    if(seq!==viewportSeq.current)return
    setMsg('Kartendaten konnten nicht synchronisiert werden: '+(error?.message||String(error)))
  }
 }

 function handleViewport(v){
  currentViewport.current=v
  setMapRenderMode(v?.mode||'overview')
  scheduleVisibleReload(v?.mode==='detail'?100:250)
 }

 function terrainRequirement(type){
  if(type==='forest')return {tech:'ter2',name:'🌲 Waldkunde'}
  if(type==='water')return {tech:'ter4',name:'🌊 Boot & Sonar'}
  if(type==='wetland')return {tech:'ter5',name:'🟫 Sumpfausrüstung'}
  if(type==='industrial'||type==='restricted')return {tech:'ter6',name:'🏭 Urban Explorer'}
  return null
 }

 async function cacheTerrainBatch(cells){
  if(!Array.isArray(cells)||!cells.length||!game)return
  const width=Math.max(1,Number(game.width||1))
  const sorted=[...cells]
    .map(c=>({...c,idx:Number(c.y)*width+Number(c.x)}))
    .sort((a,b)=>a.idx-b.idx)

  const runs=[]
  let current=null
  for(const c of sorted){
    const type=String(c.terrain_type||'unknown')
    const label=String(c.terrain_label||'')
    if(current&&
       c.idx===current[0]+current[1]&&
       type===current[2]&&
       label===current[3]){
      current[1]++
    }else{
      current=[c.idx,1,type,label]
      runs.push(current)
    }
  }

  const {error}=await supabase.rpc('cache_terrain_runs_v623',{
    p_game_id:id,p_runs:runs
  })
  if(error&&!error.message?.includes('duplicate'))setMsg('Terrain: '+error.message)
 }

 async function terrainReveal(x,y,terrain){
  const t=terrain||{type:'open',label:'🧭 Offenes Gelände'}
  setTerrainInfo(t)
  try{
    await supabase.rpc('cache_terrain_cell_v618',{
      p_game_id:id,p_x:x,p_y:y,
      p_terrain_type:t.type||'open',
      p_terrain_label:t.label||''
    })
  }catch{}

  const req=terrainRequirement(t.type)
  if(req&&!has('ter7')&&!has(req.tech)){
    setMsg(`${t.label||'Dieses Gelände'} · benötigt ${req.name}. Kein Zug verbraucht.`)
    return {success:false,blocked:true,reason:'terrain_locked'}
  }

  setMsg(`${t.label||'Gelände erkannt'} · Suche startet…`)
  return await reveal(x,y)
 }

 async function loadPendingClaim(){
  const {data,error}=await supabase.rpc('get_my_pending_claim_v620',{p_game_id:id})
  if(error)return null
  if(data&&data.id){
    setPendingClaim(prev=>{
      if(prev?.id===data.id)return {...prev,...data}
      return data
    })
    setClaimStarted(prev=>prev||!!data.started_at)
    setClaimChallenge(prev=>{
      if(prev&&prev.id===data.id)return {...prev,expires_at:data.expires_at||prev.expires_at}
      return data.started_at?{
        id:data.id,
        challenge_type:data.challenge_type,
        display_code:data.display_code||null,
        expires_at:data.expires_at||null,
        symbol_count:Number(data.symbol_count||6),
        show_seconds:Number(data.show_seconds||6.5),
        time_seconds:Number(data.time_seconds||120),
        failure_level:Number(data.failure_level||0)
      }:null
    })
    return data
  }
  setPendingClaim(null)
  setClaimStarted(false)
  setClaimChallenge(null)
  setClaimInput('')
  setClaimShow(false)
  setClaimTimeLeft(null)
  return null
 }

 useEffect(()=>{
  if(!claimStarted||!claimChallenge?.expires_at){
    setClaimTimeLeft(null)
    return
  }
  const left=Math.max(0,Math.ceil((new Date(claimChallenge.expires_at).getTime()-Date.now())/1000))
  setClaimTimeLeft(left)
 },[tick,claimStarted,claimChallenge?.expires_at])

 async function startClaimChallenge(){
  if(!pendingClaim||claimResolving||claimStarted)return
  setClaimResolving(true)
  const {data,error}=await supabase.rpc('start_treasure_claim_v620',{p_claim_id:pendingClaim.id})
  setClaimResolving(false)
  if(error){setMsg('Schatzsicherung: '+error.message);return}
  setClaimStarted(true)
  setClaimChallenge(data||null)
  setClaimResult(null)
  setClaimInput('')
  if(['memory_forward','memory_reverse','memory_swap'].includes(data?.challenge_type)){
    setClaimShow(true)
    clearTimeout(claimTimerRef.current)
    const showMs=Math.max(5000,Math.min(15000,Number(data?.show_seconds||6.5)*1000))
    claimTimerRef.current=setTimeout(()=>setClaimShow(false),showMs)
  }else{
    setClaimShow(false)
  }
 }

 async function resolveClaim(answer){
  if(!pendingClaim||claimResolving)return
  setClaimResolving(true)
  clearTimeout(claimTimerRef.current)
  const {data,error}=await supabase.rpc('resolve_treasure_claim_v620',{
    p_claim_id:pendingClaim.id,p_answer:answer
  })
  setClaimResolving(false)
  if(error){setMsg('Schatzsicherung: '+error.message);return}

  if(data?.retryable){
    setMsg(data?.message||'Eingabe noch nicht vollständig')
    return
  }

  if(!data?.passed&&data?.reason==='wrong'){
    setClaimResult({
      passed:false,
      message:data?.message||'Schatzsicherung fehlgeschlagen',
      correctAnswer:data?.correct_answer||'',
      displayCode:data?.display_code||'',
      challengeType:data?.challenge_type||claimChallenge?.challenge_type||'memory_forward'
    })
  }

  setPendingClaim(null)
  setClaimInput('')
  setClaimShow(false)
  setClaimStarted(false)
  setClaimChallenge(null)
  setClaimTimeLeft(null)
  setMsg(data?.message||'Schatzsicherung beendet')

  if(data?.passed){
    setTreasurePopup({
      parts:1,
      share:Number(data.share_bps||0),
      gold:Number(data.amount_ug||0),
      source:'claim'
    })
    await Promise.all([loadGoldOnly(),loadPlayersOnly(),loadGameOnly(),loadAnalysisClues()])
    if(data?.game_over){
      setWinnerCelebration({
        won:user?.id===data.winner_id,
        name:data.winner_name||'Spieler',
        moves:Number(data.winner_moves_used||0),
        opened:0,
        share:Number(data.winner_share_bps||0),
        talerGold:Number(data.winner_taler_gold_ug||0)
      })
    }
  }else{
    await Promise.all([loadPlayersOnly(),loadAnalysisClues(),loadCluePositions()])
    setAnalysisHint(null)
    if(currentViewport.current)scheduleVisibleReload(100)
  }

  if(!(data?.retry_created&&['wrong','expired'].includes(data?.reason))){
    setTimeout(()=>loadPendingClaim(),500)
  }
 }

 function pressClaimKey(key){
  if(!pendingClaim||claimShow||claimResolving)return
  const need=Math.max(5,Math.min(6,Number(claimChallenge?.symbol_count||pendingClaim?.symbol_count||6)))
  setClaimInput(prev=>{
    if(prev.length>=need)return prev
    return (prev+String(key)).slice(0,need)
  })
 }

 async function reveal(x,y){
  if(revealBusy.current)return
  revealBusy.current=true
  setMsg('Suche läuft…')
  try{
    await supabase.rpc('set_machine_focus_v690',{p_game_id:id,p_x:x,p_y:y})
    const {data,error}=await supabase.rpc('reveal_area_v620',{p_game_id:id,p_x:x,p_y:y})
    if(error){
      const errorText=String(error.message||'')
      const traversable=
        errorText.includes('kein freies zugängliches Feld')||
        errorText.includes('vollständig erforscht')
      const {data:rescue,error:rescueError}=await supabase.rpc('ensure_terrain_progress_v6245',{p_game_id:id})
      if(traversable){
        setMsg('🧭 Assistent läuft über bereits erforschtes Gebiet weiter.')
      }else if(!rescueError&&rescue?.message){
        setMsg(rescue.message)
      }else{
        setMsg(errorText)
      }
      return {success:false,traversable,reason:errorText||'reveal_failed'}
    }

    setMsg(data?.message||'Gebiet untersucht')
    handleGimmicks(data?.gimmicks)
    handleTreasure(data,'manual')
    setSessionFields(v=>v+Number(data?.opened||0))
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
    if(currentViewport.current){
      if(Number(game?.explored_count||0)>50000)scheduleVisibleReload(300)
      else await loadVisibleFields(currentViewport.current)
    }

    // Gold ist nach eigenem Fund relevant; Spieler/Game kommen über den kompakten Live-State.
    await loadGoldOnly()
    await loadPendingClaim()
    setTimeout(()=>pollLiveState(),350)
    return {success:true,data}
  }finally{
    revealBusy.current=false
  }
 }

 async function unlockAssistant(){
  if(assistantUnlockBusy||assistantUnlocked)return
  setAssistantUnlockBusy(true)
  const {data,error}=await supabase.rpc('unlock_assistant_v629',{p_game_id:id})
  setAssistantUnlockBusy(false)
  if(error){
    setMsg('Assistent: '+error.message)
    return
  }
  setAssistantUnlocked(true)
  setMsg(data?.message||'🧭 Assistent dauerhaft freigeschaltet.')
  await loadPlayersOnly()
 }

 function toggleAssistant(){
  if(assistantUnlocked!==true){
    setMsg('🧭 Assistent muss zuerst einmalig für 10 Taler freigeschaltet werden.')
    return
  }
  if(assistantEnabled){
    setAssistantEnabled(false)
    setAssistantTarget(null)
    setMsg('🧭 Assistent pausiert. Kartenklick deckt wieder normal auf.')
    return
  }
  setTrapMode(null)
  setAssistantRouteDone(false)
  setAssistantEnabled(true)
  assistantLastStepAtRef.current=Date.now()
  setMsg(assistantWaypoints.length
    ?'🧭 Assistent aktiv. Er folgt der Route im normalen Zugtakt.'
    :'🧭 Assistent aktiv. Tippe auf die Karte, um Wegpunkte zu setzen.')
 }

 function addAssistantWaypoint(x,y){
  setAssistantRouteDone(false)
  if(assistantWaypoints.length>=20){
    setMsg('🧭 Maximal 20 Wegpunkte pro Route.')
    return
  }
  const p={x:Number(x),y:Number(y)}
  setAssistantWaypoints(prev=>[...prev,p].slice(0,20))
  setMsg(`🧭 Wegpunkt ${assistantWaypoints.length+1}/20 gesetzt.`)
 }

 function clearAssistantRoute(){
  setAssistantWaypoints([])
  setAssistantPosition(null)
  setAssistantNextIndex(0)
  setAssistantTarget(null)
  assistantPendingStepRef.current=null
  setAssistantEnabled(false)
  setAssistantRouteDone(false)
  setMsg('🧭 Assistentenroute gelöscht.')
 }

 function undoAssistantWaypoint(){
  setAssistantWaypoints(prev=>{
    const next=prev.slice(0,-1)
    if(assistantNextIndex>next.length)setAssistantNextIndex(next.length)
    return next
  })
 }

 function repeatAssistantRoute(){
  if(!assistantWaypoints.length)return
  setAssistantNextIndex(0)
  setAssistantTarget(null)
  assistantPendingStepRef.current=null
  setAssistantRouteDone(false)
  setAssistantEnabled(true)
  assistantLastStepAtRef.current=Date.now()
  setMsg('🔁 Assistent fährt die gespeicherte Route erneut ab.')
 }

 function buildAssistantStep(){
  if(!assistantWaypoints.length)return null

  if(!assistantPosition){
    const first=assistantWaypoints[0]
    return {
      x:Number(first.x),y:Number(first.y),
      nextIndex:1,
      reached:true
    }
  }

  if(assistantNextIndex>=assistantWaypoints.length)return null

  const target=assistantWaypoints[assistantNextIndex]
  const dx=Number(target.x)-Number(assistantPosition.x)
  const dy=Number(target.y)-Number(assistantPosition.y)
  const dist=Math.sqrt(dx*dx+dy*dy)
  const stepCells=Math.max(1,Math.round(Math.sqrt(Math.max(1,Number(me?.reveal_power||1)))))

  if(dist<=stepCells){
    return {
      x:Number(target.x),y:Number(target.y),
      nextIndex:assistantNextIndex+1,
      reached:true
    }
  }

  return {
    x:Math.round(Number(assistantPosition.x)+(dx/dist)*stepCells),
    y:Math.round(Number(assistantPosition.y)+(dy/dist)*stepCells),
    nextIndex:assistantNextIndex,
    reached:false
  }
 }

 async function runAssistantStep(){
  if(assistantBusyRef.current||!assistantEnabled||!assistantWaypoints.length)return
  if(document.visibilityState!=='visible'||waitingForStart||pendingClaim)return
  assistantBusyRef.current=true
  try{
    const {data,error}=await supabase.rpc('refresh_player_moves',{p_game_id:id})
    if(error)return
    setRegenInfo(data)
    if(Number(data?.moves||0)<=0)return

    const step=buildAssistantStep()
    if(!step){
      setAssistantEnabled(false)
      setAssistantRouteDone(true)
      setMsg('🏁 Assistent hat die Route abgeschlossen. Du kannst sie direkt erneut starten.')
      return
    }

    assistantPendingStepRef.current=step
    assistantTokenRef.current+=1
    setAssistantTarget({
      x:step.x,y:step.y,
      token:`${id}:${assistantTokenRef.current}`
    })
  }finally{
    assistantBusyRef.current=false
  }
 }

 function handleAssistantStepDone(result){
  const step=assistantPendingStepRef.current
  assistantPendingStepRef.current=null
  setAssistantTarget(null)
  if(!step)return

  if(result?.success||result?.blocked||result?.traversable){
    setAssistantPosition({x:step.x,y:step.y})
    setAssistantNextIndex(step.nextIndex)
    if(step.nextIndex>=assistantWaypoints.length){
      setAssistantEnabled(false)
      setAssistantRouteDone(true)
      setMsg(result?.blocked
        ?'🏁 Route beendet. Letzter Abschnitt konnte wegen Gelände nicht durchsucht werden.'
        :'🏁 Assistent hat die Route abgeschlossen. Die Wegpunkte bleiben gespeichert.')
    }
  }
 }

 function handleGimmicks(g){
  if(!g)return
  if(g.found_total!==undefined||g.available_total!==undefined){
    setGame(prev=>prev?{...prev,
      gimmicks_found_count:Number(g.found_total??prev.gimmicks_found_count??0),
      gimmick_target_count:Number(g.available_total??prev.gimmick_target_count??0)
    }:prev)
  }
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
  if(machineBusy.current||machinePower<=0||document.visibilityState!=='visible')return
  if(Date.now()<machineRetryAfterRef.current)return
  machineBusy.current=true
  try{
    const {data,error}=await supabase.rpc('run_machines_game_v620',{p_game_id:id})
    if(error){
      if(!error.message?.includes('Noch nicht fällig')){
        if(error.message?.includes('statement timeout')){
          machineRetryAfterRef.current=Date.now()+5000
          setMsg('Maschinenlauf wurde übersprungen – nächster Mikrotakt folgt automatisch.')
        }else if(error.message?.toLowerCase().includes('deadlock')){
          machineRetryAfterRef.current=Date.now()+4000
          setMsg('Maschinenlauf kurz blockiert – automatischer neuer Versuch.')
        }else setMsg('Maschinen: '+error.message)
      }
      return
    }
    if(data?.message)setMsg(data.message)
    if(data?.waiting_for_start){machineRetryAfterRef.current=Date.now()+3000;return}
    if(data?.busy){machineRetryAfterRef.current=Date.now()+1800;return}
    handleGimmicks(data?.gimmicks)
    handleTreasure(data,'machine')
    setSessionFields(v=>v+Number(data?.opened||0))
    if(data?.opened>0&&currentViewport.current){
      const now=Date.now()
      if(now-lastMachineMapRefreshAt.current>3000){
        lastMachineMapRefreshAt.current=now
        scheduleVisibleReload(350)
      }
    }
    await Promise.all([loadGoldOnly(),loadPlayersOnly(),loadPendingClaim()])
    setTimeout(()=>pollLiveState(),350)
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

 async function buyAnalysis(){
  if(analysisBuying)return
  setAnalysisBuying(true);setMsg('Deduktionsanalyse läuft…')
  const {data,error}=await supabase.rpc('buy_analysis_hint_v633',{p_game_id:id})
  setAnalysisBuying(false)
  if(error){setMsg(error.message);return}
  setAnalysisHint(data)
  setMsg(`Hinweis #${Number(data?.clue_no||0)} gekauft · ${Number(data?.cost||0).toFixed(2)} Taler`)
  await Promise.all([loadPlayersOnly(),loadAnalysisClues()])
 }

 async function recreateSameGame(){
  setMsg('Erzeuge neues Spiel mit gleichen Einstellungen…')
  const {data,error}=await supabase.rpc('create_same_game_v6151',{p_game_id:id})
  if(error){setMsg(error.message);return}
  if(data)location.href='/game/'+data
 }

 async function buy(t){
  const {data,error}=await supabase.rpc('buy_technology_v614',{p_game_id:id,p_technology_id:t.id})
  setMsg(error?error.message:(data?.message||'Erforscht'))
  await Promise.all([loadPlayersOnly(),loadOwnedOnly()]); await loadEndgameStatus()
 }

 async function toggleAutoDevelop(){
  if(autoDevelopBusy)return
  setAutoDevelopBusy(true)
  const next=!autoDevelopEnabled
  const {data,error}=await supabase.rpc('set_auto_develop_v638',{p_game_id:id,p_enabled:next})
  setAutoDevelopBusy(false)
  if(error){setMsg(error.message);return}
  setAutoDevelopEnabled(next)
  setMsg(data?.message||(next?'⚙️ Automatisch entwickeln aktiviert.':'⚙️ Automatisch entwickeln deaktiviert.'))
  await loadPlayersOnly()
 }

 async function runAutoDevelop(){
  if(autoDevelopBusy||!autoDevelopEnabled||document.visibilityState!=='visible')return
  setAutoDevelopBusy(true)
  const {data,error}=await supabase.rpc('run_auto_develop_v638',{p_game_id:id})
  setAutoDevelopBusy(false)
  if(error){
    setMsg('Auto-Entwicklung: '+error.message)
    return
  }
  if(data?.purchased){
    setMsg(data.message||'⚙️ Technologie automatisch erforscht.')
    await Promise.all([loadPlayersOnly(),loadOwnedOnly(),loadEndgameStatus()])
  }
 }

 const me=players.find(p=>p.user_id===user?.id)
 useEffect(()=>{
  if(!me)return
  if(me.assistant_unlocked===true){
    setAssistantUnlocked(true)
  }else{
    setAssistantUnlocked(prev=>prev===true?true:false)
  }
 },[me?.user_id,me?.assistant_unlocked])
 useEffect(()=>{
  if(!me)return
  setAutoDevelopEnabled(!!me.auto_develop_enabled)
 },[me?.user_id,me?.auto_develop_enabled])
 const currentAnalysisCost=analysisPrices[Math.min(6,Math.max(1,Number(me?.analysis_level||1)))]||0
 const left=game?Math.max(0,Number(game.width)*Number(game.height)-Number(game.explored_count||0)):0
 const startAtMs=game?.start_at?new Date(game.start_at).getTime():0
 const secondsToStart=startAtMs?Math.max(0,Math.ceil((startAtMs-Date.now())/1000)):0
 const waitingForStart=secondsToStart>0
 const jobSecondsLeft=job?.finishes_at?Math.max(0,Math.ceil((new Date(job.finishes_at).getTime()-Date.now())/1000)):null
 const jobReady=jobSecondsLeft===0
 function countdownText(sec){
  const d=Math.floor(sec/86400)
  const h=Math.floor((sec%86400)/3600)
  const m=Math.floor((sec%3600)/60)
  const ss=sec%60
  if(d>0)return `${d}T ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
  if(h>0)return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
 }
 const has=x=>owned.includes(x)
 const cap=game?Number(game.max_stored_moves||4)+Number(me?.move_capacity_bonus||0):4
 const effectiveRegen=Number(regenInfo?.interval_seconds||game?.regen_seconds||30)
 const branches=[...new Set(technologies.map(t=>t.branch))]
 const activeBranch=branches.includes(branch)?branch:(branches[0]||'Erkundung')
 const techProgress=branches.map(b=>{
   const items=technologies.filter(t=>t.branch===b).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0))
   const completed=items.filter(t=>has(t.id)).length
   return {branch:b,items,completed,total:items.length}
 })
 const allCurrentTechChoices=technologies
   .filter(t=>!has(t.id)&&(t.requires||[]).every(has))
   .sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0))
 const currentTechChoices=allCurrentTechChoices.slice(0,3)
 const activeTrack=techProgress.find(t=>t.branch===activeBranch)||{branch:activeBranch,items:[],completed:0,total:0}
 const activeTrackChoices=currentTechChoices.filter(t=>t.branch===activeBranch)
 const visibleTechChoices=activeTrackChoices.length?activeTrackChoices:currentTechChoices
 const techById=Object.fromEntries(technologies.map(t=>[t.id,t]))
 const activeTrackTierCache={}
 function techTierInActiveBranch(id){
   if(activeTrackTierCache[id]!==undefined)return activeTrackTierCache[id]
   const t=activeTrack.items.find(x=>x.id===id)
   if(!t){activeTrackTierCache[id]=0;return 0}
   const reqs=(t.requires||[]).map(r=>techById[r]).filter(Boolean).filter(r=>r.branch===activeBranch)
   const val=reqs.length?Math.max(...reqs.map(r=>techTierInActiveBranch(r.id)))+1:0
   activeTrackTierCache[id]=val
   return val
 }
 const activeTechColumns=activeTrack.items.reduce((acc,t)=>{
   const tier=techTierInActiveBranch(t.id)
   ;(acc[tier] ||= []).push(t)
   return acc
 },{})
 const activeTechTierList=Object.keys(activeTechColumns).map(Number).sort((a,b)=>a-b)
 const machinePower=technologies
   .filter(t=>owned.includes(t.id))
   .reduce((sum,t)=>sum+Number(t.machine_auto_fields||0),0)
   +Number(me?.endgame_machine_power_bonus||0)
 const machineBatchSize=machinePower
 const machineBatchInterval=effectiveRegen
 const secondsUntilMachine=(()=>{
   if(!me||!game||machinePower<=0)return null
   const last=new Date(me.machine_last_run_at||Date.now()).getTime()
   const due=last+machineBatchInterval*1000
   return Math.max(0,Math.ceil((due-Date.now())/1000))
 })()

 const fieldsPerMinute=sessionFields/Math.max(1/60,(Date.now()-sessionStartedAt.current)/60000)
 const trapTechs=technologies.filter(t=>owned.includes(t.id)&&t.trap_type)

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
  if(joinState!=='joined'||!assistantEnabled||!assistantWaypoints.length)return
  if(document.visibilityState!=='visible'||waitingForStart||pendingClaim)return
  if(assistantTarget)return
  const intervalMs=Math.max(5000,Number(effectiveRegen||30)*1000)
  if(Date.now()-assistantLastStepAtRef.current<intervalMs)return
  assistantLastStepAtRef.current=Date.now()
  runAssistantStep()
 },[tick,joinState,assistantEnabled,assistantWaypoints,assistantPosition,assistantNextIndex,assistantTarget,pendingClaim,waitingForStart,effectiveRegen])

 useEffect(()=>{
  if(joinState!=='joined'||machinePower<=0)return
  if(tick%10!==0)return
  if(document.visibilityState!=='visible')return
  supabase.rpc('machine_presence_v690',{p_game_id:id})
 },[tick,joinState,machinePower,id])

 useEffect(()=>{
  if(joinState!=='joined'||machinePower<=0)return
  if(document.visibilityState!=='visible')return
  // V6.46: nur noch leichter Server-Würfel statt Kartenberechnung.
  // Der Client fragt regelmäßig an; der Server würfelt nur, wenn der Takt fällig ist.
  if(tick%2!==0)return
  runMachines()
 },[tick,joinState,machinePower])

 useEffect(()=>{
  if(joinState!=='joined'||!autoDevelopEnabled||endgameStatus?.ready)return
  if(document.visibilityState!=='visible')return
  if(tick%5!==0)return
  runAutoDevelop()
 },[tick,joinState,autoDevelopEnabled,endgameStatus?.ready])

 useEffect(()=>{
  if(joinState!=='joined'||botPlayers.length===0)return
  if(document.visibilityState!=='visible')return
  if(tick%5!==0)return
  runBots()
 },[tick,joinState,botPlayers.length])

 function techEffect(t){
  const effects=[]
  if(t.description)effects.push(t.description)
  if(Number(t.reveal_power_bonus))effects.push(`+${t.reveal_power_bonus} Felder/Zug`)
  if(Number(t.reward_bonus))effects.push(`+${Math.round(Number(t.reward_bonus)*100)}% Talerbonus`)
  if(Number(t.analysis_level))effects.push(`Analyse Stufe ${t.analysis_level}`)
  if(Number(t.capacity_bonus))effects.push(`+${t.capacity_bonus} Zugspeicher`)
  if(Number(t.regen_reduction))effects.push(`${Math.round(Number(t.regen_reduction)*100)}% schnellere Regeneration`)
  if(Number(t.machine_auto_fields))effects.push(`${Number(t.machine_auto_fields).toLocaleString('de-DE')} virtuelle Suchfelder/Takt`)
  if(t.exclusive_per_game)effects.push('🔒 exklusiv: nur 1 Spieler pro Game')
  if(t.trap_type==='taler')effects.push(`🪤 Talerfalle · −${Number(t.trap_power||0)}% aktueller Taler · max. ${Number(t.trap_limit||0)} aktiv`)
  else if(t.trap_type)effects.push(`🪤 ${t.trap_type} · Stärke ${Number(t.trap_power||0)} · max. ${Number(t.trap_limit||0)} aktiv`)
  if(t.id==='ter2')effects.push('🌲 Wald freigeschaltet')
  if(t.id==='ter4')effects.push('🌊 Wasser freigeschaltet')
  if(t.id==='ter5')effects.push('🟫 Feuchtgebiete freigeschaltet')
  if(t.id==='ter6')effects.push('🏭 Industrie/Sonderflächen freigeschaltet')
  if(t.id==='ter7')effects.push('🧭 alle Terrain-Sperren aufgehoben')
  return effects.join(' · ')||'Keine direkte Wirkung'
 }

 const rankTabs=[
  ['coins','💰 Taler'],
  ['tech_count','🧠 Ausbau'],
  ['fields_revealed','🗺️ Felder'],
  ['treasure_share_bps','🧩 Schatz']
 ]
 const competitionWithBots=[
  ...competition,
  ...botPlayers.map(b=>({
    user_id:'bot:'+b.bot_id,
    bot_id:b.bot_id,
    is_bot:true,
    display_name:b.display_name,
    avatar_emoji:b.avatar_emoji,
    coins:b.coins,
    fields_revealed:b.fields_revealed,
    treasure_share_bps:b.treasure_share_bps,
    tech_count:b.tech_count
  }))
 ]
 const isTutorial=!!game?.is_tutorial
 const ownFields=Number(me?.fields_revealed||0)
 const tutorialStep=ownFields<1?0:owned.length<1?1:analysisClues.length<1?2:ownFields<8?3:4
 const tutorialHints=[
  {title:'Karte ausprobieren',text:'Klicke auf ein unbekanntes Rasterfeld. Damit verbrauchst du einen Zug und erhältst für leere Felder Taler.'},
  {title:'Technologie erforschen',text:'Du hast gesucht und Taler gesammelt. Öffne „Technologien“ und erforsche eine bezahlbare Entwicklung. Der grüne Punkt zeigt dir, wo etwas möglich ist.'},
  {title:'Analyse testen',text:'Setze einen Suchpunkt und kaufe anschließend einen Analysehinweis. Hinweise helfen dir, den Schatz systematisch einzugrenzen.'},
  {title:'Mitspieler beobachten',text:'Schau auf Karte, Teilnehmer und Ranking: Die anderen Spieler suchen gleichzeitig. Namen kannst du überall anklicken und ihr Profil öffnen.'},
  {title:'Jetzt frei spielen',text:'Du kennst die wichtigsten Elemente. Suche weiter, entwickle Technologien und versuche, den Schatz vor den anderen zu sichern.'}
 ]
 const ranked=[...competitionWithBots].sort((a,b)=>Number(b?.[rankMetric]||0)-Number(a?.[rankMetric]||0))
 function rankValue(r){
   if(rankMetric==='coins')return Number(r.coins||0).toFixed(2)+' T'
   if(rankMetric==='treasure_share_bps')return (Number(r.treasure_share_bps||0)/100).toFixed(2)+'%'
   return Number(r?.[rankMetric]||0).toLocaleString('de-DE')
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

 return <main className="container gamePage"><div className="buildBadge">V6.46</div>
  <div className="topnav"><a className="btn" href="/lobby">← Lobby</a><button className="btn" onClick={nextGame} disabled={activeGames.length<2}>↪ Nächstes Game</button><a className="btn" href="/profile">Profil</a><a className="btn" href="/legenden">🏆 Legenden</a><a className="btn" href="/hall-of-fame">🏛️ Hall of Fame</a></div>

  <div className="panel gameTopPanel mobileAllStats"><div className="gameTopTitle"><h1>{game?.name||'Spiel'}</h1></div>
   <div className="worldMeta">
    <span>📍 {game?.center_label||'Kartenmittelpunkt'} · {game?.cell_size_m||100} m pro Feld · echte Weltkarte</span>
    {game?.invite_code&&<span className="inviteChip">Einladungscode: <strong>{game.invite_code}</strong>{game.is_private?' · 🔒 privat':''}</span>}
   </div>
   <div className="gameStatsBody"><div className="gameQuickStats">
    {[
     [Number(me?.coins||0).toFixed(2),'Taler'],
     [`${me?.moves_left??0} / ${cap}`,'Züge'],
     [secondsUntilMove===null?`${effectiveRegen}s`: `${secondsUntilMove}s`,'Nächster Zug'],
     [me?.reveal_power??1,'Felder/Zug'],
     [(me?.reward_multiplier??1)+'×','Bonus'],
     ['Stufe '+(me?.analysis_level??0),'Analyse'],
     [machinePower>0?`${machinePower.toLocaleString('de-DE')} / ${secondsUntilMachine===null?'–':secondsUntilMachine+'s'}`:'0','Maschinenleistung / nächster Takt'],
     [`${Number(game?.gimmick_percent||0).toFixed(2)}% · ${Number(game?.gimmicks_found_count||0).toLocaleString('de-DE')}/${Number(game?.gimmick_target_count||0).toLocaleString('de-DE')}`,'Gimmicks'],
     [fieldsPerMinute.toFixed(1),'Felder/Min'],
     [left.toLocaleString('de-DE'),'Felder übrig']
    ].map((v,i)=><div className="quickStat" key={i}><span>{v[1]}</span><strong>{v[0]}</strong></div>)}
   </div>
   <div className="regenBarText">Ungenutzte Züge werden bis zum Speicherlimit gesammelt; darüber hinaus verfallen sie.</div>
   </div>
  </div>

  <div className="mobileSecondaryStats">
   {[
    ['Bonus',(me?.reward_multiplier??1)+'×'],
    ['Analyse','Stufe '+(me?.analysis_level??0)],
    ['Maschine',machinePower>0?machinePower.toLocaleString('de-DE'):'0'],
    ['Schatz',(Number(me?.treasure_share_bps||0)/100).toFixed(1)+'%'],
    ['Nächster Zug',secondsUntilMove===null?`${effectiveRegen}s`:`${secondsUntilMove}s`]
   ].map((v,i)=><div className="mobileSecondaryStat" key={i}><span>{v[0]}</span><b>{v[1]}</b></div>)}
  </div>

  {game&&<details className={'panel compactTreasurePanel '+(game.game_type==='pay'?'goldGamePanel':'treasureGamePanel')}>
   <summary>
    <span>🧩 Schatz</span>
    <strong>{(Number(me?.treasure_share_bps||0)/100).toFixed(2)}%</strong>
    <span>{goldTreasures.filter(t=>!t.found_by).length}/{goldTreasures.length||game.treasure_count||1} offen</span>
    {(game.game_type==='pay'||game.game_type==='sponsor')&&<span>{formatGold(game.gold_prize_pool_ug)}</span>}
   </summary>
   <div className="compactTreasureBody">
    <div className="treasurePills">{goldTreasures.map((t,i)=>{
     const finder=players.find(p=>p.user_id===t.found_by)
     return <span key={t.id} className={'treasurePill '+(t.found_by?'found':'')}>
       {t.found_by?'✅':'🧩'} {i+1}: {(Number(t.share_bps||0)/10000).toFixed(3)}
       {(game.game_type==='pay'||game.game_type==='sponsor')&&<> · {formatGold(t.amount_ug)}</>}
       {t.found_by&&<> · {finder?.profiles?.display_name||'gefunden'}</>}
     </span>
    })}</div>
    <div className="small">Gesamtschatz 1,000 · Spielende erst nach allen Teilen · größter Gesamtanteil gewinnt.</div>
   </div>
  </details>}

  {game?.game_type==='sponsor'&&<div className="sponsorGameBanner">
   <span>🤝 Sponsorspiel</span>
   <strong>{game.sponsor_name||'Sponsor'}</strong>
   <span>stiftet {formatGold(game.sponsor_pool_ug||game.gold_prize_pool_ug||0)}</span>
   <small>Teilnahme für Spieler kostenlos · Schatz muss nach Entdeckung geborgen werden.</small>
  </div>}

  {gameEvent&&<div className="globalGameEvent">📣 {gameEvent.message}</div>}

  {waitingForStart&&<div className="tournamentStartPanel">
   <div className="small">🏁 GEMEINSAMER START · {new Date(game.start_at).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
   <strong>{countdownText(secondsToStart)}</strong>
   <span>{players.length} Spieler sind bereits im Spiel.</span>
   <small>Du kannst Karte, Technologien und Mitspieler ansehen. Suche und Maschinen starten für alle gleichzeitig.</small>
  </div>}

  <div className="gameLayout">
   <section className="panel gameMapPanel">
    <div className="mapHeader"><div><h2>{game?.name||'Schatzsuche'}{game?.center_label?` · ${game.center_label}`:''}</h2><div className="small">{assistantEnabled?'Assistent aktiv: Kartenklick setzt Wegpunkte. Normales Aufdecken ist pausiert.':'Zoomen und verschieben ist möglich. Klick auf ein Rasterfeld = erkunden.'}</div>{gameActivity&&<div className="gameActivityBadge">⚡ Aktivität {Number(gameActivity.fields_per_min||0).toFixed(1)} Felder/min je Spieler</div>}</div>
     <div className="mapLegend">
      {players.map(p=><div className={'legendItem '+(onlineIds.includes(p.user_id)?'online':'offline')} key={p.user_id}><span className="colorDot" style={{background:p.player_color||'#35516d'}}></span><a className="profileLink" href={'/spieler/'+p.user_id}>{p.profiles?.display_name||'Spieler'}</a>{onlineIds.includes(p.user_id)&&<span className="onlineDot" title="online">●</span>}</div>)}
      {botPlayers.map(b=><div className="legendItem online" key={'legend-'+b.bot_id}><span className="colorDot" style={{background:b.player_color||'#35516d'}}></span><a className="profileLink" href={'/bot/'+b.bot_id}>{b.avatar_emoji||'🙂'} {b.display_name||'Spieler'}</a><span className="onlineDot" title="online">●</span></div>)}
     </div>
    </div>
    {game&&<>
     <div className="assistantToolbar">
      {assistantUnlocked===null&&<span className="assistantLoading small">🧭 Assistent wird geladen…</span>}
      {assistantUnlocked===false&&<button className="miniBtn" disabled={assistantUnlockBusy||Number(me?.coins||0)<10} onClick={unlockAssistant}>
       {assistantUnlockBusy?'Freischalten…':'🧭 Assistent freischalten · 10 T'}
      </button>}
      {assistantUnlocked===true&&<button className={'miniBtn '+(assistantEnabled?'active':'')} onClick={toggleAssistant}>
       🧭 Assistent {assistantEnabled?'AN':'AUS'}
      </button>}
      {assistantUnlocked===true&&<span className="small">
       Route: {assistantNextIndex}/{assistantWaypoints.length} erledigt · {assistantWaypoints.length}/20 Wegpunkte
       {assistantEnabled?' · Kartenklick setzt Wegpunkt':''}
      </span>}
      {assistantUnlocked===true&&assistantWaypoints.length>0&&assistantNextIndex>=assistantWaypoints.length&&<button className="miniBtn" onClick={repeatAssistantRoute}>🔁 Route wiederholen</button>}
      {assistantUnlocked===true&&assistantWaypoints.length>0&&<button className="miniBtn" onClick={undoAssistantWaypoint}>↩ Letzten löschen</button>}
      {assistantUnlocked===true&&assistantWaypoints.length>0&&<button className="miniBtn" onClick={clearAssistantRoute}>🗑 Route löschen</button>}
     </div>
     {assistantRouteDone&&<div className="assistantDoneNotice">
      <strong>🏁 Route beendet</strong>
      <span>Alle Wegpunkte wurden abgearbeitet. Die Route bleibt gespeichert.</span>
      <button className="miniBtn" onClick={repeatAssistantRoute}>🔁 Noch einmal abfahren</button>
     </div>}
     <div className="trapToolbar">{trapTechs.length>0&&<><span>🪤 Falle:</span>{trapTechs.map(t=><button key={t.id} className={'miniBtn '+(trapMode===t.id?'active':'')} disabled={assistantEnabled} onClick={()=>setTrapMode(trapMode===t.id?null:t.id)}>{t.name} · {Number(t.trap_place_cost||0).toFixed(1)} T</button>)}{trapMode&&<button className="miniBtn trapCancelBtn" onClick={()=>setTrapMode(null)}>✕ Fallenmodus beenden</button>}</>}</div><GameMap game={game} mapChunks={mapChunks} mapRenderMode={mapRenderMode} players={[...players,...botPlayers.map(b=>({user_id:'bot:'+b.bot_id,player_color:b.player_color,display_name:b.display_name,is_bot:true}))]} onReveal={reveal} onTerrainReveal={terrainReveal} onTerrainBatch={cacheTerrainBatch} terrainScanPower={Number(me?.reveal_power||1)+Number(me?.gimmick_reveal_bonus_pending||0)} onTrapPlace={placeTrap} trapMode={trapMode} ownTraps={ownTraps} analysisHint={analysisHint} onViewportChange={handleViewport} analysisFocusToken={analysisFocusToken} onAnalysisFeatures={items=>{setAnalysisFeatures(items);setAnalysisClue(buildAnalysisClue(items))}}
      waypointMode={assistantEnabled}
      onWaypoint={addAssistantWaypoint}
      assistantWaypoints={assistantWaypoints}
      assistantPosition={assistantPosition}
      assistantTarget={assistantTarget}
      onAssistantStepDone={handleAssistantStepDone}
      clueMarker={selectedClueMarker}
      mobileHud={<div className="mobileMapHud">
       {[
        [Number(me?.coins||0).toFixed(2),'Taler'],
        [`${me?.moves_left??0}/${cap}`,'Züge'],
        [me?.reveal_power??1,'Felder/Zug'],
        [fieldsPerMinute.toFixed(1),'Felder/Min'],
        [left.toLocaleString('de-DE'),'Felder übrig']
       ].map((v,i)=><div className="mobileHudStat" key={i}><span>{v[1]}</span><b>{v[0]}</b></div>)}
      </div>}
      mapInfo={<>
       <div className="mapInfoMain">{msg||(assistantEnabled?'🧭 Assistent aktiv · Wegpunkte auf der Karte setzen':'Karte bereit · Feld antippen zum Erkunden')}</div>
       <div className="mapInfoTerrain">
        <span>🌊 Wasser</span><span>🌲 Wald</span><span>🌾 Offen</span>
        <span>🚜 Acker</span><span>🏙 Stadt</span><span>🏭 Industrie</span>
        {terrainInfo&&<b>{terrainInfo.label}</b>}
       </div>
      </>}/></>}
    <details className="panel jobPanel compactJobPanel">
      <summary className="compactJobSummary">
       <span><strong>🧰 Nebenjobs</strong><small>Zeit gegen Taler</small></span>
       {job&&<span className={'jobStatus '+(jobReady?'ready':'')}>{jobReady?'✓ Lohn bereit':`⏱ ${Math.floor(jobSecondsLeft/60)}:${String(jobSecondsLeft%60).padStart(2,'0')}`}</span>}
       {!job&&<span className="compactJobChevron">⌄</span>}
      </summary>
      <div className="compactJobBody">
       {!job&&<div className="jobChoices jobChoiceCards">
        <button className="jobChoiceBtn" disabled={jobBusy||waitingForStart} onClick={()=>startJob('bottles')}>
         <span>♻️</span><div><strong>Pfandflaschen sammeln</strong><small>{Math.round(jobSettings.bottlesSeconds/60)} Min. · +{Number(jobSettings.bottlesReward).toFixed(2)} Taler</small></div>
        </button>
        <button className="jobChoiceBtn" disabled={jobBusy||waitingForStart} onClick={()=>startJob('scrap')}>
         <span>🔩</span><div><strong>Altmetall suchen</strong><small>{Math.round(jobSettings.scrapSeconds/60)} Min. · +{Number(jobSettings.scrapReward).toFixed(2)} Taler</small></div>
        </button>
       </div>}
       {job&&!jobReady&&<div className="jobRunningLine"><span>{job.job_type==='bottles'?'♻️ Pfandflaschen':'🔩 Altmetall'}</span><strong>{Math.floor(jobSecondsLeft/60)}:{String(jobSecondsLeft%60).padStart(2,'0')}</strong><small>+{Number(job.reward_taler||0).toFixed(2)} Taler</small></div>}
       {job&&jobReady&&<button className="btn primary compactClaimJob" disabled={jobBusy} onClick={claimJob}>💰 Lohn abholen · +{Number(job.reward_taler||0).toFixed(2)} Taler</button>}
      </div>
    </details>

    {Number(me?.analysis_level||0)>0&&<div className="analysisPurchaseBox deductionPanel searchCenterCompact">
      <div className="analysisPurchaseHead">
       <div>
        <strong>🧭 Suchzentrale · Analyse {Number(me.analysis_level)}</strong>
        <div className="small">
         {analysisClues.length
          ?`${analysisClues.length} Hinweis${analysisClues.length===1?'':'e'} gesammelt · nächster Hinweis verfeinert die Suche`
          :'Noch kein Hinweis gekauft · starte mit einer groben Eingrenzung'}
        </div>
       </div>
       <button className="btn primary" disabled={analysisBuying||waitingForStart} onClick={buyAnalysis}>
        {analysisBuying?'Analysiert…':`Nächsten Hinweis · ${Number(currentAnalysisCost).toFixed(2)} T`}
       </button>
      </div>

      {analysisHint&&<div className="analysisHintBox compactAnalysisHint">
       <div className="analysisHintTitle"><strong>{clueTypeLabel(analysisHint.kind)}</strong><span>aktueller Hinweis</span></div>
       <div>{analysisHint.text}</div>
       {analysisHint.kind==='precision_zone'&&analysisClue&&<div className="analysisMapContext">🗺️ {analysisClue}</div>}
      </div>}

      {analysisClues.length>0&&<details className="deductionNotebook compactClueHistory">
       <summary>
        <span>📓 Bisherige Hinweise</span>
        <span className="small">{analysisClues.length}</span>
       </summary>
       <div className="deductionClueList">
        {[...analysisClues].reverse().slice(0,8).map(c=><div className="deductionClue" key={c.id}>
         <div className="deductionClueHead">
          <strong>{clueTypeLabel(c.clue_kind)} · #{c.clue_no}</strong>
          <span>Schatz {c.treasure_no}</span>
         </div>
         <div>{c.text}</div>
         <div className="clueActions">
          <button className="miniBtn" onClick={()=>showClueOnMap(c)}>📍 Standort zeigen</button>
         </div>
        </div>)}
       </div>
      </details>}
    </div>}
   </section>

   <aside className="panel developmentPanel">
    <div className="developmentHead technologyHeaderRow">
     <h2>🧠 Technologien</h2>
     <label className={'autoDevelopToggle '+(autoDevelopEnabled?'active':'')}>
      <input type="checkbox" checked={autoDevelopEnabled} disabled={autoDevelopBusy||endgameStatus?.ready}
       onChange={toggleAutoDevelop}/>
      <span>⚙️ automatisch entwickeln</span>
     </label>
    </div>

    {!endgameStatus?.ready&&<div className="technologyBranchStack compactCategories">
     {techProgress.map(track=>{
      const branchAllChoices=allCurrentTechChoices.filter(t=>t.branch===track.branch)
      const branchChoices=branchAllChoices.slice(0,2)
      const branchCanBuy=branchAllChoices.some(t=>Number(me?.coins||0)>=Number(t.cost))
      return <details className="technologyBranchSection compactBranch" key={track.branch}>
       <summary className="technologyBranchSummary">
        <div className="technologyBranchSummaryMain">
         <div className="technologyBranchTitleRow">
          <strong><i className={'branchReadyDot '+(branchCanBuy?'ready':'idle')} title={branchCanBuy?'Technologie jetzt bezahlbar':'Aktuell nichts bezahlbar'}></i>{track.branch}</strong>
          <span>{track.completed}/{track.total}</span>
         </div>
         <div className="technologyBranchProgress">
          {track.items.map(t=>{
           const state=has(t.id)?'done':(t.requires||[]).every(has)?'current':'future'
           return <span key={t.id} className={state} title={t.name}></span>
          })}
         </div>
        </div>
        <span className="branchChevron">⌄</span>
       </summary>

       {branchChoices.length>0&&<div className="branchAvailableTechs branchPreviewChoices">
        {branchChoices.map(t=>{
         const enough=Number(me?.coins||0)>=Number(t.cost)
         return <div className="branchAvailableCard preview" key={t.id}>
          <div>
           <strong>{t.name}{t.exclusive_per_game?' 🔒':''}</strong>
           <div className="small">{techEffect(t)}</div>
          </div>
          <button className="miniBtn primaryTechAction" disabled={!enough} onClick={e=>{e.preventDefault();e.stopPropagation();buy(t)}}>
           {enough?`${Number(t.cost).toFixed(2)} T · Erforschen`:`${Number(t.cost).toFixed(2)} T`}
          </button>
         </div>
        })}
       </div>}

       {branchChoices.length===0&&track.completed<track.total&&<div className="small muted branchNoChoice">
        In diesem Zweig ist aktuell keine neue Technologie direkt verfügbar.
       </div>}

       <div className="branchTechPath">
        {track.items.map((t,i)=>{
         const ready=!has(t.id)&&(t.requires||[]).every(has)
         const state=has(t.id)?'done':ready?'current':'future'
         const reqNames=(t.requires||[]).map(r=>techById[r]?.name).filter(Boolean)
         return <div className="branchTechStepWrap" key={t.id}>
          {i>0&&<span className="branchTechConnector">↓</span>}
          <div className={'branchTechStep '+state}>
           <div className="branchTechStepTop">
            <span className={'branchTechState '+state}>
             {state==='done'?'✓':state==='current'?'●':'○'}
            </span>
            <strong>{t.name}{t.exclusive_per_game?' 🔒':''}</strong>
            <span className="branchTechCost">{Number(t.cost||0).toFixed(2)} T</span>
           </div>
           <div className="small">{techEffect(t)}</div>
           {reqNames.length>0&&<div className="techReqLine">Voraussetzung: {reqNames.join(' + ')}</div>}
           {state==='current'&&<button className="miniBtn branchResearchBtn"
             disabled={Number(me?.coins||0)<Number(t.cost)}
             onClick={()=>buy(t)}>
             {Number(me?.coins||0)>=Number(t.cost)?'Erforschen':'Nicht genug Taler'}
           </button>}
          </div>
         </div>
        })}
       </div>
      </details>
     })}
    </div>}

    {endgameStatus?.ready&&<div className="endgameUpgradePanel">
      <div className="endgameUpgradeHead">
       <strong>♾️ Endgame-Ausbau</strong>
       <span>Normaler Techbaum vollständig</span>
      </div>
      <div className="endgameUpgradeCard">
       <div><strong>🗺️ Expeditionsausbau</strong><div className="small">+{Number(endgameStatus.reveal_bonus_per_buy||0).toLocaleString('de-DE')} Felder/Zug · {Number(endgameStatus.reveal_buys||0)}× gekauft</div></div>
       <button className="btn primary" disabled={endgameBusy||Number(me?.coins||0)<Number(endgameStatus.reveal_next_cost||0)} onClick={()=>buyEndgame('reveal')}>
        {Number(endgameStatus.reveal_next_cost||0).toFixed(2)} T
       </button>
      </div>
      <div className="endgameUpgradeCard">
       <div><strong>⚙️ Maschinenoptimierung</strong><div className="small">+{Number(endgameStatus.machine_bonus_per_buy||0).toLocaleString('de-DE')} Suchfelder/Takt · {Number(endgameStatus.machine_buys||0)}× gekauft</div></div>
       <button className="btn primary" disabled={endgameBusy||Number(me?.coins||0)<Number(endgameStatus.machine_next_cost||0)} onClick={()=>buyEndgame('machine')}>
        {Number(endgameStatus.machine_next_cost||0).toFixed(2)} T
       </button>
      </div>
    </div>}
   </aside>
  </div>

  <details className="panel gameChangelogPanel">
   <summary><span>📜 Spiel-Changelog</span><span className="small">{gameChangelog.length} Ereignisse</span></summary>
   <div className="gameChangelogList">
    {gameChangelog.length===0&&<div className="muted small">Noch keine protokollierten Spielereignisse.</div>}
    {gameChangelog.map(evt=><div className="gameChangelogItem" key={evt.id}>
     <div className="gameChangelogMeta">
      <span>{evt.event_type||'event'}</span>
      <time>{evt.created_at?new Date(evt.created_at).toLocaleString('de-DE'):'–'}</time>
     </div>
     <div>{evt.message||'Spielereignis'}</div>
    </div>)}
   </div>
  </details>

  <details className="panel ingameRanking" open={rankOpen} onToggle={e=>setRankOpen(e.currentTarget.open)}>
   <summary><span>🏁 Ingame-Ranking</span><span className="small">{competitionWithBots.length} Teilnehmer</span></summary>
   <div className="rankingBody">
    <div className="rankingTabs">{rankTabs.map(t=><button key={t[0]} className={'miniBtn '+(rankMetric===t[0]?'active':'')} onClick={()=>setRankMetric(t[0])}>{t[1]}</button>)}</div>
    <div className="rankingList">
     {ranked.map((r,i)=><div className={'rankingRow '+(r.user_id===user?.id?'me':'')} key={r.user_id}>
      <span>{i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1)}</span>
      <strong>{r.is_bot
       ?<a className="profileLink" href={'/bot/'+r.bot_id}>{r.avatar_emoji||'🙂'} {r.display_name||'Spieler'} <span className="onlineDot" title="online">●</span></a>
       :<><a className="profileLink" href={'/spieler/'+r.user_id}>{r.display_name||'Spieler'}</a> {onlineIds.includes(r.user_id)&&<span className="onlineDot" title="online">●</span>}</>}</strong>
      <b>{rankValue(r)}</b>
     </div>)}
    </div>
   </div>
  </details>

  <div className="panel"><h2>Teilnehmer</h2><div className="grid">
   {players.map(p=><div className={'card playerStatusCard '+(onlineIds.includes(p.user_id)?'online':'offline')} key={p.user_id}>
    <div className="playerNameLine"><span className="colorDot large" style={{background:p.player_color||'#35516d'}}></span><strong><a className="profileLink" href={'/spieler/'+p.user_id}>{p.profiles?.display_name||'Spieler'}</a></strong><span className={'presenceLabel '+(onlineIds.includes(p.user_id)?'online':'')}>{onlineIds.includes(p.user_id)?'● online':'offline'}</span></div>
    <div className="small">{Number(p.coins).toFixed(2)} T · {p.moves_left} gespeicherte Züge · {p.reveal_power} Felder/Zug · 🗺️ {Number(p.fields_revealed||0).toLocaleString('de-DE')} Felder · 🧩 {(Number(p.treasure_share_bps||0)/100).toFixed(2)}%</div>
   </div>)}
   {botPlayers.map(b=><div className="card playerStatusCard online" key={'bot-'+b.bot_id}>
    <div className="playerNameLine"><span className="colorDot large" style={{background:b.player_color||'#35516d'}}></span><strong><a className="profileLink" href={'/bot/'+b.bot_id}>{b.avatar_emoji||'🙂'} {b.display_name||'Spieler'}</a></strong><span className="presenceLabel online">● online</span></div>
    <div className="small">{Number(b.coins||0).toFixed(2)} T · {Number(b.moves_left||1)} gespeicherte Züge · {Number(b.reveal_power||1)} Felder/Zug · 🗺️ {Number(b.fields_revealed||0).toLocaleString('de-DE')} Felder · 🧩 {(Number(b.treasure_share_bps||0)/100).toFixed(2)}%</div>
   </div>)}
  </div></div>
  {isTutorial&&<aside className="tutorialLiveCoach">
   <div className="tutorialCoachProgress">🎓 Tutorial · {tutorialStep+1}/5</div>
   <strong>{tutorialHints[tutorialStep].title}</strong>
   <p>{tutorialHints[tutorialStep].text}</p>
   <div className="tutorialCoachMini">
    <span>🗺️ {ownFields} Felder</span>
    <span>🧠 {owned.length} Techs</span>
    <span>🧭 {analysisClues.length} Hinweise</span>
   </div>
   {tutorialStep===4&&<a className="miniBtn" href="/lobby">Tutorial verlassen</a>}
  </aside>}
  {game&&user&&<GameChat gameId={id} userId={user.id}/>}

  {claimResult&&!claimResult.passed&&<div className="claimOverlay" role="dialog" aria-modal="true">
   <div className="claimModal claimResultModal">
    <div className="claimIcon">🧩</div>
    <div className="small">SCHATZSICHERUNG NICHT GESCHAFFT</div>
    <h2>Das wäre richtig gewesen</h2>
    <p>{claimResult.challengeType==='memory_reverse'
      ? 'Die angezeigte Folge musste rückwärts eingegeben werden.'
      : 'Die angezeigte Folge musste in normaler Reihenfolge eingegeben werden.'}</p>
    <div className="claimCorrectAnswer">
     {String(claimResult.correctAnswer||'').split('').map((n,i)=><span className={'claimKey k'+n} key={i}>
      {n==='1'?'▲':n==='2'?'●':n==='3'?'■':'◆'}
     </span>)}
    </div>
    <div className="small muted">Der Schatz bleibt auf diesem Feld. Dein nächster Sicherungsversuch wird etwas leichter.</div>
    <button className="btn primary" onClick={async()=>{
      setClaimResult(null)
      await loadPendingClaim()
    }}>Verstanden · neuer Versuch</button>
   </div>
  </div>}

  {pendingClaim&&<div className="claimOverlay" role="dialog" aria-modal="true">
   <div className="claimModal">
    <div className="claimIcon">🧗</div>
    <div className="small">SCHATZ ENTDECKT · NOCH NICHT GEBORGEN</div>
    <h2>Schatzsicherung</h2>
    {claimStarted&&claimTimeLeft!==null&&<div className={'claimCountdown '+(claimTimeLeft<=20?'urgent':'')}>
      ⏱️ {Math.floor(claimTimeLeft/60)}:{String(claimTimeLeft%60).padStart(2,'0')}
    </div>}
    {claimStarted&&Number(claimChallenge?.failure_level||0)>0&&<div className="claimAssistBadge">
      🧩 Anpassung nach Fehlversuchen · Stufe {Number(claimChallenge.failure_level)}
    </div>}
    {Number(pendingClaim.amount_ug||0)>0&&<div className="claimPrize">✨ möglicher Fund: {formatGold(pendingClaim.amount_ug)}</div>}

    {!claimStarted&&<>
      <p>Die Aufgabe startet erst, wenn du bereit bist. Danach startet der Countdown. Je nach bisheriger Sicherungsstufe bekommst du 5 oder 6 Symbole und etwas mehr oder weniger Zeit.</p>
      <button className="btn primary" disabled={claimResolving} onClick={startClaimChallenge}>
       {claimResolving?'Startet…':'Schatz sichern'}
      </button>
    </>}

    {claimStarted&&claimChallenge?.challenge_type==='memory_forward'&&<>
      <div className="claimRuleBadge">→ NORMALE REIHENFOLGE</div>
      <p>Merke dir die Symbolfolge und gib sie danach <strong>genau von links nach rechts</strong> ein.</p>
      {claimShow
       ? <div className="claimSequence">{String(claimChallenge.display_code||'').split('').map((n,i)=><span className={'claimKey k'+n} key={i}>{n==='1'?'▲':n==='2'?'●':n==='3'?'■':'◆'}</span>)}</div>
       : <ClaimSymbolInput value={claimInput} count={Number(claimChallenge?.symbol_count||6)} onKey={pressClaimKey} onClear={()=>setClaimInput('')} onSubmit={resolveClaim} disabled={claimResolving}/>}
    </>}

    {claimStarted&&claimChallenge?.challenge_type==='memory_reverse'&&<>
      <div className="claimReverseAlert">
       <div className="claimReverseTop">⚠️ RÜCKWÄRTS!</div>
       <div className="claimReverseMain">LETZTES SYMBOL ZUERST</div>
       <div className="claimReverseExample">
        <span>▲ ● ■ ◆</span>
        <b>→</b>
        <span>◆ ■ ● ▲</span>
       </div>
      </div>
      <p className="claimReverseText">Merken wie angezeigt – <strong>bei der Eingabe hinten anfangen.</strong></p>
      {claimShow
       ? <div className="claimSequence">{String(claimChallenge.display_code||'').split('').map((n,i)=><span className={'claimKey k'+n} key={i}>{n==='1'?'▲':n==='2'?'●':n==='3'?'■':'◆'}</span>)}</div>
       : <ClaimSymbolInput value={claimInput} count={Number(claimChallenge?.symbol_count||6)} onKey={pressClaimKey} onClear={()=>setClaimInput('')} onSubmit={resolveClaim} disabled={claimResolving}/>}
    </>}

    {claimStarted&&claimChallenge?.challenge_type==='memory_swap'&&<>
      <p>Merke dir die sechs Symbole. Danach vertauschst du immer die Paare: <strong>2–1 · 4–3 · 6–5</strong>.</p>
      {claimShow
       ? <div className="claimSequence">{String(claimChallenge.display_code||'').split('').map((n,i)=><span className={'claimKey k'+n} key={i}>{n==='1'?'▲':n==='2'?'●':n==='3'?'■':'◆'}</span>)}</div>
       : <ClaimSymbolInput value={claimInput} count={Number(claimChallenge?.symbol_count||6)} onKey={pressClaimKey} onClear={()=>setClaimInput('')} onSubmit={resolveClaim} disabled={claimResolving}/>}
    </>}

    {claimStarted&&<div className="small claimRule">Ein bestätigter Versuch. Kontrolliere deine Symbolfolge vor dem Absenden.</div>}
   </div>
  </div>}

  {treasurePopup&&<div className="treasureFoundOverlay" role="dialog" aria-modal="true">
   <div className="treasureFoundModal">
    <div className="treasureFoundIcon">🧩</div>
    <div className="small">SCHATZTEIL GEFUNDEN</div>
    <h2>+{(treasurePopup.share/100).toFixed(2)} %</h2>
    <p>{treasurePopup.parts>1?`${treasurePopup.parts} Schatzteile auf einmal!`:'Du hast einen Teil des Gesamtschatzes gefunden.'}</p>
    {treasurePopup.gold>0&&<div className="treasureGold">✨ {formatGold(treasurePopup.gold)} Gold</div>}
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

  {globalPopup&&<div className="globalAchievementOverlay" role="dialog" aria-modal="true">
   <div className="globalAchievementPopup">
    <div className="globalAchievementIcon">{globalPopup.type==='treasure_found'?'🧩':globalPopup.type==='trap'||globalPopup.type==='trap_treasure'?'🪤':'🔒⚡'}</div>
    <div className="small">{globalPopup.type==='treasure_found'?'SCHATZFUND':globalPopup.type==='trap'||globalPopup.type==='trap_treasure'?'FALLEN-EREIGNIS':'EINZIGARTIGE FÄHIGKEIT'}</div>
    <h2>{globalPopup.type==='treasure_found'?'Schatzteil gefunden!':globalPopup.type==='trap'||globalPopup.type==='trap_treasure'?'Falle ausgelöst!':'Technologie gesichert!'}</h2>
    <p>{globalPopup.message}</p>
    <button className="btn" onClick={()=>setGlobalPopup(null)}>Weiter</button>
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
      {game?.game_type!=='sponsor'&&<button className="btn" onClick={recreateSameGame}>🔁 Gleiches Spiel nochmal</button>}
      <button className="btn" onClick={()=>setWinnerCelebration(null)}>Noch kurz hier bleiben</button>
    </div>
   </div>
  </div>}
 </main>
}


function ClaimSymbolInput({value,count=6,onKey,onClear,onSubmit,disabled}){
 const symbols={1:'▲',2:'●',3:'■',4:'◆'}
 const need=Math.max(5,Math.min(6,Number(count||6)))
 return <div className="claimInputArea">
  <div className="claimInput">{Array.from({length:need},(_,i)=><span key={i}>{value[i]?symbols[value[i]]:'·'}</span>)}</div>
  <div className="claimButtons">
   {[1,2,3,4].map(n=><button key={n} disabled={disabled||value.length>=need} onClick={()=>onKey(n)}>{symbols[n]}</button>)}
  </div>
  <div className="claimSubmitRow">
   <button className="miniBtn" disabled={disabled||!value} onClick={onClear}>Eingabe löschen</button>
   <button className="btn primary" disabled={disabled||value.length!==need} onClick={()=>onSubmit(value)}>
    Antwort prüfen
   </button>
  </div>
  {value.length<need&&<div className="small">{value.length}/{need} Symbole eingegeben</div>}
  {value.length===need&&<div className="small">Kontrolliere die Folge und bestätige dann bewusst.</div>}
 </div>
}
