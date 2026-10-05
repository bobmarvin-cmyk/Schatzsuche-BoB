'use client'
import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase-browser'
import {formatGold,ugToGoldMg} from '../../lib/gold'

const NUM=(v)=>v===''?0:Number(v)


const RELEASE_NEWS_TEMPLATES=[
 {
  id:'v6531',
  title:'Update V6.53.1.1 – Bot-Feldsuche repariert',
  kind:'change',
  body:`Hotfix V6.53.1.1:

• Die Bot-Simulation konnte Züge verbrauchen, obwohl 0 Felder geöffnet wurden.
• Die Feldsuche nutzt jetzt ein deterministisches Rasterfenster statt nur Zufallsstichproben.
• Wenn kein Feld geöffnet wird, wird keine virtuelle Bot-Zeit mehr verbraucht.
• Die Diagnose zeigt zusätzlich Kandidaten-, Terrain- und bereits belegte Felder über den Fehlertext.`
 },

 {
  id:'v653',
  title:'Update V6.53.1 – neue Bot-Simulationsengine',
  kind:'change',
  body:`Neu in V6.53.1:

• Computer-Mitspieler sind nicht mehr von ihrem moves_left-Zähler abhängig.
• Ihre Aktionen werden aus der vergangenen Zeit und der effektiven Zugzeit berechnet.
• Neue Bots starten sofort mit einem vollen virtuellen Zugspeicher.
• Solange echte Spieler aktiv sind, wird die Runde alle zwei Sekunden fortgeschrieben.
• Ein Server-Lock verhindert doppelte Bot-Aktionen bei mehreren gleichzeitig geöffneten Spielern.
• Die Schaltzentrale zeigt pro Bot letzte Simulation, berechnete Züge und geöffnete Felder.`
 },

 {
  id:'v6521',
  title:'Update V6.53.1.1 – Bot-Zugversorgung korrigiert',
  kind:'change',
  body:`Hotfix V6.53.1.1:

• Neue Computer-Mitspieler starten jetzt mit gefülltem Zugspeicher statt praktisch nur einem Zug.
• Bestehende aktive Bots werden beim Update ebenfalls auf den normalen Runden-Zugspeicher aufgefüllt.
• Danach gelten wieder die normalen Zugzeiten und Technologieboni.
• Die Schaltzentrale zeigt eine Laufzeit-Diagnose mit Zügen, Such-Power, Feldern, Techs und Fehlern.`
 },

 {
  id:'v652',
  title:'Update V6.53.1 – schnellere Computer-Mitspieler',
  kind:'change',
  body:`Neu in V6.53.1:

• Computer-Mitspieler verarbeiten ihre verfügbaren Züge jetzt in einer gemeinsamen Serveroperation statt Zug für Zug.
• Dadurch werden große Mengen Felder deutlich effizienter aufgedeckt.
• Ein Sicherheitsdeckel begrenzt nur extreme Feldmengen; übrige Züge folgen im nächsten Tick.
• Die Aktivitätsanzeige über der Karte wurde entfernt.
• Zielgebiete, echte Züge, Technologien, Terrain und gemeinsame Siegerlogik bleiben erhalten.`
 },

 {
  id:'v651',
  title:'Update V6.53.1 – flüssigere Mitspieler',
  kind:'change',
  body:`Neu in V6.53.1:

• Computer-Mitspieler verarbeiten ihre echten Züge jetzt in kleinen Batches im Sekundentakt.
• Dadurch reagieren sie deutlich flüssiger, ohne große Datenbankabfragen zu erzeugen.
• Jeder Mitspieler behält ein Zielgebiet und sucht dort mehrere Züge weiter, statt bei jedem Zug zufällig über die ganze Karte zu springen.
• Die Bot-Verwaltung kann Icons bequem wechseln.
• Nicht mehr benötigte Bots können entfernt werden; vorhandene Spielhistorie bleibt dabei erhalten.`
 },

 {
  id:'v650',
  title:'Update V6.53.1 – neue Mitspieler-Architektur',
  kind:'change',
  body:`Neu in V6.53.1:

• Computer-Mitspieler besitzen jetzt echte Züge und regenerieren sie wie normale Spieler.
• Sobald echte Spieler aktiv sind, spielen sie alle verfügbaren Züge aus.
• Sie kaufen automatisch alle aktuell möglichen Technologien.
• Schatzteile werden nur noch durch tatsächlich aufgedeckte Felder gefunden und erscheinen sichtbar auf der Karte.
• Menschliche und Computer-Spieler laufen durch eine gemeinsame Siegerwertung.
• Der Fehler, bei dem ein Spieler mit 0,00 % gewinnen konnte, obwohl Mitspieler Schatzanteile hatten, wurde behoben.
• Ohne echte Spieler laufen Computer-Mitspieler nur im einstellbaren Sparmodus.`
 },

 {
  id:'v649',
  title:'Update V6.53.1 – kompaktere News & stärkere Gegner',
  kind:'change',
  body:`Neu in V6.53.1:

• In der Lobby heißt der Bereich jetzt nur noch „News“.
• Nur die zwei neuesten Meldungen sind direkt sichtbar; ältere News lassen sich platzsparend aufklappen.
• Der Zugzähler wird nach einem Aufdecken sofort mit dem Serverstand synchronisiert.
• Computer-Mitspieler erhalten einen neuen Konkurrenzdruck: Liegen sie hinter echten Spielern zurück, bekommen sie automatisch einen Aufhol-Boost.
• Auch der Technologie-Rückstand wird berücksichtigt und aggressiver nachentwickelt.`
 },
 {
  id:'v648',
  title:'Update V6.53.1 – kompakte News & mehr Bot-Power',
  kind:'change',
  body:`Änderungen aus V6.53.1:

• Lobby-News wurden kompakter gestaltet.
• Vollgas-Ratio, Such-Power und maximale Felder/Aktion wurden deutlich erweitert.
• Neue Einstellung „Vollgas-Aktionen pro Zug“ für stärkere Computer-Mitspieler.`
 },
 {
  id:'v647',
  title:'Update V6.47 – Vollgas bei aktiven Spielern',
  kind:'change',
  body:`Änderungen aus V6.47:

• Felder/min dient nur noch als Anzeige.
• Ohne echte Spieler laufen Computer-Mitspieler im Minimalbetrieb.
• Sobald ein echter Spieler aktiv ist, wechseln sie sofort in den Vollgas-Modus.
• Tutorial-Fix für die nicht vorhandene password_hash-Spalte.`
 },

 {
  id:'v646',
  title:'Update V6.53.1 – Tutorial, stärkere Mitspieler & Startbonus',
  kind:'change',
  body:`Neu in V6.53.1:

• Tutorial-Erstellung robuster gemacht und den gen_salt/pgcrypto-Fehler abgefangen.
• Computer-Mitspieler reagieren stärker auf aktive Spiele und erhalten mehr Such-Power.
• Adaptive Aktivität orientiert sich weiterhin an Felder/min.
• Autogames können Zufallsnamen aus dem Namenspool erhalten.
• Spielernamen sind an weiteren Stellen direkt mit dem Profil verlinkt.
• Startgold ist jetzt ein Startbonus: Es kann im System genutzt werden, wird aber vor der ersten physischen Auszahlung einmalig zurückgeführt.

Viel Spaß bei der Schatzsuche!`
 },
 {
  id:'v645',
  title:'Update V6.53.1 – Tutorial-Fix & mehr Gegner-Power',
  kind:'change',
  body:`Änderungen aus V6.53.1:

• Tutorial-Fix für den Fehler „gen_salt does not exist“.
• Tutorial-Runde wird ohne Passwortpfad erzeugt und anschließend privat geschaltet.
• Computer-Mitspieler erhalten mehr Grundtempo, höheres Maximaltempo und einen Such-Power-Multiplikator.
• Aktivitäts-Boost für lebendigere Runden.
• Bis zu zwei Technologien können pro Bot-Aktivität automatisch ausgebaut werden.`
 },
 {
  id:'v644',
  title:'Update V6.44 – Adaptive Aktivität & Autogame-Namen',
  kind:'change',
  body:`Änderungen aus V6.44:

• Neuer Aktivitätswert „Felder/min je Spieler“.
• Computer-Mitspieler passen ihr Tempo an die Aktivität echter Spieler an.
• Grundtempo und Maximaltempo sind in der Schaltzentrale einstellbar.
• Autogames können optional Zufallsnamen aus dem Namenspool erhalten.
• Fehlende Profil-Links im Ingame-Ranking wurden ergänzt.`
 },
 {
  id:'v643',
  title:'Update V6.43 – echtes Tutorial & Spielerprofile',
  kind:'change',
  body:`Änderungen aus V6.43:

• Jeder Computer-Mitspieler kann nur noch in einem laufenden Spiel gleichzeitig aktiv sein.
• Individuelle Aktionszeitpunkte sorgen für weniger starres Verhalten.
• Neues echtes Tutorial-Spiel mit kleiner Karte und erklärenden Hinweisen.
• Spielernamen wurden an vielen Stellen als Profil-Link ausgebaut.
• Zusätzliche Mitspieler-Profile für parallele Schatzsuchen.`
 }
]

