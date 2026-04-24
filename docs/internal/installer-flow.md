# Installer-Flow (Doppelklick, nicht-technisch)

Stand: 22.04.2026

## Ziel

Der Erststart muss ohne manuelle Terminal-Bedienung möglich sein: Doppelklick auf einen OS-spezifischen Starter, danach geführte Installation bis zum lauffähigen Projektzustand.

## Artefakte

- Kundenartefakt Zielbild: `LyfMark-Setup.exe`.
- Windows-Installationsskript als aktuelle Bootstrap-Quelle: `installer/windows/install.ps1`.
- Projektinterner Wizard nach erfolgreichem Bootstrap: `tools/installer/wizard.mjs`.
- Projektinterne Wrapper für bereits vorhandene Projektordner:
	- Windows: `installer/windows/install.cmd`
	- macOS: `installer/macos/install.command`
	- Linux: `installer/linux/install.sh`

## Ablauf (verbindlich)

1. Das Kundenartefakt lädt die aktuelle Version von `installer/windows/install.ps1` aus GitHub/Server und führt sie aus.
2. Das Bootstrap-Skript fragt den Projekt-/Webseitennamen ab und verwendet ihn als Zielverzeichnis unter dem Installationsordner.
3. Das Bootstrap-Skript prüft/installiert Systemprogramme:
	- `node`
	- `npm`
	- `git`
	- `ssh-keygen`
	- Visual Studio Code
4. Das Bootstrap-Skript lädt das LyfMark-Projekt in den lokalen Zielordner.
5. Der projektinterne Wizard prüft/setzt Git-Identität (`git config --global user.name/user.email`).
6. Der Wizard prüft/erzeugt den SSH-Key (`~/.ssh/id_ed25519`) und öffnet die GitHub-Key-Seite.
7. Der Wizard installiert Projektabhängigkeiten (`npm install`).
8. Der Wizard finalisiert die Struktur (`npm run repair`).
9. Das Bootstrap-Skript installiert die LyfMark-VS-Code-Extension einmalig über `tools/lyfmark-vscode/install-local-extension.mjs`.
10. Das Bootstrap-Skript erstellt einen Desktop-Link auf die Customer-Workspace.
11. Das Bootstrap-Skript öffnet die Customer-Workspace in Visual Studio Code.
12. Abschluss mit klaren nächsten Schritten.

## Fehlerverhalten (DbC)

- Fehlende Pflicht-Tools werden im Windows-Bootstrap über `winget` installiert, falls nicht explizit deaktiviert.
- Wenn `winget` oder eine Systeminstallation blockiert ist, bricht der Installer mit klarer Handlungsanweisung ab.
- Harte Konflikte (z. B. kein Projekt-Root, fehlgeschlagene Setup-Schritte) brechen mit eindeutiger Handlungsanweisung ab.
- Keine stillen Fallbacks bei Setup-Fehlern.

## Wrapper-Vertrag

- Das spätere `LyfMark-Setup.exe` ist das einzige Kundenartefakt.
- Das `.exe` enthält keine dauerhaft eingebettete Installationslogik, sondern lädt das aktuelle Installationsskript und führt es aus.
- Der `.exe`-Wrapper muss den Exit-Code des Skripts übernehmen und dessen Fehlerausgabe für Supportfälle sichtbar/logbar machen.
- Projektinterne Wrapper bleiben nur Entwickler-/Support-Einstieg für bereits geladene Projektordner.

## Automatisierung/Support

Windows-Bootstrap (`installer/windows/install.ps1`):

- `-RepositoryUrl <url>`
- `-InstallDirectory <pfad>`
- `-ProjectName <name>`
- `-Yes`
- `-GitName <name>`
- `-GitEmail <email>`
- `-SshComment <email/oder kommentar>`
- `-SkipToolInstall`
- `-SkipVSCode`
- `-SkipOpenWorkspace`
- `-NoPause`

Projekt-Wizard (`tools/installer/wizard.mjs`):

