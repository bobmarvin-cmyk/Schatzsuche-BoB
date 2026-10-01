'use client'
import {useState} from 'react'
import {supabase} from '../../lib/supabase-browser'
export default function Page(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[msg,setMsg]=useState('')
 async function submit(e){e.preventDefault();setMsg('Bitte warten...')
   const {data,error}=await supabase.auth.signUp({email,password,options:{data:{display_name:name}}})
   if(error)return setMsg(error.message)
   setMsg('Registrierung erfolgreich. Prüfe ggf. deine E-Mails zur Bestätigung.')
 }
 return <main className="container"><div className="panel" style={{maxWidth:480,margin:'40px auto'}}>
 <h1>Registrieren</h1><form onSubmit={submit}>
 <label>Spielername</label><input className="input" value={name} onChange={e=>setName(e.target.value)} required/>
 <label>E-Mail</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/>
 <label>Passwort</label><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} required/>
 <button className="btn primary">Konto anlegen</button></form><p>{msg}</p><a href="/login">Schon registriert? Anmelden</a>
 </div></main>}