export default function Admin(){
 const [allowed,setAllowed]=useState(null)
 const [settings,setSettings]=useState(null)
 const [techs,setTechs]=useState([])
 const [goldOverview,setGoldOverview]=useState(null)
 const [autoGame,setAutoGame]=useState(null)
 const [adminGames,setAdminGames]=useState([])
 const [geoGameId,setGeoGameId]=useState('')
 const [geoX,setGeoX]=useState('0')
 const [geoY,setGeoY]=useState('0')
 const [geoResult,setGeoResult]=useState(null)
 const [treasureProfiles,setTreasureProfiles]=useState([])
 const [barOverview,setBarOverview]=useState(null)
 const [barSizesText,setBarSizesText]=useState('')
 const [members,setMembers]=useState([])
 const [memberSearch,setMemberSearch]=useState('')
 const [selectedMember,setSelectedMember]=useState(null)
 const [memberDraft,setMemberDraft]=useState(null)
 const [memberGames,setMemberGames]=useState([])
 const [passwordDraft,setPasswordDraft]=useState('')
 const [msg,setMsg]=useState('')
 const [saving,setSaving]=useState(false)
 const [namePoolLeft,setNamePoolLeft]=useState('')
 const [namePoolRight,setNamePoolRight]=useState('')
 const [claimStats,setClaimStats]=useState(null)
 const [newsPosts,setNewsPosts]=useState([])
 const [newsTitle,setNewsTitle]=useState('')
 const [newsBody,setNewsBody]=useState('')
 const [newsKind,setNewsKind]=useState('news')
 const [newsPinned,setNewsPinned]=useState(false)
 const [botConfig,setBotConfig]=useState(null)
 const [botRuntime,setBotRuntime]=useState([])
 const [newBotName,setNewBotName]=useState('')
 const [newBotIcon,setNewBotIcon]=useState('🤖')
 const [newBotDifficulty,setNewBotDifficulty]=useState('normal')

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
  const [{data:s,error:se},{data:t,error:te},{data:go,error:ge},{data:ag,error:ae},{data:games,error:gameErr},{data:bars},{data:namePool,error:namePoolErr}]=await Promise.all([
    supabase.from('platform_settings').select('*').eq('id',1).single(),
    supabase.from('technologies').select('*').order('sort_order',{ascending:true}).order('id',{ascending:true}),
    supabase.rpc('admin_gold_overview_v613'),
    supabase.rpc('admin_get_auto_game_config_v6141'),
    supabase.rpc('admin_list_games_v615',{p_limit:200}),
    supabase.rpc('admin_gold_bars_overview_v6211'),
    supabase.rpc('list_game_name_parts_v625')
  ])
  if(se||te||ge||ae||gameErr||namePoolErr){setMsg(se?.message||te?.message||ge?.message||ae?.message||gameErr?.message||namePoolErr?.message||'Fehler beim Laden');return}
  setSettings(s);setTechs(t||[]);setGoldOverview(go||null);setAutoGame(ag||null);setAdminGames(games||[]);setBarOverview(bars||null)
  const {data:cs}=await supabase.rpc('admin_treasure_claim_stats_v630')
  setClaimStats(cs||null)
  const {data:newsData}=await supabase.rpc('get_lobby_news_v632',{p_limit:50})
  setNewsPosts(Array.isArray(newsData)?newsData:[])
  const {data:botData}=await supabase.rpc('admin_get_bot_config_v651')
  setBotConfig(botData||null)
  const {data:runtimeData}=await supabase.rpc('admin_bot_runtime_v653')
  setBotRuntime(Array.isArray(runtimeData)?runtimeData:[])
  setBarSizesText((s?.allowed_bar_sizes_mg||[100,250,500,1000,2500,5000]).join(', '))
  setGeoGameId(current=>current||games?.[0]?.id||'')
  setNamePoolLeft((namePool?.left||[]).join('\n'))
  setNamePoolRight((namePool?.right||[]).join('\n'))
  await loadMembers(memberSearch)
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

 async function saveEndgameSettings(){
  setSaving(true);setMsg('')
  const {data,error}=await supabase.rpc('admin_set_endgame_settings_v630',{
    p_reveal_start_cost:NUM(settings.endgame_reveal_start_cost??40),
    p_reveal_price_factor:NUM(settings.endgame_reveal_price_factor??1.35),
    p_reveal_bonus:NUM(settings.endgame_reveal_bonus??100),
    p_machine_start_cost:NUM(settings.endgame_machine_start_cost??25),
    p_machine_price_factor:NUM(settings.endgame_machine_price_factor??1.35),
    p_machine_bonus:NUM(settings.endgame_machine_bonus??250)
  })
  setSaving(false)
  setMsg(error?error.message:(data?.message||'Endgame-Ausbauwerte gespeichert.'))
  if(!error)await load()
 }

 async function saveJobSettings(){
  setSaving(true);setMsg('')
  const {data,error}=await supabase.rpc('admin_set_job_settings_v6252',{
    p_bottles_duration_seconds:NUM(settings.job_bottles_duration_seconds??180),
    p_bottles_reward_taler:NUM(settings.job_bottles_reward_taler??1),
    p_scrap_duration_seconds:NUM(settings.job_scrap_duration_seconds??900),
    p_scrap_reward_taler:NUM(settings.job_scrap_reward_taler??7)
  })
  setSaving(false)
  setMsg(error?error.message:(data?.message||'Jobwerte gespeichert.'))
  if(!error)await load()
 }

 async function saveNamePool(){
  const left=namePoolLeft.split(/\n|,/).map(x=>x.trim()).filter(Boolean)
  const right=namePoolRight.split(/\n|,/).map(x=>x.trim()).filter(Boolean)
  setSaving(true);setMsg('')
  const {data,error}=await supabase.rpc('admin_replace_game_name_pool_v625',{
    p_left:left,p_right:right
  })
  setSaving(false)
  setMsg(error?error.message:'Namenspool gespeichert.')
  if(!error&&data){
    setNamePoolLeft((data.left||[]).join('\n'))
    setNamePoolRight((data.right||[]).join('\n'))
  }
 }

 function setAuto(key,value){setAutoGame(a=>({...a,[key]:value}))}
 async function saveAutoGame(){
  setSaving(true);setMsg('')
  const payload={
    enabled:!!autoGame.enabled,
    random_names:!!autoGame.random_names,
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
  const {data,error}=await supabase.rpc('admin_save_auto_game_config_v644',{p:payload})
  setSaving(false);setMsg(error?error.message:(data?.message||'Auto-Game gespeichert'))
  if(!error)await load()
 }
 async function generateAutoGameNow(){
  setSaving(true);setMsg('Erzeuge Auto-Game…')
  const {data,error}=await supabase.rpc('admin_generate_auto_game_v644')
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

 async function analyzeGeoField(){
  if(!geoGameId)return
  setSaving(true);setMsg('')
  const [{data:field,error:fe},{data:profiles,error:pe}]=await Promise.all([
    supabase.rpc('admin_analyze_field_v6211',{
      p_game_id:geoGameId,p_x:NUM(geoX),p_y:NUM(geoY)
    }),
    supabase.rpc('admin_get_treasure_profiles_v6211',{p_game_id:geoGameId})
  ])
  setSaving(false)
  if(fe||pe){setMsg(fe?.message||pe?.message||'Analyse fehlgeschlagen');return}
  setGeoResult(field||null)
  setTreasureProfiles(profiles||[])
 }

 async function saveSmelter(){
  const sizes=barSizesText.split(',')
    .map(v=>Number(v.trim()))
    .filter(v=>Number.isFinite(v)&&v>0)
  setSaving(true);setMsg('')
  const {data,error}=await supabase.rpc('admin_set_smelter_settings_v6211',{
    p_smelting_enabled:!!settings.smelting_enabled,
    p_redemptions_enabled:!!settings.redemptions_enabled,
    p_allowed_sizes_mg:sizes
  })
  setSaving(false)
  setMsg(error?error.message:(data?.message||'Schmelze gespeichert'))
  if(!error)await load()
 }

 async function loadMembers(search=memberSearch){
  const {data,error}=await supabase.rpc('admin_list_members_v6234',{p_search:search||''})
  if(error){setMsg('Mitglieder: '+error.message);return}
  setMembers(data||[])
  if(selectedMember){
    const fresh=(data||[]).find(m=>m.id===selectedMember.id)
    if(fresh){
      setSelectedMember(fresh)
      setMemberDraft({...fresh})
    }
  }
 }

 async function selectMember(member){
  setSelectedMember(member)
  setMemberDraft({...member})
  setPasswordDraft('')
  const {data,error}=await supabase.rpc('admin_get_member_games_v6234',{p_user_id:member.id})
  if(error){setMsg('Spielwerte: '+error.message);setMemberGames([]);return}
  setMemberGames(data||[])
 }

 function setMemberValue(key,value){
  setMemberDraft(m=>({...m,[key]:value}))
 }

 async function saveMember(){
  if(!memberDraft)return
  setSaving(true);setMsg('')
  const {data,error}=await supabase.rpc('admin_update_member_v6234',{
    p_user_id:memberDraft.id,
    p_display_name:memberDraft.display_name||'Spieler',
    p_bio:memberDraft.bio||'',
    p_wins:NUM(memberDraft.wins),
    p_total_games:NUM(memberDraft.total_games),
    p_total_fields_revealed:NUM(memberDraft.total_fields_revealed),
    p_gold_found_ug:NUM(memberDraft.gold_found_ug),
    p_wallet_ug:NUM(memberDraft.wallet_ug)
  })
  setSaving(false)
  setMsg(error?error.message:(data?.message||'Mitglied gespeichert'))
  if(!error)await loadMembers(memberSearch)
 }

 function setMemberGame(gameId,key,value){
  setMemberGames(list=>list.map(g=>g.game_id===gameId?{...g,[key]:value}:g))
 }

 async function saveMemberGame(g){
  setSaving(true);setMsg('')
  const {data,error}=await supabase.rpc('admin_update_member_game_v6234',{
    p_user_id:selectedMember.id,
    p_game_id:g.game_id,
    p_coins:NUM(g.coins),
    p_moves_left:NUM(g.moves_left)
  })
  setSaving(false)
  setMsg(error?error.message:(data?.message||'Spielwerte gespeichert'))
  if(!error)await selectMember(selectedMember)
 }

 async function setMemberPassword(){
  if(!selectedMember||passwordDraft.length<8)return
  setSaving(true);setMsg('')
  try{
    const {data:{session}}=await supabase.auth.getSession()
    const res=await fetch('/api/admin/member-password',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        Authorization:`Bearer ${session?.access_token||''}`
      },
      body:JSON.stringify({
        user_id:selectedMember.id,
        password:passwordDraft
      })
    })
    const body=await res.json()
    if(!res.ok)throw new Error(body?.error||'Passwort konnte nicht gesetzt werden')
    setPasswordDraft('')
    setMsg(body?.message||'Neues Passwort wurde gesetzt.')
  }catch(err){
    setMsg(err?.message||'Passwort konnte nicht gesetzt werden')
  }finally{
    setSaving(false)
  }
 }

 function applyNewsTemplate(t){
  setNewsTitle(t.title||'')
  setNewsBody(t.body||'')
  setNewsKind(t.kind||'change')
  setNewsPinned(false)
 }

 async function publishNews(){
  if(!newsTitle.trim()||!newsBody.trim()){
    setMsg('Titel und Text für die Ankündigung fehlen.')
    return
  }
  setSaving(true);setMsg('')
  const {data,error}=await supabase.rpc('admin_publish_news_v632',{
    p_title:newsTitle,
    p_body:newsBody,
    p_kind:newsKind,
    p_is_pinned:newsPinned
  })
  setSaving(false)
  if(error){setMsg(error.message);return}
  setNewsTitle('');setNewsBody('');setNewsPinned(false)
  setMsg(data?.message||'Ankündigung veröffentlicht.')
  await load()
 }

 async function deleteNews(id){
  if(!confirm('Ankündigung wirklich löschen?'))return
  setSaving(true)
  const {data,error}=await supabase.rpc('admin_delete_news_v632',{p_id:id})
  setSaving(false)
  setMsg(error?error.message:(data?.message||'Ankündigung gelöscht.'))
  if(!error)await load()
 }

 function setBotSetting(key,value){
  setBotConfig(c=>({...c,settings:{...(c?.settings||{}),[key]:value}}))
 }
 function setBotValue(id,key,value){
  setBotConfig(c=>({...c,bots:(c?.bots||[]).map(b=>b.id===id?{...b,[key]:value}:b)}))
 }

 async function saveBotSettings(){
  if(!botConfig?.settings)return
  setSaving(true);setMsg('')
  const s=botConfig.settings
  const {data,error}=await supabase.rpc('admin_save_bot_settings_v653',{
    p_enabled:!!s.enabled,
    p_bots_per_auto_game:NUM(s.bots_per_auto_game),
    p_active_percent:NUM(s.simulation_active_percent??100),
    p_idle_percent:NUM(s.simulation_idle_percent??10),
    p_max_moves_per_run:NUM(s.simulation_max_moves_per_run??40),
    p_max_fields_per_run:NUM(s.simulation_max_fields_per_run??8000),
    p_base_solve_percent:NUM(s.base_solve_percent),
    p_use_real_average:!!s.use_real_average
  })
  setSaving(false)
  setMsg(error?error.message:(data?.message||'Bot-Einstellungen gespeichert.'))
  if(!error)await load()
 }

 async function addBot(){
  if(!newBotName.trim())return
  setSaving(true);setMsg('')
  const {data,error}=await supabase.rpc('admin_add_bot_v640',{
    p_name:newBotName.trim(),
    p_icon:newBotIcon||'🤖',
    p_difficulty:newBotDifficulty
  })
  setSaving(false)
  setMsg(error?error.message:(data?.message||'Bot angelegt.'))
  if(!error){setNewBotName('');setNewBotIcon('🤖');await load()}
 }

 async function saveBot(bot){
  setSaving(true);setMsg('')
  const {data,error}=await supabase.rpc('admin_update_bot_v640',{
    p_bot_id:bot.id,
    p_name:bot.display_name,
    p_icon:bot.avatar_emoji||'🤖',
    p_active:!!bot.active,
    p_difficulty:bot.difficulty||'normal',
    p_color:bot.player_color||'#6f86a8'
  })
  setSaving(false)
  setMsg(error?error.message:(data?.message||'Bot gespeichert.'))
  if(!error)await load()
 }

 async function deleteBot(bot){
  if(!confirm(`Bot „${bot.display_name}“ wirklich entfernen?\n\nBei vorhandener Historie wird er archiviert, damit alte Spiele korrekt bleiben.`))return
  setSaving(true);setMsg('')
  const {data,error}=await supabase.rpc('admin_delete_bot_v651',{p_bot_id:bot.id})
  setSaving(false)
  setMsg(error?error.message:(data?.message||'Bot entfernt.'))
  if(!error)await load()
 }

 const BOT_ICONS=['🤖','🧭','✨','☄️','👾','🦊','🐺','🦉','🦝','🛰️','🦜','🐾','🌙','⭐','🪐','🌿']

 async function seedBots(gameId){
  setSaving(true);setMsg('')
  const {data,error}=await supabase.rpc('admin_seed_bots_v639',{p_game_id:gameId})
  setSaving(false)
  setMsg(error?error.message:(data?.message||'Bots hinzugefügt.'))
  if(!error)await load()
 }

 async function setGameBots(gameId,blocked){
  setSaving(true);setMsg('')
  const {data,error}=await supabase.rpc('admin_set_game_bots_v640',{
    p_game_id:gameId,
    p_blocked:!!blocked
  })
  setSaving(false)
  setMsg(error?error.message:(data?.message||'Bot-Einstellung gespeichert.'))
  if(!error)await load()
 }

 async function saveTech(t){
  setSaving(true);setMsg('')
  const {data,error}=await supabase.rpc('admin_update_technology_v624',{
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
    p_trap_place_cost:NUM(t.trap_place_cost),
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

 return <main className="container adminPage"><div className="buildBadge">V6.53.1</div>
  <div className="topnav"><a className="btn" href="/lobby">← Lobby</a><button className="btn" onClick={load}>↻ Neu laden</button></div>

  <div className="panel adminHero">
   <div><div className="small">SPIELLEITUNG</div><h1>🎛️ Schaltzentrale</h1><p className="muted">Zentrale Masterwerte für Spiel, Ökonomie, Lebenszyklus und Technologien.</p></div>
   <div className="adminStatus">SERVERSEITIG</div>
  </div>

  {msg&&<div className="noticeBar">{msg}</div>}
  <nav className="adminJumpNav">
   <a href="#admin-news">📰 News</a><a href="#admin-members">👥 Mitglieder</a><a href="#admin-jobs">🧰 Jobs & Namen</a><a href="#admin-games">🎮 Spiele</a><a href="#admin-geo">🌍 Geodaten</a><a href="#admin-auto">🤖 Auto</a><a href="#admin-bots">🤖 Bots</a><a href="#admin-economy">✨ Gold</a><a href="#admin-rules">⚙️ Regeln</a><a href="#admin-claims">📊 Schatzsicherung</a><a href="#admin-tech">🧠 Technologien</a>
  </nav>

  <section className="panel" id="admin-news">
   <div className="sectionTitleRow">
    <div><h2>📰 Lobby-News</h2><p className="small">Ankündigungen, Änderungen, Wartungen oder Events direkt in der Lobby veröffentlichen.</p></div>
   </div>
   <div className="newsTemplateBox">
    <div className="small"><strong>Vorlagen aus den letzten Releases</strong> · übernehmen und anschließend frei bearbeiten.</div>
    <div className="newsTemplateButtons">
     {RELEASE_NEWS_TEMPLATES.map(t=><button type="button" className="miniBtn" key={t.id} onClick={()=>applyNewsTemplate(t)}>{t.id.toUpperCase()} übernehmen</button>)}
    </div>
   </div>
   <div className="adminGrid">
    <Field label="Titel" type="text" value={newsTitle} onChange={setNewsTitle}/>
    <label className="adminField"><span>Kategorie</span><select className="input" value={newsKind} onChange={e=>setNewsKind(e.target.value)}>
     <option value="news">News</option><option value="change">Änderung</option><option value="maintenance">Wartung</option><option value="event">Event</option>
    </select></label>
    <label className="adminCheck"><input type="checkbox" checked={newsPinned} onChange={e=>setNewsPinned(e.target.checked)}/> Oben anheften</label>
    <div className="adminField span2"><label>Text</label><textarea className="input adminTextarea" maxLength={4000} value={newsBody} onChange={e=>setNewsBody(e.target.value)}/></div>
   </div>
   <button className="btn primary" disabled={saving||!newsTitle.trim()||!newsBody.trim()} onClick={publishNews}>Veröffentlichen</button>
   {newsPosts.length>0&&<div className="adminNewsList">
    {newsPosts.map(n=><div className="adminNewsItem" key={n.id}>
     <div><strong>{n.is_pinned?'📌 ':''}{n.title}</strong><span className="small">{n.kind} · {n.created_at?new Date(n.created_at).toLocaleString('de-DE'):'–'}</span><p>{n.body}</p></div>
     <button className="miniBtn" onClick={()=>deleteNews(n.id)}>Löschen</button>
    </div>)}
   </div>}
  </section>

  <section className="panel" id="admin-jobs">
   <div className="sectionTitleRow">
    <div>
     <h2>🧰 Nebenjobs & Zufallsnamen</h2>
     <p className="small">Notfall-Talerquelle und Namenspool für automatisch vorgeschlagene Spielnamen.</p>
    </div>
   </div>

   <h3>Nebenjobs</h3>
   <div className="adminJobCards">
    <div className="adminJobCard">
     <strong>♻️ Pfandflaschen sammeln</strong>
     <div className="adminGrid">
      <Field label="Dauer (Sekunden)" value={settings.job_bottles_duration_seconds??180} onChange={v=>setSetting('job_bottles_duration_seconds',v)}/>
      <Field label="Lohn (Taler)" step="0.01" value={settings.job_bottles_reward_taler??1} onChange={v=>setSetting('job_bottles_reward_taler',v)}/>
     </div>
    </div>
    <div className="adminJobCard">
     <strong>🔩 Altmetall suchen</strong>
     <div className="adminGrid">
      <Field label="Dauer (Sekunden)" value={settings.job_scrap_duration_seconds??900} onChange={v=>setSetting('job_scrap_duration_seconds',v)}/>
      <Field label="Lohn (Taler)" step="0.01" value={settings.job_scrap_reward_taler??7} onChange={v=>setSetting('job_scrap_reward_taler',v)}/>
     </div>
    </div>
   </div>
   <button className="btn primary" disabled={saving} onClick={saveJobSettings}>Jobwerte speichern</button>

   <h3 style={{marginTop:22}}>Zufallsnamen-Pool</h3>
   <p className="small">Eine Zeile = ein Namensbaustein. Das Spiel kombiniert links + rechts, z. B. „Nebel“ + „Expedition“.</p>
   <div className="gameNamePoolGrid">
    <label className="adminField"><span>Erster Teil</span><textarea className="input" value={namePoolLeft} onChange={e=>setNamePoolLeft(e.target.value)}/></label>
    <label className="adminField"><span>Zweiter Teil</span><textarea className="input" value={namePoolRight} onChange={e=>setNamePoolRight(e.target.value)}/></label>
   </div>
   <button className="btn primary" disabled={saving} onClick={saveNamePool}>Namenspool speichern</button>
  </section>

  <section className="panel" id="admin-members">
   <div className="sectionTitleRow">
    <div>
     <h2>👥 Mitgliederverwaltung</h2>
     <p className="small">Profile, Statistik, Gold und laufende Spielwerte bearbeiten. Bestehende Passwörter sind aus Sicherheitsgründen niemals sichtbar.</p>
    </div>
   </div>

   <div className="memberAdminLayout">
    <div className="memberListPane">
     <div className="memberSearchRow">
      <input className="input" type="search" value={memberSearch} placeholder="Name oder E-Mail suchen"
       onChange={e=>setMemberSearch(e.target.value)}
       onKeyDown={e=>{if(e.key==='Enter')loadMembers(memberSearch)}}/>
      <button className="btn" onClick={()=>loadMembers(memberSearch)}>Suchen</button>
     </div>
     <div className="memberAdminList">
      {members.map(m=><button type="button" key={m.id}
       className={'memberAdminRow '+(selectedMember?.id===m.id?'active':'')}
       onClick={()=>selectMember(m)}>
       <div>
        <strong>{m.display_name||'Spieler'} {m.is_admin?'🛡️':''}</strong>
        <span>{m.email||'keine E-Mail'}</span>
       </div>
       <div className="memberMiniStats">
        <span>{m.wins} Siege</span>
        <span>{formatGold(m.wallet_ug||0)}</span>
       </div>
      </button>)}
      {members.length===0&&<div className="muted">Keine Mitglieder gefunden.</div>}
     </div>
    </div>

    <div className="memberEditorPane">
     {!memberDraft?<div className="muted">Links ein Mitglied auswählen.</div>:<>
      <div className="memberEditorHead">
       <div>
        <h3>{memberDraft.display_name||'Spieler'}</h3>
        <div className="small">{memberDraft.email}</div>
        <div className="small mono">{memberDraft.id}</div>
       </div>
       {memberDraft.is_admin&&<span className="adminStatus">ADMIN</span>}
      </div>

      <div className="adminGrid">
       <Field label="Anzeigename" type="text" value={memberDraft.display_name} onChange={v=>setMemberValue('display_name',v)}/>
       <Field label="Siege" value={memberDraft.wins} onChange={v=>setMemberValue('wins',v)}/>
       <Field label="Spiele gesamt" value={memberDraft.total_games} onChange={v=>setMemberValue('total_games',v)}/>
       <Field label="Felder gesamt" value={memberDraft.total_fields_revealed} onChange={v=>setMemberValue('total_fields_revealed',v)}/>
       <MgField label="Gold gefunden (mg)" valueUg={memberDraft.gold_found_ug} onChangeUg={v=>setMemberValue('gold_found_ug',v)}/>
       <MgField label="Wallet-Gold (mg)" valueUg={memberDraft.wallet_ug} onChangeUg={v=>setMemberValue('wallet_ug',v)}/>
       <div className="adminField span2">
        <label>Bio</label>
        <textarea className="input adminTextarea" maxLength={500} value={memberDraft.bio||''} onChange={e=>setMemberValue('bio',e.target.value)}/>
       </div>
      </div>
      <button className="btn primary" disabled={saving} onClick={saveMember}>Mitglied speichern</button>

      <div className="memberPasswordBox">
       <h4>🔐 Neues Passwort vergeben</h4>
       <p className="small">Das alte Passwort kann nicht angezeigt werden. Hier setzt du stattdessen ein neues.</p>
       <div className="memberPasswordRow">
        <input className="input" type="password" autoComplete="new-password" minLength={8}
         placeholder="Neues Passwort · mindestens 8 Zeichen"
         value={passwordDraft} onChange={e=>setPasswordDraft(e.target.value)}/>
        <button className="btn" disabled={saving||passwordDraft.length<8} onClick={setMemberPassword}>Passwort setzen</button>
       </div>
      </div>

      <div className="memberGameAdmin">
       <h4>🎮 Spielwerte</h4>
       {memberGames.length===0?<div className="muted small">Noch keine Spielteilnahmen.</div>:
        <div className="memberGameList">{memberGames.map(g=><div className="card memberGameCard" key={g.game_id}>
         <div className="memberGameHead">
          <strong>{g.game_name}</strong><span className="small">{g.status}</span>
         </div>
         <div className="adminGrid compactAdminGrid">
          <Field label="Taler" step="0.01" value={g.coins} onChange={v=>setMemberGame(g.game_id,'coins',v)}/>
          <Field label="Gespeicherte Züge" value={g.moves_left} onChange={v=>setMemberGame(g.game_id,'moves_left',v)}/>
         </div>
         <div className="small">Felder/Zug: {g.reveal_power} · Analyse-Level: {g.analysis_level} · Züge benutzt: {g.moves_used}</div>
         <button className="miniBtn" disabled={saving} onClick={()=>saveMemberGame(g)}>Spielwerte speichern</button>
        </div>)}</div>}
      </div>
     </>}
    </div>
   </div>
  </section>

  <section className="panel" id="admin-geo">
   <h2>🌍 Geodaten- & Hinweisprüfer</h2>
   <p className="small">Prüft exakt die Hintergrundinformationen, auf denen die Deduktionshinweise beruhen. Nur in der Schaltzentrale werden Schatzdistanzen und Schatzprofile offen gezeigt.</p>
   <div className="adminGrid">
    <label className="adminField"><span>Spiel</span>
     <select className="input" value={geoGameId} onChange={e=>{setGeoGameId(e.target.value);setGeoResult(null);setTreasureProfiles([])}}>
      <option value="">Spiel wählen…</option>
      {adminGames.map(g=><option key={g.id} value={g.id}>{g.name} · {g.status}</option>)}
     </select>
    </label>
    <Field label="Raster X" value={geoX} onChange={setGeoX}/>
    <Field label="Raster Y" value={geoY} onChange={setGeoY}/>
   </div>
   <button className="btn primary" disabled={saving||!geoGameId} onClick={analyzeGeoField}>🔎 Feld & Schatzprofil analysieren</button>

   {geoResult&&<div className="geoInspectorResult">
    <div className="goldOverviewGrid">
     <div className="card"><div className="small">Feld</div><div className="stat">{geoResult.x} / {geoResult.y}</div></div>
     <div className="card"><div className="small">Koordinate</div><div className="stat smallStat">{geoResult.lat}, {geoResult.lon}</div></div>
     <div className="card"><div className="small">Terrain</div><div className="stat smallStat">{geoResult.terrain_label||geoResult.terrain_type}</div></div>
     <div className="card"><div className="small">Erforscht</div><div className="stat">{geoResult.explored?'Ja':'Nein'}</div></div>
     <div className="card"><div className="small">Wasser</div><div className="stat">{geoResult.nearest_water_m==null?'–':Math.round(geoResult.nearest_water_m)+' m'}</div></div>
     <div className="card"><div className="small">Wald</div><div className="stat">{geoResult.nearest_forest_m==null?'–':Math.round(geoResult.nearest_forest_m)+' m'}</div></div>
     <div className="card"><div className="small">Siedlung/Nutzung</div><div className="stat">{geoResult.nearest_urban_m==null?'–':Math.round(geoResult.nearest_urban_m)+' m'}</div></div>
     <div className="card"><div className="small">Verkehr</div><div className="stat">{geoResult.nearest_road_m==null?'–':Math.round(geoResult.nearest_road_m)+' m'}</div></div>
     <div className="card"><div className="small">Nächster offener Schatz</div><div className="stat">{geoResult.nearest_open_treasure_m==null?'–':Math.round(geoResult.nearest_open_treasure_m)+' m'}</div><div className="small">Teil #{geoResult.nearest_open_treasure_no||'–'}</div></div>
     <div className="card"><div className="small">Terrain-Cache</div><div className="stat">{Number(geoResult.cached_terrain_cells||0).toLocaleString('de-DE')}</div></div>
    </div>
   </div>}

   {treasureProfiles.length>0&&<details className="adminProfileList" open>
    <summary>🧩 Server-Schatzprofile ({treasureProfiles.length})</summary>
    <div className="grid">
     {treasureProfiles.map(t=><div className="card" key={t.treasure_id}>
      <strong>Schatz #{t.treasure_no} · X {t.x} / Y {t.y}</strong>
      <div className="small">Sektor: {t.sector} · Quadrant: {t.quadrant}</div>
      <div className="small">Zentrum: {Math.round(Number(t.center_distance_m||0))} m · Rand: {Math.round(Number(t.edge_distance_m||0))} m</div>
      <div className="small">Terrain: {t.terrain_type||'noch unbekannt'}</div>
      <div className="small">Wasser {t.nearest_water_m==null?'–':Math.round(t.nearest_water_m)+' m'} · Wald {t.nearest_forest_m==null?'–':Math.round(t.nearest_forest_m)+' m'}</div>
      <div className="small">Siedlung {t.nearest_urban_m==null?'–':Math.round(t.nearest_urban_m)+' m'} · Verkehr {t.nearest_road_m==null?'–':Math.round(t.nearest_road_m)+' m'}</div>
     </div>)}
    </div>
   </details>}
  </section>

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

   <div className="endgameAdminBox">
    <h3>♾️ Wiederholbarer Endgame-Ausbau</h3>
    <p className="small">Diese Käufe erscheinen für einen Spieler erst, wenn alle aktiven nicht-exklusiven Technologien gekauft wurden.</p>
    <div className="adminGrid">
     <Field label="Erkunden · Startpreis (Taler)" step="0.01" value={settings.endgame_reveal_start_cost??40} onChange={v=>setSetting('endgame_reveal_start_cost',v)}/>
     <Field label="Erkunden · Preisfaktor" step="0.01" value={settings.endgame_reveal_price_factor??1.35} onChange={v=>setSetting('endgame_reveal_price_factor',v)}/>
     <Field label="Erkunden · +Felder je Kauf" value={settings.endgame_reveal_bonus??100} onChange={v=>setSetting('endgame_reveal_bonus',v)}/>
     <Field label="Maschine · Startpreis (Taler)" step="0.01" value={settings.endgame_machine_start_cost??25} onChange={v=>setSetting('endgame_machine_start_cost',v)}/>
     <Field label="Maschine · Preisfaktor" step="0.01" value={settings.endgame_machine_price_factor??1.35} onChange={v=>setSetting('endgame_machine_price_factor',v)}/>
     <Field label="Maschine · +Suchfelder je Kauf" value={settings.endgame_machine_bonus??250} onChange={v=>setSetting('endgame_machine_bonus',v)}/>
    </div>
    <div className="small muted">Formel: nächster Preis = Startpreis × Preisfaktor ^ bisherige Käufe</div>
    <button className="btn primary" disabled={saving} onClick={saveEndgameSettings}>Endgame-Werte speichern</button>
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
   <div className="smelterAdminBox">
    <h3>🔥 Goldbarrenschmelze</h3>
    <div className="adminGrid">
     <label className="adminToggle"><input type="checkbox" checked={!!settings.smelting_enabled} onChange={e=>setSetting('smelting_enabled',e.target.checked)}/><span>Digitale Barren gießen erlauben</span></label>
     <label className="adminToggle"><input type="checkbox" checked={!!settings.redemptions_enabled} onChange={e=>setSetting('redemptions_enabled',e.target.checked)}/><span>Physische Barren-/Prämienausgabe freigeben</span></label>
     <label className="adminField span2"><span>Erlaubte Barrengrößen in mg (Komma getrennt)</span><input className="input" value={barSizesText} onChange={e=>setBarSizesText(e.target.value)}/></label>
    </div>
    <button className="btn" disabled={saving} onClick={saveSmelter}>Schmelze speichern</button>
    {barOverview&&<div className="adminReadOnly smelterStats">
     <span>Digitale Barren: <b>{barOverview.minted_count}</b> · {Number(barOverview.minted_mg||0).toLocaleString('de-DE')} mg</span>
     <span>Ausgabe angefragt: <b>{barOverview.requested_count}</b> · {Number(barOverview.requested_mg||0).toLocaleString('de-DE')} mg</span>
     <span>Ausgegeben: <b>{barOverview.redeemed_count}</b> · {Number(barOverview.redeemed_mg||0).toLocaleString('de-DE')} mg</span>
    </div>}
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
   <label className="adminToggle"><input type="checkbox" checked={!!autoGame.random_names} onChange={e=>setAuto('random_names',e.target.checked)}/> 🎲 für jedes Autogame einen Zufallsnamen aus dem Namenspool verwenden</label>
   <div className="adminGrid">
    <Field label="Alle X Minuten" value={autoGame.interval_minutes} onChange={v=>setAuto('interval_minutes',v)}/>
    <Field label="Namenspräfix (wenn Zufallsnamen aus)" type="text" value={autoGame.name_prefix} onChange={v=>setAuto('name_prefix',v)}/>
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

  {botConfig&&<section className="panel" id="admin-bots">
   <div className="sectionTitleRow">
    <div>
     <h2>🤖 Bots</h2>
     <p className="small">Persistente Mitspieler-Profile für normale Schatzsuchen. Gold- und Sponsorspiele bleiben botfrei.</p>
    </div>
    <span className="adminStatus">Ø Sicherung {Number(botConfig.effective_solve_percent||0).toFixed(1)}%</span>
   </div>

   <label className="adminToggle"><input type="checkbox" checked={!!botConfig.settings?.enabled} onChange={e=>setBotSetting('enabled',e.target.checked)}/> Mitspieler in Schatzsuchen aktiv</label>
   <div className="adminGrid">
    <Field label="Mitspieler je Spiel" value={botConfig.settings?.bots_per_auto_game??3} onChange={v=>setBotSetting('bots_per_auto_game',v)}/>
    <Field label="Aktiv-Leistung (%)" step="5" value={botConfig.settings?.simulation_active_percent??100} onChange={v=>setBotSetting('simulation_active_percent',v)}/>
    <Field label="Sparmodus ohne echte Spieler (%)" step="1" value={botConfig.settings?.simulation_idle_percent??10} onChange={v=>setBotSetting('simulation_idle_percent',v)}/>
    <Field label="Max. virtuelle Züge pro Lauf" value={botConfig.settings?.simulation_max_moves_per_run??40} onChange={v=>setBotSetting('simulation_max_moves_per_run',v)}/>
    <Field label="Max. Felder pro Lauf" value={botConfig.settings?.simulation_max_fields_per_run??8000} onChange={v=>setBotSetting('simulation_max_fields_per_run',v)}/>
    <Field label="Fallback Schatzsicherung (%)" step="0.1" value={botConfig.settings?.base_solve_percent??60} onChange={v=>setBotSetting('base_solve_percent',v)}/>
   </div>
   <div className="small adminHint">⚡ V6.53.1: Alle verfügbaren Bot-Züge werden pro Bot zu EINER gemeinsamen Feldoperation zusammengefasst. „Max. Bot-Felder pro Tick“ ist nur ein Sicherheitsdeckel gegen Datenbank-Timeouts; übrig gebliebene Züge folgen im nächsten Tick.</div>
   <label className="adminToggle"><input type="checkbox" checked={!!botConfig.settings?.use_real_average} onChange={e=>setBotSetting('use_real_average',e.target.checked)}/> echte durchschnittliche Schatzsicherungsquote verwenden</label>
   <div className="winnerActions"><button className="btn primary" disabled={saving} onClick={saveBotSettings}>Bot-Einstellungen speichern</button></div>

   <h3 style={{marginTop:20}}>Bot-Profile</h3>
   <div className="botAdminCreate">
    <input className="input" value={newBotName} placeholder="Neuer Bot-Name" onChange={e=>setNewBotName(e.target.value)}/>
    <input className="input botIconInput" value={newBotIcon} maxLength={12} placeholder="Icon" onChange={e=>setNewBotIcon(e.target.value)}/>
    <select className="input" value={newBotDifficulty} onChange={e=>setNewBotDifficulty(e.target.value)}>
     <option value="locker">locker</option><option value="normal">normal</option><option value="aktiv">aktiv</option>
    </select>
    <button className="btn" disabled={saving||!newBotName.trim()} onClick={addBot}>Bot anlegen</button>
   </div>

   <div className="botAdminList">
    {(botConfig.bots||[]).map(bot=><div className="botAdminRow" key={bot.id}>
     <div className="botAdminIdentity"><span className="botAdminAvatar">{bot.avatar_emoji||'🤖'}</span><div><strong>{bot.display_name}</strong><span className="small">{Number(bot.total_games||0)} Spiele · {Number(bot.total_fields_revealed||0).toLocaleString('de-DE')} Felder</span></div></div>
     <input className="input" value={bot.display_name} onChange={e=>setBotValue(bot.id,'display_name',e.target.value)}/>
     <div className="botIconEditor">
      <input className="input botIconInput" value={bot.avatar_emoji||'🤖'} maxLength={12} onChange={e=>setBotValue(bot.id,'avatar_emoji',e.target.value)}/>
      <div className="botIconPresets">{BOT_ICONS.map(icon=><button type="button" className={'botIconPreset '+(bot.avatar_emoji===icon?'active':'')} key={icon} onClick={()=>setBotValue(bot.id,'avatar_emoji',icon)}>{icon}</button>)}</div>
     </div>
     <select className="input" value={bot.difficulty||'normal'} onChange={e=>setBotValue(bot.id,'difficulty',e.target.value)}>
      <option value="locker">locker</option><option value="normal">normal</option><option value="aktiv">aktiv</option>
     </select>
     <input className="input botColorInput" type="color" value={bot.player_color||'#6f86a8'} onChange={e=>setBotValue(bot.id,'player_color',e.target.value)}/>
     <label className="adminCheck"><input type="checkbox" checked={!!bot.active} onChange={e=>setBotValue(bot.id,'active',e.target.checked)}/> aktiv</label>
     <div className="botAdminActions"><button className="miniBtn" disabled={saving} onClick={()=>saveBot(bot)}>Speichern</button><button className="miniBtn danger" disabled={saving} onClick={()=>deleteBot(bot)}>Löschen</button></div>
    </div>)}
   </div>

   <details className="botRuntimeDiag">
    <summary>🔧 Laufzeit-Diagnose ({botRuntime.length})</summary>
    <div className="botRuntimeList">
     {botRuntime.length===0&&<div className="small">Keine aktiven Bots in laufenden Spielen.</div>}
     {botRuntime.map(r=><div className="botRuntimeRow" key={r.game_id+'-'+r.bot_id}>
      <span>{r.avatar_emoji||'🤖'} <strong>{r.bot_name}</strong></span>
      <span>fällig {r.virtual_due_moves} Züge</span>
      <span>letzter Lauf {r.last_simulated_moves} Züge / {r.last_simulated_fields} Felder</span>
      <span>Power {r.reveal_power}</span>
      <span>{Number(r.fields_revealed||0).toLocaleString('de-DE')} Felder gesamt</span>
      <span>{r.tech_count} Techs</span>
      <span>{Number(r.coins||0).toFixed(2)} T</span>
      <span>{r.last_simulated_at?'Simulation '+new Date(r.last_simulated_at).toLocaleTimeString('de-DE'):'noch nie simuliert'}</span>
      <span>{Number(r.simulation_runs||0)} Läufe</span>
      {r.last_error&&<span className="botRuntimeError">{r.last_error}</span>}
     </div>)}
    </div>
   </details>

   <h3 style={{marginTop:20}}>Bots in laufenden Schatzsuchen</h3>
   <p className="small">Normale Schatzsuchen dürfen standardmäßig Bots enthalten. Hier kannst du sie nachträglich sperren oder wieder zulassen.</p>
   <div className="botSeedGames botGameControls">
    {(adminGames||[]).filter(g=>g.status==='active'&&g.game_type==='standard').slice(0,30).map(g=><div className="botGameControl" key={g.id}>
     <span>{g.name}</span>
     <button className="miniBtn" disabled={saving} onClick={()=>setGameBots(g.id,false)}>🤖 erlauben</button>
     <button className="miniBtn" disabled={saving} onClick={()=>setGameBots(g.id,true)}>🚫 sperren</button>
    </div>)}
   </div>
  </section>}

  <section className="panel" id="admin-claims">
   <div className="sectionTitleRow">
    <div>
     <h2>📊 Schatzsicherungs-Statistik</h2>
     <p className="small">Zeigt, wie häufig die Sicherungsaufgaben tatsächlich gelöst werden.</p>
    </div>
    <button className="btn" onClick={load}>↻ Aktualisieren</button>
   </div>
   {claimStats?<>
    <div className="claimStatsGrid">
     <div className="card"><div className="small">Versuche gesamt</div><div className="stat">{Number(claimStats.total||0).toLocaleString('de-DE')}</div></div>
     <div className="card"><div className="small">Bestanden</div><div className="stat">{Number(claimStats.pass_percent||0).toFixed(2)}%</div><div className="small">{Number(claimStats.passed||0).toLocaleString('de-DE')}</div></div>
     <div className="card"><div className="small">Fehlgeschlagen</div><div className="stat">{Number(claimStats.failed_percent||0).toFixed(2)}%</div><div className="small">{Number(claimStats.failed||0).toLocaleString('de-DE')}</div></div>
     <div className="card"><div className="small">Abgelaufen</div><div className="stat">{Number(claimStats.expired_percent||0).toFixed(2)}%</div><div className="small">{Number(claimStats.expired||0).toLocaleString('de-DE')}</div></div>
     <div className="card"><div className="small">Ø Versuche / Schatz</div><div className="stat">{Number(claimStats.avg_attempts_per_treasure||0).toFixed(2)}</div></div>
    </div>
    <div className="claimTypeStats">
     {(claimStats.by_type||[]).map(x=><div className="claimTypeRow" key={x.challenge_type}>
      <strong>{x.challenge_type}</strong>
      <span>{Number(x.attempts||0)} Versuche</span>
      <span>{Number(x.pass_percent||0).toFixed(2)}% bestanden</span>
      <span>{Number(x.failed||0)} falsch</span>
      <span>{Number(x.expired||0)} abgelaufen</span>
     </div>)}
    </div>
   </>:<div className="muted">Noch keine Statistik verfügbar.</div>}
  </section>

  <details className="panel adminCollapsible" id="admin-tech">
   <summary><span>🧠 Technologien</span><span className="small">{techs.length} Einträge</span></summary>
   <div className="adminCollapsibleBody">
   <p className="small">Diese Werte werden direkt vom Spiel geladen. Änderungen benötigen keinen neuen GitHub-Deploy. Bei Talerfallen bedeutet „Talerverlust (%)“ den prozentualen Abzug vom aktuellen Talerbestand.</p>
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
       <Field label={t.trap_type==='taler'?'Talerverlust (%)':'Fallenstärke'} step="0.1" value={t.trap_power||0} onChange={v=>setTech(t.id,'trap_power',v)}/>
       <Field label="Max. aktive Fallen" value={t.trap_limit||0} onChange={v=>setTech(t.id,'trap_limit',v)}/>
       <Field label="Taler je Fallenplatzierung" step="0.1" value={t.trap_place_cost||0} onChange={v=>setTech(t.id,'trap_place_cost',v)}/>
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
