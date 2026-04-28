# Changelog

Stand: 28.04.2026

## Verbesserungen bei Installation

- Neue Kundenprojekte werden jetzt aus einem vorbereiteten LyfMark-Core-Paket eingerichtet und als eigenes Kundenprojekt mit `main`-Branch vorbereitet. Dadurch startet das Projekt unabhängig vom internen LyfMark-Entwicklungsrepository.
- Die Windows-Installation verwendet für Projektabhängigkeiten jetzt den reproduzierbaren Installationsweg. Dadurch passt die lokale Einrichtung verlässlicher zum ausgelieferten Projektstand.

Stand: 27.04.2026

## Verbesserungen bei Installation

- Die Windows-Installation startet jetzt zuverlässiger, wenn sie über einen vorbereiteten Startbefehl ausgeführt wird, und zeigt Installationsfortschritt sowie Rückfragen direkt sichtbar an. Dadurch kann die Installation benötigte Programme mit einmaliger Zustimmung einrichten und danach nachvollziehbar fortfahren.
- Die Einrichtung der Projektabhängigkeiten läuft jetzt ohne Auswahlfrage automatisch weiter und zeigt bei längerer Dauer einen Wartestatus an.
- Nach der Windows-Installation öffnet sich die vorbereitete VS-Code-Kundenansicht wieder automatisch; zusätzlich wird der Desktop-Link angelegt.
- Die LyfMark-Erweiterung und empfohlene VS-Code-Erweiterungen werden nach einer frischen VS-Code-Installation zuverlässiger automatisch eingerichtet, ohne vorher leere VS-Code-Fenster zu öffnen.
- `npm run repair` prüft die VS-Code-Erweiterungen jetzt mit und kann sie bei Bedarf erneut einrichten.

Stand: 24.04.2026

## Verbesserungen bei Installation

- Der Installer fragt jetzt den Namen der Website ab und legt den Projektordner entsprechend an. Dadurch ist das Projekt nach der Installation leichter wiederzufinden.
- Am Ende der Installation wird die vorbereitete VS-Code-Kundenansicht automatisch geöffnet und zusätzlich als Desktop-Link angelegt.
- Die LyfMark-VS-Code-Erweiterung wird vor dem ersten Öffnen einmalig eingerichtet. Dadurch startet VS Code stabil ohne wiederholt neue Fenster zu öffnen.
- Die Installation läuft nach der Zustimmung zu benötigten Programmen zuverlässiger weiter und vermeidet unnötige weitere Eingaben.
- Die Windows-Installation startet die Projektvorbereitung jetzt robuster. Dadurch läuft der Schritt zum Einrichten der Projektabhängigkeiten zuverlässiger durch.
- Beim erneuten Ausführen der Windows-Installation wird ein bereits vorhandenes Projekt jetzt zuverlässiger aktualisiert und danach korrekt weiter eingerichtet.

Stand: 22.04.2026

## Verbesserungen bei Stabilität und Reparatur

- Mit `npm run repair` kann eine lokale Projektstruktur jetzt vollständig in einem Schritt wiederhergestellt werden. Der Befehl prüft die Arbeitsordner, repariert Verknüpfungen und aktualisiert anschließend die LyfMark-Generierung automatisch.
- Nach dem Reparaturlauf wird eine kompakte Zustandsübersicht ausgegeben. Dadurch ist direkt erkennbar, ob die Struktur bereit ist oder ob noch Hinweise geprüft werden sollten.

## Verbesserungen bei Installation

- Für den Erststart gibt es jetzt pro Betriebssystem einen Doppelklick-Installer (`Windows`, `macOS`, `Linux`), der Sie Schritt für Schritt durch das Setup führt.
- Der Installer prüft benötigte Werkzeuge, hilft beim Git-/SSH-Setup und führt danach die Projektvorbereitung automatisch aus. Dadurch ist der Start für neue Nutzer deutlich robuster und klarer.

Stand: 21.04.2026

## Verbesserungen bei Templates

- Das aktive Website-Template kann jetzt zentral über `defaultTemplate` in `site.config.yml` gewechselt werden, ohne Anpassungen an Layout-Dateien.
- Beim Template-Wechsel werden Modul-Styles automatisch passend zusammengestellt. Falls für ein Modul keine templatespezifische Variante vorhanden ist, bleibt die Darstellung stabil über den Basisstyle.
- Neu: `docs/public/templates.md` erklärt den Wechsel Schritt für Schritt, inklusive der nötigen Aktualisierung mit `npm run lyfmark:sync`.
- Seiten können jetzt optional im Frontmatter mit `template="..."` ein anderes Template als das globale Standard-Template verwenden. Falsche Template-Namen werden beim Build mit klaren, gültigen Optionen gemeldet.
- Beim Start mit `npm run dev` wird die Template-Zusammenstellung jetzt automatisch aktualisiert. Dadurch sind manuelle Zwischenschritte beim Start nicht mehr nötig.
- Beim Aktualisieren werden nicht mehr benötigte, generierte Template-Dateien jetzt automatisch entfernt. Das hält die Auslieferung stabil und verhindert Altstände nach Template-Wechseln.
- Sync-Hinweise sind jetzt klarer formuliert: Die Website bleibt nutzbar, und bei Bedarf sind Detailinformationen separat verfügbar.

