# LyfMark Prettier Formatter (intern)

## Ziel

Automatische, stabile Einrueckung fuer `:::`-Module in Markdown-Dateien ohne Abhaengigkeit von Marketplace oder externem Plugin-Publish.

## Grundsatz

- Der Formatter ist eine interne LyfMark-Entwicklung.
- Kein Publish im Marketplace.
- Kein globales npm-Paket.
- Auslieferung nur als Teil bezahlter Kunden-Templates.

## Technische Umsetzung

- Lokales Plugin im Repository: `tools/lyfmark-prettier-plugin.mjs` (Kompatibilitaets-Entry).
- Interne Modulstruktur unter `tools/lyfmark-prettier/`:
  - `prettier-plugin.mjs`: Parser/Printer-Export.
  - `formatter.mjs`: Orchestrierung der Passes.
  - `passes/indentation-pass.mjs`: Einrueckung und Modul-Tiefenlogik.
  - `passes/readability-pass.mjs`: Leerzeilen- und Lesbarkeitsregeln.
  - `directive-policies.mjs`: zentrales Override-System fuer Modul-Sonderverhalten.
  - `content-blocks.mjs`: dynamische Erkennung von Content-Block-Shortcuts.
  - `line-analysis.mjs` und `line-utils.mjs`: wiederverwendbare Parsing-Helfer.
- Eigener Prettier-Parser: `lyfmark-markdown`.
- Der Standard-Parsername `markdown` wird intern auf dieselbe LyfMark-Logik gemappt, damit VSCode-Formatierung und CLI-Formatierung identisch bleiben.
- Prettier-Config bindet das Plugin lokal ein: `.prettierrc.cjs`.

Warum eigener Parser:

- Der Standard-Markdown-Parser von Prettier kann `:::`-Syntax in Randfaellen kollabieren.
- LyfMark braucht deterministische Formatierung fuer Modulgrenzen.
- Der LyfMark-Parser formatiert nur die benoetigten Regeln und veraendert sonst nichts.

## Formatierungsregeln

- Render-safe Einrueckung rein generisch mit 2 Spaces pro Modul-Ebene (keine modul-spezifischen Einrueckungs-Sonderregeln).
- Parserseitig wird Modul-Kontext vor der AST-Auswertung generisch normalisiert, damit auch tiefe Einrueckung nicht als indented code block fehlinterpretiert wird.
- Self-Closing-Module erhoehen die Tiefe nicht (`space`, `link`, `accent-rule`, `content-block` und Content-Block-Shortcuts ohne deklarierte `children`-Variable).
- `---` innerhalb eines Moduls wird auf der aktuellen Modul-Ebene eingerueckt.
- Um `---` innerhalb von Modulen wird jeweils genau eine Leerzeile erzwungen (verhindert Setext-Fehlinterpretation).
- Vor einem neuen Modul wird nach Listen/Blockquotes automatisch eine Leerzeile gesetzt.
- Vor einem neuen Modul wird nach einer direkten HTML-Zeile automatisch eine Leerzeile gesetzt, damit CommonMark-HTML-Bloecke keine folgenden Direktiven verschlucken.
- Nach schliessendem `:::` und nach Self-Closing-Modulen wird eine Leerzeile gesetzt.
- Ausnahme: aufeinanderfolgende schliessende `:::` bleiben ohne Zwischenleerzeile; aufeinanderfolgende `:::link` bleiben ohne Leerzeile in derselben Link-Row; aufeinanderfolgende `text-over-picture`-Module bleiben ohne erzwungene Leerzeile zwischen `:::` und folgendem `:::text-over-picture`.

## Policy-Architektur (prozessual statt ad-hoc)

Sonderverhalten wird nicht in Pass-Logik gehackt, sondern als Richtlinie pro Directive modelliert.

- Zentrale Policy-Datei im Code: `tools/lyfmark-prettier/directive-policies.mjs`.
- Modulverhalten ist **internes Vertragsverhalten** und nicht kundenseitig konfigurierbar.
- `selfClosing` und Gruppenregeln werden pro Modul im Code gepflegt, weil sie fachliche Eigenschaften des Moduls sind.
- Erweiterungsprozess:
  1. Modul-Policy in `tools/lyfmark-prettier/constants.mjs` ergaenzen/anpassen.
  2. Falls noetig Parsing-Pass unveraendert lassen und nur Policy auswerten.
  3. Regressionstest in `tools/test-lyfmark-prettier.mjs` ergaenzen.

## VS Code (Workspace)

- `.vscode/settings.json` setzt Markdown auf `esbenp.prettier-vscode` mit `formatOnSave`.
- `markdown.format.enable=false` verhindert, dass der eingebaute Markdown-Formatter mit Prettier konkurriert.
- `.vscode/extensions.json` empfiehlt `esbenp.prettier-vscode`.
- `prettier.requireConfig=true` stellt sicher, dass nur mit Projektkonfig formatiert wird.

## Befehle

- Test: `npm run test:lyfmark-prettier`
- Check: `npm run format:check`
- Write Content: `npm run format:content`
- Write: `npm run format`
- Build: `npm run build` fuehrt durch `prebuild` zuerst automatisch `npm run format:content` aus.

## Pflicht bei Moduländerungen

- Bei jeder Neuentwicklung oder Änderung eines `:::`-Moduls muss ein passender Formatter-Test in `tools/test-lyfmark-prettier.mjs` ergänzt oder aktualisiert werden.
- Abschlusskriterium: `npm run test:lyfmark-prettier` und `npm run build` sind beide erfolgreich.
- Wenn Spezialverhalten noetig ist: zuerst Modul-Policy pruefen, erst danach (falls fachlich zwingend) Parser-Logik anpassen.

## Auslieferung an Kunden

- Das Plugin wird im gelieferten Template mit ausgeliefert.
- Kunde arbeitet nur im Projektordner; keine globale Installation und kein Plugin-Publish erforderlich.
- Fuer Autoformat in VS Code wird die empfohlene Prettier-Extension genutzt.
