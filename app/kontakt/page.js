'use client'
import {useState} from 'react'
import {supabase} from '../../lib/supabase-browser'

export default function Kontakt(){
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[message,setMessage]=useState('')
 const [status,setStatus]=useState(''),[sending,setSending]=useState(false)

 async function submit(e){
  e.preventDefault()
  setSending(true);setStatus('')
  const {error}=await supabase.rpc('submit_contact_message',{
    p_name:name.trim(),p_email:email.trim(),p_message:message.trim()
  })
  setSending(false)
  if(error){setStatus(error.message);return}
  setName('');setEmail('');setMessage('')
  setStatus('Danke. Deine Nachricht wurde übermittelt.')
 }

 return <main className="container legalPage">
  <div className="panel contactPanel">
   <h1>Kontakt</h1>
   <p className="muted">Fragen, Fehlermeldungen oder Feedback zur Schatzsuche.</p>
   <form onSubmit={submit}>
    <label>Name</label>
    <input className="input" value={name} onChange={e=>setName(e.target.value)} maxLength={100} required/>
    <label>E-Mail</label>
    <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={200} required/>
    <label>Nachricht</label>
    <textarea className="input textarea" value={message} onChange={e=>setMessage(e.target.value)} minLength={5} maxLength={5000} required/>
    <p className="small">Die Angaben werden ausschließlich zur Bearbeitung deiner Anfrage verarbeitet. Weitere Informationen findest du unter <a className="textLink" href="/datenschutz">Datenschutz</a>.</p>
    <button className="btn primary wideOnMobile" disabled={sending}>{sending?'Wird gesendet…':'Nachricht senden'}</button>
   </form>
   {status&&<div className="noticeBar">{status}</div>}
  </div>
 </main>
}
