# Workflow: `:::`-Module in Markdown (Astro)

Ziel: Nicht-technische Autoren pflegen Seiten ausschließlich in `.md`. Wiederverwendbare Bausteine werden als `:::`-Directives gesetzt; der Block-Inhalt ist normales Markdown.

Dieses Dokument ist die detaillierte Referenz für neue/angepasste Module. Die Kurzfassung (DoD + harte Regeln) steht in `AGENTS.md`.

## Grundprinzipien

- Keep it very simple: Module werden von Laien verwendet; immer die verständlichste, fehlerresistenteste Variante wählen.
- Design by Contract: Pflichtinhalte strikt prüfen und bei Fehlern mit klarer, deutschsprachiger Anleitung abbrechen (kein “silent fix”).
- Security by default: Modul-Autoren und -Nutzer haben keine Sicherheitskenntnisse; Module müssen Risiken eigenständig vermeiden.

## Content-Blocks (Kurzregeln)

- Jede Datei in `content-blocks/<name>.md` wird automatisch als `:::<name>` verfügbar (technisch gespiegelt über `src/content-blocks/<name>.md`).
- Variablen werden als `$variable` im Block notiert und beim Einbinden als Attribute gesetzt (`:::<name> variable="wert"`).
- Unbekannte Attribute oder fehlende Variablen führen zu klaren Fehlermeldungen.
- Kollidiert ein Blockname mit einem eingebauten Modul, wird der Build mit Hinweis abgebrochen.
- Im Dev-Server invalidieren Änderungen an `content-blocks/*.md` (inkl. Mirror `src/content-blocks/*.md`) automatisch die Seitenmodule und triggern einen Full-Reload der offenen Seite.
- Der HMR-Watcher berücksichtigt zusätzlich `navigation/**/*.md`, `forms/**/*.html` und `pages/**/*.{md,mdx,astro}` jeweils sowohl im Root als auch im `src`-Mirror.

## Verbindliche Pflichten pro Modul-Task (neu/Änderung)

### 1) Keep it very simple

- Keine unnötigen Abkürzungen; Modulnutzung muss ohne In-Code-Kommentare intuitiv sein.
- Komplexität realistisch für Laien einschätzen; bei unerwarteter Komplexität warnen und einfachere Varianten aufzeigen.
- Modulnamen spiegeln den Einsatzzweck wider (z. B. `intro-spotlight` statt seitenbezogener Namen wie `intro`).
- Attribute leicht verständlich und positiv formulieren (z. B. `align={left|right}`), mit sinnvollem Standardwert.
- Vor jeder Modul-Implementation prüfen, welche generischen Helper (z. B. Validatoren, Text-Sammler) extrahiert/normalisiert werden sollten.
- Vor oder nach `:::` sind parserseitig keine Leerzeilen erforderlich; die Direktive wird auch direkt neben Fließtext korrekt erkannt.
- Optionale Einrückung innerhalb von Modulen mit 2 Spaces ist erlaubt (inkl. `---`-Trennern auf derselben Ebene).
- LyfMark-Formatter kanonisiert Leerzeilen: nach schließendem `:::` und nach Self-Closing-Direktiven wird eine Leerzeile gesetzt; direkt aufeinanderfolgende `:::`-Abschlüsse bleiben kompakt ohne Leerzeile.
- `:::link` bleibt als Sonderfall zeilenweise gruppierbar: direkt aufeinanderfolgende Links bleiben ohne Zwischenleerzeile in derselben Link-Row.
- `---` innerhalb von Modul-Kontexten wird immer mit genau einer Leerzeile davor und danach formatiert, damit CommonMark den Trenner nicht als Setext-Heading interpretiert.
- Parserseitig wird die Einrueckung innerhalb offener Modulkontexte vor der AST-Auswertung generisch normalisiert, damit tiefe Verschachtelung nicht als indented-code fehlinterpretiert wird.
- Parserseitig werden HTML-Bloecke defensiv aufgetrennt, wenn sie durch fehlende Leerzeile folgende `:::`-Direktiven verschlucken wuerden.
- Restinhalt nach einem Modul-Oeffner (z. B. `:::split` und direkt in der Folgezeile HTML) wird als Markdown-Fragment geparst, nicht als Plain-Text rekonstruiert.
- Wenn der Parser vorab normalisiert, muss `file.value` auf der normalisierten Quelle bleiben, damit spaetere Source-Line-Rekonstruktionen keine alte Einrueckung reaktivieren.

