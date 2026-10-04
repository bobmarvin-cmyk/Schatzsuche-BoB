import 'maplibre-gl/dist/maplibre-gl.css'
import './globals.css'
import SiteFooter from '../components/SiteFooter'
import {siteConfig} from '../lib/site-config'

export const metadata={
  title:siteConfig.brandName,
  description:'Multiplayer-Schatzsuche auf einer echten Weltkarte'
}

export const viewport={
  width:'device-width',
  initialScale:1,
  maximumScale:5
}

export default function RootLayout({children}){
  return <html lang="de">
    <body>
      <div className="siteShell">{children}</div>
      <SiteFooter/>
    </body>
  </html>
}
