'use client'
import {useEffect,useRef,useState} from 'react'
import {supabase} from '../lib/supabase-browser'

export default function GameChat({gameId,userId}){
 const [messages,setMessages]=useState([]),[text,setText]=useState(''),[sending,setSending]=useState(false),[error,setError]=useState('')
 const bottom=useRef(null)
 useEffect(()=>{
  load()
  const ch=supabase.channel('chat-'+gameId)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'game_messages',filter:`game_id=eq.${gameId}`},payload=>{
    setMessages(old=>[...old.filter(x=>x.id!==payload.new.id),payload.new].slice(-100))
   }).subscribe()
  return()=>supabase.removeChannel(ch)
 },[gameId])
 useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth'})},[messages.length])
 async function load(){
  const {data,error}=await supabase.from('game_messages').select('id,game_id,user_id,display_name,message,created_at').eq('game_id',gameId).order('created_at',{ascending:true}).limit(100)
  if(error)setError(error.message);else setMessages(data||[])
 }
 async function send(e){
  e?.preventDefault();const value=text.trim();if(!value||sending)return
  setSending(true);setError('')
  const {error}=await supabase.rpc('send_game_message_v68',{p_game_id:gameId,p_message:value})
  setSending(false)
  if(error){setError(error.message);return}
  setText('')
 }
 return <section className="panel gameChat">
  <div className="chatHead"><div><h2>💬 Spielchat</h2><div className="small">Nur Teilnehmer dieses Spiels können lesen und schreiben.</div></div></div>
  <div className="chatMessages">
   {messages.length===0&&<div className="muted">Noch keine Nachrichten.</div>}
   {messages.map(m=><div className={'chatMessage '+(m.user_id===userId?'mine':'')} key={m.id}>
    <div className="chatMeta"><a href={'/spieler/'+m.user_id}>{m.display_name||'Spieler'}</a><span>{new Date(m.created_at).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}</span></div>
    <div>{m.message}</div>
   </div>)}
   <div ref={bottom}/>
  </div>
  <form className="chatForm" onSubmit={send}>
   <input className="input" value={text} maxLength={500} onChange={e=>setText(e.target.value)} placeholder="Nachricht schreiben…"/>
   <button className="btn primary" disabled={sending||!text.trim()}>Senden</button>
  </form>
  {error&&<div className="small statusLine">{error}</div>}
 </section>
}
