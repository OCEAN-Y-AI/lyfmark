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

- Zielbild für Endkunden: `LyfMark-Setup.exe` als einziges Doppelklick-Artefakt.
- Windows-Bootstrap-Skript für aktuelle Tests und den späteren `.exe`-Wrapper: `installer/windows/install.ps1`.
- Projektinterne OS-Wrapper für bereits geladene Projektordner:
  - Windows: `installer/windows/install.cmd`
  - macOS: `installer/macos/install.command`
  - Linux: `installer/linux/install.sh`
- Technischer Projekt-Wizard: `tools/installer/wizard.mjs`
- npm-Shortcut: `npm run installer:wizard`

Das Windows-Bootstrap-Skript:

- fragt den Projekt-/Webseitennamen ab und verwendet ihn als Zielordner
- kann Daten direkt per Parameter oder gesammelt per Install-Info-JSON erhalten
- installiert/prüft Git, Node.js/npm, `ssh-keygen` und Visual Studio Code
- lädt langfristig ein versioniertes LyfMark-Core-Paket statt das interne Entwicklungsrepository zu klonen
- initialisiert daraus ein eigenes Kunden-Git-Repository mit Branch `main`
- pusht den Initial Commit, wenn eine Kunden-GitHub-Repository-URL übergeben oder eingegeben wurde
- startet danach den Projekt-Wizard
- installiert die LyfMark-VS-Code-Extension einmalig
- erstellt einen Desktop-Link auf die Customer-Workspace
- öffnet am Ende die Customer-Workspace in Visual Studio Code

Der Projekt-Wizard führt:

- Pflicht-Tools (`node`, `npm`, `git`, `ssh-keygen`)
- Git-Identität (`user.name`, `user.email`)
- SSH-Key-Setup für GitHub
- `npm ci` und anschließend `npm run repair`

Release-/Paket-Sicherheit:

- Operativer Release-Ablauf: `docs/internal/release-flow.md`
- Zielbild: `docs/internal/release-packaging-security.md`
- Core-Version für den nächsten Testkunden: `1.0`
- Core-Release lokal bauen und prüfen: `npm run build:release`
- Core-Release vorhandene Artefakte hochladen: `npm run release:core`
- Core-Release vor Upload in einer VM mit lokalem `-CorePackageUrl` testen: `docs/internal/release-flow.md`
- GitHub dient für Kundenpakete zunächst als Download-Host, nicht als Vertrauenswurzel.
- Das Kundenprojekt darf nicht die Git-Historie des internen LyfMark-Repositorys enthalten.
- Die vollautomatische GitHub-Repository-Erstellung per OAuth/GitHub-App bleibt Folgearbeit; der pragmatische Testkundenstand akzeptiert eine vorhandene leere Repository-URL.

Manueller Windows-VM-Test des aktuellen GitHub-Skripts:

- Skript laden:
  - `powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri https://raw.githubusercontent.com/OCEAN-Y-AI/lyfmark/main/installer/windows/install.ps1 -OutFile $env:TEMP\lyfmark-install.ps1"`
- Skript ausführen:
  - `powershell -NoProfile -ExecutionPolicy Bypass -File $env:TEMP\lyfmark-install.ps1`

Beispiel mit direkter Parameterübergabe:

- `powershell -NoProfile -ExecutionPolicy Bypass -File $env:TEMP\lyfmark-install.ps1 -ProjectName "Example Website" -Yes -GitName "Jane Doe" -GitEmail "jane@example.com" -SshComment "jane@example.com"`

Beispiel mit Install-Info-Datei für spätere GUI-Wrapper:

```json
{
  "projectName": "Example Website",
  "gitName": "Jane Doe",
  "gitEmail": "jane@example.com",
  "sshComment": "jane@example.com",
  "yes": true
}
```

- Ausführen:
  - `powershell -NoProfile -ExecutionPolicy Bypass -File $env:TEMP\lyfmark-install.ps1 -InstallInfoPath C:\Path\install-info.json`

Hinweise:

- Ja/Nein-Abfragen können mit Enter bestätigt werden; dadurch ist kein `y` auf eventuell falsch gemappten Tastaturen nötig.
- Der erhöhte Administrator-Prozess installiert nur fehlende Systemprogramme und beendet sich danach automatisch. Das eigentliche Projekt-Setup läuft anschließend im normalen Nutzerkontext weiter.

## Installer-Tests (für CI und manuelle VM-Prüfung)

- Smoke-Tests: `npm run test:installer`
- Voller E2E-Ablauf (automatisch): `npm run test:installer:e2e:auto`
- Voller E2E-Ablauf (manuell/interaktiv): `npm run test:installer:e2e:manual`
- Pre-Release-Windows-VM-Test ohne GitHub-Upload: `npm run build:release`, dann `installer/windows/install.ps1` mit `-CorePackageUrl` auf das lokale `dist-release/lyfmark-core-1.0.zip` ausführen.

Der E2E-Test nutzt ein temporäres HOME und mockt die GitHub-URL-Öffnung, damit der komplette Setup-Flow reproduzierbar ohne echten Login geprüft werden kann.

## Link-/HMR-Regressionstest (cross-root)

- Integrationstest: `npm run test:hmr-links`
- Abdeckung: Änderungen unter `pages/`, `content-blocks/`, `forms/`, `navigation/` werden im Dev-Server korrekt neu gerendert.
- CI-Matrix: `.github/workflows/hmr-link-tests.yml` auf `ubuntu-latest`, `macos-latest`, `windows-latest`.