## Verbesserungen bei Farben

- Das Basissystem nutzt jetzt nur noch fünf feste Farbtoken: `light`, `light-accent`, `dark`, `dark-accent` und `highlight`.
- Veraltete Varianten wie `color-highlight-alt` sowie numerische Farbvarianten (`-5`, `-7`) wurden aus dem Basissystem entfernt.

## Verbesserungen bei Medien

- Die Standard-Wellengrafik (`/img/lyfmark-wave.svg`) ist wieder als Basismotiv enthalten. Dadurch erscheinen die betroffenen Module zuverlässig ohne fehlende Datei-Hinweise.

## Verbesserungen bei Starter-Bausteinen

- Das Basispaket enthält jetzt einen neutralen Hero-Content-Block unter `content-blocks/hero.md`, der direkt als Einstieg genutzt und angepasst werden kann.
- Zusätzlich ist ein neutrales Kontaktformular-Preset unter `forms/basic-contact.html` enthalten. Dadurch können Sie schneller mit einem einfachen Formular starten.

Stand: 17.04.2026

## Verbesserungen in VS Code

- Das Projekt enthält jetzt eine vorbereitete VS-Code-Kundenansicht als Workspace-Datei.
- Die Kundenansicht blendet technische Betriebsordner (z. B. `node_modules`, `src`, `tools`) aus. Dadurch bleibt der Arbeitsbereich für Inhalte übersichtlich und klar.
- Für Umsetzung und Support öffnen Entwickler den Projektordner direkt über „Open Folder“ und behalten so die vollständige technische Sicht.
- Die mitgelieferte LyfMark-VS-Code-Extension wurde auf Version `0.0.8` aktualisiert.
- Wenn Vorschläge für `:::`-Module nicht wie erwartet erscheinen, prüfen Sie bitte zuerst, ob mindestens Version `0.0.8` installiert ist.

## Verbesserungen in der Basis-Konfiguration

- Die zentrale Website-Basiskonfiguration liegt jetzt in `site.config.yml` im Projekt-Root. Titel, Beschreibung und Standard-Template können damit ohne Änderungen an TypeScript-Dateien gepflegt werden.
- Ungültige oder unvollständige Einträge in `site.config.yml` werden beim Build jetzt mit klaren Hinweisen gemeldet. Dadurch lassen sich typische Konfigurationsfehler schneller erkennen und beheben.

Stand: 15.04.2026

## Neue Baseline für neue Kundenprojekte

- Das Basispaket startet jetzt bewusst mit einer neutralen Demo-Startseite statt mit einer umfangreichen Beispiel-Website. Dadurch können Sie Ihr Projekt ohne vorheriges Aufräumen direkt aufbauen.
- Bestehende, kundenspezifische Inhaltsbeispiele wurden aus dem Standardpaket entfernt. Sie starten damit auf einer sauberen, markenneutralen Grundlage.
- Das Startmenü wurde auf eine klare Minimalstruktur reduziert (`Start`, `Module`, `Templates`), damit die Orientierung beim ersten Projektaufbau einfacher ist.

Stand: 03.04.2026

## Verbesserungen in VS Code

- Die mitgelieferte LyfMark-VS-Code-Extension wurde auf Version `0.0.7` aktualisiert.
- Die Autovervollständigung für `:::`-Module und `[lucide:...]` wurde vereinheitlicht. Vorschläge sind dadurch klarer und werden beim Einfügen zuverlässig korrekt übernommen.
- Parameter von Modulen können jetzt (wenn sinnvoll möglich) mit Autovervollständigung auch nachträglich ausgefüllt werden.
- Wenn neue Vorschläge nicht erscheinen, prüfen Sie bitte zuerst, ob mindestens Version `0.0.7` installiert ist.

## Verbesserungen bei Seiten-Styles

- Farbakzente können jetzt pro Seite direkt im Frontmatter über `color-*` gesetzt werden (z. B. `color-highlight`), ohne die globale Farbwelt zu ändern.
- Bei fehlerhafter Eingabe (z. B. Hexwert ohne Anführungszeichen) erhalten Sie eine klare Korrekturhilfe direkt in der Fehlermeldung.

## Verbesserungen in der Moduldokumentation

- Die Doku für `:::typo` enthält jetzt eine klare Entscheidungshilfe für `as` inklusive praxisnahem Beispiel mit `as="h2"`.
- Beispiele in Doku und Snippets sind jetzt konsequent kundenneutral formuliert, ohne Klarnamen realer Personen.

Stand: 31.03.2026

## Verbesserungen im Menü

