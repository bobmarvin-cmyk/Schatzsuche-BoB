import {siteConfig} from '../lib/site-config'

export default function Home(){
 return <main className="container">
  <div className="panel">
   <h1>🗺️ {siteConfig.brandName}</h1>
   <p className="muted">Multiplayer-Schatzsuche mit Profilen, Weltkarte, Technologien und Test-Goldstaub.</p>
   <div className="topnav">
    <a className="btn primary" href="/register">Registrieren</a>
    <a className="btn" href="/login">Anmelden</a>
    <a className="btn" href="/lobby">Lobby</a>
   </div>
  </div>
 </main>
}
