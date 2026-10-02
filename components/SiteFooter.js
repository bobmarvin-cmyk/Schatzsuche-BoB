export default function SiteFooter(){
  return <footer className="siteFooter">
    <div className="footerInner">
      <div>© {new Date().getFullYear()} Schatzsuche Online · Alle Rechte vorbehalten.</div>
      <nav className="footerLinks" aria-label="Rechtliche Informationen">
        <a href="/impressum">Impressum</a>
        <a href="/datenschutz">Datenschutz</a>
        <a href="/kontakt">Kontakt</a>
      </nav>
    </div>
  </footer>
}