- Untermenüs folgen jetzt einer klaren Regel: entweder Linkliste oder freier Inhalt. Dadurch entstehen weniger widersprüchliche Strukturen, und das Menü bleibt in der Praxis stabiler. Wenn Sie freien Inhalt einsetzen, nutzen Sie im selben Untermenü bitte keine zusätzliche Linkliste.
- Das Menü reagiert toleranter auf kleine Einrückungsfehler. Dadurch bleibt die Navigation auch bei laufenden redaktionellen Anpassungen verlässlicher und benötigt seltener Nacharbeit.
- Freie Inhalte können gezielt als eigener Menüabschnitt verwendet werden, zum Beispiel für Hinweise oder Hervorhebungen. So lassen sich Schwerpunkte im Menü sichtbarer setzen.

## Verbesserungen bei Content-Blocks

- Content-Blocks können jetzt auch in Unterordnern organisiert und direkt von dort eingebunden werden. Das verbessert die Übersicht, wenn viele Bausteine im Einsatz sind.
- In VS Code werden Content-Blocks nun auch aus Unterordnern in der Auto-Vervollständigung vorgeschlagen und bei Änderungen aktualisiert. Das macht das Einfügen schneller und reduziert Tippfehler.
- Content-Blocks können eigenen Inhalt zwischen Öffnen und Schließen aufnehmen, wenn der jeweilige Block den Parameter `$children` nutzt. Damit lassen sich bestehende Bausteine flexibler einsetzen.
- Variablen in Content-Blocks werden verbindlicher über das Frontmatter geführt. Fehlende oder falsch geschriebene Angaben werden dadurch früher sichtbar. Wenn Sie Variablen verwenden, pflegen Sie diese im Frontmatter mit kurzer Erläuterung.

## Verbesserungen bei Modulen

- Das `split`-Modul unterstützt jetzt flexible Spaltenbreiten, zum Beispiel `1:2:1`. So können Inhalte gezielter gewichtet werden.
- Das `picture-and-text`-Modul kann jetzt auch als `highlight-card` dargestellt werden. Damit lassen sich wichtige Inhalte deutlicher hervorheben. Für diese Darstellung nutzen Sie `display="highlight-card"`.
- `highlight-card` nutzt jetzt standardmäßig `color="auto"`. Dadurch passt sich die Karte automatisch an den Umgebungsbereich an: In hellen Bereichen wird sie dunkel, in dunklen Bereichen hell. Wenn Sie den Ton fest vorgeben möchten, verwenden Sie weiterhin `color="light"` oder `color="dark"`.
- Das `list`-Modul führt ungeordnete Listen (`-`) jetzt einheitlich im Kartenstil. Damit die Darstellung eindeutig bleibt, ist bei `-`-Listen das Feld `bullet` jetzt verpflichtend (zum Beispiel `bullet="[lucide:circle-check]"`).
- Pfeil-Buttons in Modulen wurden auch für dunkle Bereiche visuell vereinheitlicht. Dadurch wirkt die Bedienung über verschiedene Module hinweg konsistenter.
- Kursiv formatierte Zitate bleiben auch in komplexeren Modul-Kombinationen korrekt erhalten. Das verhindert unerwünschte Formatverluste.

## Verbesserungen bei Page-Teaser

- Im `page-teaser` kann das Feld `author-image` jetzt direkt als Kartenbild genutzt werden. Das reduziert doppelte Bildpflege und sorgt für ein einheitlicheres Ergebnis bei Profil- und Teamseiten. Wenn Sie das nutzen möchten, hinterlegen Sie im Seiten-Frontmatter ein `author-image`.
- Mit `author-image` wird ab Kartenplatz 2 automatisch die Profilkarten-Darstellung verwendet: Bild links, Text rechts.
- Kartenplatz 1 bleibt weiterhin die große Hauptkarte mit Teaserbild oben, auch wenn ein `author-image` vorhanden ist. So bleibt die visuelle Priorisierung klar.
- Wenn kein reguläres Teaserbild vorhanden ist, wird automatisch das `author-image` verwendet. Dadurch bleibt die Karte auch ohne separates Teaserbild vollständig.
- Bei `order="random"` bleiben fest platzierte Karten auf ihrer Position, während nur die übrigen Karten gemischt werden. So lassen sich Prioritäten und Abwechslung zuverlässig kombinieren.

## Verbesserungen bei Seiten-Styles

- Farbakzente können jetzt pro Seite direkt im Frontmatter gesetzt werden. Dafür können Sie `color-*`-Felder verwenden, zum Beispiel `color-highlight`, um die zugehörige CSS-Farbvariable nur für diese Seite zu überschreiben.

## Verbesserungen in VS Code

- Die mitgelieferte LyfMark-VS-Code-Extension wurde auf Version `0.0.4` aktualisiert.
- In `[lucide:...]` werden jetzt passende Iconnamen vorgeschlagen, damit Lucide-Icons schneller eingefügt werden können.
- Das `page-teaser`-Snippet startet jetzt mit einem praxisnahen Cards-Beispiel inklusive fixer Platzierung und Filter, statt mit dem selten genutzten Template-Aufbau.
- Wenn neue Vorschläge nicht erscheinen, prüfen Sie bitte zuerst, ob mindestens Version `0.0.4` installiert ist.
