'use client'
import {useState} from 'react'
import {supabase} from '../../lib/supabase-browser'
import {siteConfig} from '../../lib/site-config'

export default function Page(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[msg,setMsg]=useState('')
 async function submit(e){
  e.preventDefault();setMsg('Anmeldung läuft…')
  const {error}=await supabase.auth.signInWithPassword({email,password})
  if(error)return setMsg(error.message)
  location.href='/lobby'
 }
 return <main className="container authLanding">
  <div className="authSplit">
   <section className="panel authInfo">
    <div className="eyebrow">WILLKOMMEN ZURÜCK</div>
    <h1>🗺️ {siteConfig.brandName}</h1>
    <p className="landingLead">Finde versteckte Schätze auf einer echten Weltkarte und entwickle deine Suchstrategie mit Technologien und Analysehinweisen.</p>
    <div className="authInfoPoints"><span>🌍 echte Weltkarte</span><span>⚡ kontinuierliche Züge</span><span>🧠 Technologien</span><span>💬 Spielchat</span></div>
    <a className="textLink" href="/hilfe">Spielregeln ansehen →</a>
   </section>
   <section className="panel authCard">
    <h2>Anmelden</h2>
    <form onSubmit={submit}>
     <label>E-Mail</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/>
     <label>Passwort</label><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required/>
     <button className="btn primary wideOnMobile">Anmelden</button>
    </form>
    {msg&&<p className="statusLine">{msg}</p>}
    <p className="small">Noch kein Konto? <a href="/register">Jetzt registrieren</a></p>
    <a className="textLink" href="/">← Zur Startseite</a>
   </section>
  </div>
 </main>
}
