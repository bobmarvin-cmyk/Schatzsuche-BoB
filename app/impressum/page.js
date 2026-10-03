import {siteConfig} from '../../lib/site-config'

export default function Impressum(){
 return <main className="container legalPage">
  <div className="panel legalCard">
   <h1>Impressum</h1>
   <p className="muted">Anbieterkennzeichnung gemäß § 5 DDG und § 18 Abs. 1 MStV</p>

   <h2>Anbieter</h2>
   <p>
    <strong>{siteConfig.operatorName}</strong><br/>
    {siteConfig.street}<br/>
    {siteConfig.city}<br/>
    {siteConfig.country}
   </p>

   <h2>Kontakt</h2>
   <p>
    E-Mail: <a href={'mailto:'+siteConfig.email}>{siteConfig.email}</a><br/>
    Kontaktformular: <a href="/kontakt">/kontakt</a>
    {siteConfig.phone&&<><br/>Telefon: {siteConfig.phone}</>}
   </p>

   {siteConfig.vatId&&<>
    <h2>Umsatzsteuer-Identifikationsnummer</h2>
    <p>{siteConfig.vatId}</p>
   </>}
  </div>
 </main>
}
