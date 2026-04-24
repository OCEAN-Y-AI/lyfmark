## Windows

- Visual Studio Code installieren
  - Extensions: Astro (Language support for Astro), Mardown All in One
- Git installieren
- NodeJS installieren (22 LTS, oder neuer)
- Zum Ausführen von npm.ps1 im Terminal: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force`
- Namen/Email
  - git config --global user.name "FIRST LAST"
  - git config --global user.email "NAME@example.com"
  - git config pull.rebase true

## Build unter Subpfad

Für Deployments unter einem Nicht-Root-Pfad (z. B. `https://example.com/example-site/`) muss beim Build die Base gesetzt werden, damit Assets, Menü und Breadcrumbs korrekt verlinken.

- `ASTRO_BASE=/example-site npm run build`

## Offline-Preview (für Versand)

Für eine Vorschau per Doppelklick (ohne lokalen Server) kann ein Offline-Paket erzeugt werden.
Es entsteht eine einzelne ZIP-Datei, die alle Assets enthält und deren Links für `file://` umgeschrieben sind.

- `npm run package:offline`
- Ergebnis: `<package-name>-offline.zip` (z. B. `lyfmark-base-template-offline.zip`) → entpacken → `index.html` doppelklicken

Hinweis: Einige Browser blockieren `type="module"` Scripts bei `file://`; das Offline-Paket ersetzt diese Script-Tags automatisch durch klassische `defer`-Scripts.

## VS-Code-Workspaces (Kunde vs. Entwickler)

Die Basisauslieferung enthält eine Workspace-Datei unter `.vscode/`:

- `.vscode/lyfmark.customer.code-workspace`

Ziel:

- Nicht-technische Nutzer sehen nur die Arbeitsbereiche für Inhalte.
- Entwickler arbeiten weiterhin direkt über „Open Folder“ mit dem vollständigen Projektbaum.

Nutzung:

- Kunden starten VS Code mit `.vscode/lyfmark.customer.code-workspace`.
- Entwickler öffnen den Projektordner direkt über „Open Folder“.

Verhalten:

- Die Customer-Workspace blendet Betriebs- und Technikpfade aus (z. B. `node_modules`, `src`, `tools`, `dist`, `docs/internal`).

Installer-Integration:

- Installer und Onboarding sollen standardmäßig die Customer-Workspace öffnen.
- Für Support und Implementierung wird der Projektordner bewusst direkt geöffnet („Open Folder“).

## Reparatur bei lokaler Strukturabweichung

- Ein beschädigtes lokales Setup wird mit einem Befehl wiederhergestellt:
  - `npm run repair`
- Der Befehl führt folgende Schritte aus:
  - prüft/erstellt die Root-Ordner (`pages`, `content-blocks`, `navigation`, `forms`, `public`, `docs/public`)
  - repariert Spiegel-Links/Junctions unter `src/*`
  - führt `lyfmark:sync` aus
  - zeigt eine kompakte Health-Zusammenfassung

## Geführter Installer (Doppelklick)

- Einstieg über OS-Wrapper:
  - Windows: `installer/windows/install.cmd`
  - macOS: `installer/macos/install.command`
  - Linux: `installer/linux/install.sh`
- Technischer Kern: `tools/installer/wizard.mjs`
- npm-Shortcut: `npm run installer:wizard`

Der Wizard prüft/geführt:

- Pflicht-Tools (`node`, `npm`, `git`, `ssh-keygen`)
- Git-Identität (`user.name`, `user.email`)
- SSH-Key-Setup für GitHub
- `npm install` und anschließend `npm run repair`

## Installer-Tests (für CI und manuelle VM-Prüfung)

- Smoke-Tests: `npm run test:installer`
- Voller E2E-Ablauf (automatisch): `npm run test:installer:e2e:auto`
- Voller E2E-Ablauf (manuell/interaktiv): `npm run test:installer:e2e:manual`

Der E2E-Test nutzt ein temporäres HOME und mockt die GitHub-URL-Öffnung, damit der komplette Setup-Flow reproduzierbar ohne echten Login geprüft werden kann.

## Link-/HMR-Regressionstest (cross-root)

- Integrationstest: `npm run test:hmr-links`
- Abdeckung: Änderungen unter `pages/`, `content-blocks/`, `forms/`, `navigation/` werden im Dev-Server korrekt neu gerendert.
- CI-Matrix: `.github/workflows/hmr-link-tests.yml` auf `ubuntu-latest`, `macos-latest`, `windows-latest`.
