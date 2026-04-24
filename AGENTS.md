# AGENTS (LyfMark – Astro)

Ziel: Kurze, operative Quick-Reference für konsistente, performante und SEO-/KI-freundliche Entwicklung („It just works“).
Details stehen in `docs/**` und werden von hier aus verlinkt.

## Doc-Atlas (immer aktuell halten)

- Public Einstieg: `docs/public/README.md`
- Public Redaktion: `docs/public/onboarding.md`, `docs/public/content-richtlinien.md`, `docs/public/menu.md`, `docs/public/templates.md`, `docs/public/changelog.md`
- Public Module: `docs/public/modules/overview.md`, `docs/public/examples/`
- Internes Doku-Playbook: `docs/internal/kunden-doku-leitfaden.md`, `docs/internal/documentation-structure.md`
- Produktstrategie intern: `docs/internal/lyfmark-product-strategy.md`
- Baseline-Konsolidierung intern: `docs/internal/lyfmark-baseline-konsolidierung.md`
- Site-Konfiguration intern: `docs/internal/site-config.md`
- Architektur/Komponenten intern: `docs/internal/architektur.md`, `docs/internal/komponenten-richtlinien.md`
- Styles intern: `docs/internal/styles-styleguide.md`, `docs/internal/theme-system.md`
- Templates intern: `docs/internal/template-system.md`
- Installer intern: `docs/internal/installer-flow.md`
- QA intern: `docs/internal/seo-checkliste.md`, `docs/internal/performance-checkliste.md`
- Setup intern: `docs/internal/install.md`
- Remark-Workflow intern: `docs/internal/workflows/remark-typecheck.md`
- LyfMark-Formatter intern: `docs/internal/workflows/lyfmark-prettier.md`
- Browser-Rendering intern: `docs/internal/workflows/browser-render-check.md`
- VS Code URL-Autocomplete intern: `docs/internal/workflows/vscode-url-autocomplete.md`

## Nicht verhandelbar (Essentials)

- Performance-/SEO-/A11y-first: Ziel ist 100/100 Lighthouse + saubere Semantik.
- Content-first: Pages bleiben reines `.md` (keine MDX-Imports/Build-Hacks für Redakteure).
- TypeScript strikt (keine `any`-Leaks), Astro 6 SSG bevorzugt.
- Basisauslieferung bleibt kundenneutral und startet mit einer einzelnen Demo-Startseite; zusätzliche Seiten/Content-Blocks sind optional und projektbezogen.
- Kundenkonfiguration erfolgt primär über `site.config.yml` im Projekt-Root; interne TS-Configs bleiben Implementierungsdetail.
- SCSS: Tokens nur in `colors.scss`/`global.scss`; templateübergreifende Basis + Modulstyles werden über `src/lyfmark/templates/<template>/foundation.scss` und den Sync-Generator gebündelt.
- Kundendoku: `docs/internal/kunden-doku-leitfaden.md` ist verbindlich und wird bei neuen Erkenntnissen fortgeschrieben.

## Harte Trigger (immer ausführen)

- Änderungen an `pages/**` (technisch gespiegelt über `src/pages`) oder Modul-Renderern: `npm run build` und HTML der betroffenen Seite in `dist/**` stichprobenartig prüfen (keine rohen `:::`, keine Dummy-Platzhalter, semantisch korrekt).
- Änderungen an `src/remark/**` oder Remark-Plugin-Einträgen in `astro.config.ts`: `npm run typecheck` (keine Wegcasts; Ursachen sauber beheben).
- Änderungen an Modul-Parsing/Formatting (`src/lyfmark/modules/**`, `src/lyfmark/registry/**`, `src/remark/directives-to-blocks.ts`, `tools/lyfmark-prettier-plugin.mjs`, `tools/lyfmark-prettier/**`): `npm run test:lyfmark-prettier` und danach `npm run build`.
- Änderungen an visuellen Komponenten/Styles/Client-Scripts (`src/styles/**`, `public/scripts/**`, relevante Module): Browser-Rendering visuell prüfen via `npm run render:shot` oder `npm run render:compare` (Splash standardmäßig unterdrückt, außer explizit mit `--show-splash`).

## Content- und Projektkonventionen (Kurzfassung)

