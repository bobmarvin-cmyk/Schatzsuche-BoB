'use client'
import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase-browser'
import {formatGold,goldToUg} from '../../lib/gold'
import FirstLoginHelp from '../../components/FirstLoginHelp'

export default function Lobby(){
 const [games,setGames]=useState([]),[isAdmin,setIsAdmin]=useState(false)
 const [wallet,setWallet]=useState(null),[settings,setSettings]=useState(null)
 const [name,setName]=useState('Mein Spiel'),[msg,setMsg]=useState('')
 const [mode,setMode]=useState('random')
 const [lat,setLat]=useState('49.52'),[lon,setLon]=useState('7.14'),[label,setLabel]=useState('Zuhause')
 const [fields,setFields]=useState(100000),[cellSize,setCellSize]=useState(100)
 const [regen,setRegen]=useState(30),[capacity,setCapacity]=useState(4),[maxPlayers,setMaxPlayers]=useState(20)
 const [privateGame,setPrivateGame]=useState(false),[password,setPassword]=useState('')
 const [inviteCode,setInviteCode]=useState(''),[joinPassword,setJoinPassword]=useState('')
 const [gameType,setGameType]=useState('standard'),[entryGold,setEntryGold]=useState('0.01'),[treasureMode,setTreasureMode]=useState('auto')

 useEffect(()=>{
   init()
   const channel=supabase.channel('games-live')
    .on('postgres_changes',{event:'*',schema:'public',table:'games'},()=>loadGames()).subscribe()
   return()=>supabase.removeChannel(channel)
 },[])

 async function init(){
   const {data:{user}}=await supabase.auth.getUser()
   if(!user){location.href='/login';return}
   await supabase.rpc('run_game_maintenance_v66')
   const {data:adminFlag}=await supabase.rpc('is_admin_v67')
   setIsAdmin(!!adminFlag)
   await Promise.all([loadGames(),loadWallet(),loadSettings()])
 }

 async function loadWallet(){
   const {data:{user}}=await supabase.auth.getUser()
   if(!user)return
   const {data}=await supabase.from('gold_wallets').select('balance_ug,test_grant_claimed').eq('user_id',user.id).maybeSingle()
   setWallet(data)
 }
 async function loadSettings(){
   const {data}=await supabase.from('platform_settings').select('prize_share_bps,community_share_bps,platform_share_bps,multi_treasure_threshold_ug,max_treasures,test_grant_ug,game_inactivity_hours,closed_game_retention_hours,inactive_community_share_bps,inactive_platform_share_bps,min_game_fields,max_game_fields,max_game_players,min_cell_size_m,max_cell_size_m,min_regen_seconds,max_regen_seconds,max_stored_moves_limit,min_entry_gold_ug,max_entry_gold_ug,exploration_reward').eq('id',1).maybeSingle()
   setSettings(data)
 }
 async function loadGames(){
   const {data,error}=await supabase.from('games')
    .select('id,name,status,max_players,created_at,closed_at,close_reason,last_activity_at,width,height,center_label,cell_size_m,regen_seconds,max_stored_moves,is_private,game_type,entry_gold_ug,treasure_count,gold_prize_pool_ug,game_players(count)')
    .eq('is_private',false).order('created_at',{ascending:false})
   if(error){setMsg(error.message);return}
   setGames(data||[])
 }

 async function claimTestGold(){
   const {data,error}=await supabase.rpc('claim_test_gold_v65')
   if(error){setMsg(error.message);return}
   setMsg(data?.message||'Test-Goldstaub gutgeschrieben.')
   await loadWallet()
 }

 async function createGame(){
   setMsg('Spiel wird erstellt…')
   if(privateGame && password.trim().length>0 && password.trim().length<4){
     setMsg('Das Passwort muss mindestens 4 Zeichen haben.');return
   }
   const entryUg=gameType==='pay'?goldToUg(entryGold):0
   if(gameType==='pay' && entryUg<=0){setMsg('Bitte einen Goldstaub-Einsatz größer 0 wählen.');return}

   const {data,error}=await supabase.rpc('create_game_v67',{
    p_name:name,
    p_field_count:Number(fields),
    p_cell_size_m:Number(cellSize),
    p_max_players:Number(maxPlayers),
    p_location_mode:mode,
    p_center_lat:mode==='coords'?Number(lat):null,
    p_center_lon:mode==='coords'?Number(lon):null,
    p_center_label:mode==='coords'?(label||'Kartenmittelpunkt'):null,
    p_regen_seconds:Number(regen),
    p_max_stored_moves:Number(capacity),
    p_is_private:privateGame,
    p_password:privateGame && password.trim()?password:null,
    p_game_type:gameType,
    p_entry_gold_ug:entryUg,
    p_treasure_mode:gameType==='pay'?treasureMode:'1'
   })
   if(error){setMsg(error.message);return}
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
 const inactivityHours=settings?.game_inactivity_hours||24
 const retentionHours=settings?.closed_game_retention_hours||72

 return <>
  <FirstLoginHelp/>
  <main className="container lobbyPage">
  <div className="topnav">
   <a className="btn" href="/profile">Profil</a>
   <a className="btn" href="/legenden">🏆 Legenden</a>
   {isAdmin&&<a className="btn adminNavBtn" href="/admin">🎛️ Schaltzentrale</a>}
   <button className="btn" onClick={logout}>Abmelden</button>
  </div>

  <div className="panel heroPanel">
   <div className="heroSplit">
    <div><h1>Lobby</h1><p className="muted">Standardspiele sind kostenlos. Paygames laufen ausschließlich mit <strong>Test-Goldstaub ohne Echtgeldwert</strong>.</p><p className="small">Spiele ohne Zug werden nach {inactivityHours} Stunden automatisch geschlossen. Geschlossene Spiele werden nach {Math.round(retentionHours/24)} Tagen gelöscht.</p></div>
    <div className="goldWalletCard">
     <div className="small">Test-Goldstaub</div>
     <div className="goldBalance">✨ {formatGold(wallet?.balance_ug||0)}</div>
     {!wallet?.test_grant_claimed&&<button className="btn goldBtn" onClick={claimTestGold}>0,25 g Test-Gold holen</button>}
    </div>
   </div>
  </div>

  <div className="lobbyColumns">
   <section className="panel">
    <h2>Neues Spiel</h2>
    <div className="gameTypeSwitch">
     <button type="button" className={'typeBtn '+(gameType==='standard'?'active':'')} onClick={()=>setGameType('standard')}>🆓 Standard</button>
     <button type="button" className={'typeBtn gold '+(gameType==='pay'?'active':'')} onClick={()=>setGameType('pay')}>✨ Paygame (Test)</button>
    </div>

    {gameType==='pay'&&<div className="goldRulesBox">
     <strong>Test-Goldstaub-Verteilung</strong>
     <div>{prizePct}% Schatzpool · {communityPct}% Community-Ausschüttung · {platformPct}% Plattformanteil</div>
     <div className="small">Diese Quoten kann nur die Spielleitung serverseitig ändern.</div>
    </div>}

    <div className="createGrid">
     <div>
      <label>Spielname</label><input className="input" value={name} onChange={e=>setName(e.target.value)}/>
      <label>Kartenquelle</label>
      <select className="input" value={mode} onChange={e=>setMode(e.target.value)}>
       <option value="random">🌍 Zufälliger echter Ort</option><option value="coords">📍 Eigene Koordinaten</option>
      </select>
      {mode==='coords'&&<>
       <label>Breitengrad</label><input className="input" type="number" step="0.000001" value={lat} onChange={e=>setLat(e.target.value)}/>
       <label>Längengrad</label><input className="input" type="number" step="0.000001" value={lon} onChange={e=>setLon(e.target.value)}/>
       <label>Ortsname für Hinweise</label><input className="input" value={label} onChange={e=>setLabel(e.target.value)}/>
      </>}
      <label>Maximale Spielerzahl</label><input className="input" type="number" min="2" max={settings?.max_game_players||100} value={maxPlayers} onChange={e=>setMaxPlayers(e.target.value)}/>

      {gameType==='pay'&&<>
       <label>Schürfrechte / Teilnahme pro Spieler</label>
       <div className="goldInputRow"><input className="input" type="number" min="0.001" step="0.001" value={entryGold} onChange={e=>setEntryGold(e.target.value)}/><span>g Test-Gold</span></div>
       <label>Goldschätze</label>
       <select className="input" value={treasureMode} onChange={e=>setTreasureMode(e.target.value)}>
        <option value="auto">Automatisch nach Serverregel</option><option value="1">1 Schatz</option><option value="3">3 Schätze</option><option value="5">5 Schätze</option>
       </select>
       <div className="small">Auch der Host zahlt beim Erstellen denselben Einsatz.</div>
      </>}

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
       <option value="5">1 Zug / 5 Sekunden</option><option value="10">1 Zug / 10 Sekunden</option><option value="30">1 Zug / 30 Sekunden</option>
       <option value="60">1 Zug / Minute</option><option value="300">1 Zug / 5 Minuten</option><option value="3600">1 Zug / Stunde</option>
      </select>
      <label>Maximal speicherbare Züge</label>
      <select className="input" value={capacity} onChange={e=>setCapacity(e.target.value)}>{[3,4,5,6,8,10].map(n=><option value={n} key={n}>{n}</option>)}</select>
     </div>
    </div>
    <button className="btn primary wideOnMobile" onClick={createGame}>{gameType==='pay'?'Paygame erstellen & Einsatz zahlen':'Spiel erstellen'}</button>
   </section>

   <section className="panel privateJoinPanel">
    <h2>Privatem Spiel beitreten</h2>
    <label>Einladungscode</label><input className="input codeInput" value={inviteCode} onChange={e=>setInviteCode(e.target.value.toUpperCase())} maxLength={8}/>
    <label>Passwort <span className="muted">(falls gesetzt)</span></label><input className="input" type="password" value={joinPassword} onChange={e=>setJoinPassword(e.target.value)}/>
    <button className="btn primary wideOnMobile" onClick={joinPrivate}>Beitreten</button>
   </section>
  </div>

  {msg&&<div className="noticeBar">{msg}</div>}

  <section className="panel">
   <h2>Laufende öffentliche Spiele</h2>
   <div className="grid gameCards">
    {activeGames.length===0&&<div className="muted">Momentan sind keine öffentlichen Spiele aktiv.</div>}
    {activeGames.map(g=>{
      const count=g.game_players?.[0]?.count||0
      const isPay=g.game_type==='pay'
      return <div className={'card '+(isPay?'payGameCard':'')} key={g.id}>
       <div className="gameCardTop"><h3>{g.name}</h3><span className={'gameBadge '+(isPay?'gold':'')}>{isPay?'✨ PAY TEST':'🆓 GRATIS'}</span></div>
       <div className="small">{g.center_label||'Weltkarte'} · {(g.width*g.height).toLocaleString('de-DE')} Felder</div>
       <div className="small">{g.cell_size_m||100} m/Feld · Zug alle {g.regen_seconds||30}s</div>
       {isPay&&<div className="payFacts">
        <span>Einsatz: <b>{formatGold(g.entry_gold_ug)}</b></span><span>Schätze: <b>{g.treasure_count}</b></span><span>Aktueller Pool: <b>{formatGold(g.gold_prize_pool_ug)}</b></span>
       </div>}
       <div className="capacityLine"><span>👥 {count} / {g.max_players}</span><span>🟢 aktiv</span></div>
       <button className={'btn '+(isPay?'goldBtn':'primary')+' wideOnMobile'} disabled={count>=g.max_players} onClick={()=>joinPublic(g)}>
        {count>=g.max_players?'Voll':isPay?`Beitreten · ${formatGold(g.entry_gold_ug)}`:'Beitreten'}
       </button>
      </div>
    })}
   </div>
  </section>

  <section className="panel closedGamesPanel">
   <h2>Geschlossene Spiele</h2>
   <p className="small">Diese Einträge werden automatisch nach {Math.round(retentionHours/24)} Tagen gelöscht.</p>
   <div className="grid gameCards">
    {closedGames.length===0&&<div className="muted">Keine kürzlich geschlossenen Spiele.</div>}
    {closedGames.map(g=><div className="card closedGameCard" key={g.id}>
      <div className="gameCardTop"><h3>{g.name}</h3><span className="gameBadge">🔒 GESCHLOSSEN</span></div>
      <div className="small">{g.close_reason==='inactive'?`${inactivityHours} Stunden ohne Zug`:g.status==='finished'?'Regulär beendet':'Beendet'}</div>
      <div className="small">{g.closed_at?new Date(g.closed_at).toLocaleString('de-DE'):'–'}</div>
      {g.game_type==='pay'&&<div className="small">Rest-Schatzpool wurde nach Serverregel verteilt.</div>}
    </div>)}
   </div>
  </section>
 </main>
 </>
}
