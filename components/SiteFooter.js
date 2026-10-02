import {siteConfig} from '../lib/site-config'

export default function SiteFooter(){
  return <footer className="siteFooter">
    <div className="footerInner">
      <div>© {new Date().getFullYear()} {siteConfig.brandName} · Alle Rechte vorbehalten.</div>
      <nav className="footerLinks" aria-label="Seitennavigation">
        <a href="/hilfe">Hilfe</a>
        <a href="/impressum">Impressum</a>
        <a href="/datenschutz">Datenschutz</a>
        <a href="/kontakt">Kontakt</a>
      </nav>
    </div>
  </footer>
}
