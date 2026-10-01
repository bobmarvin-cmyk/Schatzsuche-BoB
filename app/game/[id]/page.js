'use client'
import {useEffect,useRef,useState} from 'react'
import {useParams} from 'next/navigation'
import {supabase} from '../../../lib/supabase-browser'

const CELL=10
const TECHS=[
 ['root','Grundlagen',0.05,'Basis','+1 Feld/Zug',[]],
 ['e1','Fernglas I',0.15,'Erkundung','+2 Felder/Zug',['root']],
 ['e2','Fernglas II',0.45,'Erkundung','+5 Felder/Zug',['e1']],
 ['e3','Suchtrupp',0.60,'Erkundung','+8 Felder/Zug',['e1']],
 ['e4','Geländefahrzeuge',1.80,'Erkundung','+20 Felder/Zug',['e2']],
 ['e5','Expeditionsteam',2.20,'Erkundung','+25 Felder/Zug',['e3']],
 ['e6','Drohnen',5.50,'Erkundung','+50 Felder/Zug',['e4']],
 ['e7','Präzisionssuche',5.50,'Erkundung','+35 Felder/Zug · +15% Bonus',['e5']],
 ['e8','Luftaufklärung',14.00,'Erkundung','+100 Felder/Zug',['e6']],
 ['e9','Rasteroptimierung',14.00,'Erkundung','+75 Felder/Zug · +25% Bonus',['e7']],
 ['e10','Satellitenbilder',35.00,'Erkundung','+250 Felder/Zug',['e8']],
 ['end1','Planetare Suche',260.00,'Erkundung','+1.000 Felder/Zug',['e10']],
 ['a1','Kartografie',0.40,'Analyse','Richtungshinweise',['root']],
 ['a2','Spurenanalyse',1.20,'Analyse','Grobe Distanz',['a1']],
 ['a3','Sektorscan',3.50,'Analyse','Sektor-Hinweis',['a2']],
 ['a4','Radar',8.00,'Analyse','Distanz ~10 Felder',['a3']],
 ['a5','Geodatenanalyse',20.00,'Analyse','Distanz ~5 Felder',['a4']],
 ['a6','KI-Auswertung',55.00,'Analyse','Sehr präzise Distanz',['a5']],
 ['l1','Logistik I',0.12,'Logistik','+1 Zug alle 3 Runden',['root']],
 ['l2','Basislager',0.45,'Logistik','+1 Zug alle 2 Runden',['l1']],
 ['l3','Versorgungsnetz',1.40,'Logistik','+1 Zug jede Runde',['l2']],
 ['l4','Automatisierte Teams',3.50,'Logistik','+2 Züge/Runde',['l3']],
 ['l5','Expeditionsautomatik',9.00,'Logistik','+3 Züge/Runde',['l4']],
 ['w1','Förderprogramm',5.00,'Wirtschaft','+50% Erkundungsbonus',['e7']],
 ['w2','Forschungsfonds',12.00,'Wirtschaft','+100% Erkundungsbonus',['a5']],
 ['h1','Drohnen + Radar',12.00,'Hybrid','+120 Felder/Zug + Analyse',['e8','a4']],
 ['h2','Satelliten-KI',55.00,'Hybrid','+350 Felder/Zug + KI-Analyse',['e10','a6']]
]
const BR=['Basis','Erkundung','Analyse','Logistik','Wirtschaft','Hybrid']

