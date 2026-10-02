'use client'
import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase-browser'

export default function Lobby(){
 const [games,setGames]=useState([])
 const [name,setName]=useState('Mein Spiel'),[msg,setMsg]=useState('')
 const [mode,setMode]=useState('random')
 const [lat,setLat]=useState('49.52'),[lon,setLon]=useState('7.14'),[label,setLabel]=useState('Zuhause')
 const [fields,setFields]=useState(100000),[cellSize,setCellSize]=useState(100)
 const [regen,setRegen]=useState(30),[capacity,setCapacity]=useState(4),[maxPlayers,setMaxPlayers]=useState(20)
 const [privateGame,setPrivateGame]=useState(false),[password,setPassword]=useState('')
 const [inviteCode,setInviteCode]=useState(''),[joinPassword,setJoinPassword]=useState('')

 useEffect(()=>{
   init()
   const channel=supabase.channel('games-live')
    .on('postgres_changes',{event:'*',schema:'public',table:'games'},()=>loadGames()).subscribe()
   return()=>supabase.removeChannel(channel)
 },[])

 async function init(){
   const {data:{user}}=await supabase.auth.getUser()
   if(!user){location.href='/login';return}
   loadGames()
 }

 async function loadGames(){
   const {data,error}=await supabase.from('games')
    .select('id,name,status,max_players,created_at,width,height,center_label,cell_size_m,regen_seconds,max_stored_moves,is_private,game_players(count)')
    .eq('is_private',false)
    .order('created_at',{ascending:false})
   if(error){setMsg(error.message);return}
   setGames(data||[])
 }

 async function createGame(){
   setMsg('Spiel wird erstellt…')
   if(privateGame && password.trim().length>0 && password.trim().length<4){
     setMsg('Das Passwort muss mindestens 4 Zeichen haben.');return
   }

   const {data,error}=await supabase.rpc('create_game_v64',{
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
    p_password:privateGame && password.trim()?password:null
   })
   if(error){setMsg(error.message);return}
   location.href='/game/'+data
 }

 async function joinPublic(id){
   const {error}=await supabase.rpc('join_game_v64',{p_game_id:id,p_password:null})
   if(error){setMsg(error.message);return}
   location.href='/game/'+id
 }

 async function joinPrivate(){
   setMsg('Privates Spiel wird gesucht…')
   const code=inviteCode.trim().toUpperCase()
   if(!code){setMsg('Bitte Einladungscode eingeben.');return}
   const {data,error}=await supabase.rpc('join_game_by_code_v64',{
     p_invite_code:code,
     p_password:joinPassword||null
   })
   if(error){setMsg(error.message);return}
   if(joinPassword)sessionStorage.setItem('game_password_'+data,joinPassword)
   location.href='/game/'+data
 }

 async function logout(){await supabase.auth.signOut();location.href='/'}

 return <main className="container lobbyPage">
  <div className="topnav">
   <a className="btn" href="/profile">Profil</a>
   <button className="btn" onClick={logout}>Abmelden</button>
  </div>

  <div className="panel heroPanel">
   <h1>Lobby</h1>
   <p className="muted">Öffentliche Spiele sind für alle sichtbar. Private Spiele funktionieren über Einladungscode und optionales Passwort.</p>
  </div>

  <div className="lobbyColumns">
   <section className="panel">
    <h2>Neues Spiel</h2>
    <div className="createGrid">
     <div>
      <label>Spielname</label>
      <input className="input" value={name} onChange={e=>setName(e.target.value)}/>

      <label>Kartenquelle</label>
      <select className="input" value={mode} onChange={e=>setMode(e.target.value)}>
       <option value="random">🌍 Zufälliger echter Ort</option>
       <option value="coords">📍 Eigene Koordinaten</option>
      </select>

      {mode==='coords'&&<>
       <label>Breitengrad</label>
       <input className="input" type="number" step="0.000001" value={lat} onChange={e=>setLat(e.target.value)}/>
       <label>Längengrad</label>
       <input className="input" type="number" step="0.000001" value={lon} onChange={e=>setLon(e.target.value)}/>
       <label>Ortsname für Hinweise</label>
       <input className="input" value={label} onChange={e=>setLabel(e.target.value)} placeholder="z. B. Zuhause"/>
      </>}

      <label>Maximale Spielerzahl</label>
      <input className="input" type="number" min="2" max="100" value={maxPlayers} onChange={e=>setMaxPlayers(e.target.value)}/>

      <label className="toggleRow">
       <input type="checkbox" checked={privateGame} onChange={e=>setPrivateGame(e.target.checked)}/>
       <span><strong>Privates Spiel</strong><small>Nicht in der öffentlichen Lobby sichtbar.</small></span>
      </label>

      {privateGame&&<>
       <label>Spielpasswort <span className="muted">(optional)</span></label>
       <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)}
        placeholder="Leer lassen = nur Einladungscode"/>
      </>}
     </div>

     <div>
      <label>Ungefähre Anzahl Felder</label>
      <input className="input" type="number" min="100" max="50000000" value={fields} onChange={e=>setFields(e.target.value)}/>
      <div className="quickButtons">
       {[10000,100000,1000000,10000000,50000000].map(n=><button type="button" className="miniBtn" key={n} onClick={()=>setFields(n)}>{n.toLocaleString('de-DE')}</button>)}
      </div>

      <label>Reale Feldkante</label>
      <select className="input" value={cellSize} onChange={e=>setCellSize(e.target.value)}>
       <option value="10">10 m × 10 m</option><option value="25">25 m × 25 m</option>
       <option value="50">50 m × 50 m</option><option value="100">100 m × 100 m</option>
       <option value="250">250 m × 250 m</option><option value="500">500 m × 500 m</option>
      </select>

      <label>Zugregeneration</label>
      <select className="input" value={regen} onChange={e=>setRegen(e.target.value)}>
       <option value="5">1 Zug / 5 Sekunden</option><option value="10">1 Zug / 10 Sekunden</option>
       <option value="30">1 Zug / 30 Sekunden</option><option value="60">1 Zug / Minute</option>
       <option value="300">1 Zug / 5 Minuten</option><option value="3600">1 Zug / Stunde</option>
      </select>

      <label>Maximal speicherbare Züge</label>
      <select className="input" value={capacity} onChange={e=>setCapacity(e.target.value)}>
       {[3,4,5,6,8,10].map(n=><option value={n} key={n}>{n}</option>)}
      </select>
     </div>
    </div>
    <button className="btn primary wideOnMobile" onClick={createGame}>Spiel erstellen</button>
   </section>

   <section className="panel privateJoinPanel">
    <h2>Privatem Spiel beitreten</h2>
    <p className="small">Den Einladungscode erhältst du vom Host.</p>
    <label>Einladungscode</label>
    <input className="input codeInput" value={inviteCode} onChange={e=>setInviteCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={8}/>
    <label>Passwort <span className="muted">(falls gesetzt)</span></label>
    <input className="input" type="password" value={joinPassword} onChange={e=>setJoinPassword(e.target.value)}/>
    <button className="btn primary wideOnMobile" onClick={joinPrivate}>Beitreten</button>
   </section>
  </div>

  {msg&&<div className="noticeBar">{msg}</div>}

  <section className="panel">
   <h2>Öffentliche Spiele</h2>
   <div className="grid gameCards">
    {games.length===0&&<div className="muted">Momentan sind keine öffentlichen Spiele verfügbar.</div>}
    {games.map(g=>{
      const count=g.game_players?.[0]?.count||0
      return <div className="card" key={g.id}>
       <h3>{g.name}</h3>
       <div className="small">{g.center_label||'Weltkarte'} · {(g.width*g.height).toLocaleString('de-DE')} Felder</div>
       <div className="small">{g.cell_size_m||100} m/Feld · Zug alle {g.regen_seconds||30}s</div>
       <div className="capacityLine"><span>👥 {count} / {g.max_players}</span><span>{g.status==='active'?'🟢 aktiv':'⚫ beendet'}</span></div>
       <button className="btn primary wideOnMobile" disabled={g.status!=='active'||count>=g.max_players} onClick={()=>joinPublic(g.id)}>
        {count>=g.max_players?'Voll':g.status==='active'?'Beitreten':'Beendet'}
       </button>
      </div>
    })}
   </div>
  </section>
 </main>
}
