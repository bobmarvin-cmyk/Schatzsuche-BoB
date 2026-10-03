'use client'
import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase-browser'
import {siteConfig} from '../lib/site-config'

export default function FirstLoginHelp(){
  const [open,setOpen]=useState(false)
  const [loading,setLoading]=useState(true)

  useEffect(()=>{
    check()
  },[])

  async function check(){
    const {data:{user}}=await supabase.auth.getUser()
    if(!user){setLoading(false);return}

    const {data,error}=await supabase
      .from('profiles')
      .select('help_intro_seen')
      .eq('id',user.id)
      .single()

    if(!error && data && !data.help_intro_seen){
      setOpen(true)
    }
    setLoading(false)
  }

  async function close(){
    await supabase.rpc('mark_help_intro_seen_v653')
    setOpen(false)
  }

  if(loading || !open)return null

  return <div className="introOverlay" role="dialog" aria-modal="true" aria-labelledby="intro-title">
    <div className="introModal">
      <div className="introTop">
        <div>
          <div className="small">Willkommen</div>
          <h1 id="intro-title">{siteConfig.brandName}</h1>
        </div>
        <button className="introClose" onClick={close} aria-label="Einführung schließen">×</button>
      </div>

      <p className="introLead">
        Auf einer echten Weltkarte sind Schätze unter Rasterfeldern versteckt.
        Dein Ziel ist es, sie vor den anderen Spielern zu finden.
      </p>

      <div className="introSteps">
        <div className="introStep">
          <span>1</span>
          <div><strong>Spiel auswählen</strong><p>Trete einem öffentlichen oder privaten Spiel bei.</p></div>
        </div>
        <div className="introStep">
          <span>2</span>
          <div><strong>Felder erkunden</strong><p>Mit jedem Zug deckst du Felder auf. Deine Felder erscheinen in deiner Spielerfarbe.</p></div>
        </div>
        <div className="introStep">
          <span>3</span>
          <div><strong>Taler sammeln</strong><p>Leere Felder bringen Taler, mit denen du Technologien freischaltest.</p></div>
        </div>
        <div className="introStep">
          <span>4</span>
          <div><strong>Technologien nutzen</strong><p>Erkunde mehr Felder pro Zug, verbessere Hinweise und erhöhe deinen Zugspeicher.</p></div>
        </div>
        <div className="introStep">
          <span>5</span>
          <div><strong>Schatz finden</strong><p>Kombiniere Karte, Hinweise und Strategie, bevor ein Mitspieler schneller ist.</p></div>
        </div>
      </div>

      <div className="introInfoBox">
        <strong>🆓 Schatzsuchee</strong>
        <span>sind kostenlos.</span>
      </div>

      <div className="introInfoBox gold">
        <strong>✨ Goldgames</strong>
        <span>verwenden derzeit ausschließlich Test-Goldstaub ohne Echtgeldwert.</span>
      </div>

      <div className="introActions">
        <button className="btn primary" onClick={close}>Verstanden – los geht's</button>
        <a className="btn" href="/hilfe" onClick={close}>Ausführliche Hilfe</a>
      </div>
    </div>
  </div>
}
