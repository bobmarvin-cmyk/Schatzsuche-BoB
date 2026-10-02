'use client'
import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase-browser'
import {formatGold} from '../../lib/gold'
export default function Profile(){
 const [p,setP]=useState(null),[wallet,setWallet]=useState(null)
 useEffect(()=>{(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user)return location.href='/login';const [{data},{data:w}]=await Promise.all([supabase.from('profiles').select('*').eq('id',user.id).single(),supabase.from('gold_wallets').select('balance_ug').eq('user_id',user.id).maybeSingle()]);setP(data);setWallet(w)})()},[])
 if(!p)return <main className="container"><div className="panel">Lade Profil…</div></main>
 return <main className="container"><div className="topnav"><a className="btn" href="/lobby">← Lobby</a><a className="btn" href="/legenden">🏆 Legenden</a></div><div className="panel"><h1>{p.display_name||'Spieler'}</h1><div className="grid"><div className="card goldMiniCard"><div className="small">Test-Goldstaub</div><div className="stat">✨ {formatGold(wallet?.balance_ug||0)}</div></div><div className="card"><div className="small">Spiele</div><div className="stat">{p.total_games}</div></div><div className="card"><div className="small">Siege</div><div className="stat">{p.wins}</div></div><div className="card"><div className="small">Erforschte Felder</div><div className="stat">{p.total_fields_revealed}</div></div></div></div></main>}
