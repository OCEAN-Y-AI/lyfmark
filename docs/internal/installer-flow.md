# Installer-Flow (Double-Click, nicht-technisch)

Stand: 22.04.2026

## Ziel

Der Erststart muss ohne manuelle Terminal-Bedienung möglich sein: Doppelklick auf einen OS-spezifischen Starter, danach geführte Installation bis zum lauffähigen Projektzustand.

## Artefakte

- Kernlogik: `tools/installer/wizard.mjs`
- Wrapper:
	- Windows: `installer/windows/install.cmd`
	- macOS: `installer/macos/install.command`
	- Linux: `installer/linux/install.sh`

## Ablauf (verbindlich)

1. Projekt-Root validieren (`package.json` vorhanden).
2. Pflicht-Tools prüfen:
	- `node`
	- `npm`
	- `git`
	- `ssh-keygen`
3. Git-Identität prüfen/setzen (`git config --global user.name/user.email`).
4. SSH-Key prüfen/erzeugen (`~/.ssh/id_ed25519`) und GitHub-Key-Seite öffnen.
5. Projektabhängigkeiten installieren (`npm install`).
6. Struktur/Fallbacks finalisieren (`npm run repair`).
7. Abschluss mit klaren nächsten Schritten.

## Fehlerverhalten (DbC)

- Fehlende Pflicht-Tools führen zu klarer Meldung + Download-Link.
- Harte Konflikte (z. B. kein Projekt-Root, fehlgeschlagene Setup-Schritte) brechen mit eindeutiger Handlungsanweisung ab.
- Keine stillen Fallbacks bei Setup-Fehlern.

## Wrapper-Vertrag

- Wrapper müssen per Doppelklick ausführbar sein.
- Wrapper prüfen mindestens auf vorhandenes `node` und delegieren dann an `wizard.mjs`.
- Wrapper beenden mit Exit-Code der Wizard-Ausführung.

## Automatisierung/Support

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

Der Wizard führt derzeit keine automatisierte Systeminstallation von Node/Git durch (Admin-/Policy-abhängig). Stattdessen: geführte Prüfung + Link-gestützter Installweg. Die echte One-Click-Systeminstallation erfolgt im externen Installer-Wrapper (separates Auslieferungsprojekt).
