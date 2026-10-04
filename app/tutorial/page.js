'use client'
import {useMemo,useState} from 'react'

const steps=[
 {title:'Willkommen im Testspiel',text:'Dieses Tutorial ist komplett simuliert. Es kostet keine Züge, Taler oder Gold und verändert kein echtes Spiel.',action:'Weiter'},
 {title:'Felder erkunden',text:'Tippe auf ein dunkles Feld. Im echten Spiel deckst du damit je nach Ausbau mehrere Rasterfelder auf und erhältst für normale leere Felder Taler.',action:'Feld anklicken'},
 {title:'Technologien ausbauen',text:'Taler investierst du in Technologien. Sie verbessern zum Beispiel Felder/Zug, Analyse, Maschinen oder Fallen.',action:'Erkundung I kaufen'},
 {title:'Analyse gezielt kaufen',text:'Analysehinweise erscheinen nicht automatisch. Nach einer manuellen Suche kannst du einen Hinweis gegen Taler kaufen. Dieselbe Suchposition lässt sich nur einmal analysieren.',action:'Hinweis kaufen'},
 {title:'Fallen und Maschinen',text:'Fallen werden verdeckt auf noch unbekannte Felder gelegt. Maschinen können an deiner letzten Suche weiterarbeiten oder zufällig über die Karte suchen.',action:'Falle platzieren'},
 {title:'Wettbewerb',text:'Im Ingame-Ranking vergleichst du Taler, Ausbau, aufgedeckte Felder und Schatzanteil. Online-Spieler werden grün markiert.',action:'Ranking ansehen'},
 {title:'Schatz gefunden!',text:'Schatzteile erhöhen deinen Anteil. Sind alle Teile entdeckt, gewinnt der Spieler mit dem größten Schatzanteil. Danach kannst du direkt ein gleiches Spiel neu starten.',action:'Tutorial abschließen'}
]

export default function Tutorial(){
 const [step,setStep]=useState(0)
 const [revealed,setRevealed]=useState([12])
 const [taler,setTaler]=useState(3)
 const [tech,setTech]=useState(false)
 const [analysis,setAnalysis]=useState(false)
 const [trap,setTrap]=useState(null)
 const [ranking,setRanking]=useState(false)

 const done=step>=steps.length-1
 const cells=useMemo(()=>Array.from({length:25},(_,i)=>i),[])

 function reveal(i){
  if(step!==1||revealed.includes(i))return
  setRevealed(v=>[...v,i]);setTaler(v=>v+2);setStep(2)
 }
 function action(){
  if(step===0){setStep(1);return}
  if(step===2){if(taler>=3){setTaler(v=>v-3);setTech(true);setStep(3)}return}
  if(step===3){if(taler>=2){setTaler(v=>v-2);setAnalysis(true);setStep(4)}return}
  if(step===4){setTrap(18);setStep(5);return}
  if(step===5){setRanking(true);setStep(6);return}
 }

 return <main className="container tutorialPage">
  <div className="topnav"><a className="btn" href="/lobby">← Lobby</a><a className="btn" href="/hilfe">Hilfe</a></div>

  <section className="panel tutorialHero">
   <div><div className="eyebrow">SIMULIERTES TESTSPIEL</div><h1>🎓 BoBs Schatzsuche Tutorial</h1><p className="muted">Einmal durch die wichtigsten Funktionen – ohne Auswirkungen auf deinen Account oder echte Spiele.</p></div>
   <div className="tutorialProgress">{step+1}/{steps.length}</div>
  </section>

  <div className="tutorialLayout">
   <section className="panel tutorialGame">
    <div className="tutorialHud">
     <span><small>Taler</small><b>{taler}</b></span>
     <span><small>Felder</small><b>{revealed.length}</b></span>
     <span><small>Ausbau</small><b>{tech?'1':'0'}</b></span>
     <span><small>Schatz</small><b>{done?'100%':'0%'}</b></span>
    </div>

    <div className="tutorialMap">
     {cells.map(i=><button key={i}
       className={'tutorialCell '+(revealed.includes(i)?'revealed ':'')+(trap===i?'trap ':'')+(done&&i===22?'treasure ':'')}
       onClick={()=>reveal(i)}
       aria-label={'Tutorialfeld '+(i+1)}>
       {trap===i?'🪤':done&&i===22?'🧩':revealed.includes(i)?'✓':''}
     </button>)}
    </div>

    {analysis&&<div className="tutorialHint">🧭 Hinweis: Der Schatz liegt südöstlich von deiner letzten Suche.</div>}
    {ranking&&<div className="tutorialRanking">
      <strong>🏁 Ranking</strong>
      <div><span>🥇 Du</span><b>{taler} T</b></div>
      <div><span>🥈 Alex <em className="tutorialOnline">● online</em></span><b>2 T</b></div>
    </div>}
   </section>

   <aside className="panel tutorialCoach">
    <div className="small">SCHRITT {step+1}</div>
    <h2>{steps[step].title}</h2>
    <p>{steps[step].text}</p>

    {step===1
      ? <div className="tutorialCallout">👆 Tippe jetzt auf eines der dunklen Rasterfelder.</div>
      : done
        ? <div className="tutorialActions"><a className="btn primary" href="/lobby">🚀 Zur Lobby</a><a className="btn" href="/tutorial">Nochmal</a></div>
        : <button className="btn primary" onClick={action}>{steps[step].action}</button>}

    {step===2&&<div className="tutorialTechCard"><strong>Erkundung I</strong><span>+5 Felder/Zug</span><b>3 T</b></div>}
    {step===3&&<div className="tutorialTechCard"><strong>Analyse I</strong><span>Richtungshinweis</span><b>2 T pro Hinweis</b></div>}
   </aside>
  </div>
 
  <section className="panel">
   <h2>🧠 Schatz durch Deduktion finden</h2>
   <p>Der Schatz soll nicht durch blindes Glück gefunden werden. Analysen liefern feste Tatsachen über das aktuelle Schatzteil. Kombiniere sie auf der echten Karte.</p>
   <div className="grid">
    <div className="card"><strong>🧭 Sektor</strong><div className="small">Welcher Teil der Karte ist grundsätzlich relevant?</div></div>
    <div className="card"><strong>📐 Zentrumring</strong><div className="small">Wie weit liegt der Schatz ungefähr vom Kartenmittelpunkt?</div></div>
    <div className="card"><strong>🌍 Gelände</strong><div className="small">Wald, Wasser, Siedlung, Landwirtschaft oder andere kartierte Nutzung.</div></div>
    <div className="card"><strong>📡 Peilung</strong><div className="small">Setze bewusst neue Suchpunkte und trianguliere Richtung und Entfernung.</div></div>
    <div className="card"><strong>🧩 Umgebung</strong><div className="small">Vergleiche mit bereits kartierten Wasser-, Wald-, Siedlungs- und Verkehrsflächen.</div></div>
    <div className="card"><strong>🎯 Präzision</strong><div className="small">Hohe Analyse-Technik verdichtet deine bisherigen Schlüsse auf einen kleinen Bereich.</div></div>
   </div>
  </section>
</main>
}
