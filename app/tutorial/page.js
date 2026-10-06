'use client'
import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase-browser'

export default function Tutorial(){
 const [loading,setLoading]=useState(true)
 const [starting,setStarting]=useState(false)
 const [msg,setMsg]=useState('')
 const [openGame,setOpenGame]=useState(null)
 const [settings,setSettings]=useState(null)

 useEffect(()=>{init()},[])

 async function init(){
  const {data:{user}}=await supabase.auth.getUser()
  if(!user){location.href='/login';return}

  const [{data:existing},{data:s}]=await Promise.all([
   supabase.rpc('get_my_open_tutorial_v643'),
   supabase.from('platform_settings').select('min_game_fields,max_game_fields,min_regen_seconds,max_regen_seconds').eq('id',1).single()
  ])
  setOpenGame(existing||null)
  setSettings(s||null)
  setLoading(false)
 }

 async function startTutorial(){
  if(starting)return
  setStarting(true);setMsg('Tutorial-Runde wird vorbereitet…')

  const fieldCount=Math.min(
   Number(settings?.max_game_fields||50000000),
   Math.max(1000,Number(settings?.min_game_fields||100))
  )
  const regen=Math.max(Number(settings?.min_regen_seconds||5),Math.min(8,Number(settings?.max_regen_seconds||3600)))

  const {data:gid,error}=await supabase.rpc('create_game_v612',{
   p_name:'🎓 Deine erste Schatzsuche',
   p_field_count:fieldCount,
   p_cell_size_m:50,
   p_max_players:3,
   p_location_mode:'random',
   p_center_lat:null,
   p_center_lon:null,
   p_center_label:'Tutorial-Gebiet',
   p_regen_seconds:regen,
   p_max_stored_moves:6,
   p_is_private:false,
   p_password:null,
   p_treasure_count:1,
   p_gimmick_percent:0.1,
   p_game_type:'standard',
   p_entry_gold_ug:0
  })
  if(error){setStarting(false);setMsg(error.message);return}

  const {data:configured,error:ce}=await supabase.rpc('configure_tutorial_game_v647',{p_game_id:gid})
  if(ce){setStarting(false);setMsg('Spiel erstellt, Tutorial konnte aber nicht vorbereitet werden: '+ce.message);return}

  location.href='/game/'+gid+'?tutorial=1'
 }

 if(loading)return <main className="container"><div className="buildBadge">V6.60</div><div className="panel">Tutorial wird geladen…</div></main>

 return <main className="container tutorialLaunchPage">
  <div className="buildBadge">V6.60</div>
  <div className="topnav"><a className="btn" href="/lobby">← Lobby</a><a className="btn" href="/hilfe">Hilfe</a></div>

  <section className="panel tutorialHero realTutorialHero">
   <div>
    <div className="eyebrow">ECHTES TESTSPIEL</div>
    <h1>🎓 Deine erste Schatzsuche</h1>
    <p className="muted">Keine Simulation mehr: Du spielst eine kleine echte Schatzsuche mit ungefähr 1.000 Feldern und bis zu zwei Mitspielern. Währenddessen erklärt dir das Spiel direkt die wichtigsten Funktionen.</p>
   </div>
  </section>

  <section className="grid tutorialLaunchGrid">
   <div className="card"><strong>🗺️ Kleine echte Karte</strong><div className="small">Ca. 1.000 Felder. Groß genug für das echte Spielgefühl, klein genug zum Ausprobieren.</div></div>
   <div className="card"><strong>👥 Mitspieler</strong><div className="small">Bis zu zwei verfügbare Mitspieler suchen parallel und entwickeln sich wie in normalen Runden.</div></div>
   <div className="card"><strong>💰 Taler & Technologien</strong><div className="small">Du verdienst echte Spiel-Taler und erforschst die normalen Technologien.</div></div>
   <div className="card"><strong>🧭 Hinweise</strong><div className="small">Ein Coach blendet im Spiel passend zu deinem Fortschritt kurze Erklärungen ein.</div></div>
  </section>

  {msg&&<div className="noticeBar">{msg}</div>}

  <section className="panel tutorialStartPanel">
   {openGame
    ?<>
      <h2>Deine Tutorial-Runde läuft noch</h2>
      <p className="muted">Du kannst direkt weiterspielen.</p>
      <a className="btn primary" href={'/game/'+openGame+'?tutorial=1'}>🎓 Tutorial fortsetzen</a>
     </>
    :<>
      <h2>Bereit?</h2>
      <p className="muted">Die Runde zählt nicht als Goldgame und kostet nichts.</p>
      <button className="btn primary" disabled={starting} onClick={startTutorial}>{starting?'Wird erstellt…':'🚀 Tutorial-Spiel starten'}</button>
     </>}
  </section>
 </main>
}
