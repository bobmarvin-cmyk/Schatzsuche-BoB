'use client'
import {useState} from 'react'
import {supabase} from '../../lib/supabase-browser'
export default function Page(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[msg,setMsg]=useState('')
 async function submit(e){e.preventDefault();const {error}=await supabase.auth.signInWithPassword({email,password});if(error)return setMsg(error.message);location.href='/lobby'}
 return <main className="container"><div className="panel" style={{maxWidth:480,margin:'40px auto'}}>
 <h1>Anmelden</h1><form onSubmit={submit}><label>E-Mail</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/>
 <label>Passwort</label><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required/>
 <button className="btn primary">Anmelden</button></form><p>{msg}</p><a href="/register">Noch kein Konto? Registrieren</a>
 </div></main>}
