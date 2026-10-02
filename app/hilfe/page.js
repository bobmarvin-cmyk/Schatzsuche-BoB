import {siteConfig} from '../../lib/site-config'

export default function Hilfe(){
  return <main className="container legalPage">
    <div className="topnav">
      <a className="btn" href="/lobby">← Zur Lobby</a>
    </div>

    <div className="panel">
      <h1>Hilfe – {siteConfig.brandName}</h1>
      <p className="muted">
        Hier findest du die wichtigsten Informationen zum Spiel, zum Ablauf und zu den verschiedenen Spielmodi.
      </p>

      <h2>Was ist das Ziel?</h2>
      <p>
        Auf einer echten Weltkarte liegt ein Raster. Unter einem oder mehreren Feldern sind Schätze versteckt.
        Dein Ziel ist es, durch das Aufdecken von Feldern die Schätze vor den anderen Spielern zu finden.
      </p>

      <h2>Wie funktioniert das Spiel?</h2>
      <p>
        Du trittst einem Spiel in der Lobby bei und erhältst regelmäßig neue Züge. Mit jedem Zug kannst du ein Gebiet
        auf der Karte untersuchen. Aufgedeckte Felder werden in deiner Spielerfarbe markiert, damit sichtbar bleibt,
        wer welchen Bereich erkundet hat.
      </p>

      <h2>Züge und Zugspeicher</h2>
      <p>
        Züge regenerieren automatisch nach der vom Host festgelegten Zeit. Nicht verbrauchte Züge können bis zu einem
        bestimmten Limit gespeichert werden. Ist der Speicher voll, verfallen weitere neue Züge, bis du wieder einen
        Zug benutzt.
      </p>

      <h2>Technologien</h2>
      <p>
        Für das Aufdecken leerer Felder erhältst du Taler. Diese kannst du im Technologiebaum einsetzen.
        Technologien können unter anderem mehr Felder pro Zug freischalten, deine Hinweise verbessern,
        deinen Zugspeicher vergrößern oder die Regeneration beschleunigen.
      </p>

      <h2>Hinweise und Weltkarte</h2>
      <p>
        Mit Analyse-Technologien erhältst du zunehmend genauere Hinweise zur Position des Schatzes.
        Die Hinweise beziehen sich auf die reale Karte und können zum Beispiel Richtung, Entfernung oder
        Kartenbereiche einbeziehen.
      </p>

      <h2>Standardspiele</h2>
      <p>
        Standardspiele sind kostenlos. Der Host legt unter anderem Kartengröße, reale Feldgröße,
        maximale Spielerzahl und die Geschwindigkeit der Zugregeneration fest.
      </p>

      <h2>Paygames im Testmodus</h2>
      <p>
        Paygames verwenden derzeit ausschließlich Test-Goldstaub ohne Echtgeldwert. Für die Teilnahme wird eine
        bestimmte Menge Test-Goldstaub eingesetzt. Ein Teil davon landet im Schatzpool, ein Teil wird als
        Community-Anteil verteilt und ein Teil wird als Plattform-Testanteil verbucht.
      </p>
      <p>
        In dieser Testversion kann Goldstaub weder mit echtem Geld gekauft noch ausgezahlt oder in echtes Gold
        umgewandelt werden.
      </p>

      <h2>Mehrere Schätze</h2>
      <p>
        Bei Paygames kann es mehrere Goldschätze geben. Der Host kann – innerhalb der serverseitig vorgegebenen Grenzen –
        eine feste Schatzanzahl wählen oder die automatische Verteilung verwenden.
      </p>

      <h2>Private Spiele</h2>
      <p>
        Ein Host kann ein Spiel als privat erstellen. Private Spiele erscheinen nicht in der öffentlichen Lobby.
        Der Beitritt erfolgt über einen Einladungscode und, falls gesetzt, zusätzlich über ein Passwort.
      </p>

      <h2>Später beitreten</h2>
      <p>
        Spieler können auch einem bereits laufenden Spiel beitreten, solange noch Plätze frei sind.
        Neue Spieler starten ohne bereits freigeschaltete Technologien.
      </p>

      <h2>Legenden</h2>
      <p>
        Unter „Legenden“ findest du Bestenlisten für verschiedene Errungenschaften, zum Beispiel Siege,
        erkundete Felder, gefundene Goldschätze und gespielte Partien.
      </p>


      <h2>Inaktive Spiele</h2>
      <p>
        Wenn in einem Spiel über längere Zeit kein Zug mehr gemacht wird, kann es automatisch geschlossen werden.
        Die Standardregel liegt bei 24 Stunden ohne Zug. Geschlossene Spiele bleiben noch kurz in der Lobby sichtbar
        und werden anschließend automatisch gelöscht.
      </p>

      <h2>Dein Profil</h2>
      <p>
        Im Profil kannst du deinen Spielernamen, einen kurzen Infotext und ein Profilbild hinterlegen.
        Profilbilder dürfen maximal 2 MB groß sein und als JPG, PNG oder WebP hochgeladen werden.
      </p>


      <h2>Hall of Fame</h2>
      <p>
        Beendete Spiele werden dauerhaft im Spielarchiv festgehalten. Dort kannst du später
        die Endkarte, den Sieger, die Zahl der verwendeten Züge und den Endstand der Mitspieler ansehen.
        Die großen Live-Spieldaten können nach der Aufbewahrungsfrist gelöscht werden, ohne dass der Rückblick verloren geht.
      </p>


      <h2>Maschinen und Automatisierung</h2>
      <p>
        Im Technologiezweig „Automatisierung“ kannst du Maschinen kaufen, die zusätzlich zu deinen
        manuellen Zügen automatisch Felder aufdecken. Die Maschinen arbeiten im Bereich deines letzten
        manuellen Kartenklicks und laufen nur, solange das jeweilige Spiel sichtbar geöffnet ist.
        Wechselst du den Tab oder verlässt das Spiel, stoppt die Automatisierung automatisch.
      </p>
      <p>
        Maschinen verbrauchen keine gespeicherten manuellen Züge. Ihre Leistung und der Talerertrag
        automatischer Felder werden zentral von der Spielleitung eingestellt.
      </p>


      <h2>Schatzteile und Siegerwertung</h2>
      <p>
        Jedes Spiel besitzt insgesamt genau 1,000 Schatz. Der Host kann diesen Gesamtwert auf mehrere
        Fundstellen verteilen. Bei drei Teilen sind das zum Beispiel ungefähr 0,333 + 0,333 + 0,334.
        Das Spiel endet erst, wenn alle Schatzteile gefunden wurden. Gewinner ist der Spieler, der
        insgesamt den größten Anteil des Schatzes gefunden hat.
      </p>
      <p>
        Im Paygame wird auch der Test-Gold-Schatzpool auf diese Fundstellen verteilt. Der Gesamtpool
        wird dadurch nicht größer – er wird lediglich auf mehrere Funde aufgeteilt.
      </p>

      <h2>Die echte Karte als Spielhinweis</h2>
      <p>
        Analyse-Technologien markieren ein ungefähres Gebiet auf der realen Karte. Über
        „Hinweisgebiet fokussieren“ kannst du direkt dorthin springen. Wenn der Kartenstil passende
        Daten liefert, zeigt das Spiel zusätzlich benannte Straßen, Orte, Gewässer oder andere
        Kartenmerkmale aus diesem Gebiet. Diese Merkmale sollen zur Orientierung genutzt werden,
        statt nur Rasterkoordinaten abzuzählen.
      </p>

      <h2>Tipps</h2>
      <p>
        Nutze deine Züge nicht nur zufällig. Beobachte bereits erkundete Bereiche, kombiniere Hinweise mit der
        Karte und investiere Taler gezielt in Technologien, die zu deiner Spielweise passen.
      </p>

      <div className="helpActions">
        <a className="btn primary" href="/lobby">← Zurück zur Lobby</a>
        <a className="btn" href="/legenden">🏆 Legenden ansehen</a>
      </div>
    </div>
  </main>
}
