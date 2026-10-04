'use client'
import {useMemo,useState} from 'react'

const modes=[
 {id:'standard',icon:'🧭',name:'Schatzsuche',text:'Klassisches Spiel ohne Gold-Einsatz. Taler, Technologien, Hinweise, Maschinen und Fallen entscheiden über deine Strategie.'},
 {id:'pay',icon:'✨',name:'Goldsuche',text:'Teilnehmer zahlen Goldstaub-Einsatz. Die Spielmechanik bleibt gleich, aber Gold wird nach den serverseitigen Regeln verteilt.'},
 {id:'sponsor',icon:'🤝',name:'Sponsorspiel',text:'Für Spieler kostenlos. Der Sponsor stiftet den Gold-Pool. Der Schatz wird erst nach bestandener Schatzsicherung endgültig gewonnen.'}
]

const steps=[
 {title:'Spielmodus verstehen',text:'Wähle zuerst einen Spielmodus. Die Suche selbst funktioniert in allen Modi ähnlich – Unterschiede gibt es vor allem bei Gold und Teilnahme.',action:'Weiter'},
 {title:'Felder gezielt erkunden',text:'Tippe auf dunkle Felder. Aufgedeckte Felder bleiben sichtbar. Im echten Spiel können Technologien mehrere Felder pro Zug öffnen.',action:'2 Felder öffnen'},
 {title:'Taler verdienen & investieren',text:'Leere Felder bringen Taler. Damit kaufst du Technologien. Im Testspiel schaltest du jetzt Erkundung I frei.',action:'Erkundung I kaufen'},
 {title:'Hinweise statt blindem Glück',text:'Nach einer manuellen Suche kannst du einen Analysehinweis kaufen. Hinweise liefern feste Informationen, die du kombinierst.',action:'Analyse kaufen'},
 {title:'Fallen einsetzen',text:'Fallen dürfen auf unbekannte Felder. Sie bleiben aktiv, bis sie ausgelöst werden. Jede neue Platzierung kostet Taler.',action:'Falle für 2 T setzen'},
 {title:'Maschinen verstehen',text:'Maschinen arbeiten automatisch weiter, solange das Spiel aktiv ist. Sie sind Werkzeuge – die Karte bleibt serverautoritativ.',action:'Maschine simulieren'},
 {title:'Schatzteil entdecken',text:'Mehrere Schatzteile können zusammen den Gesamtschatz bilden. Dein Anteil entscheidet am Ende über die Wertung.',action:'Schatzteil suchen'},
 {title:'Schatzsicherung',text:'Ein Fund ist noch nicht endgültig. Merke dir die Symbolfolge und bestätige sie. Im echten Spiel läuft dabei ein sichtbarer Timer.',action:'Schatz sichern'},
 {title:'Wertung & Abschluss',text:'Geschafft. Ranking, Schatzanteil und Spielmodus greifen jetzt zusammen. Du kannst das Tutorial wiederholen oder direkt in die Lobby wechseln.',action:'Fertig'}
]

