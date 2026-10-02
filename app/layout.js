import 'maplibre-gl/dist/maplibre-gl.css'
import './globals.css'
import SiteFooter from '../components/SiteFooter'

export const metadata={
  title:'Schatzsuche Online',
  description:'Multiplayer-Schatzsuche auf einer echten Weltkarte',
  viewport:'width=device-width, initial-scale=1, maximum-scale=5'
}

export default function RootLayout({children}){
  return <html lang="de">
    <body>
      <div className="siteShell">{children}</div>
      <SiteFooter/>
    </body>
  </html>
}
