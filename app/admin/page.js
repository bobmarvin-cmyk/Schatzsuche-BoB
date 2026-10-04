'use client'
import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase-browser'
import {formatGold,ugToGoldMg} from '../../lib/gold'

const NUM=(v)=>v===''?0:Number(v)

export default function Admin(){
 const [allowed,setAllowed]=useState(null)
 const [settings,setSettings]=useState(null)
 const [techs,setTechs]=useState([])
 const [goldOverview,setGoldOverview]=useState(null)
 const [autoGame,setAutoGame]=useState(null)
 const [adminGames,setAdminGames]=useState([])
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
  const [{data:s,error:se},{data:t,error:te},{data:go,error:ge},{data:ag,error:ae},{data:games,error:gameErr}]=await Promise.all([
    supabase.from('platform_settings').select('*').eq('id',1).single(),
    supabase.from('technologies').select('*').order('sort_order',{ascending:true}).order('id',{ascending:true}),
    supabase.rpc('admin_gold_overview_v613'),
    supabase.rpc('admin_get_auto_game_config_v6141'),
    supabase.rpc('admin_list_games_v615',{p_limit:200})
  ])
  if(se||te||ge||ae||gameErr){setMsg(se?.message||te?.message||ge?.message||ae?.message||gameErr?.message||'Fehler beim Laden');return}
  setSettings(s);setTechs(t||[]);setGoldOverview(go||null);setAutoGame(ag||null);setAdminGames(games||[])
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
   max_entry_gold_ug:NUM(settings.max_entry_gold_ug),
   machine_reward_factor:NUM(settings.machine_reward_factor)
  }
  const {data,error}=await supabase.rpc('admin_update_settings_v67',{p_settings:payload})
  if(!error){
    await supabase.rpc('admin_set_default_regen_v68',{p_seconds:NUM(settings.default_regen_seconds)})
    await supabase.rpc('admin_set_machine_reward_v690',{p_factor:NUM(settings.machine_reward_factor)})
    await supabase.rpc('admin_set_gimmick_settings_v611',{
      p_min:NUM(settings.min_gimmick_percent),
      p_max:NUM(settings.max_gimmick_percent),
      p_default:NUM(settings.default_gimmick_percent),
      p_taler_bonus:NUM(settings.gimmick_taler_bonus),
      p_move_bonus:NUM(settings.gimmick_move_bonus),
      p_reveal_bonus:NUM(settings.gimmick_reveal_bonus)
    })
    await supabase.rpc('admin_set_winner_gold_factor_v613',{
      p_ug_per_1000:NUM(settings.winner_taler_gold_ug_per_1000)
    })
    await supabase.rpc('admin_set_analysis_prices_v616',{
      p_l1:NUM(settings.analysis_price_l1),
      p_l2:NUM(settings.analysis_price_l2),
      p_l3:NUM(settings.analysis_price_l3),
      p_l4:NUM(settings.analysis_price_l4),
      p_l5:NUM(settings.analysis_price_l5),
      p_l6:NUM(settings.analysis_price_l6)
    })
  }
  setSaving(false)
  setMsg(error?error.message:(data?.message||'Globale Einstellungen gespeichert.'))
  if(!error)await load()
 }

 function setAuto(key,value){setAutoGame(a=>({...a,[key]:value}))}
 async function saveAutoGame(){
  setSaving(true);setMsg('')
  const payload={
    enabled:!!autoGame.enabled,
    interval_minutes:NUM(autoGame.interval_minutes),
    name_prefix:autoGame.name_prefix||'Auto-Runde',
    field_count:NUM(autoGame.field_count),
    cell_size_m:NUM(autoGame.cell_size_m),
    max_players:NUM(autoGame.max_players),
    regen_seconds:NUM(autoGame.regen_seconds),
    max_stored_moves:NUM(autoGame.max_stored_moves),
    game_type:autoGame.game_type||'standard',
    entry_gold_ug:NUM(autoGame.entry_gold_ug),
    treasure_count:NUM(autoGame.treasure_count),
    gimmick_percent:NUM(autoGame.gimmick_percent),
    location_mode:autoGame.location_mode||'random',
    center_lat:autoGame.center_lat??'',
    center_lon:autoGame.center_lon??'',
    center_label:autoGame.center_label||''
  }
  const {data,error}=await supabase.rpc('admin_save_auto_game_config_v6141',{p:payload})
  setSaving(false);setMsg(error?error.message:(data?.message||'Auto-Game gespeichert'))
  if(!error)await load()
 }
 async function generateAutoGameNow(){
  setSaving(true);setMsg('Erzeuge Auto-Game…')
  const {data,error}=await supabase.rpc('admin_generate_auto_game_v6141')
  setSaving(false)
  if(error){setMsg(error.message);return}
  setMsg(data?.created?'Auto-Game wurde erstellt.':'Kein Game erstellt.')
  await load()
 }

 async function endAdminGame(g){
  if(!confirm(`Spiel „${g.name}“ wirklich beenden?`))return
  setSaving(true)
  const {data,error}=await supabase.rpc('admin_end_game_v615',{p_game_id:g.id})
  setSaving(false);setMsg(error?error.message:(data?.message||'Spiel beendet'))
  if(!error)await load()
 }
 async function deleteAdminGame(g){
  if(!confirm(`Spiel „${g.name}“ wirklich löschen? Der Hall-of-Fame-Endstand bleibt erhalten.`))return
  setSaving(true)
  const {data,error}=await supabase.rpc('admin_delete_game_v615',{p_game_id:g.id})
  setSaving(false);setMsg(error?error.message:(data?.message||'Spiel gelöscht'))
  if(!error)await load()
 }

 async function saveTech(t){
  setSaving(true);setMsg('')
  const {data,error}=await supabase.rpc('admin_update_technology_v614',{
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
    p_machine_auto_fields:NUM(t.machine_auto_fields),
    p_exclusive_per_game:!!t.exclusive_per_game,
    p_trap_type:t.trap_type||'',
    p_trap_power:NUM(t.trap_power),
    p_trap_limit:NUM(t.trap_limit),
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

 return <main className="container adminPage"><div className="buildBadge">V6.20.2</div>
  <div className="topnav"><a className="btn" href="/lobby">← Lobby</a><button className="btn" onClick={load}>↻ Neu laden</button></div>

  <div className="panel adminHero">
   <div><div className="small">SPIELLEITUNG</div><h1>🎛️ Schaltzentrale</h1><p className="muted">Zentrale Masterwerte für Spiel, Ökonomie, Lebenszyklus und Technologien.</p></div>
   <div className="adminStatus">SERVERSEITIG</div>
  </div>

  {msg&&<div className="noticeBar">{msg}</div>}
  <nav className="adminJumpNav">
   <a href="#admin-games">🎮 Spiele</a><a href="#admin-auto">🤖 Auto</a><a href="#admin-economy">✨ Gold</a><a href="#admin-rules">⚙️ Regeln</a><a href="#admin-tech">🧠 Technologien</a>
  </nav>

  <section className="panel" id="admin-rules">
   <h2>🎮 Spielgrenzen</h2>
   <div className="adminGrid">
    <Field label="Min. Kartenfelder" value={settings.min_game_fields} onChange={v=>setSetting('min_game_fields',v)}/>
    <Field label="Max. Kartenfelder" value={settings.max_game_fields} onChange={v=>setSetting('max_game_fields',v)}/>
    <Field label="Max. Spieler pro Spiel" value={settings.max_game_players} onChange={v=>setSetting('max_game_players',v)}/>
    <Field label="Min. Feldkante (m)" value={settings.min_cell_size_m} onChange={v=>setSetting('min_cell_size_m',v)}/>
    <Field label="Max. Feldkante (m)" value={settings.max_cell_size_m} onChange={v=>setSetting('max_cell_size_m',v)}/>
    <Field label="Standard-Zugregeneration neue Spiele (s)" value={settings.default_regen_seconds} onChange={v=>setSetting('default_regen_seconds',v)}/>
    <Field label="Min. Zugregeneration (s)" value={settings.min_regen_seconds} onChange={v=>setSetting('min_regen_seconds',v)}/>
    <Field label="Max. Zugregeneration (s)" value={settings.max_regen_seconds} onChange={v=>setSetting('max_regen_seconds',v)}/>
    <Field label="Max. Zugspeicher" value={settings.max_stored_moves_limit} onChange={v=>setSetting('max_stored_moves_limit',v)}/>
    <Field label="Taler pro leerem Feld" step="0.001" value={settings.exploration_reward} onChange={v=>setSetting('exploration_reward',v)}/>
    <Field label="Maschinen-Talerfaktor (1 = 100%)" step="0.05" value={settings.machine_reward_factor} onChange={v=>setSetting('machine_reward_factor',v)}/>
        <Field label="Analyse-Hinweis Stufe 1 (Taler)" step="0.1" value={settings.analysis_price_l1} onChange={v=>setSetting('analysis_price_l1',v)}/>
    <Field label="Analyse-Hinweis Stufe 2 (Taler)" step="0.1" value={settings.analysis_price_l2} onChange={v=>setSetting('analysis_price_l2',v)}/>
    <Field label="Analyse-Hinweis Stufe 3 (Taler)" step="0.1" value={settings.analysis_price_l3} onChange={v=>setSetting('analysis_price_l3',v)}/>
    <Field label="Analyse-Hinweis Stufe 4 (Taler)" step="0.1" value={settings.analysis_price_l4} onChange={v=>setSetting('analysis_price_l4',v)}/>
    <Field label="Analyse-Hinweis Stufe 5 (Taler)" step="0.1" value={settings.analysis_price_l5} onChange={v=>setSetting('analysis_price_l5',v)}/>
    <Field label="Analyse-Hinweis Stufe 6+ (Taler)" step="0.1" value={settings.analysis_price_l6} onChange={v=>setSetting('analysis_price_l6',v)}/>
   </div>
  </section>

  <section className="panel" id="admin-economy">
   <h2>✨ Goldstaub-Ökonomie</h2>
   <div className="adminGrid">
    <Field label="Schatzpool (Basispunkte)" value={settings.prize_share_bps} onChange={v=>setSetting('prize_share_bps',v)}/>
    <Field label="Community (Basispunkte)" value={settings.community_share_bps} onChange={v=>setSetting('community_share_bps',v)}/>
    <Field label="Plattform (Basispunkte)" value={settings.platform_share_bps} onChange={v=>setSetting('platform_share_bps',v)}/>
    <MgField label="Startgutschrift (mg)" valueUg={settings.test_grant_ug} onChangeUg={v=>setSetting('test_grant_ug',v)}/>
    <MgField label="Mehrschatz-Schwelle (mg)" valueUg={settings.multi_treasure_threshold_ug} onChangeUg={v=>setSetting('multi_treasure_threshold_ug',v)}/>
    <Field label="Max. Schätze" value={settings.max_treasures} onChange={v=>setSetting('max_treasures',v)}/>
    <MgField label="Min. Goldgame-Einsatz (mg)" valueUg={settings.min_entry_gold_ug} onChangeUg={v=>setSetting('min_entry_gold_ug',v)}/>
    <MgField label="Max. Goldgame-Einsatz (mg)" valueUg={settings.max_entry_gold_ug} onChangeUg={v=>setSetting('max_entry_gold_ug',v)}/>
    <Field label="Referenzpreis Cent / 10 mg" value={settings.gold_price_cents_per_001g} onChange={v=>setSetting('gold_price_cents_per_001g',v)}/>
    <MgField label="Gewinner-Gold mg / 1.000 Taler" valueUg={settings.winner_taler_gold_ug_per_1000} onChangeUg={v=>setSetting('winner_taler_gold_ug_per_1000',v)}/>
    <div className="adminField"><label>Aktuelle Umrechnung</label><div className="input readOnlyLike">1.000 Taler = {formatGold(settings.winner_taler_gold_ug_per_1000,6)}</div></div>
   </div>
   <div className={'sumCheck '+(normalSum===10000?'ok':'bad')}>Normale Verteilung: {(normalSum/100).toFixed(2)} % {normalSum===10000?'✓':'– muss 100 % ergeben'}</div>
   <div className="adminReadOnly">
    <span>Community-Reserve: <b>{formatGold(settings.community_reserve_ug)}</b></span>
    <span>Plattformanteil: <b>{formatGold(settings.platform_revenue_ug)}</b></span>
   </div>
   {goldOverview&&<div className="goldOverviewGrid">
    <div className="card"><div className="small">Bei Spielern aktuell</div><div className="stat">{formatGold(goldOverview.wallet_total_ug)}</div></div>
    <div className="card"><div className="small">Schatz-Auszahlungen gesamt</div><div className="stat">{formatGold(goldOverview.treasure_paid_ug)}</div></div>
    <div className="card"><div className="small">Community verteilt gesamt</div><div className="stat">{formatGold(goldOverview.community_paid_ug)}</div></div>
    <div className="card"><div className="small">Gewinner-Taler → Gold</div><div className="stat">{formatGold(goldOverview.winner_conversion_paid_ug)}</div></div>
    <div className="card"><div className="small">Vom Game vereinnahmt</div><div className="stat">{formatGold(goldOverview.platform_absorbed_ug)}</div></div>
    <div className="card"><div className="small">Community-Reserve</div><div className="stat">{formatGold(goldOverview.community_reserve_ug)}</div></div>
    <div className="card"><div className="small">Aktuell im System bilanziert</div><div className="stat">{formatGold(goldOverview.tracked_total_ug)}</div></div>
    <div className="card"><div className="small">Aus Startgutschriften erzeugt</div><div className="stat">{formatGold(goldOverview.test_grants_ug)}</div></div>
   </div>}
  </section>

  <section className="panel">
   <h2>🎁 Karten-Gimmicks</h2>
   <p className="small">Steuert, wie häufig Überraschungsfelder bei der Spielerstellung gewählt werden dürfen und wie stark ihre Effekte sind.</p>
   <div className="adminGrid">
    <Field label="Min. Gimmicks (%)" step="0.01" value={settings.min_gimmick_percent} onChange={v=>setSetting('min_gimmick_percent',v)}/>
    <Field label="Max. Gimmicks (%)" step="0.01" value={settings.max_gimmick_percent} onChange={v=>setSetting('max_gimmick_percent',v)}/>
    <Field label="Standard Gimmicks (%)" step="0.01" value={settings.default_gimmick_percent} onChange={v=>setSetting('default_gimmick_percent',v)}/>
    <Field label="Taler-Kiste Bonus" step="0.1" value={settings.gimmick_taler_bonus} onChange={v=>setSetting('gimmick_taler_bonus',v)}/>
    <Field label="Extra-Züge pro Fund" value={settings.gimmick_move_bonus} onChange={v=>setSetting('gimmick_move_bonus',v)}/>
    <Field label="Scanner-Bonus nächster manueller Zug" value={settings.gimmick_reveal_bonus} onChange={v=>setSetting('gimmick_reveal_bonus',v)}/>
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

  <section className="panel" id="admin-games">
   <div className="adminSectionHead"><div><h2>🎮 Spielverwaltung</h2><p className="small">Aktive oder geschlossene Spiele administrativ beenden bzw. löschen.</p></div><span className="adminStatus">{adminGames.length} Spiele</span></div>
   <div className="adminGameList">
    {adminGames.map(g=><div className="adminGameRow" key={g.id}>
      <div className="adminGameMain">
       <strong>{g.name}</strong>
       <span className="small">{g.game_type==='pay'?'✨ Goldgame':g.game_type==='sponsor'?'🤝 Sponsorspiel':'🧭 Schatzsuche'} · {g.status==='active'?'🟢 aktiv':'⚪ '+g.status} · 👥 {Number(g.player_count||0)} · 🗺️ {Number(g.explored_count||0).toLocaleString('de-DE')}</span>
      </div>
      <div className="adminGameActions">
       {g.status==='active'&&<button className="btn" onClick={()=>endAdminGame(g)} disabled={saving}>Beenden</button>}
       <button className="btn dangerBtn" onClick={()=>deleteAdminGame(g)} disabled={saving}>Löschen</button>
      </div>
    </div>)}
   </div>
  </section>

  {autoGame&&<section className="panel" id="admin-auto">
   <h2>🤖 Automatische Games</h2>
   <p className="small">Erzeugt öffentliche Spiele automatisch. Der Zeitplan wird serverseitig alle 5 Minuten geprüft, sofern pg_cron verfügbar ist.</p>
   <label className="adminToggle"><input type="checkbox" checked={!!autoGame.enabled} onChange={e=>setAuto('enabled',e.target.checked)}/> automatische Erstellung aktiv</label>
   <div className="adminGrid">
    <Field label="Alle X Minuten" value={autoGame.interval_minutes} onChange={v=>setAuto('interval_minutes',v)}/>
    <Field label="Namenspräfix" type="text" value={autoGame.name_prefix} onChange={v=>setAuto('name_prefix',v)}/>
    <Field label="Kartenfelder" value={autoGame.field_count} onChange={v=>setAuto('field_count',v)}/>
    <Field label="Feldkante (m)" step="1" value={autoGame.cell_size_m} onChange={v=>setAuto('cell_size_m',v)}/>
    <Field label="Max. Spieler" value={autoGame.max_players} onChange={v=>setAuto('max_players',v)}/>
    <Field label="Zug alle (s)" value={autoGame.regen_seconds} onChange={v=>setAuto('regen_seconds',v)}/>
    <Field label="Zugspeicher" value={autoGame.max_stored_moves} onChange={v=>setAuto('max_stored_moves',v)}/>
    <Field label="Schatzteile" value={autoGame.treasure_count} onChange={v=>setAuto('treasure_count',v)}/>
    <Field label="Gimmicks (%)" step="0.01" value={autoGame.gimmick_percent} onChange={v=>setAuto('gimmick_percent',v)}/>
    <MgField label="Goldgame-Einsatz (mg)" valueUg={autoGame.entry_gold_ug} onChangeUg={v=>setAuto('entry_gold_ug',v)}/>
   </div>
   <div className="autoGameSelects">
    <label>Spieltyp<select className="input" value={autoGame.game_type||'standard'} onChange={e=>setAuto('game_type',e.target.value)}><option value="standard">Schatzsuche</option><option value="pay">Goldgame</option></select></label>
    <label>Ort<select className="input" value={autoGame.location_mode||'random'} onChange={e=>setAuto('location_mode',e.target.value)}><option value="random">🌍 Zufallsort global</option><option value="coords">📍 Feste Koordinaten</option></select></label>
   </div>
   {autoGame.location_mode==='coords'&&<div className="adminGrid">
    <Field label="Breitengrad" step="0.000001" value={autoGame.center_lat} onChange={v=>setAuto('center_lat',v)}/>
    <Field label="Längengrad" step="0.000001" value={autoGame.center_lon} onChange={v=>setAuto('center_lon',v)}/>
    <Field label="Ortsname" type="text" value={autoGame.center_label||''} onChange={v=>setAuto('center_label',v)}/>
   </div>}
   <div className="adminReadOnly">
    <span>Nächster geplanter Lauf: <b>{autoGame.next_run_at?new Date(autoGame.next_run_at).toLocaleString('de-DE'):'–'}</b></span>
   </div>
   <div className="winnerActions">
    <button className="btn" onClick={saveAutoGame} disabled={saving}>Auto-Game Einstellungen speichern</button>
    <button className="btn primary" onClick={generateAutoGameNow} disabled={saving}>Jetzt Game erzeugen</button>
   </div>
  </section>}

  <details className="panel adminCollapsible" id="admin-tech">
   <summary><span>🧠 Technologien</span><span className="small">{techs.length} Einträge</span></summary>
   <div className="adminCollapsibleBody">
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
       <Field label="Maschinenfelder pro Takt" value={t.machine_auto_fields||0} onChange={v=>setTech(t.id,'machine_auto_fields',v)}/>
       <label className="adminCheck"><input type="checkbox" checked={!!t.exclusive_per_game} onChange={e=>setTech(t.id,'exclusive_per_game',e.target.checked)}/> Exklusiv pro Game</label>
       <Field label="Fallentyp (leer = keine)" type="text" value={t.trap_type||''} onChange={v=>setTech(t.id,'trap_type',v)}/>
       <Field label="Fallenstärke" step="0.1" value={t.trap_power||0} onChange={v=>setTech(t.id,'trap_power',v)}/>
       <Field label="Max. aktive Fallen" value={t.trap_limit||0} onChange={v=>setTech(t.id,'trap_limit',v)}/>
       <Field label="Sortierung" value={t.sort_order} onChange={v=>setTech(t.id,'sort_order',v)}/>
       <div className="adminField span2"><label>Voraussetzungen (IDs mit Komma)</label><input className="input" value={(t.requires||[]).join(', ')} onChange={e=>setTech(t.id,'requires',e.target.value.split(',').map(x=>x.trim()).filter(Boolean))}/></div>
       <div className="adminField span2"><label>Beschreibung im Spiel</label><textarea className="input adminTextarea" value={t.description||''} onChange={e=>setTech(t.id,'description',e.target.value)} maxLength={250}/></div>
      </div>
      <button className="btn" onClick={()=>saveTech(t)} disabled={saving}>Diese Technologie speichern</button>
    </div>)}
   </div>
   </div>
  </details>
 </main>
}

function Field({label,value,onChange,type='number',step='1'}){
 return <div className="adminField">
  <label>{label}</label>
  <input className="input" type={type} step={type==='number'?step:undefined} value={value??''} onChange={e=>onChange(e.target.value)}/>
 </div>
}

function MgField({label,valueUg,onChangeUg}){
 return <div className="adminField">
  <label>{label}</label>
  <input className="input" type="number" step="0.001"
    value={Number.isFinite(Number(valueUg))?ugToGoldMg(valueUg):''}
    onChange={e=>onChangeUg(Math.round(Number(e.target.value||0)*1000))}/>
 </div>
}
