'use client'
import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase-browser'
import {formatGold} from '../../lib/gold'

const NUM=(v)=>v===''?0:Number(v)

export default function Admin(){
 const [allowed,setAllowed]=useState(null)
 const [settings,setSettings]=useState(null)
 const [techs,setTechs]=useState([])
 const [msg,setMsg]=useState('')
 const [saving,setSaving]=useState(false)

 useEffect(()=>{init()},[])

 async function init(){
  const {data:{user}}=await supabase.auth.getUser()
  if(!user){location.href='/login';return}

  const {data:isAdmin}=await supabase.rpc('is_admin_v67')
  if(!isAdmin){setAllowed(false);return}
  setAllowed(true)
  await load()
 }

 async function load(){
  const [{data:s,error:se},{data:t,error:te}]=await Promise.all([
    supabase.from('platform_settings').select('*').eq('id',1).single(),
    supabase.from('technologies').select('*').order('sort_order',{ascending:true}).order('id',{ascending:true})
  ])
  if(se||te){setMsg(se?.message||te?.message||'Fehler beim Laden');return}
  setSettings(s);setTechs(t||[])
 }

 function setSetting(key,value){
  setSettings(s=>({...s,[key]:value}))
 }
 function setTech(id,key,value){
  setTechs(list=>list.map(t=>t.id===id?{...t,[key]:value}:t))
 }

 async function saveSettings(){
  setSaving(true);setMsg('')
  const payload={
   prize_share_bps:NUM(settings.prize_share_bps),
   community_share_bps:NUM(settings.community_share_bps),
   platform_share_bps:NUM(settings.platform_share_bps),
   multi_treasure_threshold_ug:NUM(settings.multi_treasure_threshold_ug),
   max_treasures:NUM(settings.max_treasures),
   test_grant_ug:NUM(settings.test_grant_ug),
   gold_price_cents_per_001g:NUM(settings.gold_price_cents_per_001g),
   game_inactivity_hours:NUM(settings.game_inactivity_hours),
   closed_game_retention_hours:NUM(settings.closed_game_retention_hours),
   inactive_community_share_bps:NUM(settings.inactive_community_share_bps),
   inactive_platform_share_bps:NUM(settings.inactive_platform_share_bps),
   min_game_fields:NUM(settings.min_game_fields),
   max_game_fields:NUM(settings.max_game_fields),
   max_game_players:NUM(settings.max_game_players),
   min_cell_size_m:NUM(settings.min_cell_size_m),
   max_cell_size_m:NUM(settings.max_cell_size_m),
   min_regen_seconds:NUM(settings.min_regen_seconds),
   max_regen_seconds:NUM(settings.max_regen_seconds),
   max_stored_moves_limit:NUM(settings.max_stored_moves_limit),
   exploration_reward:NUM(settings.exploration_reward),
   min_entry_gold_ug:NUM(settings.min_entry_gold_ug),
   max_entry_gold_ug:NUM(settings.max_entry_gold_ug)
  }
  const {data,error}=await supabase.rpc('admin_update_settings_v67',{p_settings:payload})
  setSaving(false)
  setMsg(error?error.message:(data?.message||'Globale Einstellungen gespeichert.'))
  if(!error)await load()
 }

 async function saveTech(t){
  setSaving(true);setMsg('')
  const {data,error}=await supabase.rpc('admin_update_technology_v67',{
    p_id:t.id,
    p_name:t.name,
    p_branch:t.branch,
    p_description:t.description||'',
    p_cost:NUM(t.cost),
    p_reveal_power_bonus:NUM(t.reveal_power_bonus),
    p_reward_bonus:NUM(t.reward_bonus),
    p_analysis_level:NUM(t.analysis_level),
    p_capacity_bonus:NUM(t.capacity_bonus),
    p_regen_reduction:NUM(t.regen_reduction),
    p_requires:t.requires||[],
    p_sort_order:NUM(t.sort_order),
    p_is_active:!!t.is_active
  })
  setSaving(false)
  setMsg(error?error.message:(data?.message||`${t.name} gespeichert.`))
  if(!error)await load()
 }

 if(allowed===null)return <main className="container"><div className="panel">Prüfe Admin-Berechtigung…</div></main>
 if(allowed===false)return <main className="container"><div className="panel"><h1>Kein Zugriff</h1><p>Diese Seite ist nur für die Spielleitung.</p><a className="btn" href="/lobby">← Lobby</a></div></main>
 if(!settings)return <main className="container"><div className="panel">Lade Schaltzentrale…</div></main>

 const normalSum=NUM(settings.prize_share_bps)+NUM(settings.community_share_bps)+NUM(settings.platform_share_bps)
 const inactiveSum=NUM(settings.inactive_community_share_bps)+NUM(settings.inactive_platform_share_bps)

 return <main className="container adminPage">
  <div className="topnav"><a className="btn" href="/lobby">← Lobby</a><button className="btn" onClick={load}>↻ Neu laden</button></div>

  <div className="panel adminHero">
   <div><div className="small">SPIELLEITUNG</div><h1>🎛️ Schaltzentrale</h1><p className="muted">Zentrale Masterwerte für Spiel, Ökonomie, Lebenszyklus und Technologiebaum.</p></div>
   <div className="adminStatus">SERVERSEITIG</div>
  </div>

  {msg&&<div className="noticeBar">{msg}</div>}

  <section className="panel">
   <h2>🎮 Spielgrenzen</h2>
   <div className="adminGrid">
    <Field label="Min. Kartenfelder" value={settings.min_game_fields} onChange={v=>setSetting('min_game_fields',v)}/>
    <Field label="Max. Kartenfelder" value={settings.max_game_fields} onChange={v=>setSetting('max_game_fields',v)}/>
    <Field label="Max. Spieler pro Spiel" value={settings.max_game_players} onChange={v=>setSetting('max_game_players',v)}/>
    <Field label="Min. Feldkante (m)" value={settings.min_cell_size_m} onChange={v=>setSetting('min_cell_size_m',v)}/>
    <Field label="Max. Feldkante (m)" value={settings.max_cell_size_m} onChange={v=>setSetting('max_cell_size_m',v)}/>
    <Field label="Min. Zugregeneration (s)" value={settings.min_regen_seconds} onChange={v=>setSetting('min_regen_seconds',v)}/>
    <Field label="Max. Zugregeneration (s)" value={settings.max_regen_seconds} onChange={v=>setSetting('max_regen_seconds',v)}/>
    <Field label="Max. Zugspeicher" value={settings.max_stored_moves_limit} onChange={v=>setSetting('max_stored_moves_limit',v)}/>
    <Field label="Taler pro leerem Feld" step="0.001" value={settings.exploration_reward} onChange={v=>setSetting('exploration_reward',v)}/>
   </div>
  </section>

  <section className="panel">
   <h2>✨ Goldstaub-Testökonomie</h2>
   <div className="adminGrid">
    <Field label="Schatzpool (Basispunkte)" value={settings.prize_share_bps} onChange={v=>setSetting('prize_share_bps',v)}/>
    <Field label="Community (Basispunkte)" value={settings.community_share_bps} onChange={v=>setSetting('community_share_bps',v)}/>
    <Field label="Plattform (Basispunkte)" value={settings.platform_share_bps} onChange={v=>setSetting('platform_share_bps',v)}/>
    <Field label="Testguthaben (µg)" value={settings.test_grant_ug} onChange={v=>setSetting('test_grant_ug',v)}/>
    <Field label="Mehrschatz-Schwelle (µg)" value={settings.multi_treasure_threshold_ug} onChange={v=>setSetting('multi_treasure_threshold_ug',v)}/>
    <Field label="Max. Schätze" value={settings.max_treasures} onChange={v=>setSetting('max_treasures',v)}/>
    <Field label="Min. Paygame-Einsatz (µg)" value={settings.min_entry_gold_ug} onChange={v=>setSetting('min_entry_gold_ug',v)}/>
    <Field label="Max. Paygame-Einsatz (µg)" value={settings.max_entry_gold_ug} onChange={v=>setSetting('max_entry_gold_ug',v)}/>
    <Field label="Referenzpreis Cent / 0,01 g" value={settings.gold_price_cents_per_001g} onChange={v=>setSetting('gold_price_cents_per_001g',v)}/>
   </div>
   <div className={'sumCheck '+(normalSum===10000?'ok':'bad')}>Normale Verteilung: {(normalSum/100).toFixed(2)} % {normalSum===10000?'✓':'– muss 100 % ergeben'}</div>
   <div className="adminReadOnly">
    <span>Community-Reserve: <b>{formatGold(settings.community_reserve_ug)}</b></span>
    <span>Plattform-Testanteil: <b>{formatGold(settings.platform_revenue_ug)}</b></span>
   </div>
  </section>

  <section className="panel">
   <h2>⏱️ Spiel-Lebenszyklus</h2>
   <div className="adminGrid">
    <Field label="Schließen nach Inaktivität (h)" value={settings.game_inactivity_hours} onChange={v=>setSetting('game_inactivity_hours',v)}/>
    <Field label="Geschlossene Spiele löschen nach (h)" value={settings.closed_game_retention_hours} onChange={v=>setSetting('closed_game_retention_hours',v)}/>
    <Field label="Restgold → Community (Basispunkte)" value={settings.inactive_community_share_bps} onChange={v=>setSetting('inactive_community_share_bps',v)}/>
    <Field label="Restgold → Plattform (Basispunkte)" value={settings.inactive_platform_share_bps} onChange={v=>setSetting('inactive_platform_share_bps',v)}/>
   </div>
   <div className={'sumCheck '+(inactiveSum===10000?'ok':'bad')}>Inaktivitäts-Verteilung: {(inactiveSum/100).toFixed(2)} % {inactiveSum===10000?'✓':'– muss 100 % ergeben'}</div>
  </section>

  <div className="adminSaveBar">
   <button className="btn primary" onClick={saveSettings} disabled={saving||normalSum!==10000||inactiveSum!==10000}>{saving?'Speichert…':'Globale Werte speichern'}</button>
  </div>

  <section className="panel">
   <h2>🧠 Technologiebaum</h2>
   <p className="small">Diese Werte werden direkt vom Spiel geladen. Änderungen benötigen keinen neuen GitHub-Deploy.</p>
   <div className="adminTechList">
    {techs.map(t=><div className={'adminTech '+(!t.is_active?'disabledTech':'')} key={t.id}>
      <div className="adminTechHead">
       <div><strong>{t.name}</strong><span className="techId">{t.id}</span></div>
       <label className="adminToggle"><input type="checkbox" checked={!!t.is_active} onChange={e=>setTech(t.id,'is_active',e.target.checked)}/> aktiv</label>
      </div>
      <div className="adminTechFields">
       <Field label="Name" type="text" value={t.name} onChange={v=>setTech(t.id,'name',v)}/>
       <Field label="Kategorie" type="text" value={t.branch} onChange={v=>setTech(t.id,'branch',v)}/>
       <Field label="Preis (Taler)" step="0.01" value={t.cost} onChange={v=>setTech(t.id,'cost',v)}/>
       <Field label="Felder-Bonus" value={t.reveal_power_bonus} onChange={v=>setTech(t.id,'reveal_power_bonus',v)}/>
       <Field label="Talerbonus (0,5 = +50%)" step="0.01" value={t.reward_bonus} onChange={v=>setTech(t.id,'reward_bonus',v)}/>
       <Field label="Analyse-Level" value={t.analysis_level} onChange={v=>setTech(t.id,'analysis_level',v)}/>
       <Field label="Zugspeicher-Bonus" value={t.capacity_bonus} onChange={v=>setTech(t.id,'capacity_bonus',v)}/>
       <Field label="Regeneration schneller (0,1 = 10%)" step="0.01" value={t.regen_reduction} onChange={v=>setTech(t.id,'regen_reduction',v)}/>
       <Field label="Sortierung" value={t.sort_order} onChange={v=>setTech(t.id,'sort_order',v)}/>
       <div className="adminField span2"><label>Voraussetzungen (IDs mit Komma)</label><input className="input" value={(t.requires||[]).join(', ')} onChange={e=>setTech(t.id,'requires',e.target.value.split(',').map(x=>x.trim()).filter(Boolean))}/></div>
       <div className="adminField span2"><label>Beschreibung im Spiel</label><textarea className="input adminTextarea" value={t.description||''} onChange={e=>setTech(t.id,'description',e.target.value)} maxLength={250}/></div>
      </div>
      <button className="btn" onClick={()=>saveTech(t)} disabled={saving}>Diese Technologie speichern</button>
    </div>)}
   </div>
  </section>
 </main>
}

function Field({label,value,onChange,type='number',step='1'}){
 return <div className="adminField">
  <label>{label}</label>
  <input className="input" type={type} step={type==='number'?step:undefined} value={value??''} onChange={e=>onChange(e.target.value)}/>
 </div>
}
