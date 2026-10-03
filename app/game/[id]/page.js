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
 const [joinState,setJoinState]=useState('checking'),[joinPassword,setJoinPassword]=useState(''),[analysisHint,setAnalysisHint]=useState(null),[analysisFeatures,setAnalysisFeatures]=useState([]),[analysisFocusToken,setAnalysisFocusToken]=useState(0),[analysisClue,setAnalysisClue]=useState(''),[tick,setTick]=useState(0),[winnerCelebration,setWinnerCelebration]=useState(null),[gimmickPopup,setGimmickPopup]=useState(null),[treasurePopup,setTreasurePopup]=useState(null),[activeGames,setActiveGames]=useState([]),[statsOpen,setStatsOpen]=useState(false),[sessionFields,setSessionFields]=useState(0),[ownTraps,setOwnTraps]=useState([]),[trapMode,setTrapMode]=useState(null),[gameEvent,setGameEvent]=useState(null),[competition,setCompetition]=useState([]),[rankOpen,setRankOpen]=useState(false),[rankMetric,setRankMetric]=useState('coins'),[globalPopup,setGlobalPopup]=useState(null),[analysisPrices,setAnalysisPrices]=useState({1:5,2:10,3:15,4:20,5:25,6:30}),[analysisBuying,setAnalysisBuying]=useState(false),[onlineIds,setOnlineIds]=useState([])
 const moveRefreshBusy=useRef(false),revealBusy=useRef(false),machineBusy=useRef(false),viewportTimer=useRef(null),viewportSeq=useRef(0),currentViewport=useRef(null),sessionStartedAt=useRef(Date.now()),lastFieldVersion=useRef(0),lastEventId=useRef(0),livePollBusy=useRef(false),playerReloadTimer=useRef(null),winnerHandledRef=useRef(false),lastPlayersSig=useRef(''),lastCompetitionSig=useRef(''),lastVisibleReloadAt=useRef(0),lastPollAt=useRef(0),lastMachineMapRefreshAt=useRef(0)

 useEffect(()=>{
  init()
  const ch=supabase.channel('game-'+id)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'game_events',filter:`game_id=eq.${id}`},payload=>handleRealtimeGameEvent(payload.new))
   .subscribe()
  const timer=setInterval(()=>setTick(t=>t+1),1000)
  const liveTimer=setInterval(()=>{if(document.visibilityState==='visible')pollLiveState()},7000)
  return()=>{supabase.removeChannel(ch);clearInterval(timer);clearInterval(liveTimer);clearTimeout(viewportTimer.current);clearTimeout(playerReloadTimer.current)}
 },[id])

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
  if(evt.id){
    const eid=Number(evt.id||0)
    if(eid<=lastEventId.current)return
    lastEventId.current=eid
  }
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
      return {...g,explored_count:explored,field_version:fv,status:data.status,winner_id:data.winner_id}
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
      if(currentViewport.current)scheduleVisibleReload(80)
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
  const {data}=await supabase.from('game_players').select('user_id,coins,moves_left,reveal_power,reward_multiplier,analysis_level,player_color,move_capacity_bonus,regen_reduction,last_regen_at,machine_last_run_at,auto_focus_x,auto_focus_y,treasure_share_bps,treasure_parts_found,machine_ticks_used,machine_mode,gimmick_reveal_bonus_pending,fields_revealed,profiles(display_name,avatar_path)').eq('game_id',id).order('joined_at')
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
 async function loadCompetition(){
  const {data}=await supabase.rpc('get_game_competition_v615',{p_game_id:id})
  if(data)setCompetition(data)
 }

 async function loadOwnTraps(){
  const {data}=await supabase.rpc('get_my_traps_v614',{p_game_id:id})
  if(data)setOwnTraps(data)
 }

 async function placeTrap(x,y){
  if(!trapMode)return
  const {data,error}=await supabase.rpc('place_trap_v614',{p_game_id:id,p_x:x,p_y:y,p_technology_id:trapMode})
  if(error){setMsg('Falle: '+error.message);return}
  setMsg(data?.message||'Falle platziert')
  await loadOwnTraps()
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
      supabase.from('game_players').select('user_id,coins,moves_left,reveal_power,reward_multiplier,analysis_level,player_color,move_capacity_bonus,regen_reduction,last_regen_at,machine_last_run_at,auto_focus_x,auto_focus_y,treasure_share_bps,treasure_parts_found,machine_ticks_used,machine_mode,gimmick_reveal_bonus_pending,fields_revealed,profiles(display_name,avatar_path)').eq('game_id',id).order('joined_at'),
      supabase.from('player_technologies').select('technology_id').eq('game_id',id).eq('user_id',user?.id||'00000000-0000-0000-0000-000000000000'),
      supabase.from('gold_wallets').select('balance_ug').eq('user_id',user?.id||'00000000-0000-0000-0000-000000000000').maybeSingle(),
      supabase.rpc('get_treasure_status_v610',{p_game_id:id}),
      supabase.from('technologies').select('id,name,branch,cost,reveal_power_bonus,reward_bonus,analysis_level,capacity_bonus,regen_reduction,machine_auto_fields,exclusive_per_game,trap_type,trap_power,trap_limit,requires,description,sort_order,is_active').eq('is_active',true).order('sort_order',{ascending:true}).order('id',{ascending:true}),
      supabase.from('platform_settings').select('analysis_price_l1,analysis_price_l2,analysis_price_l3,analysis_price_l4,analysis_price_l5,analysis_price_l6').eq('id',1).single()
    ])

    setGame(g.data)
    lastFieldVersion.current=Number(g.data?.field_version||0)
    setPlayers(p.data||[])
    setOwned((t.data||[]).map(x=>x.technology_id))
    setWallet(w.data)
    setGoldTreasures(gt.data||[])
    setTechnologies(tech.data||[])
    setAnalysisPrices({
      1:Number(ps.data?.analysis_price_l1||5),
      2:Number(ps.data?.analysis_price_l2||10),
      3:Number(ps.data?.analysis_price_l3||15),
      4:Number(ps.data?.analysis_price_l4||20),
      5:Number(ps.data?.analysis_price_l5||25),
      6:Number(ps.data?.analysis_price_l6||30)
    })
    loadActiveGames();loadOwnTraps();loadCompetition()
  }catch(err){
    setMsg('Fehler beim Laden der Karte: '+(err?.message||String(err)))
  }
 }

 function scheduleVisibleReload(delay=220){
  clearTimeout(viewportTimer.current)
  const now=Date.now()
  const minGap=700
  const wait=Math.max(delay,minGap-(now-lastVisibleReloadAt.current))
  viewportTimer.current=setTimeout(()=>{
   const v=currentViewport.current
   if(!v)return
   lastVisibleReloadAt.current=Date.now()
   loadVisibleFields(v)
  },wait)
 }

 async function loadVisibleFields(v){
  currentViewport.current=v
  const seq=++viewportSeq.current
  const {data,error}=await supabase.rpc('get_visible_fields_v617',{
   p_game_id:id,p_x0:v.x0,p_x1:v.x1,p_y0:v.y0,p_y1:v.y1,p_step:v.step||1
  })
  if(seq!==viewportSeq.current)return
  if(error){setMsg('Kartenausschnitt konnte nicht geladen werden: '+error.message);return}
  const next=data?.fields||[]
  setFields(prev=>{
    if(prev.length===next.length){
      let same=true
      for(let i=0;i<next.length;i++){
        const a=prev[i],b=next[i]
        if(a?.x!==b?.x||a?.y!==b?.y||a?.size!==b?.size||a?.discovered_by!==b?.discovered_by||a?.is_treasure!==b?.is_treasure){
          same=false;break
        }
      }
      if(same)return prev
    }
    return next
  })
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
    const {data,error}=await supabase.rpc('reveal_area_v6151',{p_game_id:id,p_x:x,p_y:y})
    if(error){setMsg(error.message);return}

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
    if(currentViewport.current)await loadVisibleFields(currentViewport.current)

    // Gold ist nach eigenem Fund relevant; Spieler/Game kommen über den kompakten Live-State.
    await loadGoldOnly()
    setTimeout(()=>pollLiveState(),350)
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
    const {data,error}=await supabase.rpc('run_machines_game_v6151',{p_game_id:id})
    if(error){
      if(!error.message?.includes('Noch nicht fällig')){
        if(error.message?.includes('statement timeout'))setMsg('Maschinenlauf wurde übersprungen – nächster Mikrotakt folgt automatisch.')
        else setMsg('Maschinen: '+error.message)
      }
      return
    }
    if(data?.message)setMsg(data.message)
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
    await loadGoldOnly()
    setTimeout(()=>pollLiveState(),600)
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
  setAnalysisBuying(true);setMsg('Analyse läuft…')
  const {data,error}=await supabase.rpc('buy_analysis_hint_v6151',{p_game_id:id})
  setAnalysisBuying(false)
  if(error){setMsg(error.message);return}
  setAnalysisHint(data)
  setMsg(`Analyse gekauft · ${Number(data?.cost||0).toFixed(2)} Taler`)
  await loadPlayersOnly()
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
  await Promise.all([loadPlayersOnly(),loadOwnedOnly()])
 }

 const me=players.find(p=>p.user_id===user?.id)
 const currentAnalysisCost=analysisPrices[Math.min(6,Math.max(1,Number(me?.analysis_level||1)))]||0
 const left=game?Math.max(0,Number(game.width)*Number(game.height)-Number(game.explored_count||0)):0
 const has=x=>owned.includes(x)
 const cap=game?Number(game.max_stored_moves||4)+Number(me?.move_capacity_bonus||0):4
 const effectiveRegen=Number(regenInfo?.interval_seconds||game?.regen_seconds||30)
 const branches=[...new Set(technologies.map(t=>t.branch))]
 const activeBranch=branches.includes(branch)?branch:(branches[0]||'Erkundung')
 const machinePower=technologies
   .filter(t=>owned.includes(t.id))
   .reduce((sum,t)=>sum+Number(t.machine_auto_fields||0),0)
 const machineBatchSize=Math.min(150,Math.max(0,machinePower))
 const machineBatchInterval=machinePower>0
   ? Math.max(1,Math.round(effectiveRegen*(machineBatchSize/machinePower)))
   : effectiveRegen
 const secondsUntilMachine=(()=>{
   if(!me||!game||machinePower<=0)return null
   if((me.machine_mode||'focus')==='focus'&&(me.auto_focus_x==null||me.auto_focus_y==null))return null
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
  if(t.exclusive_per_game)effects.push('🔒 exklusiv: nur 1 Spieler pro Game')
  if(t.trap_type)effects.push(`🪤 ${t.trap_type} · Stärke ${Number(t.trap_power||0)} · max. ${Number(t.trap_limit||0)} aktiv`)
  return effects.join(' · ')||'Keine direkte Wirkung'
 }

 const rankTabs=[
  ['coins','💰 Taler'],
  ['tech_count','🧠 Ausbau'],
  ['fields_revealed','🗺️ Felder'],
  ['treasure_share_bps','🧩 Schatz']
 ]
 const ranked=[...competition].sort((a,b)=>Number(b?.[rankMetric]||0)-Number(a?.[rankMetric]||0))
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

 return <main className="container gamePage"><div className="buildBadge">V6.17.1</div>
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
     [machinePower>0?`${machinePower.toLocaleString('de-DE')} / ${secondsUntilMachine===null?'–':secondsUntilMachine+'s'}`:'0','Maschinenfelder / nächster Takt'],
     [`${Number(game?.gimmick_percent||0).toFixed(2)}% · ${Number(game?.gimmicks_found_count||0).toLocaleString('de-DE')}/${Number(game?.gimmick_target_count||0).toLocaleString('de-DE')}`,'Gimmicks'],
     [fieldsPerMinute.toFixed(1),'Felder/Min'],
     [left.toLocaleString('de-DE'),'Felder übrig']
    ].map((v,i)=><div className="quickStat" key={i}><span>{v[1]}</span><strong>{v[0]}</strong></div>)}
   </div>
   <div className="regenBarText">Ungenutzte Züge werden bis zum Speicherlimit gesammelt; darüber hinaus verfallen sie.</div>
   {machinePower>0&&<div className="machineStatusCompact">
    <span>⚙️ {machinePower.toLocaleString('de-DE')}/Takt{machinePower>800?` · ${machineBatchSize}/Paket`:''}</span>
    <button className={'miniBtn '+((me?.machine_mode||'focus')==='focus'?'active':'')} onClick={()=>setMachineMode('focus')}>📍 Fokus</button>
    <button className={'miniBtn '+(me?.machine_mode==='random'?'active':'')} onClick={()=>setMachineMode('random')}>🎲 Zufall</button>
   </div>}
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

  {gameEvent&&<div className="globalGameEvent">📣 {gameEvent.message}</div>}

  <div className="gameLayout">
   <section className="panel gameMapPanel">
    <div className="mapHeader"><div><h2>{game?.name||'Schatzsuche'}{game?.center_label?` · ${game.center_label}`:''}</h2><div className="small">Zoomen und verschieben ist möglich. Klick auf ein Rasterfeld = erkunden.</div></div>
     <div className="mapLegend">{players.map(p=><div className={'legendItem '+(onlineIds.includes(p.user_id)?'online':'offline')} key={p.user_id}><span className="colorDot" style={{background:p.player_color||'#35516d'}}></span>{p.profiles?.display_name||'Spieler'}{onlineIds.includes(p.user_id)&&<span className="onlineDot" title="online">●</span>}</div>)}</div>
    </div>
    {game&&<><div className="trapToolbar">{trapTechs.length>0&&<><span>🪤 Falle:</span>{trapTechs.map(t=><button key={t.id} className={'miniBtn '+(trapMode===t.id?'active':'')} onClick={()=>setTrapMode(trapMode===t.id?null:t.id)}>{t.name}</button>)}</>}</div><GameMap game={game} fields={fields} players={players} onReveal={reveal} onTrapPlace={placeTrap} trapMode={trapMode} ownTraps={ownTraps} analysisHint={analysisHint} onViewportChange={handleViewport} analysisFocusToken={analysisFocusToken} onAnalysisFeatures={items=>{setAnalysisFeatures(items);setAnalysisClue(buildAnalysisClue(items))}}
      mobileHud={<div className="mobileMapHud">
       {[
        [Number(me?.coins||0).toFixed(1),'Taler'],
        [`${me?.moves_left??0}/${cap}`,'Züge'],
        [me?.reveal_power??1,'Felder/Zug'],
        [fieldsPerMinute.toFixed(1),'Felder/Min'],
        [left.toLocaleString('de-DE'),'Felder übrig']
       ].map((v,i)=><div className="mobileHudStat" key={i}><span>{v[1]}</span><b>{v[0]}</b></div>)}
      </div>}/></>}
    {Number(me?.analysis_level||0)>0&&<div className="analysisPurchaseBox">
      <div className="analysisPurchaseHead">
       <div><strong>🧭 Analyse Stufe {me.analysis_level}</strong><div className="small">Ein Hinweis pro neuer manueller Suchposition.</div></div>
       <button className="btn" disabled={analysisBuying} onClick={buyAnalysis}>
        {analysisBuying?'Analysiert…':`Hinweis kaufen · ${Number(currentAnalysisCost).toFixed(2)} T`}
       </button>
      </div>
      {analysisHint&&<div className="analysisHintBox compactAnalysisHint"><div>{analysisHint.text}</div><div className="small">Bezahlt: {Number(analysisHint.cost||0).toFixed(2)} Taler</div></div>}
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
      <strong>{bought?'✅ ':''}{t.name}{t.exclusive_per_game?' 🔒':''}</strong><div className="small">{techEffect(t)}</div>
      <div className="small">Benötigt: {req.length?req.join(', '):'–'}</div>
      <div className="techBottom"><b>{Number(t.cost).toFixed(2)} T</b><button className="btn primary" disabled={bought||!unlocked||!enough} onClick={()=>buy(t)}>{bought?'Erforscht':'Erforschen'}</button></div>
     </div>
    })}</div>
   </aside>
  </div>

  <details className="panel ingameRanking" open={rankOpen} onToggle={e=>setRankOpen(e.currentTarget.open)}>
   <summary><span>🏁 Ingame-Ranking</span><span className="small">{competition.length} Spieler</span></summary>
   <div className="rankingBody">
    <div className="rankingTabs">{rankTabs.map(t=><button key={t[0]} className={'miniBtn '+(rankMetric===t[0]?'active':'')} onClick={()=>setRankMetric(t[0])}>{t[1]}</button>)}</div>
    <div className="rankingList">
     {ranked.map((r,i)=><div className={'rankingRow '+(r.user_id===user?.id?'me':'')} key={r.user_id}>
      <span>{i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1)}</span>
      <strong>{r.display_name||'Spieler'} {onlineIds.includes(r.user_id)&&<span className="onlineDot" title="online">●</span>}</strong>
      <b>{rankValue(r)}</b>
     </div>)}
    </div>
   </div>
  </details>

  <div className="panel"><h2>Spieler</h2><div className="grid">{players.map(p=><div className={'card playerStatusCard '+(onlineIds.includes(p.user_id)?'online':'offline')} key={p.user_id}>
   <div className="playerNameLine"><span className="colorDot large" style={{background:p.player_color||'#35516d'}}></span><strong><a className="profileLink" href={'/spieler/'+p.user_id}>{p.profiles?.display_name||'Spieler'}</a></strong><span className={'presenceLabel '+(onlineIds.includes(p.user_id)?'online':'')}>{onlineIds.includes(p.user_id)?'● online':'offline'}</span></div>
   <div className="small">{Number(p.coins).toFixed(2)} T · {p.moves_left} gespeicherte Züge · {p.reveal_power} Felder/Zug · 🗺️ {Number(p.fields_revealed||0).toLocaleString('de-DE')} Felder · 🧩 {(Number(p.treasure_share_bps||0)/100).toFixed(2)}%</div>
  </div>)}</div></div>
  {game&&user&&<GameChat gameId={id} userId={user.id}/>}

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
      <button className="btn" onClick={recreateSameGame}>🔁 Gleiches Spiel nochmal</button>
      <button className="btn" onClick={()=>setWinnerCelebration(null)}>Noch kurz hier bleiben</button>
    </div>
   </div>
  </div>}
 </main>
}
