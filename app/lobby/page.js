'use client'
import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase-browser'

export default function Lobby(){
 const [user,setUser]=useState(null),[games,setGames]=useState([])
 const [name,setName]=useState('Mein Spiel'),[msg,setMsg]=useState('')
 const [mode,setMode]=useState('random')
 const [lat,setLat]=useState('49.52'),[lon,setLon]=useState('7.14'),[label,setLabel]=useState('Zuhause')
 const [fields,setFields]=useState(100000)
 const [cellSize,setCellSize]=useState(100)
 const [regen,setRegen]=useState(30)
 const [capacity,setCapacity]=useState(4)
 const [maxPlayers,setMaxPlayers]=useState(20)

 useEffect(()=>{
   init()
   const channel=supabase.channel('games-live')
     .on('postgres_changes',{event:'*',schema:'public',table:'games'},()=>loadGames()).subscribe()
   return()=>supabase.removeChannel(channel)
 },[])

 async function init(){
   const {data:{user}}=await supabase.auth.getUser()
   if(!user){location.href='/login';return}
   setUser(user);loadGames()
 }
 async function loadGames(){
   const {data}=await supabase.from('games')
    .select('id,name,status,round_no,max_players,created_at,width,height,center_label,cell_size_m,regen_seconds,max_stored_moves')
    .order('created_at',{ascending:false})
   setGames(data||[])
 }
 async function createGame(){
   setMsg('Spiel wird erstellt…')
   const args={
    p_name:name,
    p_field_count:Number(fields),
    p_cell_size_m:Number(cellSize),
    p_max_players:Number(maxPlayers),
    p_location_mode:mode,
    p_center_lat:mode==='coords'?Number(lat):null,
    p_center_lon:mode==='coords'?Number(lon):null,
    p_center_label:mode==='coords'?(label||'Kartenmittelpunkt'):null,
    p_regen_seconds:Number(regen),
    p_max_stored_moves:Number(capacity)
   }
   const {data,error}=await supabase.rpc('create_game_v63',args)
   if(error)return setMsg(error.message)
   location.href='/game/'+data
 }
 async function join(id){
   const {error}=await supabase.rpc('join_game',{p_game_id:id})
   if(error)return setMsg(error.message)
   location.href='/game/'+id
 }
 async function logout(){await supabase.auth.signOut();location.href='/'}

 return <main className="container">
  <div className="topnav"><a className="btn" href="/profile">Profil</a><button className="btn" onClick={logout}>Abmelden</button></div>

  <div className="panel">
   <h1>Lobby</h1>
   <p className="muted">Laufenden Spielen kann jederzeit beigetreten werden. Neue Spieler starten ohne Technologien.</p>
  </div>

  <div className="panel">
   <h2>Neues Spiel</h2>
   <div className="createGrid">
    <div>
     <label>Spielname</label><input className="input" value={name} onChange={e=>setName(e.target.value)}/>
     <label>Kartenquelle</label>
     <select className="input" value={mode} onChange={e=>setMode(e.target.value)}>
      <option value="random">🌍 Zufälliger echter Ort</option>
      <option value="coords">📍 Eigene Koordinaten</option>
     </select>
     {mode==='coords'&&<>
      <label>Breitengrad</label><input className="input" type="number" step="0.000001" value={lat} onChange={e=>setLat(e.target.value)}/>
      <label>Längengrad</label><input className="input" type="number" step="0.000001" value={lon} onChange={e=>setLon(e.target.value)}/>
      <label>Ortsname für Hinweise</label><input className="input" value={label} onChange={e=>setLabel(e.target.value)} placeholder="z.B. Zuhause, Namborn"/>
     </>}
    </div>
    <div>
     <label>Ungefähre Anzahl Felder</label>
     <input className="input" type="number" min="100" max="50000000" value={fields} onChange={e=>setFields(e.target.value)}/>
     <div className="quickButtons">
      {[10000,100000,1000000,10000000,50000000].map(n=><button className="miniBtn" key={n} onClick={()=>setFields(n)}>{n.toLocaleString('de-DE')}</button>)}
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
     <label>Max. Spieler</label><input className="input" type="number" min="2" max="100" value={maxPlayers} onChange={e=>setMaxPlayers(e.target.value)}/>
    </div>
   </div>
   <button className="btn primary" onClick={createGame}>Spiel erstellen</button>
   <p>{msg}</p>
  </div>

  <div className="panel"><h2>Öffentliche Spiele</h2><div className="grid">
   {games.map(g=><div className="card" key={g.id}>
    <h3>{g.name}</h3>
    <div className="small">{g.center_label||'Weltkarte'} · {(g.width*g.height).toLocaleString('de-DE')} Felder</div>
    <div className="small">{g.cell_size_m||100} m/Feld · Zug alle {g.regen_seconds||30}s · Speicher {g.max_stored_moves||4}</div>
    <button className="btn primary" disabled={g.status!=='active'} onClick={()=>join(g.id)}>{g.status==='active'?'Beitreten':'Beendet'}</button>
   </div>)}
  </div></div>
 </main>
}
