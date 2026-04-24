# Workflow: VS Code URL-Autocomplete für LyfMark

Ziel: In Markdown-Direktiven kontextbezogene URL-Vorschläge anbieten, ohne Freitext-Eingaben zu blockieren.

## Technischer Ort

- VS Code Extension (lokal im Template): `tools/lyfmark-vscode/`
- Einstieg: `tools/lyfmark-vscode/extension.cjs`
- Regeldefinitionen: `tools/lyfmark-vscode/rules.cjs`

## Verhalten

- Aktiv in Markdown-Dateien.
- Aktiv in lokalen und Remote-Markdown-Dateien (u. a. `file`, `untitled`, `vscode-remote` wie WSL/SSH).
- Vorschläge erscheinen nur in konfigurierten LyfMark-Attributen (z. B. `:::background-image url="..."`).
- Vorschläge erscheinen zusätzlich in konfigurierten Frontmatter-Feldern (z. B. `thumbnail: "/..."`, `author-image: "/..."`).
- Bei `:::`-Direktivnamen werden eingebaute Module aus `src/lyfmark/modules/**` plus vorhandene Content-Blocks aus `content-blocks/**` (inkl. Mirror `src/content-blocks/**`) als Vorschläge angeboten.
- Bei `[lucide:...]` werden Iconnamen aus `lucide-static` kontextbezogen vorgeschlagen.
- Freitext bleibt immer erlaubt; Vorschläge sind nicht verpflichtend.
- Änderungen an Content-Block- oder Seiten-Dateien (Root oder `src`-Mirror) aktualisieren die Vorschläge ohne VS-Code-Neustart.
- Bei Bildfeldern funktioniert die Vorschlagsfilterung auch ohne führenden Slash (z. B. Eingabe `wave` findet `/img/.../wave...`).

## Regelmodell (erweiterbar)

Neue Felder werden ausschließlich über `rules.cjs` ergänzt.

Schema pro Regel:

- `module`: LyfMark-Modulname.
- `attribute`: Attributname innerhalb der Direktive.
- `source.type`:
  - `public-images`: schlägt Bilddateien aus einem `public/**`-Teilbereich vor.
  - `page-routes`: schlägt interne Routen auf Basis von `pages/**` vor (mit Mirror-Fallback über `src/pages/**`).
- `source.rootDir` oder `source.rootDirs`: Quellverzeichnis(se) innerhalb des Projekts.
- `label`: kurze Beschreibung im Completion-Detail.

Für Frontmatter-Regeln:

- `field`: Frontmatter-Feldname (case-insensitive).
- `source` und `label` wie bei Modulregeln.

Hinweis: Content-Block-Namen für `:::`-Direktivnamen werden bewusst nicht über `rules.cjs` gepflegt, sondern dynamisch aus `content-blocks/**` plus `src/content-blocks/**` gelesen.

## Aktuelle Regeln

- `background-image.url` -> Bilder aus `public/**`
- `background-wave.url` -> Bilder aus `public/**`
- `picture-and-text.image` -> Bilder aus `public/**`
- `text-over-picture.image` -> Bilder aus `public/**`
- `link.to` -> interne Pfade aus `pages/` plus `src/pages/` (dedupliziert)
- `frontmatter.thumbnail` -> Bilder aus `public/**`
- `frontmatter.author-image` -> Bilder aus `public/**`
- `:::<name>` -> eingebaute Modulnamen plus Content-Block-Namen aus `content-blocks/**` plus `src/content-blocks/**` (dedupliziert)
- `[lucide:...]` -> Lucide-Iconnamen aus `lucide-static` (dynamisch aus Workspace-Abhängigkeit)

## Packaging / Installation

Die Erweiterung ist lokal im Repo. Für Endnutzer wird sie als `.vsix` verpackt und installiert.

Beispiel (manuell):

1. In `tools/lyfmark-vscode` wechseln.
2. `npx @vscode/vsce package` ausführen.
3. Es entsteht `tools/lyfmark-vscode/lyfmark-vscode-<version>.vsix`.
4. In VS Code: Extensions -> `...` -> `Install from VSIX...`.

## Automatische Projekt-Installation

- Die Extension-Installation läuft über den Installer oder einen expliziten Repair-/Support-Schritt, nicht über einen Folder-Open-Task.
- Der Installer ruft `tools/lyfmark-vscode/install-local-extension.mjs` einmalig vor dem ersten Öffnen der Customer-Workspace auf.
- `.vscode/tasks.json` darf keinen `runOn: folderOpen`-Task für die Extension-Installation enthalten, weil ein solcher Task beim Öffnen der Workspace wieder `code` starten und Fenster-Schleifen erzeugen kann.
- Das Script prüft zuerst, ob die lokale `.vsix` gegenüber den Quellen (`extension.cjs`, `rules.cjs`, `package.json`, ...) veraltet ist; bei Bedarf wird sie automatisch neu gebaut.
- Danach installiert/aktualisiert das Script die Extension, wenn die VS Code CLI (`code`) verfügbar ist.
- In WSL wird die Installation gezielt gegen das Remote-Target (`--remote wsl+<Distro>`) ausgeführt.
- Auch bei gleicher Versionsnummer wird bei geänderter VSIX-Signatur einmalig mit `--force` neu installiert, damit neue Vorschlagslogik sicher aktiv wird.
- Ist die CLI nicht verfügbar, bleibt die manuelle VSIX-Installation der Fallback.

Hinweis: Die Auslieferung an Kunden erfolgt idealerweise mit bereits gebautem `.vsix` im Projektpaket.

## Update-Strategie für Kunden (empfohlen)

Ziel: Updates für Redakteure ohne manuelle VSIX-Schritte.

1. Version der Extension erhöhen:
   - `tools/lyfmark-vscode/package.json` (`version`).
2. Neue VSIX bauen:
   - in `tools/lyfmark-vscode`: `npx @vscode/vsce package`.
3. VSIX mitliefern:
   - neue Datei `lyfmark-vscode-<version>.vsix` im Template belassen.
4. Automatische Installation über Installer/Support:
   - `install-local-extension.mjs` baut bei Bedarf die VSIX neu und installiert diese.
   - installierter Stand wird über `publisher.name@version` plus VSIX-Signatur geprüft; bei geändertem Inhalt wird auch bei gleicher Versionsnummer aktualisiert.
   - in WSL wird explizit auf dem Remote-Target (`--remote wsl+<Distro>`) installiert.
5. Fallback für gesperrte Umgebungen:
   - wenn `code`-CLI fehlt, bleibt manuelle VSIX-Installation als klarer Fallback.

Empfehlung für Release-Pakete:
- Pro Kunden-Release genau eine neue VSIX-Version beilegen.
- Updates über Installer/Repair-Flow ausrollen; `.vscode/tasks.json` bleibt frei von Folder-Open-Installationsaufgaben.
