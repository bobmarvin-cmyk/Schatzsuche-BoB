'use client'
import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase-browser'
export default function Lobby(){
 const [user,setUser]=useState(null),[games,setGames]=useState([]),[name,setName]=useState('Mein Spiel'),[msg,setMsg]=useState('')
 useEffect(()=>{init(); const channel=supabase.channel('games-live').on('postgres_changes',{event:'*',schema:'public',table:'games'},()=>loadGames()).subscribe();return()=>supabase.removeChannel(channel)},[])
 async function init(){const {data:{user}}=await supabase.auth.getUser();if(!user){location.href='/login';return}setUser(user);loadGames()}
 async function loadGames(){const {data}=await supabase.from('games').select('id,name,status,round_no,max_players,created_at').order('created_at',{ascending:false});setGames(data||[])}
 async function createGame(){const {data:{user}}=await supabase.auth.getUser();if(!user)return
   const {data,error}=await supabase.rpc('create_game',{p_name:name,p_width:100,p_height:100,p_max_players:20})
   if(error)return setMsg(error.message);location.href='/game/'+data
 }
 async function join(id){const {error}=await supabase.rpc('join_game',{p_game_id:id});if(error)return setMsg(error.message);location.href='/game/'+id}
 async function logout(){await supabase.auth.signOut();location.href='/'}
 return <main className="container">
 <div className="topnav"><a className="btn" href="/profile">Profil</a><button className="btn" onClick={logout}>Abmelden</button></div>
 <div className="panel"><h1>Lobby</h1><div className="grid"><div className="card"><h3>Neues Spiel</h3><input className="input" value={name} onChange={e=>setName(e.target.value)}/><button className="btn primary" onClick={createGame}>Spiel erstellen</button><p>{msg}</p></div></div></div>
 <div className="panel"><h2>Spiele</h2><div className="grid">{games.map(g=><div className="card" key={g.id}><h3>{g.name}</h3><div className="small">Runde {g.round_no} · {g.status}</div><button className="btn primary" onClick={()=>join(g.id)}>Beitreten</button></div>)}</div></div>
 </main>}