- Seiten ausschließlich als `.md` mit Frontmatter; Pflichtfelder: `title`, `description`, `layout`, `updated` (Details: `docs/public/content-richtlinien.md`).
- Saubere Heading-Hierarchie; interne Links relativ mit sprechendem Text.
- Benennung: Dateien/Ordner kebab-case; Komponenten PascalCase.

## Verhalten (Abstraktion, Pflicht)

- Vor jeder Änderung an Kunden-, Modul- oder Redaktionsdokumentation immer zuerst `docs/internal/kunden-doku-leitfaden.md` vollständig lesen und die Formulierungen daran ausrichten.
- Deutschsprachige Nutzer-, Kunden- und Redaktionsausgaben immer mit korrekten Umlauten und ß schreiben; Umschreibungen wie `ae/oe/ue/ss` sind in sichtbaren Texten zu vermeiden.
- Installer-, Repair-, CI- und sonstige technische Konsolenausgaben grundsätzlich auf Englisch und möglichst ASCII-sicher formulieren; lokalisierte Endkundendokumentation bleibt davon unberührt.
- GUI-Installer-Wrapper sollen Setup-Daten bevorzugt per strukturierter Install-Info-JSON an Skripte übergeben; direkte CLI-Parameter bleiben Support-/CI-Vertrag.
- VS-Code-Extension-Installation niemals per `runOn: folderOpen`-Task starten; solche Tasks können beim Öffnen der Customer-Workspace wieder `code` ausführen und Fenster-Schleifen verursachen. Extension-Setup gehört in Installer/Repair-Flow.
- Nach jedem Arbeitsschritt aktiv prüfen, ob dabei eine wertvolle, verallgemeinerbare Erkenntnis entstanden ist, die künftige Arbeit verbessert.
- Solche Erkenntnisse immer passend festhalten: allgemeine Arbeitsregeln in `AGENTS.md`, themenspezifische Erkenntnisse in `docs/**`, kritische Prüffälle in `testcases.md` und aufgabenspezifische Zwischenstände in `todo.md`.
- Diese Lernpflege gilt für alle Arbeiten im Projekt, nicht nur für Dokumentation. Sie soll die künftige Qualität verbessern, ohne in unnötige Detailverwaltung oder Hyperfokus abzugleiten.
- Kundenspezifische Einmal-Anpassungen ohne langfristigen Wiederverwendungsbedarf als klar isolierte CSS-Blöcke mit kurzer Entfernen-Markierung umsetzen, damit sie später schnell und risikoarm entfernt werden können.
- Bei visuellen Tests auffällige oder unerwartete Inkonsistenzen immer aktiv melden, auch wenn sie nicht eindeutig als Bug verifiziert sind; Rückmeldung des Nutzers einholen, ob gewolltes Verhalten oder Fehler.
- Kundenspezifische Implementationen immer so generisch formulieren und umsetzen, dass sie für beliebige Branchen/Projekte wiederverwendbar sind.
- Bei jedem Umsetzungsschritt aktiv prüfen, ob Struktur, API, Benennung und Styling abstrahiert und kundenneutral genug sind.
- Bei neuen oder angepassten Modulen mit visuellem Tone-Kontext immer `color="light|dark"` als explizite Option anbieten; fehlt `color`, muss der Ton automatisch vom nächstliegenden übergeordneten Tone-Container übernommen werden.
- Modul-Doku, Beispiele und Snippets grundsätzlich kundenneutral formulieren (keine Marken-/Kundennamen in Platzhaltertexten).
- In Kundendoku konsequent nutzenorientiert formulieren (Ergebnis/Wirkung), keine technischen Ursachen oder Implementierungsdetails beschreiben.
- Wesentliche Änderungen in `docs/public/changelog.md` immer für nicht-technische Endkunden formulieren: zuerst verständlich erklären, was geändert wurde, dann (falls relevant) kurz den Zweck, danach die konkrete Auswirkung für den Kunden und bei Bedarf die Nutzung (Feld/Option).
- In `docs/public/changelog.md` keine Kleinständerungen oder reine Umsetzungsdetails erfassen; nur Änderungen aufnehmen, die für den Endkunden beim Einspielen eines Updates spürbar oder entscheidungsrelevant sind.
- Changelog-Stände werden nach Kalendertag geführt (`Stand: TT.MM.JJJJ`); mehrere kundenrelevante Änderungen eines Tages werden im selben Tagesstand zusammengefasst.
- Ein neuer Changelog-Stand wird nur bei kundenrelevanten Änderungen angelegt; bei mehreren Lieferungen am selben Tag wird der bestehende Tagesstand ergänzt statt ein zweiter Stand erzeugt.
- Bereits an Kunden ausgelieferte ältere Changelog-Stände dürfen nicht nachträglich umformuliert oder erweitert werden; Anpassungen nur im aktuellen Tagesstand.
- Changelog-Texte müssen informationsdicht sein: keine Füllsätze; Hinweise wie „keine zusätzliche Einstellung nötig“ nur nennen, wenn Nutzer hier erfahrungsgemäß etwas erwarten oder prüfen würden.
- Vor jedem neuen Changelog-Bullet zuerst den aktuellen Tagesstand und thematisch passende bestehende Einträge prüfen; wenn inhaltlich bereits abgedeckt, bestehenden Punkt präzisieren statt einen neuen Detailpunkt anzulegen.
- Pro Arbeitspaket nur kundenrelevante Ergebnisänderungen eintragen und technische Teilschritte bündeln; keine Schritt-für-Schritt-Implementierungsdetails.
- Konfigurationswerte in der Changelog immer in eindeutiger Parameter-Notation mit Anführungszeichen schreiben (z. B. `display="highlight-card"`, `order="random"`).
- Wenn ein Release Änderungen an der mitgelieferten LyfMark-VS-Code-Extension enthält, im Changelog den relevanten Versionsstand nennen und kurz darauf hinweisen, dass bei fehlender Funktion zuerst die installierte Version geprüft werden soll.
- Vor jeder finalen Abgabe mit kundenrelevanten Änderungen ist ein expliziter Changelog-Gate Pflicht: prüfen, ob `docs/public/changelog.md` aktualisiert werden muss; falls ja, Eintrag im aktuellen Tagesstand ergänzen, falls nein, Entscheidung kurz im Arbeitskontext begründen.
- Wenn eine sinnvolle Abstraktion unklar ist oder Zielkonflikte entstehen, sofort proaktiv nachfragen statt implizit zu verengen.
- Dateistruktur aktiv mitdenken: komponentenspezifische Renderlogik bleibt bei der Komponente, unabhängige Funktionen werden in passende, wiederverwendbare Module ausgelagert.
- Balance halten: keine monolithischen Dateien, aber auch keine Über-Fragmentierung (KIS). Neue Dateien nur, wenn sie eine klare fachliche Grenze oder Wiederverwendbarkeit schaffen.
- Im Hauptmenü niemals die aktuelle Seite als aktiv markieren; Current-Page-Zustände werden ausschließlich über Breadcrumbs dargestellt.
- Das Browser-Render-Tool ist ein Arbeitswerkzeug für den KI-Agenten und darf/muss bei Bedarf proaktiv erweitert werden, um visuelle Prüfungen zuverlässiger und schneller zu machen.
- Bei visuellen Prüfungen immer den relevanten UI-Ausschnitt plus etwas Umfeld priorisieren (statt nur Full-Page), um Seiteneffekte schneller und token-effizient zu erkennen.
- Bei Modulen mit WebGL-Overlay plus statischem Bild-Fallback müssen beide Renderpfade dieselbe geometrische Transform-Kette nutzen (Scale/Zoom/Rotation/Offsets), damit viewport-unabhängige Kompositionen stabil bleiben.
- Produktname für das modulare Markdown/Remark-System ist `LyfMark` (kundenneutral, ohne Kundenbezug in Naming/Artefakten).
- Auslieferung an Endkunden ist als Out-of-the-box Basis-Template geplant (ZIP entpacken, in VS Code öffnen, arbeitsfähig ohne Zusatzkonfiguration).
- LyfMark-Prettier ist ein lokales internes Plugin im Template (kein Marketplace-/npm-Publish) und wird nur als Teil bezahlter Kundenpakete ausgeliefert.
- LyfMark-Prettier nutzt render-sichere Einrückung: pro Modul-Ebene 2 Spaces. Abweichungen davon dürfen sich nur unmittelbar aus der Fachlichkeit des Moduls ergeben, oder müssen vom User explizit bestätigt werden.
- LyfMark-Prettier-Sonderverhalten wird ausschließlich als interne Directive-Policy modelliert (`tools/lyfmark-prettier/directive-policies.mjs`) und nicht als ad-hoc Sonderlogik in den Passes.
- Bei jedem neuen oder geänderten Modul muss mindestens ein passender Formatter-Regressionstest in `tools/test-lyfmark-prettier.mjs` ergänzt und mit `npm run test:lyfmark-prettier` verifiziert werden.
- Neue oder überarbeitete Dokumentation immer entlang der Zielstruktur aufbauen: `docs/public/**` für Endkundeninhalte, `docs/internal/**` für interne Technik-, Produkt- und Betriebsdokumentation.
- Content-Block-Änderungen in `content-blocks/*.md` (technisch gespiegelt über `src/content-blocks`) müssen im Dev-Server ohne Seitenspeichern sichtbar werden (Invalidierung der Markdown-Seitenmodule + Full-Reload).
- `navigation/**` ist redaktioneller Kundenbereich und enthält nur Menü-Quelldateien (`.md`); technische Menü-Implementierung liegt außerhalb dieses Ordners.
- Server ist immer kanonisch: Die semantisch vollständige, klare und ranking-relevante Ausgabe (SEO/KI/Screenreader) muss ohne JavaScript korrekt funktionieren.
- Client-Skripte sind nur progressive Verbesserung: Darstellung und Interaktion dürfen angepasst werden, aber fachliche Inhalte, Reihenfolgen und Zustände dürfen nicht clientseitig „vorgegeben“ werden, wenn der Server sie nicht bereits korrekt liefert.
- URL-Autovervollständigung immer fachlich aus dem korrekten Startbereich anbieten (Bilder aus `public/**`, Seitenpfade aus `pages/**` über `src/pages`-Mirror), dabei Freitext nie blockieren; Validierung nur dort erzwingen, wo sie fachlich zwingend und mit vertretbarer Komplexität robust umsetzbar ist (z. B. interne Bildpfade auf Existenz/Dateityp).
- Bei jeder inhaltlichen Änderung an `tools/lyfmark-vscode/*.vsix` oder der Extension-Logik immer die Version in `tools/lyfmark-vscode/package.json` erhöhen, damit VS Code das Update eindeutig erkennt.
- Bei Änderungen an Frontmatter-basierten Style-Overrides immer Positiv- und Negativpfad explizit prüfen: (a) Build erfolgreich mit realistischem Kundenwert, (b) sichtbare Wirkung im Browser auf ein betroffenes UI-Element, (c) Build-Fehler mit klarer Anleitung bei typischem Eingabefehler.