### 2) Parsing & Mapping

- Direktiven werden in `src/remark/directives-to-blocks.ts` geparst und als verschachtelte Modul-Knoten strukturiert (damit innere `---`/`:::` korrekt gescoped sind).
- Zentrale Registry `src/lyfmark/registry/index.ts` pflegen (`ModulName` → Renderer).
- Parameterformat: `key="..."` oder `key='...'` (Werte müssen gequotet sein).
- Unbekannte/unerlaubte Keys: deutliche, deutschsprachige Fehlermeldung.

### 3) Renderer (Design by Contract)

- Pro Modul eine reine Renderer-Funktion: mdast → semantisches, zugängliches HTML (korrekte Landmark-Roles, Heading-Hierarchie, sinnvolle `alt`).
- Pflichtinhalte strikt prüfen → `file.fail("klare, deutschsprachige Anleitung zur Korrektur")`.
- Sinnvolle Defaults (Varianten, Spalten etc.).
- Niemals “silent fixes”, stattdessen klare, verständliche Fehlermeldungen.
- (S)CSS und HTML sauber trennen; eine verständlich strukturierte SCSS-Datei pro Modul für Anpassungs-Variablen.

### 4) VS Code Autovervollständigung (zwingend)

- `.vscode/markdown.code-snippets` pro Modul aktualisieren:
  - Prefix-Trigger (z. B. `modulname`, `:::modulname`).
  - Parameter-Choices (z. B. `variant={default,centered}`).
  - Platzhalter für realistischen Beispielinhalt.
- Ziel: `<modul><Tab>` erzeugt einen vollständigen, laienfreundlichen Block.

### 5) Beispiele & Doku (knapp, aber vollständig)

- Pro Modul genau 1 Doku-Datei: `docs/public/modules/<modul>.md` (laienverständlich, inkl. Minimalbeispiel).
- `docs/public/modules/overview.md` um Kurzbeschreibung ergänzen/aktualisieren.
- Beispiele: `docs/public/examples/<modul>.md` anlegen/aktualisieren.

### 6) Formatter-Regression (zwingend)

- Bei jedem neuen oder geänderten Modul mindestens einen passenden Fall in `tools/test-lyfmark-prettier.mjs` ergänzen oder aktualisieren.
- Der Testfall muss die reale Modul-Verschachtelung abbilden (inkl. `---`/Closing-Logik, falls relevant).
- Für den Abschluss der Aufgabe immer `npm run test:lyfmark-prettier` und danach `npm run build` ausführen.

## Definition of Done (DoD)

- Komplexität niedrig; ggf. vereinfachen oder klar warnen.
- Registry-Eintrag vorhanden.
- Renderer: A11y, Escaping, Defaults, klare Fehlermeldungen.
- `.vscode/markdown.code-snippets` erweitert (alphabetisch einfügen).
- `docs/public/examples/<modul>.md` ergänzt.
- `docs/public/modules/overview.md` ergänzt.
- Redaktions-Workflow unverändert (Pages bleiben reines `.md`).
- Formatter-Regression ergänzt/aktualisiert und grün: `npm run test:lyfmark-prettier`.

## Modul-Technik (Stand 2025-02)

- Remark-Integration: Kernparser in `src/remark/` (`directives-to-blocks.ts`), Registry unter `src/lyfmark/registry/**`, Modulquellen vertraglich unter `src/lyfmark/modules/**`.
- Zu jedem Modul gehört eine SCSS-Basisdatei in `src/lyfmark/modules/<modul>/styles/base.scss`, eingebunden in `src/styles/primary.scss` via `@use`.
- Workflow bei Remark-Änderungen: `docs/internal/workflows/remark-typecheck.md` (inkl. Pflicht: `npm run typecheck`).
