import {siteConfig} from '../../lib/site-config'

export default function Impressum(){
 return <main className="container legalPage">
  <div className="panel">
   <h1>Impressum</h1>
   <div className="legalWarning">Vor dem öffentlichen Betrieb bitte die Platzhalter in <code>lib/site-config.js</code> vollständig ersetzen.</div>
   <h2>Angaben zum Anbieter</h2>
   <p><strong>{siteConfig.operatorName}</strong><br/>{siteConfig.street}<br/>{siteConfig.city}<br/>{siteConfig.country}</p>
   <h2>Kontakt</h2>
   <p>E-Mail: {siteConfig.email}{siteConfig.phone&&<><br/>Telefon: {siteConfig.phone}</>}</p>
   {siteConfig.vatId&&<><h2>Umsatzsteuer-ID</h2><p>{siteConfig.vatId}</p></>}
   <h2>Hinweis</h2>
   <p>Diese Seite ist als technische Vorlage für die Anbieterkennzeichnung angelegt. Je nach Betreiberform, geschäftlicher Nutzung, Registereintrag oder weiteren gesetzlichen Anforderungen können zusätzliche Angaben erforderlich sein.</p>
  </div>
 </main>
}
