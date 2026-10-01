'use client'
import {useEffect,useRef,useState} from 'react'
import {useParams} from 'next/navigation'
import {supabase} from '../../../lib/supabase-browser'
const CELL=10
export default function Game(){
 const {id}=useParams();const canvasRef=useRef(null);const [me,setMe]=useState(null),[game,setGame]=useState(null),[players,setPlayers]=useState([]),[fields,setFields]=useState([]),[msg,setMsg]=useState('')
 useEffect(()=>{init();const ch=supabase.channel('game-'+id)
 .on('postgres_changes',{event:'*',schema:'public',table:'explored_fields',filter:`game_id=eq.${id}`},()=>load())
 .on('postgres_changes',{event:'*',schema:'public',table:'game_players',filter:`game_id=eq.${id}`},()=>load())
 .subscribe();return()=>supabase.removeChannel(ch)},[id])
 async function init(){const {data:{user}}=await supabase.auth.getUser();if(!user)return location.href='/login';setMe(user);await supabase.rpc('join_game',{p_game_id:id});load()}
 async function load(){const [{data:g},{data:p},{data:f}]=await Promise.all([
   supabase.from('games').select('*').eq('id',id).single(),
   supabase.from('game_players').select('user_id,coins,moves_left,reveal_power,profiles(display_name)').eq('game_id',id),
   supabase.from('explored_fields').select('x,y,discovered_by,is_treasure').eq('game_id',id)
 ]);setGame(g);setPlayers(p||[]);setFields(f||[])}
 useEffect(()=>{draw()},[game,fields])
 function draw(){if(!game||!canvasRef.current)return;const c=canvasRef.current,ctx=c.getContext('2d');c.width=game.width*CELL;c.height=game.height*CELL;ctx.fillStyle='#09111d';ctx.fillRect(0,0,c.width,c.height);for(const f of fields){ctx.fillStyle=f.is_treasure?'#efb94f':'#35516d';ctx.fillRect(f.x*CELL,f.y*CELL,CELL,CELL)}ctx.strokeStyle='#1d2a40';ctx.lineWidth=.6;for(let i=0;i<=game.width;i++){ctx.beginPath();ctx.moveTo(i*CELL,0);ctx.lineTo(i*CELL,c.height);ctx.stroke()}for(let i=0;i<=game.height;i++){ctx.beginPath();ctx.moveTo(0,i*CELL);ctx.lineTo(c.width,i*CELL);ctx.stroke()}}
 async function click(e){if(!game)return;const r=e.currentTarget.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)*(e.currentTarget.width/r.width)/CELL),y=Math.floor((e.clientY-r.top)*(e.currentTarget.height/r.height)/CELL);const {data,error}=await supabase.rpc('reveal_field',{p_game_id:id,p_x:x,p_y:y});if(error)setMsg(error.message);else setMsg(data?.message||'Feld untersucht');load()}
 const gp=players.find(p=>p.user_id===me?.id);const remaining=game?game.width*game.height-fields.length:0
 return <main className="container"><div className="topnav"><a className="btn" href="/lobby">← Lobby</a></div>
 <div className="panel"><h1>{game?.name||'Spiel'}</h1><div className="grid">
 <div className="card"><div className="small">Runde</div><div className="stat">{game?.round_no||'-'}</div></div>
 <div className="card"><div className="small">Taler</div><div className="stat">{Number(gp?.coins||0).toFixed(2)}</div></div>
 <div className="card"><div className="small">Züge</div><div className="stat">{gp?.moves_left??0}</div></div>
 <div className="card"><div className="small">Felder übrig</div><div className="stat">{remaining}</div></div></div></div>
 <div className="panel"><div className="mapwrap"><canvas ref={canvasRef} onClick={click}/></div><p>{msg}</p></div>
 <div className="panel"><h2>Spieler</h2><div className="grid">{players.map(p=><div className="card" key={p.user_id}><strong>{p.profiles?.display_name||'Spieler'}</strong><div className="small">{Number(p.coins).toFixed(2)} T · {p.moves_left} Züge</div></div>)}</div></div>
 </main>}
