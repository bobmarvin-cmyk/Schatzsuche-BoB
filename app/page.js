import {siteConfig} from '../lib/site-config'

export default function Home(){
 return <main className="container landingPage">
  <section className="panel landingHero">
   <div className="landingHeroText">
    <div className="eyebrow">MULTIPLAYER · ECHTE WELTKARTE · STRATEGIE</div>
    <h1>🗺️ {siteConfig.brandName}</h1>
    <p className="landingLead">Eine Schatzsuche auf einer echten Weltkarte: Felder erkunden, Hinweise kombinieren, Technologien freischalten und den Schatz vor den anderen finden.</p>
    <div className="landingActions">
     <a className="btn primary" href="/login">Anmelden</a>
     <a className="btn" href="/register">Kostenlos registrieren</a>
     <a className="btn" href="/hilfe">So funktioniert's</a>
    </div>
   </div>
   <div className="landingCompass">⌖</div>
  </section>

  <section className="landingFeatureGrid">
   <div className="panel"><div className="featureIcon">🌍</div><h2>Echte Karte</h2><p className="muted">Das Suchfeld liegt auf einer echten geografischen Karte. Straßen, Orte, Gewässer und Landschaft helfen bei der Orientierung.</p></div>
   <div className="panel"><div className="featureIcon">🧠</div><h2>Technologie</h2><p className="muted">Investiere Taler in Erkundung, Analyse, Logistik und Wirtschaft und entwickle deine eigene Strategie.</p></div>
   <div className="panel"><div className="featureIcon">👥</div><h2>Multiplayer</h2><p className="muted">Spiele gleichzeitig mit anderen. Jeder erkundet in seiner Farbe – wer kombiniert die Hinweise am besten?</p></div>
  </section>

  <section className="panel landingHow">
   <h2>In drei Schritten zum Schatz</h2>
   <div className="landingSteps">
    <div><b>1</b><span><strong>Spiel wählen</strong><small>Öffentlich oder privat beitreten.</small></span></div>
    <div><b>2</b><span><strong>Karte erforschen</strong><small>Züge nutzen, Taler sammeln, Technik ausbauen.</small></span></div>
    <div><b>3</b><span><strong>Hinweise lesen</strong><small>Die echte Karte mit Analysehinweisen kombinieren.</small></span></div>
   </div>
  </section>

  <section className="panel landingTestNotice">
   <strong>✨ Goldgames verwenden Goldstaub innerhalb des Spiels.</strong>
   <p className="muted">Goldstaub ist eine spielinterne Ressource.</p>
  </section>
 </main>
}