export default function Game(){
 const {id}=useParams()
 const canvas=useRef(null)
 const [user,setUser]=useState(null)
 const [game,setGame]=useState(null)
 const [players,setPlayers]=useState([])
 const [fields,setFields]=useState([])
 const [owned,setOwned]=useState([])
 const [branch,setBranch]=useState('Erkundung')
 const [msg,setMsg]=useState('')

 useEffect(()=>{
   init()
   const ch=supabase.channel('game-'+id)
    .on('postgres_changes',{event:'*',schema:'public',table:'explored_fields',filter:`game_id=eq.${id}`},load)
    .on('postgres_changes',{event:'*',schema:'public',table:'game_players',filter:`game_id=eq.${id}`},load)
    .on('postgres_changes',{event:'*',schema:'public',table:'games',filter:`id=eq.${id}`},load)
    .on('postgres_changes',{event:'*',schema:'public',table:'player_technologies',filter:`game_id=eq.${id}`},load)
    .subscribe()
   return()=>supabase.removeChannel(ch)
 },[id])

 async function init(){
   const {data:{user}}=await supabase.auth.getUser()
   if(!user){location.href='/login';return}
   setUser(user)
   await supabase.rpc('join_game',{p_game_id:id})
   await load()
 }

 async function load(){
   const {data:{user}}=await supabase.auth.getUser()
   const [g,p,f,t]=await Promise.all([
     supabase.from('games').select('*').eq('id',id).single(),
     supabase.from('game_players').select('user_id,coins,moves_left,reveal_power,reward_multiplier,analysis_level,profiles(display_name)').eq('game_id',id),
     supabase.from('explored_fields').select('x,y,discovered_by,is_treasure').eq('game_id',id),
     supabase.from('player_technologies').select('technology_id').eq('game_id',id).eq('user_id',user?.id||'00000000-0000-0000-0000-000000000000')
   ])
   setGame(g.data);setPlayers(p.data||[]);setFields(f.data||[]);setOwned((t.data||[]).map(x=>x.technology_id))
 }

 useEffect(()=>{draw()},[game,fields])

 function draw(){
   if(!game||!canvas.current)return
   const c=canvas.current,ctx=c.getContext('2d')
   c.width=game.width*CELL;c.height=game.height*CELL
   ctx.fillStyle='#09111d';ctx.fillRect(0,0,c.width,c.height)
   for(const f of fields){ctx.fillStyle=f.is_treasure?'#efb94f':'#35516d';ctx.fillRect(f.x*CELL,f.y*CELL,CELL,CELL)}
   ctx.strokeStyle='#1d2a40';ctx.lineWidth=.6
   for(let i=0;i<=game.width;i++){ctx.beginPath();ctx.moveTo(i*CELL,0);ctx.lineTo(i*CELL,c.height);ctx.stroke()}
   for(let i=0;i<=game.height;i++){ctx.beginPath();ctx.moveTo(0,i*CELL);ctx.lineTo(c.width,i*CELL);ctx.stroke()}
 }

 async function reveal(e){
   const r=e.currentTarget.getBoundingClientRect()
   const x=Math.floor((e.clientX-r.left)*(e.currentTarget.width/r.width)/CELL)
   const y=Math.floor((e.clientY-r.top)*(e.currentTarget.height/r.height)/CELL)
   const {data,error}=await supabase.rpc('reveal_area',{p_game_id:id,p_x:x,p_y:y})
   setMsg(error?error.message:(data?.message||'Gebiet untersucht'))
   await load()
 }

 async function buy(t){
   const {data,error}=await supabase.rpc('buy_technology',{p_game_id:id,p_technology_id:t[0]})
   setMsg(error?error.message:(data?.message||'Erforscht'))
   await load()
 }

 const me=players.find(p=>p.user_id===user?.id)
 const left=game?Math.max(0,game.width*game.height-fields.length):0
 const has=x=>owned.includes(x)

 return <main className="container">
  <div className="topnav"><a className="btn" href="/lobby">← Lobby</a><a className="btn" href="/profile">Profil</a></div>
  <div className="panel"><h1>{game?.name||'Spiel'}</h1><div className="grid">
   {[
    [game?.round_no||'-','Runde'],
    [Number(me?.coins||0).toFixed(2),'Taler'],
    [me?.moves_left??0,'Züge'],
    [me?.reveal_power??1,'Felder/Zug'],
    [(me?.reward_multiplier??1)+'×','Bonus'],
    ['Stufe '+(me?.analysis_level??0),'Analyse'],
    [left.toLocaleString('de-DE'),'Felder übrig']
   ].map((v,i)=><div className="card" key={i}><div className="small">{v[1]}</div><div className="stat">{v[0]}</div></div>)}
  </div></div>

  <div className="gameLayout">
   <section className="panel"><h2>Spielfeld</h2><div className="mapwrap"><canvas ref={canvas} onClick={reveal}/></div><p>{msg}</p></section>
   <aside className="panel"><h2>Technologiebaum</h2>
    <div className="branchTabs">{BR.map(b=><button key={b} className={'branchTab '+(branch===b?'active':'')} onClick={()=>setBranch(b)}>{b}</button>)}</div>
    <div className="techList">{TECHS.filter(t=>t[3]===branch).map(t=>{
      const bought=has(t[0]), unlocked=t[5].every(has), enough=Number(me?.coins||0)>=t[2]
      return <div key={t[0]} className={'techCard '+(bought?'bought':unlocked?'available':'locked')}>
       <strong>{bought?'✅ ':''}{t[1]}</strong>
       <div className="small">{t[4]}</div>
       <div className="small">Benötigt: {t[5].length?t[5].join(', '):'–'}</div>
       <div className="techBottom"><b>{t[2].toFixed(2)} T</b><button className="btn primary" disabled={bought||!unlocked||!enough} onClick={()=>buy(t)}>{bought?'Erforscht':'Erforschen'}</button></div>
      </div>
    })}</div>
   </aside>
  </div>

  <div className="panel"><h2>Spieler</h2><div className="grid">{players.map(p=><div className="card" key={p.user_id}>
   <strong>{p.profiles?.display_name||'Spieler'}</strong>
   <div className="small">{Number(p.coins).toFixed(2)} T · {p.moves_left} Züge · {p.reveal_power} Felder/Zug</div>
  </div>)}</div></div>
 </main>
}
