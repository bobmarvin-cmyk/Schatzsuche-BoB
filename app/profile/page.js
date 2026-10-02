'use client'
import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase-browser'
import {formatGold} from '../../lib/gold'

export default function Profile(){
 const [user,setUser]=useState(null),[p,setP]=useState(null),[wallet,setWallet]=useState(null)
 const [name,setName]=useState(''),[bio,setBio]=useState(''),[avatarUrl,setAvatarUrl]=useState('')
 const [saving,setSaving]=useState(false),[msg,setMsg]=useState('')

 useEffect(()=>{load()},[])

 async function load(){
  const {data:{user}}=await supabase.auth.getUser()
  if(!user){location.href='/login';return}
  setUser(user)

  const [{data,error},{data:w}]=await Promise.all([
    supabase.from('profiles').select('*').eq('id',user.id).single(),
    supabase.from('gold_wallets').select('balance_ug').eq('user_id',user.id).maybeSingle()
  ])
  if(error){setMsg(error.message);return}

  setP(data);setWallet(w)
  setName(data.display_name||'')
  setBio(data.bio||'')

  if(data.avatar_path){
    const {data:pub}=supabase.storage.from('avatars').getPublicUrl(data.avatar_path)
    setAvatarUrl(pub?.publicUrl||'')
  }else setAvatarUrl('')
 }

 async function saveProfile(){
  setSaving(true);setMsg('')
  const {error}=await supabase.rpc('update_profile_v66',{
    p_display_name:name.trim(),
    p_bio:bio.trim(),
    p_avatar_path:p?.avatar_path||null
  })
  setSaving(false)
  if(error){setMsg(error.message);return}
  setMsg('Profil gespeichert.')
  await load()
 }

 async function uploadAvatar(e){
  const file=e.target.files?.[0]
  if(!file||!user)return
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){
    setMsg('Bitte JPG, PNG oder WebP verwenden.');return
  }
  if(file.size>2*1024*1024){
    setMsg('Das Profilbild darf maximal 2 MB groß sein.');return
  }

  setSaving(true);setMsg('Profilbild wird hochgeladen…')
  const path=`${user.id}/avatar`
  const {error}=await supabase.storage.from('avatars').upload(path,file,{
    upsert:true,
    contentType:file.type,
    cacheControl:'3600'
  })
  if(error){setSaving(false);setMsg(error.message);return}

  const {error:saveError}=await supabase.rpc('update_profile_v66',{
    p_display_name:name.trim()||p.display_name,
    p_bio:bio.trim(),
    p_avatar_path:path
  })
  setSaving(false)
  if(saveError){setMsg(saveError.message);return}

  const {data:pub}=supabase.storage.from('avatars').getPublicUrl(path)
  setAvatarUrl((pub?.publicUrl||'')+'?v='+Date.now())
  setP({...p,avatar_path:path})
  setMsg('Profilbild gespeichert.')
 }

 async function removeAvatar(){
  if(!user||!p?.avatar_path)return
  setSaving(true);setMsg('')
  await supabase.storage.from('avatars').remove([p.avatar_path])
  const {error}=await supabase.rpc('update_profile_v66',{
    p_display_name:name.trim()||p.display_name,
    p_bio:bio.trim(),
    p_avatar_path:null
  })
  setSaving(false)
  if(error){setMsg(error.message);return}
  setAvatarUrl('');setP({...p,avatar_path:null});setMsg('Profilbild entfernt.')
 }

 if(!p)return <main className="container"><div className="panel">Lade Profil…</div></main>

 const initial=(p.display_name||'S').trim().slice(0,1).toUpperCase()

 return <main className="container profilePage">
  <div className="topnav">
   <a className="btn" href="/lobby">← Lobby</a>
   <a className="btn" href="/legenden">🏆 Legenden</a>
  </div>

  <div className="panel profileHero">
   <div className="avatarWrap">
    {avatarUrl
      ? <img className="profileAvatar" src={avatarUrl} alt="Profilbild"/>
      : <div className="profileAvatar avatarFallback">{initial}</div>}
   </div>
   <div className="profileIntro">
    <h1>{p.display_name||'Spieler'}</h1>
    <p className="profileBioView">{p.bio||'Noch kein Infotext hinterlegt.'}</p>
   </div>
  </div>

  <div className="grid profileStats">
   <div className="card goldMiniCard"><div className="small">Test-Goldstaub</div><div className="stat">✨ {formatGold(wallet?.balance_ug||0)}</div></div>
   <div className="card"><div className="small">Spiele</div><div className="stat">{p.total_games}</div></div>
   <div className="card"><div className="small">Siege</div><div className="stat">{p.wins}</div></div>
   <div className="card"><div className="small">Erforschte Felder</div><div className="stat">{Number(p.total_fields_revealed||0).toLocaleString('de-DE')}</div></div>
  </div>

  <div className="panel profileEditor">
   <h2>Profil personalisieren</h2>

   <label>Spielername</label>
   <input className="input" value={name} maxLength={30} onChange={e=>setName(e.target.value)}/>

   <label>Über mich</label>
   <textarea className="input textarea" value={bio} maxLength={500} onChange={e=>setBio(e.target.value)}
    placeholder="Erzähl den anderen Spielern etwas über dich…"/>
   <div className="small bioCounter">{bio.length} / 500 Zeichen</div>

   <label>Profilbild</label>
   <div className="avatarControls">
    <label className="btn avatarUploadBtn">
      Bild auswählen
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} hidden/>
    </label>
    {p.avatar_path&&<button className="btn" onClick={removeAvatar} disabled={saving}>Bild entfernen</button>}
   </div>
   <div className="small">JPG, PNG oder WebP · maximal 2 MB.</div>

   <div className="profileSaveRow">
    <button className="btn primary" onClick={saveProfile} disabled={saving}>{saving?'Speichert…':'Profil speichern'}</button>
    {msg&&<span>{msg}</span>}
   </div>
  </div>
 </main>
}