- Für Skriptläufe und Support sind folgende Optionen verfügbar:
	- `--yes`
	- `--skip-git-identity`
	- `--skip-ssh`
	- `--skip-dependencies`
	- `--skip-repair`
- npm-Shortcut: `npm run installer:wizard`

Non-interactive (`--yes`) contract:

- Wenn Git-Identität fehlt, müssen gesetzt sein:
	- `LYFMARK_INSTALLER_DEFAULT_GIT_NAME`
	- `LYFMARK_INSTALLER_DEFAULT_GIT_EMAIL`
- Optional für SSH-Kommentar:
	- `LYFMARK_INSTALLER_DEFAULT_SSH_COMMENT`

## Automatisierte Tests (CI)

- Test-Runner: `tools/test-installer.mjs`
- E2E-Runner (voller Installablauf): `tools/test-installer-e2e.mjs`
- npm-Command: `npm run test:installer`
- npm-Commands:
	- Auto-E2E: `npm run test:installer:e2e:auto`
	- Manual-E2E: `npm run test:installer:e2e:manual`
- GitHub-Workflow: `.github/workflows/installer-tests.yml`

CI-Contract:

- Läuft auf `ubuntu-latest`, `macos-latest`, `windows-latest`.
- Trigger:
	- `pull_request` auf Installer-/Repair-relevante Dateien
	- `push` auf `main` bei Installer-/Repair-relevanten Änderungen
	- manuell via `workflow_dispatch`
- Testet:
	- Fail-fast bei ungültigen Optionen
	- Fail-fast außerhalb vom Projekt-Root
	- nicht-interaktiver Wizard-Lauf inkl. `npm run repair`
	- Wrapper-Smoke-Test je Plattform mit Argument-Weitergabe
	- vollständiger E2E-Installlauf je Plattform (`ubuntu-latest`, `macos-latest`, `windows-latest`) mit Wizard + Wrapper + `npm install` + `npm run repair`
	- Windows-Bootstrap-Skript als echten Einstiegspunkt (`installer/windows/install.ps1`) gegen ein frisches Zielverzeichnis

## VS-Code-Extension-Installation

- Die Extension wird vom Installer vor dem ersten Öffnen von VS Code installiert.
- `.vscode/tasks.json` darf keinen `runOn: folderOpen`-Task für die Extension-Installation enthalten.
- Grund: Ein Folder-Open-Task, der `code --install-extension` startet, kann beim Öffnen der Customer-Workspace wieder neue VS-Code-Fenster auslösen und damit eine Startschleife erzeugen.

## E2E-Modi (Manual + Auto)

- Auto-Modus (`--mode=auto`):
	- läuft vollständig skriptgesteuert
	- nutzt temporäres HOME
	- prüft Git-Identität, SSH-Key-Dateien und Repair-Ausgabe
	- mockt externe URL-Öffnung über `LYFMARK_INSTALLER_MOCK_OPEN_URL_LOG`
- Manual-Modus (`--mode=manual`):
	- startet denselben Ablauf interaktiv für manuelle Sichtprüfung
	- behält Test-HOME zur Nachkontrolle (`--keep-home`)
	- eignet sich für lokale VM/virtuelle Testumgebungen

Mocking-Hinweis:

- GitHub-Anmeldung/Browser-Öffnung wird für E2E-Tests bewusst gemockt; es findet kein echter Login statt.
- URL-Mocking erfolgt über `LYFMARK_INSTALLER_MOCK_OPEN_URL_LOG=<pfad>`.

## Offene Produktgrenze

Der aktuelle Windows-Bootstrap installiert Systemprogramme über `winget`. Das spätere `.exe` ist zunächst nur ein komfortabler Doppelklick-Wrapper um dieses Skript. Ein eigener nativer Installer mit vollständig eingebetteten MSI-Paketen ist erst nötig, wenn `winget` für Zielkunden nicht zuverlässig genug ist oder Offline-Installationen unterstützt werden müssen.