export default function Tutorial(){
 const [step,setStep]=useState(0)
 const [mode,setMode]=useState('standard')
 const [revealed,setRevealed]=useState([12])
 const [taler,setTaler]=useState(8)
 const [tech,setTech]=useState(false)
 const [analysis,setAnalysis]=useState(false)
 const [trap,setTrap]=useState(null)
 const [machineCells,setMachineCells]=useState([])
 const [treasureFound,setTreasureFound]=useState(false)
 const [claimStarted,setClaimStarted]=useState(false)
 const [claimInput,setClaimInput]=useState('')
 const [claimPassed,setClaimPassed]=useState(false)
 const [ranking,setRanking]=useState(false)
 const cells=useMemo(()=>Array.from({length:36},(_,i)=>i),[])
 const code='123241'
 const symbols={1:'▲',2:'●',3:'■',4:'◆'}
 const done=step>=steps.length-1

 function reveal(i){
  if(step!==1||revealed.includes(i))return
  const next=[...revealed,i]
  setRevealed(next)
  setTaler(v=>v+1.5)
  if(next.length>=3)setStep(2)
 }
 function action(){
  if(step===0){setStep(1);return}
  if(step===1)return
  if(step===2&&taler>=3){setTaler(v=>v-3);setTech(true);setStep(3);return}
  if(step===3&&taler>=2){setTaler(v=>v-2);setAnalysis(true);setStep(4);return}
  if(step===4&&taler>=2){setTaler(v=>v-2);setTrap(27);setStep(5);return}
  if(step===5){
    const auto=[7,8,9,13]
    setMachineCells(auto)
    setRevealed(v=>[...new Set([...v,...auto])])
    setStep(6);return
  }
  if(step===6){setTreasureFound(true);setRevealed(v=>[...new Set([...v,29])]);setStep(7);return}
  if(step===7){setClaimStarted(true);return}
  if(step===8){setRanking(true)}
 }

 function pressClaim(n){
  if(!claimStarted||claimPassed||claimInput.length>=6)return
  setClaimInput(v=>(v+String(n)).slice(0,6))
 }
 function submitClaim(){
  if(claimInput!==code)return
  setClaimPassed(true);setRanking(true);setStep(8)
 }

 return <main className="container tutorialPage">
  <div className="buildBadge">V6.25.1</div>
  <div className="topnav"><a className="btn" href="/lobby">← Lobby</a><a className="btn" href="/hilfe">Hilfe</a></div>

  <section className="panel tutorialHero">
   <div>
    <div className="eyebrow">SIMULIERTES TESTSPIEL</div>
    <h1>🎓 BoBs Schatzsuche Tutorial</h1>
    <p className="muted">Ein kompletter Probelauf: Spielmodus wählen, suchen, ausbauen, analysieren, Falle setzen und einen Schatz bergen.</p>
   </div>
   <div className="tutorialProgress">{step+1}/{steps.length}</div>
  </section>

  <section className="tutorialModeStrip">
   {modes.map(m=><button key={m.id} type="button"
    className={'tutorialModeCard '+(mode===m.id?'active':'')}
    onClick={()=>setMode(m.id)}>
    <span>{m.icon}</span><strong>{m.name}</strong><small>{m.text}</small>
   </button>)}
  </section>

  <div className="tutorialLayout">
   <section className="panel tutorialGame">
    <div className="tutorialModeBanner">
     {modes.find(m=>m.id===mode)?.icon} <strong>{modes.find(m=>m.id===mode)?.name}</strong>
     <span>{mode==='standard'?'ohne Gold-Einsatz':mode==='pay'?'mit Gold-Einsatz':'kostenlos für Spieler'}</span>
    </div>

    <div className="tutorialHud">
     <span><small>Taler</small><b>{taler.toFixed(1)}</b></span>
     <span><small>Felder</small><b>{revealed.length}</b></span>
     <span><small>Ausbau</small><b>{tech?'1':'0'}</b></span>
     <span><small>Schatz</small><b>{claimPassed?'100%':treasureFound?'50%':'0%'}</b></span>
    </div>

    <div className="tutorialMap tutorialMapLarge tutorialMapWorld">
     {cells.map(i=><button key={i}
       className={'tutorialCell '+(revealed.includes(i)?'revealed ':'')+
        (machineCells.includes(i)?'machine ':'')+(trap===i?'trap ':'')+
        (treasureFound&&i===29?'treasure ':'')}
       onClick={()=>reveal(i)}
       aria-label={'Tutorialfeld '+(i+1)}>
       {trap===i?'🪤':treasureFound&&i===29?'🧩':machineCells.includes(i)?'⚙️':revealed.includes(i)?'✓':''}
     </button>)}
    </div>
    <div className="tutorialMapAttribution">Hintergrund: © OpenStreetMap-Mitwirkende · Raster = Spieloverlay</div>

    {analysis&&<div className="tutorialHint">
      <strong>🧭 Analyse-Hinweis</strong>
      <span>Der Schatz liegt im südöstlichen Bereich und näher am Kartenrand als am Zentrum.</span>
    </div>}

    {step===7&&claimStarted&&<div className="tutorialClaim">
      <div className="tutorialClaimTimer">⏱ 01:42</div>
      <strong>Merke dir: {code.split('').map((n,i)=><span className={'claimKey k'+n} key={i}>{symbols[n]}</span>)}</strong>
      <div className="small">Im echten Spiel verschwindet die Folge nach einigen Sekunden.</div>
      <div className="claimInput">{[0,1,2,3,4,5].map((_,i)=><span key={i}>{claimInput[i]?symbols[claimInput[i]]:'·'}</span>)}</div>
      <div className="claimButtons">{[1,2,3,4].map(n=><button key={n} onClick={()=>pressClaim(n)}>{symbols[n]}</button>)}</div>
      <div className="claimSubmitRow">
       <button className="miniBtn" onClick={()=>setClaimInput('')}>Löschen</button>
       <button className="btn primary" disabled={claimInput.length!==6} onClick={submitClaim}>Antwort prüfen</button>
      </div>
      {claimInput.length===6&&claimInput!==code&&<div className="tutorialSoftError">Im Tutorial bleibt der Versuch offen. Prüfe die Folge noch einmal.</div>}
    </div>}

    {ranking&&<div className="tutorialRanking">
      <strong>🏁 Endstand</strong>
      <div><span>🥇 Du</span><b>100% Schatz</b></div>
      <div><span>🥈 Alex <em className="tutorialOnline">● online</em></span><b>0%</b></div>
    </div>}
   </section>

   <aside className="panel tutorialCoach">
    <div className="small">SCHRITT {step+1}</div>
    <h2>{steps[step].title}</h2>
    <p>{steps[step].text}</p>

    {step===1
      ? <div className="tutorialCallout">👆 Öffne zwei weitere dunkle Felder.</div>
      : step===7&&claimStarted
        ? <div className="tutorialCallout">Merke dir die sechs Symbole und gib sie unten ein.</div>
        : done
          ? <div className="tutorialActions"><a className="btn primary" href="/lobby">🚀 Zur Lobby</a><a className="btn" href="/tutorial">Nochmal</a></div>
          : <button className="btn primary" onClick={action}
             disabled={(step===2&&taler<3)||(step===3&&taler<2)||(step===4&&taler<2)}>
             {steps[step].action}
            </button>}

    {step===2&&<div className="tutorialTechCard"><strong>Erkundung I</strong><span>mehr Felder pro Zug</span><b>3 T</b></div>}
    {step===3&&<div className="tutorialTechCard"><strong>Analyse I</strong><span>echter Richtungshinweis</span><b>2 T</b></div>}
    {step===4&&<div className="tutorialTechCard"><strong>Talerfalle</strong><span>bleibt bis zur Auslösung aktiv</span><b>2 T je Setzen</b></div>}
    {step===5&&<div className="tutorialTechCard"><strong>Maschine</strong><span>arbeitet automatisch im Hintergrund des Spiels</span><b>simuliert</b></div>}
   </aside>
  </div>

  <section className="panel tutorialGuide">
   <h2>Spielmodi auf einen Blick</h2>
   <div className="grid">
    {modes.map(m=><div className="card" key={m.id}><strong>{m.icon} {m.name}</strong><div className="small">{m.text}</div></div>)}
   </div>
  </section>

  <section className="panel">
   <h2>🧠 Der eigentliche Kern: Deduktion</h2>
   <p>Der Schatz soll nicht einfach durch blindes Anklicken gefunden werden. Gute Spieler kombinieren Suchpunkte, Terrain und Analysehinweise und grenzen das Gebiet schrittweise ein.</p>
   <div className="grid">
    <div className="card"><strong>🧭 Sektor</strong><div className="small">Welcher Kartenteil ist grundsätzlich relevant?</div></div>
    <div className="card"><strong>📐 Entfernung</strong><div className="small">Wie weit liegt der Schatz ungefähr vom Zentrum oder Rand?</div></div>
    <div className="card"><strong>🌍 Terrain</strong><div className="small">Wald, Wasser, Siedlung, Acker oder andere reale Kartennutzung.</div></div>
    <div className="card"><strong>📡 Peilung</strong><div className="small">Neue Suchpunkte liefern weitere Richtungsinformationen.</div></div>
    <div className="card"><strong>🪤 Taktik</strong><div className="small">Fallen kosten beim Setzen Taler und sind damit eine bewusste Investition.</div></div>
    <div className="card"><strong>🔐 Schatzsicherung</strong><div className="small">Der Schatz wird erst nach einer separaten, zeitlich begrenzten Prüfung gesichert.</div></div>
   </div>
  </section>
 </main>
}
