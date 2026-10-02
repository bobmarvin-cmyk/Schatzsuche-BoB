import {siteConfig} from '../../lib/site-config'

export default function Datenschutz(){
 return <main className="container legalPage">
  <div className="panel">
   <h1>Datenschutzerklärung</h1>
   <div className="legalWarning">Vor dem öffentlichen Betrieb Betreiberangaben prüfen und die Erklärung an die tatsächlich eingesetzten Dienste und Einstellungen anpassen.</div>

   <h2>1. Verantwortlicher</h2>
   <p>{siteConfig.operatorName}<br/>{siteConfig.street}<br/>{siteConfig.city}<br/>E-Mail: {siteConfig.email}</p>

   <h2>2. Bereitstellung der Website</h2>
   <p>Beim Aufruf der Website werden technisch erforderliche Verbindungs- und Protokolldaten verarbeitet. Die Anwendung wird über Vercel bereitgestellt. Die Verarbeitung erfolgt zur sicheren und funktionsfähigen Bereitstellung des Dienstes.</p>

   <h2>3. Benutzerkonto und Spielbetrieb</h2>
   <p>Für Registrierung, Anmeldung, Profile und Spielstände wird Supabase eingesetzt. Verarbeitet werden insbesondere E-Mail-Adresse, Anzeigename, technische Konto-ID sowie spielbezogene Daten wie Spiele, Technologien, Züge und aufgedeckte Felder.</p>

   <h2>4. Weltkarte</h2>
   <p>Die Kartenansicht wird mit MapLibre dargestellt und lädt Kartendaten über OpenFreeMap. Dabei kann der Kartenanbieter technisch bedingt Informationen wie IP-Adresse und angeforderte Kartenausschnitte erhalten.</p>

   <h2>5. Technisch erforderliche Speicherung</h2>
   <p>Die Anwendung verwendet technisch erforderliche Browser-Speicherungen für Anmeldung, Sitzungsverwaltung und bei privaten Spielen gegebenenfalls zur vorübergehenden Speicherung des vom Nutzer eingegebenen Spielpassworts im Sitzungsspeicher. Diese Funktionen dienen unmittelbar der vom Nutzer gewünschten Bereitstellung des Dienstes.</p>

   <h2>6. Kontaktformular</h2>
   <p>Wenn du das Kontaktformular verwendest, verarbeiten wir die von dir eingegebenen Angaben zur Bearbeitung der Anfrage. Die Nachrichten werden in der Anwendungsdatenbank gespeichert und nur so lange aufbewahrt, wie dies zur Bearbeitung und aufgrund gegebenenfalls bestehender gesetzlicher Aufbewahrungspflichten erforderlich ist.</p>

   <h2>7. Rechte betroffener Personen</h2>
   <p>Je nach Voraussetzungen bestehen insbesondere Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch sowie das Recht, sich bei einer Datenschutzaufsichtsbehörde zu beschweren.</p>

   <h2>8. Stand</h2>
   <p>Technische Vorlage: Oktober 2026. Diese Erklärung muss vor einem produktiven oder geschäftlichen Betrieb anhand der tatsächlich verwendeten Dienste und Datenflüsse geprüft werden.</p>
  </div>
 </main>
}
