'use client'
import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase-browser'
import {formatGold,mgToUg} from '../../lib/gold'
import FirstLoginHelp from '../../components/FirstLoginHelp'

const FALLBACK_LEFT=['Nebel','Nordlicht','Kompass','Atlas','Mond','Falken','Gold','Schatten','Fjord','Drachen','Wolken','Glut','Sternen','Wild','Dschungel','Wüsten']
const FALLBACK_RIGHT=['Jagd','Pfad','Quest','Rallye','Expedition','Mission','Odyssee','Spur','Fährte','Abenteuer','Challenge','Suche','Sprint','Reise','Geheimnis','Runde']
function creativeGameName(pool){
 const left=pool?.left?.length?pool.left:FALLBACK_LEFT
 const right=pool?.right?.length?pool.right:FALLBACK_RIGHT
 const a=left[Math.floor(Math.random()*left.length)]
 const b=right[Math.floor(Math.random()*right.length)]
 return a+b
}


export default function Lobby(){
 const [games,setGames]=useState([]),[isAdmin,setIsAdmin]=useState(false),[authReady,setAuthReady]=useState(false)
 const [wallet,setWallet]=useState(null),[settings,setSettings]=useState(null)
 const [name,setName]=useState('Neue Schatzsuche'),[msg,setMsg]=useState('')
 const [mode,setMode]=useState('random')
 const [lat,setLat]=useState('49.52'),[lon,setLon]=useState('7.14'),[label,setLabel]=useState('Zuhause')
 const [fields,setFields]=useState(100000),[cellSize,setCellSize]=useState(100)
 const [regen,setRegen]=useState(5),[capacity,setCapacity]=useState(4),[maxPlayers,setMaxPlayers]=useState(20)
 const [privateGame,setPrivateGame]=useState(false),[password,setPassword]=useState(''),[startDelay,setStartDelay]=useState(0),[customStartAt,setCustomStartAt]=useState('')
 const [inviteCode,setInviteCode]=useState(''),[joinPassword,setJoinPassword]=useState('')
 const [gameType,setGameType]=useState('standard'),[entryGold,setEntryGold]=useState('10'),[sponsorGold,setSponsorGold]=useState('100'),[sponsorName,setSponsorName]=useState(''),[treasureCount,setTreasureCount]=useState(1),[gimmickPercent,setGimmickPercent]=useState(1),[gimmickWarn,setGimmickWarn]=useState(false),[privateJoinOpen,setPrivateJoinOpen]=useState(false)
 const [placeQuery,setPlaceQuery]=useState(''),[placeResults,setPlaceResults]=useState([]),[placeSearching,setPlaceSearching]=useState(false),[selectedPlaceLabel,setSelectedPlaceLabel]=useState('')
 const [namePool,setNamePool]=useState({left:FALLBACK_LEFT,right:FALLBACK_RIGHT})
 const [sortMode,setSortMode]=useState('players')
 const [sortDir,setSortDir]=useState('desc')
 const [gameFilter,setGameFilter]=useState('all')

 useEffect(()=>{
   setName(creativeGameName(namePool))
   init()
   const channel=supabase.channel('games-live')
    .on('postgres_changes',{event:'*',schema:'public',table:'games'},()=>loadGames()).subscribe()
   return()=>supabase.removeChannel(channel)
 },[])

 async function init(){
   const {data:{user}}=await supabase.auth.getUser()
   if(!user){location.replace('/login');return}
   await supabase.rpc('run_game_maintenance_v66')
   const {data:adminFlag}=await supabase.rpc('is_admin_v67')
   setIsAdmin(!!adminFlag)
   await Promise.all([loadGames(),loadWallet(),loadSettings(),loadNamePool()])
   setAuthReady(true)
 }

 async function loadNamePool(){
   const {data,error}=await supabase.rpc('list_game_name_parts_v625')
   if(!error&&data){
     const pool={left:data.left||FALLBACK_LEFT,right:data.right||FALLBACK_RIGHT}
     setNamePool(pool)
     setName(current=>current==='Neue Schatzsuche'||!current?creativeGameName(pool):current)
   }
 }
 async function loadWallet(){
   const {data:{user}}=await supabase.auth.getUser()
   if(!user)return
   const {data}=await supabase.from('gold_wallets').select('balance_ug,test_grant_claimed').eq('user_id',user.id).maybeSingle()
   setWallet(data)
 }
 async function loadSettings(){
   const {data}=await supabase.from('platform_settings').select('prize_share_bps,community_share_bps,platform_share_bps,multi_treasure_threshold_ug,max_treasures,test_grant_ug,game_inactivity_hours,closed_game_retention_hours,inactive_community_share_bps,inactive_platform_share_bps,min_game_fields,max_game_fields,max_game_players,min_cell_size_m,max_cell_size_m,min_regen_seconds,max_regen_seconds,max_stored_moves_limit,min_entry_gold_ug,max_entry_gold_ug,exploration_reward,default_regen_seconds,min_gimmick_percent,max_gimmick_percent,default_gimmick_percent').eq('id',1).maybeSingle()
   setSettings(data)
   if(data){
     const min=Math.max(1,Number(data.min_regen_seconds||5))
     const max=Math.max(min,Number(data.max_regen_seconds||3600))
     const def=Math.min(max,Math.max(min,Number(data.default_regen_seconds||min)))
     setRegen(def)
     setGimmickPercent(Number(data.default_gimmick_percent??1))
   }
 }
 async function loadGames(){
   const {data,error}=await supabase.rpc('get_lobby_games_v625')
   if(error){setMsg(error.message);return}
   setGames(data||[])
 }

 async function claimTestGold(){
   const {data,error}=await supabase.rpc('claim_test_gold_v65')
   if(error){setMsg(error.message);return}
   setMsg(data?.message||'Goldstaub gutgeschrieben.')
   await loadWallet()
 }

 async function searchPlace(){
   const q=placeQuery.trim()
   if(q.length<2){setMsg('Bitte mindestens 2 Zeichen für die Ortssuche eingeben.');return}
   setPlaceSearching(true);setMsg('')
   try{
     const res=await fetch('/api/geocode?q='+encodeURIComponent(q))
     const data=await res.json()
     if(!res.ok)throw new Error(data?.error||'Ortssuche fehlgeschlagen')
     setPlaceResults(data.results||[])
     if(!(data.results||[]).length)setMsg('Kein passender Ort gefunden.')
   }catch(e){setMsg(e.message||'Ortssuche fehlgeschlagen')}
   finally{setPlaceSearching(false)}
 }
 function choosePlace(r){
   setLat(String(r.lat));setLon(String(r.lon));setLabel(r.short_label||r.label);setSelectedPlaceLabel(r.label||r.short_label||'')
   setPlaceResults([]);setMsg('Ort gewählt: '+(r.short_label||r.label))
 }

 async function createGame(force=false){
   setMsg('Spiel wird erstellt…')
   if(!force && Number(fields)>=100000 && Number(gimmickPercent)>0.1){
     setGimmickWarn(true);setMsg('');return
   }
   if(privateGame && password.trim().length>0 && password.trim().length<4){
     setMsg('Das Passwort muss mindestens 4 Zeichen haben.');return
   }
   const entryUg=gameType==='pay'?mgToUg(entryGold):0
   const sponsorUg=gameType==='sponsor'?mgToUg(sponsorGold):0
   if(gameType==='pay' && entryUg<=0){setMsg('Bitte einen Goldstaub-Einsatz größer 0 wählen.');return}
   if(gameType==='sponsor' && sponsorUg<=0){setMsg('Bitte einen Sponsor-Pool größer 0 mg wählen.');return}

   let scheduledStart=null
   if(Number(startDelay)===-1){
     if(!customStartAt){setMsg('Bitte Datum und Uhrzeit für den Spielstart auswählen.');return}
     const chosen=new Date(customStartAt)
     if(!Number.isFinite(chosen.getTime())||chosen.getTime()<=Date.now()){
       setMsg('Der geplante Spielstart muss in der Zukunft liegen.');return
     }
     scheduledStart=chosen.toISOString()
   }else if(Number(startDelay)>0){
     scheduledStart=new Date(Date.now()+Number(startDelay)*60*1000).toISOString()
   }

   const common={
    p_name:name,
    p_field_count:Number(fields),
    p_cell_size_m:Number(cellSize),
    p_max_players:Number(maxPlayers),
    p_location_mode:mode==='place'?'coords':mode,
    p_center_lat:mode==='coords'||mode==='place'?Number(lat):null,
    p_center_lon:mode==='coords'||mode==='place'?Number(lon):null,
    p_center_label:mode==='coords'||mode==='place'?(label||'Kartenmittelpunkt'):null,
    p_regen_seconds:Number(regen),
    p_max_stored_moves:Number(capacity),
    p_is_private:privateGame,
    p_password:privateGame && password.trim()?password:null,
    p_treasure_count:Number(treasureCount),
    p_gimmick_percent:Number(gimmickPercent)
   }
   const request=gameType==='sponsor'
    ? ['create_sponsor_game_v619',{...common,p_sponsor_name:sponsorName||name,p_sponsor_gold_ug:sponsorUg}]
    : ['create_game_v612',{...common,p_game_type:gameType,p_entry_gold_ug:entryUg}]
   const {data,error}=await supabase.rpc(request[0],request[1])
   if(error){setMsg(error.message);return}
   if(scheduledStart){
     const {error:startError}=await supabase.rpc('set_game_start_v620',{p_game_id:data,p_start_at:scheduledStart})
     if(startError){setMsg('Spiel erstellt, Starttimer konnte aber nicht gesetzt werden: '+startError.message);return}
   }
   await loadWallet()
   location.href='/game/'+data
 }

 async function joinPublic(g){
   const fn=g.game_type==='pay'?'join_paygame_v65':'join_game_v64'
   const {error}=await supabase.rpc(fn,{p_game_id:g.id,p_password:null})
   if(error){setMsg(error.message);return}
   await loadWallet()
   location.href='/game/'+g.id
 }

 async function joinPrivate(){
   setMsg('Privates Spiel wird gesucht…')
   const code=inviteCode.trim().toUpperCase()
   if(!code){setMsg('Bitte Einladungscode eingeben.');return}
   const {data,error}=await supabase.rpc('join_game_by_code_v65',{p_invite_code:code,p_password:joinPassword||null})
   if(error){setMsg(error.message);return}
   if(joinPassword)sessionStorage.setItem('game_password_'+data,joinPassword)
   await loadWallet()
   location.href='/game/'+data
 }

 async function logout(){await supabase.auth.signOut();location.href='/'}

 const prizePct=settings?settings.prize_share_bps/100:90
 const communityPct=settings?settings.community_share_bps/100:5
 const platformPct=settings?settings.platform_share_bps/100:5
 const activeGames=games.filter(g=>g.status==='active')
 const closedGames=games.filter(g=>g.status!=='active')
 function gameProgress(g){
   const total=Math.max(1,Number(g.width||0)*Number(g.height||0))
   return Math.min(1,Number(g.explored_count||0)/total)
 }
 function filterGame(g){
   const total=Number(g.width||0)*Number(g.height||0)
   if(gameFilter==='gold')return g.game_type==='pay'
   if(gameFilter==='sponsor')return g.game_type==='sponsor'
   if(gameFilter==='standard')return g.game_type==='standard'
   if(gameFilter==='fast')return Number(g.regen_seconds||999)<=30
   if(gameFilter==='slow')return Number(g.regen_seconds||0)>30
   return true
 }
 function sortValue(g){
   if(sortMode==='players')return Number(g.player_count||0)
   if(sortMode==='progress')return gameProgress(g)
   if(sortMode==='speed')return -Number(g.regen_seconds||0)
   if(sortMode==='size')return Number(g.width||0)*Number(g.height||0)
   if(sortMode==='created')return new Date(g.created_at||0).getTime()
   return 0
 }
 const visibleActiveGames=activeGames.filter(filterGame).sort((a,b)=>{
   const d=sortValue(a)-sortValue(b)
   return sortDir==='asc'?d:-d
 })
 const inactivityHours=settings?.game_inactivity_hours||24
 const retentionHours=settings?.closed_game_retention_hours||72
 const regenOptions=(()=>{
   const min=Math.max(1,Number(settings?.min_regen_seconds||5))
   const max=Math.max(min,Number(settings?.max_regen_seconds||3600))
   const def=Math.min(max,Math.max(min,Number(settings?.default_regen_seconds||min)))
   return [...new Set([min,def,5,10,15,20,30,45,60,120,300,600,1800,3600,max]
     .map(Number).filter(n=>Number.isFinite(n)&&n>=min&&n<=max))]
     .sort((a,b)=>a-b)
 })()
 function regenLabel(n){
   if(n<60)return `1 Zug / ${n} Sekunden`
   if(n%3600===0)return `1 Zug / ${n/3600} Stunde${n===3600?'':'n'}`
   if(n%60===0)return `1 Zug / ${n/60} Minuten`
   return `1 Zug / ${n} Sekunden`
 }

 if(!authReady)return <main className="container"><div className="buildBadge">V6.28</div><div className="panel">Anmeldung wird geprüft…</div></main>

 return <>
  <FirstLoginHelp/>
  <main className="container lobbyPage">
  <div className="topnav"><a className="btn" href="/tutorial">🎓 Tutorial</a>
   <a className="btn" href="/profile">Profil</a>
   <a className="btn" href="/legenden">🏆 Legenden</a>
   <a className="btn" href="/hall-of-fame">🏛️ Hall of Fame</a><a className="btn" href="/praemien">🪙 Prämien</a>
   {isAdmin&&<a className="btn adminNavBtn" href="/admin">🎛️ Schaltzentrale</a>}
   <button className="btn" onClick={logout}>Abmelden</button>
  </div>

  <div className="panel heroPanel">
   <div className="heroSplit">
    <div><h1>Lobby</h1><p className="muted">Finde eine passende Runde oder starte deine eigene Schatzsuche. Schnelle Spiele, Langzeitrunden, Goldspiele und Sponsorspiele lassen sich unten gezielt filtern und sortieren.</p><p className="small">Spiele ohne Zug werden nach {inactivityHours} Stunden automatisch geschlossen. Die großen Live-Daten geschlossener Spiele werden nach {Math.round(retentionHours/24)} Tagen bereinigt; der Endstand bleibt dauerhaft in der Hall of Fame.</p></div>
    <div className="goldWalletCard">
     <div className="small">Goldstaub</div>
     <div className="goldBalance">✨ {formatGold(wallet?.balance_ug||0)}</div>
     {!wallet?.test_grant_claimed&&<button className="btn goldBtn" onClick={claimTestGold}>250 mg Gold holen</button>}
    </div>
   </div>
  </div>

  <div className="lobbyColumns">
   <details className="panel createGamePanel createGameDetails">
    <summary className="createGameSummary">
     <span><b>➕ Neues Spiel erstellen</b><small>Spielmodus, Karte und Regeln konfigurieren</small></span>
     <span className="createGameChevron">⌄</span>
    </summary>
    <div className="createGameBody">
    <div className="gameTypeSwitch">
     <button type="button" className={'typeBtn '+(gameType==='standard'?'active':'')} onClick={()=>setGameType('standard')}>🧭 Schatzsuche</button>
     <button type="button" className={'typeBtn gold '+(gameType==='pay'?'active':'')} onClick={()=>setGameType('pay')}>✨ Goldsuche</button>
     <button type="button" className={'typeBtn sponsor '+(gameType==='sponsor'?'active':'')} onClick={()=>setGameType('sponsor')}>🤝 Sponsorspiel</button>
    </div>

    {gameType==='pay'&&<div className="goldRulesBox">
     <strong>Goldstaub-Verteilung</strong>
     <div>{prizePct}% Schatzpool · {communityPct}% Community-Ausschüttung · {platformPct}% Plattformanteil</div>
     <div className="small">Diese Quoten kann nur die Spielleitung serverseitig ändern.</div>
    </div>}

    {gameType==='sponsor'&&<div className="sponsorRulesBox">
     <strong>🤝 Kostenloses Sponsorspiel</strong>
     <div>Der Sponsor stiftet den vollständigen Gold-Pool. Spieler zahlen keinen Einsatz.</div>
     <div className="small">Ein Schatz wird erst nach bestandener Bergungsprüfung endgültig gewonnen.</div>
    </div>}

    <div className="createGrid">
     <div>
      <label>Spielname</label><input className="input" value={name} onChange={e=>setName(e.target.value)}/>
      <label>Kartenquelle</label>
      <select className="input" value={mode} onChange={e=>setMode(e.target.value)}>
       <option value="random">🌍 Zufälliger echter Ort</option><option value="place">🔎 Ort suchen</option><option value="coords">📍 Eigene Koordinaten</option>
      </select>

      {mode==='place'&&<div className="placeSearchBox">
       <label>Ort auswählen</label>
       <div className="placeSearchRow">
        <input className="input" value={placeQuery} onChange={e=>setPlaceQuery(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();searchPlace()}}}
          placeholder="z. B. St. Wendel, Saarland"/>
        <button type="button" className="btn" onClick={searchPlace} disabled={placeSearching}>{placeSearching?'Suche…':'Suchen'}</button>
       </div>
       <div className="small">Einzelne, bewusst ausgelöste Ortssuche · Kartendaten © OpenStreetMap-Mitwirkende.</div>
       {placeResults.length>0&&<div className="placeResults">
        {placeResults.map((r,i)=><button type="button" key={i} className="placeResult" onClick={()=>choosePlace(r)}>
          <strong>{r.short_label||r.label}</strong><span>{r.label}</span>
        </button>)}
       </div>}
       {mode==='place'&&selectedPlaceLabel&&<div className="selectedPlace">📍 Gewählt: <strong>{selectedPlaceLabel}</strong></div>}
      </div>}

      {mode==='coords'&&<>
       <label>Breitengrad</label><input className="input" type="number" step="0.000001" value={lat} onChange={e=>setLat(e.target.value)}/>
       <label>Längengrad</label><input className="input" type="number" step="0.000001" value={lon} onChange={e=>setLon(e.target.value)}/>
       <label>Ortsname für Hinweise</label><input className="input" value={label} onChange={e=>setLabel(e.target.value)}/>
      </>}
      <label>Maximale Spielerzahl</label><input className="input" type="number" min="2" max={settings?.max_game_players||100} value={maxPlayers} onChange={e=>setMaxPlayers(e.target.value)}/>

      {gameType==='pay'&&<>
       <label>Schürfrechte / Teilnahme pro Spieler</label>
       <div className="goldInputRow"><input className="input" type="number" min="1" step="1" value={entryGold} onChange={e=>setEntryGold(e.target.value)}/><span>mg Gold</span></div>
       <div className="small">Auch der Host zahlt beim Erstellen denselben Einsatz.</div>
      </>}
      {gameType==='sponsor'&&<>
       <label>Sponsor / Kampagnenname</label>
       <input className="input" value={sponsorName} onChange={e=>setSponsorName(e.target.value)} placeholder="z. B. BoBs Burger"/>
       <label>Gestifteter Schatzpool</label>
       <div className="goldInputRow"><input className="input" type="number" min="1" step="1" value={sponsorGold} onChange={e=>setSponsorGold(e.target.value)}/><span>mg Gold</span></div>
       <div className="small">Wird einmalig aus deinem Gold-Wallet finanziert. Für Teilnehmer ist das Spiel kostenlos.</div>
      </>}

      <label>Schatzteile</label>
      <select className="input" value={treasureCount} onChange={e=>setTreasureCount(Number(e.target.value))}>
       {Array.from({length:Math.max(1,Number(settings?.max_treasures||10))},(_,i)=>i+1).map(n=><option value={n} key={n}>{n===1?'1 ganzer Schatz':`${n} Teile · je ca. ${(1/n).toFixed(3)}`}</option>)}
      </select>
      <div className="small">Gesamtwert immer 1,000 Schatz. Bei mehreren Teilen gewinnt am Ende, wer den größten Anteil gefunden hat.</div>
      <label>🎁 Gimmicks auf der Karte</label>
      <div className="rangeRow">
       <input type="range"
        min={settings?.min_gimmick_percent??0}
        max={settings?.max_gimmick_percent??5}
        step="0.01"
        value={gimmickPercent}
        onChange={e=>setGimmickPercent(Number(e.target.value))}/>
       <strong>{Number(gimmickPercent).toFixed(2)}%</strong>
      </div>
      <div className="small">Anteil der Felder mit Überraschungseffekt. Grenzen kommen aus der Schaltzentrale.</div>

      <label className="toggleRow">
       <input type="checkbox" checked={privateGame} onChange={e=>setPrivateGame(e.target.checked)}/>
       <span><strong>Privates Spiel</strong><small>Nicht öffentlich sichtbar.</small></span>
      </label>
      {privateGame&&<>
       <label>Spielpasswort <span className="muted">(optional)</span></label>
       <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)}/>
      </>}
     </div>

     <div>
      <label>Ungefähre Anzahl Felder</label>
      <input className="input" type="number" min={settings?.min_game_fields||100} max={settings?.max_game_fields||50000000} value={fields} onChange={e=>setFields(e.target.value)}/>
      <div className="quickButtons">{[10000,100000,1000000,10000000,50000000].map(n=><button type="button" className="miniBtn" key={n} onClick={()=>setFields(n)}>{n.toLocaleString('de-DE')}</button>)}</div>
      <label>Reale Feldkante</label>
      <select className="input" value={cellSize} onChange={e=>setCellSize(e.target.value)}>
       <option value="10">10 m × 10 m</option><option value="25">25 m × 25 m</option><option value="50">50 m × 50 m</option>
       <option value="100">100 m × 100 m</option><option value="250">250 m × 250 m</option><option value="500">500 m × 500 m</option>
      </select>
      <label>Zugregeneration</label>
      <select className="input" value={regen} onChange={e=>setRegen(e.target.value)}>
       {regenOptions.map(n=><option value={n} key={n}>{regenLabel(n)}</option>)}
      </select>
      <div className="small">Erlaubt durch die Schaltzentrale: {settings?.min_regen_seconds||5}s bis {settings?.max_regen_seconds||3600}s.</div>
      <label>Maximal speicherbare Züge</label>
      <select className="input" value={capacity} onChange={e=>setCapacity(e.target.value)}>{[3,4,5,6,8,10].map(n=><option value={n} key={n}>{n}</option>)}</select>
      <label>Gemeinsamer Spielstart</label>
      <select className="input" value={startDelay} onChange={e=>setStartDelay(Number(e.target.value))}>
       <option value="0">Sofort starten</option>
       <option value="1">In 1 Minute</option>
       <option value="3">In 3 Minuten</option>
       <option value="5">In 5 Minuten</option>
       <option value="10">In 10 Minuten</option>
       <option value="15">In 15 Minuten</option>
       <option value="30">In 30 Minuten</option>
       <option value="60">In 60 Minuten</option>
       <option value="-1">📅 Bestimmtes Datum / Uhrzeit…</option>
      </select>
      {Number(startDelay)===-1&&<>
       <label>Startdatum und Uhrzeit</label>
       <input className="input" type="datetime-local" value={customStartAt}
        onChange={e=>setCustomStartAt(e.target.value)}/>
      </>}
      <div className="small">Auch Spiele in Tagen oder Wochen können vorab erstellt werden. Alle können vorher beitreten; Suche und Maschinen werden erst zum Termin freigegeben.</div>
     </div>
    </div>
    <button className="btn primary wideOnMobile" onClick={createGame}>{gameType==='pay'?'Goldsuche erstellen & Einsatz zahlen':gameType==='sponsor'?'Sponsorspiel erstellen & Pool stiften':'Spiel erstellen'}</button>
    </div>
   </details>

   <details className="panel privateJoinPanel" open={privateJoinOpen} onToggle={e=>setPrivateJoinOpen(e.currentTarget.open)}>
    <summary><span>🔒 Privatem Spiel beitreten</span><span className="small">{privateJoinOpen?'Schließen':'Code eingeben'}</span></summary>
    {privateJoinOpen&&<div className="privateJoinBody">
     <label>Einladungscode</label><input className="input codeInput" autoComplete="off" value={inviteCode} onChange={e=>setInviteCode(e.target.value.toUpperCase())} maxLength={8}/>
     <label>Passwort <span className="muted">(falls gesetzt)</span></label><input className="input" type="password" autoComplete="new-password" value={joinPassword} onChange={e=>setJoinPassword(e.target.value)}/>
     <button className="btn primary wideOnMobile" onClick={joinPrivate}>Beitreten</button>
    </div>}
   </details>
  </div>

  {msg&&<div className="noticeBar">{msg}</div>}

  <section className="panel activeGamesPanel">
   <div className="sectionTitleRow"><h2>Laufende öffentliche Spiele</h2><span className="gameCountBadge">{activeGames.length}</span></div>
   <div className="lobbyFilterBar">
    <div className="lobbyFilterChips">
     {[
      ['all','Alle'],['gold','✨ Gold'],['sponsor','🤝 Sponsor'],
      ['standard','Standard'],['fast','⚡ Schnell'],['slow','🐢 Langsam']
     ].map(([value,label])=><button type="button" key={value}
       className={'filterChip '+(gameFilter===value?'active':'')}
       onClick={()=>setGameFilter(value)}>{label}</button>)}
    </div>
    <div className="lobbySortControls">
     <select className="input" value={sortMode} onChange={e=>setSortMode(e.target.value)}>
      <option value="players">Spieler</option>
      <option value="progress">Fortschritt</option>
      <option value="speed">Spieltempo</option>
      <option value="size">Kartengröße</option>
      <option value="created">Neueste</option>
     </select>
     <button type="button" className="miniBtn sortDirectionBtn"
      onClick={()=>setSortDir(d=>d==='asc'?'desc':'asc')}>{sortDir==='asc'?'↑':'↓'}</button>
    </div>
   </div>
   <div className="grid gameCards">
    {visibleActiveGames.length===0&&<div className="muted">Für diesen Filter sind momentan keine Spiele verfügbar.</div>}
    {visibleActiveGames.map(g=>{
      const count=Number(g.player_count||0)
      const isPay=g.game_type==='pay'
      const isSponsor=g.game_type==='sponsor'
      return <div className={'card '+(isPay?'payGameCard':isSponsor?'sponsorGameCard':'')} key={g.id}>
       <div className="gameCardTop"><h3>{g.name}</h3><span className={'gameBadge '+(isPay?'gold':isSponsor?'sponsor':'')}>{isPay?'✨ GOLDGAME':isSponsor?'🤝 SPONSORSPIEL':'🧭 SCHATZSUCHE'}</span></div>
       <div className="small">{g.center_label||'Weltkarte'} · {(g.width*g.height).toLocaleString('de-DE')} Felder</div>
       <div className="small">{g.cell_size_m||100} m/Feld · Zug alle {g.regen_seconds||30}s · 🧩 {g.treasure_count||1} Schatzteil{Number(g.treasure_count||1)===1?'':'e'}</div>
       {g.start_at&&new Date(g.start_at)>new Date()&&<div className="small tournamentCardStart">🏁 Start: {new Date(g.start_at).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>}
       {isPay&&<div className="payFacts">
        <span>Einsatz: <b>{formatGold(g.entry_gold_ug)}</b></span><span>Schätze: <b>{g.treasure_count}</b></span><span>Aktueller Pool: <b>{formatGold(g.gold_prize_pool_ug)}</b></span>
       </div>}
       {isSponsor&&<div className="payFacts sponsorFacts">
        <span>Sponsor: <b>{g.sponsor_name||'Sponsor'}</b></span><span>Teilnahme: <b>kostenlos</b></span><span>Pool: <b>{formatGold(g.gold_prize_pool_ug)}</b></span>
       </div>}
       <div className="capacityLine"><span>👥 {count} / {g.max_players}</span><span>🟢 aktiv</span></div>
       <div className="gameProgressLine">
        <div><span style={{width:`${Math.round(gameProgress(g)*100)}%`}}/></div>
        <small>{(gameProgress(g)*100).toFixed(1)} % erkundet</small>
       </div>
       <button className={'btn '+(isPay?'goldBtn':'primary')+' wideOnMobile'} disabled={count>=g.max_players} onClick={()=>joinPublic(g)}>
        {count>=g.max_players?'Voll':isPay?`Beitreten · ${formatGold(g.entry_gold_ug)}`:isSponsor?'Kostenlos teilnehmen':'Beitreten'}
       </button>
      </div>
    })}
   </div>
  </section>

  <details className="panel closedGamesPanel lobbyArchiveDetails">
   <summary><span><b>🗂️ Geschlossene Spiele</b><small>{closedGames.length} Einträge</small></span><span>⌄</span></summary>
   <div className="lobbyArchiveBody">
   <p className="small">Die Live-Einträge werden nach {Math.round(retentionHours/24)} Tagen bereinigt. Endkarte und Endstand bleiben dauerhaft in der Hall of Fame erhalten.</p>
   <div className="grid gameCards">
    {closedGames.length===0&&<div className="muted">Keine kürzlich geschlossenen Spiele.</div>}
    {closedGames.map(g=><div className="card closedGameCard" key={g.id}>
      <div className="gameCardTop"><h3>{g.name}</h3><span className="gameBadge">🔒 GESCHLOSSEN</span></div>
      <div className="small">{g.close_reason==='inactive'?`${inactivityHours} Stunden ohne Zug`:g.status==='finished'?'Regulär beendet':'Beendet'}</div>
      <div className="small">{g.closed_at?new Date(g.closed_at).toLocaleString('de-DE'):'–'}</div>
      {(g.game_type==='pay'||g.game_type==='sponsor')&&<div className="small">Gold-/Sponsor-Spiel beendet.</div>}
      <a className="btn closedResultBtn" href={'/archiv/'+g.id}>🏁 Endstand</a>
    </div>)}
   </div>
   </div>
  </details>
 </main>
  {gimmickWarn&&<div className="gimmickOverlay" role="dialog" aria-modal="true">
   <div className="gimmickModal">
    <div className="gimmickIcon">⚠️</div>
    <h2>Viele Gimmicks</h2>
    <p>Bei großen Karten können mehr als 0,10 % Gimmicks sehr häufige Popups und Boni erzeugen und dadurch den Spielfluss beeinträchtigen.</p>
    <div className="winnerActions">
     <button className="btn" onClick={()=>setGimmickWarn(false)}>Zurück</button>
     <button className="btn primary" onClick={()=>{setGimmickWarn(false);createGame(true)}}>Trotzdem erstellen</button>
    </div>
   </div>
  </div>}
 </>
}
