'use client'
import {useEffect,useState} from 'react'
import {useParams} from 'next/navigation'
import {supabase} from '../../../lib/supabase-browser'
import {formatGold} from '../../../lib/gold'

export default function PublicProfile(){
 const {id}=useParams()
 const [p,setP]=useState(null),[loading,setLoading]=useState(true),[avatar,setAvatar]=useState('')
 useEffect(()=>{load()},[id])
 async function load(){
  const {data:{user}}=await supabase.auth.getUser()
  if(!user){location.href='/login';return}
  const {data,error}=await supabase.rpc('get_public_profile_v68',{p_user_id:id})
  if(!error&&data){
   setP(data)
   if(data.avatar_path){
    const {data:pub}=supabase.storage.from('avatars').getPublicUrl(data.avatar_path)
    setAvatar(pub?.publicUrl||'')
   }
  }
  setLoading(false)
 }
 if(loading)return <main className="container"><div className="panel">Lade Profil…</div></main>
 if(!p)return <main className="container"><div className="panel"><h1>Profil nicht gefunden</h1><a className="btn" href="/lobby">← Lobby</a></div></main>
 const initial=(p.display_name||'S').slice(0,1).toUpperCase()
 return <main className="container publicProfilePage">
  <div className="topnav"><a className="btn" href="/lobby">← Lobby</a><a className="btn" href="/legenden">🏆 Legenden</a></div>
  <section className="panel publicProfileHero">
   {avatar?<img className="profileAvatar" src={avatar} alt="Profilbild"/>:<div className="profileAvatar avatarFallback">{initial}</div>}
   <div><div className="eyebrow">SPIELERPROFIL</div><h1>{p.display_name}</h1><p className="profileBioView">{p.bio||'Dieser Spieler hat noch keinen Infotext hinterlegt.'}</p></div>
  </section>
  <section className="grid profileStats">
   <div className="card"><div className="small">Siege</div><div className="stat">{p.wins}</div></div>
   <div className="card"><div className="small">Spiele</div><div className="stat">{p.total_games}</div></div>
   <div className="card"><div className="small">Erforschte Felder</div><div className="stat">{Number(p.total_fields_revealed||0).toLocaleString('de-DE')}</div></div>
   <div className="card"><div className="small">Gefundenes Gold</div><div className="stat">{formatGold(p.gold_found_ug||0)}</div></div>
   <div className="card"><div className="small">Mitglied seit</div><div className="stat memberSince">{p.created_at?new Date(p.created_at).toLocaleDateString('de-DE',{month:'short',year:'numeric'}):'–'}</div></div>
  </section>
 </main>
}
