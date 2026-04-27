# Installer-Flow (Doppelklick, nicht-technisch)

Stand: 24.04.2026

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

- `-InstallInfoPath <pfad>`
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

Install-Info-Datei:

- Bevorzugter Vertrag für spätere GUI-Wrapper, weil Pfade, Namen und E-Mail-Adressen nicht fragil über Shell-Quoting zusammengesetzt werden müssen.
- Direkte CLI-Parameter haben Vorrang vor Werten aus der Datei.
- Unterstützte JSON-Felder:
	- `repositoryUrl`
	- `installDirectory` oder `targetDirectory`
	- `projectName` oder `websiteName`
	- `gitName`
	- `gitEmail`
	- `sshComment`
	- `yes` oder `nonInteractive`
	- `skipToolInstall`
	- `skipVSCode`
	- `skipOpenWorkspace`
	- `noPause`

Beispiel:

```json
{
	"projectName": "Example Website",
	"gitName": "Jane Doe",
	"gitEmail": "jane@example.com",
	"sshComment": "jane@example.com",
	"yes": true
}
```

Projekt-Wizard (`tools/installer/wizard.mjs`):

- Für Skriptläufe und Support sind folgende Optionen verfügbar:
	- `--yes`
	- `--install-info <pfad>` oder `--install-info=<pfad>`
	- `--git-name <name>` oder `--git-name=<name>`
	- `--git-email <email>` oder `--git-email=<email>`
	- `--ssh-comment <email/oder kommentar>` oder `--ssh-comment=<email/oder kommentar>`
	- `--skip-git-identity`
	- `--skip-ssh`
	- `--skip-dependencies`
	- `--skip-repair`
- npm-Shortcut: `npm run installer:wizard`
- Windows-Regel: `npm`-Befehle werden im Wizard nicht über einen bloßen Namen gestartet. Der Wizard bevorzugt die `npm-cli.js`, die zum aktiven `node.exe` gehört, und nutzt nur als Fallback einen absoluten `npm.cmd`-Pfad über `cmd.exe`. Zusätzlich werden Windows-`Path`/`PATH`-Varianten vor Child-Prozessen normalisiert, damit PowerShell-, GitHub-Actions- und GUI-Installer-Kontexte denselben Suchpfad verwenden. Echte Executables wie `git` oder `ssh-keygen` werden weiterhin direkt gestartet.

Non-interactive (`--yes`) contract:

- Wenn Git-Identität fehlt, müssen gesetzt sein:
	- `LYFMARK_INSTALLER_DEFAULT_GIT_NAME`
	- `LYFMARK_INSTALLER_DEFAULT_GIT_EMAIL`
- Optional für SSH-Kommentar:
	- `LYFMARK_INSTALLER_DEFAULT_SSH_COMMENT`

Admin-/Tool-Installationsvertrag:

- Elevation wird nur für fehlende Systemprogramme verwendet.
- Der erhöhte Prozess läuft mit `-AdminToolInstallOnly` und beendet sich ohne Pause.
- Danach läuft der eigentliche Projekt-Setup wieder im normalen Nutzerkontext weiter.
- Wenn der Windows-Bootstrap per Remote-Scriptblock gestartet wird (`& ([scriptblock]::Create((irm "...")))`), existiert kein `$PSCommandPath`. Vor der Elevation muss der Installer seine aktuelle Scriptquelle deshalb in eine temporäre `.ps1` unter `%TEMP%\lyfmark-installer\` schreiben und den erhöhten Prozess mit diesem physischen `-File`-Pfad starten. Ein leerer `-File`-Pfad führt in Windows PowerShell zu Exit-Code `-196608`.
- `winget` wird mit `--silent` und `--disable-interactivity` aufgerufen; `--allow-reboot` wird bewusst nicht verwendet.
- Wenn ein Installer dennoch einen Neustart erzwingt, liegt das außerhalb des LyfMark-Skripts und muss als Paket-/Windows-/VM-Verhalten analysiert werden.
- Native Ausgaben aus PowerShell-Bootstrap-Schritten (z. B. `winget`, `git`, `node`) müssen live im Installationsfenster sichtbar bleiben und dürfen nicht als Funktions-Rückgabewerte weiterlaufen. Dafür wird `System.Diagnostics.ProcessStartInfo` ohne PowerShell-Pipeline und ohne `stdout`/`stderr`-Umleitung genutzt. Sonst kann PowerShell stdout mit fachlichen Rückgabewerten vermischen, harmlose `stderr`-Statuszeilen als terminierende Fehler behandeln oder interaktive Wizard-Fragen verdecken.
- `npm install` ist im normalen Installer-Ablauf verpflichtend und darf keine Auswahlfrage an Endkunden stellen. Bei längerer Stille muss der Wizard eine klare Wartemeldung ausgeben, aber keine unnötige Erklärung, dass keine Eingabe nötig sei.
- Wenn der Windows-Bootstrap den projektinternen Wizard ausführt, muss der Wizard keine manuellen Abschlussanweisungen zum Öffnen von VS Code ausgeben. Desktop-Link und Workspace-Start sind Aufgabe des Windows-Bootstraps.
- Die lokale VS-Code-Extension wird aus der mitgelieferten `.vsix` installiert. Der Installer darf dabei nicht spontan `npx`/`vsce` ausführen, weil das zusätzliche Downloads und Prompts verursachen kann. Auf Windows muss die Extension-Installation direkt `code.cmd` aus dem VS-Code-Installationsordner nutzen können, wenn der `code`-CLI-Befehl nach frischer VS-Code-Installation noch nicht im aktuellen `PATH` liegt. `Code.exe` darf für `--install-extension` nicht verwendet werden, weil dadurch leere VS-Code-Fenster starten können.
- Fehlt die mitgelieferte `.vsix` in einem bestehenden Projektordner, darf der Extension-Installer genau diese technische Paketdatei aus `HEAD` wiederherstellen. Grund: `git pull --ff-only` repariert lokal gelöschte, bereits getrackte Dateien nicht, wenn der Commit schon aktuell ist.
- Für `code --install-extension` wird die `.vsix` relativ aus `tools/lyfmark-vscode` installiert, nicht über einen absoluten Windows-Pfad. Das vermeidet Pfadauflösungsprobleme, bei denen eine sichtbare Datei vom VS-Code-CLI trotzdem als fehlend gemeldet wird.
- `npm run repair` führt die VS-Code-Extension-Installation ebenfalls aus. `.vscode/tasks.json` bleibt trotzdem ohne `runOn: folderOpen`, damit beim Öffnen der Workspace keine Fenster-Schleifen entstehen.

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

Lokaler Vorabtest für Windows:

- Vor einem Push kann der aktuelle Working Tree in ein temporäres lokales Git-Repository kopiert und `installer/windows/install.ps1` per Windows PowerShell dagegen ausgeführt werden. Das testet den echten Bootstrap-Pfad ohne GitHub-Update.
- Der Installationsordner muss auf einem nativen Windows-Laufwerk liegen, z. B. unter `%TEMP%`. WSL-UNC-Pfade (`\\wsl.localhost\...`) oder per `pushd` gemappte WSL-Laufwerke reichen nur für Teiltests: `npm install` kann starten, aber Paket-Lifecycle-Skripte und Junction-/Symlink-Erstellung können dort an Windows-/WSL-Dateisystemgrenzen scheitern.
- Lokale Bootstrap-Tests müssen `HOME` und `USERPROFILE` auf ein temporäres Testverzeichnis setzen, damit Git-Identität und SSH-Key-Erkennung nicht die echte Nutzerumgebung verändern oder auslesen.
- Wenn Codex diesen Test aus WSL ausführen soll, muss ein temporärer Windows-Pfad in der Sandbox beschreibbar sein.

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