## Client-Side Scripts

- Interaktive Module nie via `client:load` hydratisieren.
- Logik als ES-Modul in `public/scripts/**` und via Layout `<script type="module" src="/…"></script>` laden.
- Controls mit `data-*` + `aria-controls` ausstatten.

## `:::`-Module (Kurzfassung + DoD)

Details: `docs/internal/workflows/markdown-modules.md`.

- Parsing & Mapping: `src/remark/directives-to-blocks.ts` + `src/lyfmark/registry/index.ts` pflegen; unbekannte Keys → klare deutschsprachige Fehler.
- Direktiven können ohne Leerzeilen vor/nach `:::` geparst werden; nach Markdown-Listen oder Blockquotes (`>`) bleibt eine Leerzeile vor dem nächsten Modul Pflicht, damit der Containerkontext sauber endet.
- Renderer (DbC): semantisches, zugängliches HTML; Pflichtinhalte strikt → `file.fail("…")`; keine “silent fixes”; AST-Nodes nicht mutieren, wenn Inhalte verschoben werden (immer kopieren).
- Assets/Docs: Modulquellen liegen konsolidiert unter `src/lyfmark/modules/<modul>/` (inkl. `module.ts`, `styles/**`, `internal.md`, `testcases.md`), Snippets in `.vscode/markdown.code-snippets` (alphabetisch), Doku `docs/public/modules/<modul>.md`, Beispiel `docs/public/examples/<modul>.md`, Übersicht `docs/public/modules/overview.md`.

  Diese Datei bleibt die maßgebliche Einstiegshilfe. Wenn neue Regeln entstehen, gehören Details in `docs/**` und nur die operativen Trigger/DoD hierher.
