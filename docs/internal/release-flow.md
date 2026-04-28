# LyfMark Release Flow

Stand: 28.04.2026

## Zweck

Dieses Dokument ist die operative Entwickler-Checkliste für LyfMark-Releases. Es beschreibt, wie ein Core-Release gebaut, geprüft und als GitHub-Release-Asset bereitgestellt wird.

Die Sicherheitsarchitektur steht separat in `docs/internal/release-packaging-security.md`. Wenn sich Release-Befehle, Versionierung, Artefaktnamen, Upload-Ziele oder Release-Prüfschritte ändern, muss dieses Dokument im selben Arbeitsschritt aktualisiert werden.

## Aktueller Release-Stand

- Pakettyp: `core`
- Aktuelle Core-Version: `1.0`
- Paketdatei: `lyfmark-core-1.0.zip`
- Manifest: `lyfmark-core-1.0.manifest.json`
- GitHub-Release-Tag: `core-v1.0`
- GitHub-Release-Asset-URL:

```text
https://github.com/OCEAN-Y-AI/lyfmark/releases/download/core-v1.0/lyfmark-core-1.0.zip
```

Aktuell ist die Signaturprüfung noch nicht aktiv. Das Manifest enthält bereits Paketdaten und SHA-256, ist aber im pragmatischen Testkundenstand noch nicht Teil einer vollständigen Kryptoprüfung.

## Kurzablauf

Für den aktuellen Core-Release `1.0` ist der lokale Standardablauf:

```bash
npm run build:release
npm run release:core
```

`npm run build:release` baut und prüft die Artefakte. `npm run release:core` baut absichtlich nichts, sondern validiert die bereits vorhandenen Artefakte und lädt sie hoch.

Nach dem Upload den Installer in einer frischen Windows-VM testen.

## Vorbedingungen

- Der gewünschte Release-Stand ist committed.
- Der Working Tree ist sauber.
- `package-lock.json` ist aktuell.
- Keine temporären Testdaten oder Kundendaten sind im Repository.
- Für automatischen Upload: GitHub CLI (`gh`) ist installiert und mit Schreibrechten für `OCEAN-Y-AI/lyfmark` authentifiziert.
- Für eingeschränkte/Read-only-Tokens: Upload erfolgt manuell über die GitHub-Weboberfläche.
- Das Release wird nicht aus dem automatisch von GitHub erzeugten Source-Archiv gebaut.

Der Paketbuilder bricht ohne `--allow-dirty` ab, wenn der Working Tree nicht sauber ist. `--allow-dirty` ist nur für lokale Tests erlaubt, niemals für ein echtes Release.

## Versionsänderung

Wenn die Core-Version geändert wird, müssen mindestens diese Stellen im selben Commit aktualisiert werden:

- `package.json`: Script `package:core`
- `tools/build-release.mjs`: Default `DEFAULT_CORE_VERSION`
- `tools/release.mjs`: Default `DEFAULT_CORE_VERSION`
- `installer/windows/install.ps1`: Default `CoreVersion`
- `docs/internal/release-flow.md`
- `docs/internal/release-packaging-security.md`

Der GitHub-Release-Tag muss zum Installer-URL-Schema passen:

```text
core-v<major.minor>
```

Beispiel für Version `1.1`:

```text
core-v1.1
lyfmark-core-1.1.zip
lyfmark-core-1.1.manifest.json
```

## Release-Build

Standardbefehl:

```bash
npm run build:release
```

Der Befehl führt aus:

1. Release-Sanity-Check des Repositorys
2. `npm ci`
3. `npm run typecheck`
4. `npm run test:lyfmark-prettier`
5. `npm run test:installer`
6. `npm run test:installer:e2e:auto`
7. `npm run build`
8. Core-Paketbau über `tools/package-core.mjs`
9. Signatur-Schritt
10. Artefaktprüfung
11. Entpacktes Paket mit `npm ci` und `npm run repair` prüfen

Der Release-Sanity-Check prüft bewusst nur wesentliche Voraussetzungen:

- Ausführung aus dem Git-Repository-Root
- sauberer Working Tree im echten Release-Modus
- zentrale Projekt-, Installer-, Tooling- und Dokumentationsdateien vorhanden
- `package:core`, Installer-Default-Version und Release-Doku verwenden dieselbe Core-Version
- die zur LyfMark-VS-Code-Extension-Version passende `.vsix` ist vorhanden
- der aktuelle Signaturstatus ist explizit als Platzhalter/unsigned markiert

Der Signatur-Schritt ist aktuell ein leerer Platzhalter und erzeugt noch keine `.sig`-Dateien. Das ist Absicht, damit der Release-Ablauf bereits die richtige Stelle enthält, aber keinen falschen Sicherheitsstatus vortäuscht.

Der Befehl bricht ab, wenn der Working Tree beim Paketbau nicht sauber ist. Für lokale Ablaufprüfungen ist möglich:

```bash
npm run build:release -- --allow-dirty
```

`--allow-dirty` ist niemals für echte Releases erlaubt und darf nicht hochgeladen werden.

Wenn visuelle Komponenten, Styles oder Client-Skripte geändert wurden, zusätzlich den passenden Browser-Render-Check ausführen:

```bash
npm run render:shot
```

Wenn ein Gate Dateien ändert, diese Änderung prüfen, committen und den Release-Build erneut ausführen. Ein Release wird nur aus einem sauberen Working Tree gebaut.

## Core-Paket Ergebnis

Der Release-Build erzeugt:

```text
dist-release/lyfmark-core-1.0.zip
dist-release/lyfmark-core-1.0.manifest.json
```

`dist-release/` ist bewusst nicht in Git versioniert.

Der niedrigere Paketbau-Einzelbefehl bleibt für Support und Spezialfälle verfügbar:

```bash
npm run package:core
```

Für normale Releases immer `npm run build:release` verwenden, nicht `npm run package:core` allein.

## Artefakt Prüfen

`npm run build:release` führt diese Prüfungen automatisch aus. Die folgenden Befehle sind nur für manuelle Diagnose oder Supportfälle.

Manifest anzeigen:

```bash
cat dist-release/lyfmark-core-1.0.manifest.json
```

SHA-256 vergleichen:

```bash
sha256sum dist-release/lyfmark-core-1.0.zip
```

Der Hash muss dem Feld `sha256` im Manifest entsprechen.

Pflichtdateien im ZIP prüfen:

```bash
for required in \
	.gitattributes \
	package.json \
	package-lock.json \
	installer/windows/install.ps1 \
	tools/installer/wizard.mjs \
	tools/package-core.mjs \
	tools/release.mjs
do
	if ! unzip -Z1 dist-release/lyfmark-core-1.0.zip | grep -Fxq "$required"; then
		echo "ERROR: package is missing $required"
		exit 1
	fi
done
```

Sicherstellen, dass keine Git-Historie enthalten ist:

```bash
if unzip -Z1 dist-release/lyfmark-core-1.0.zip | grep -Eq '^\.git(/|$)'; then
	echo "ERROR: package contains .git data"
	exit 1
fi
```

Entpacktes Paket testen:

```bash
tmp="$(mktemp -d)"
unzip -q dist-release/lyfmark-core-1.0.zip -d "$tmp"
LYFMARK_REPAIR_SKIP_VSCODE_EXTENSIONS=1 npm ci --prefix "$tmp" --no-audit --no-fund
(cd "$tmp" && LYFMARK_REPAIR_SKIP_VSCODE_EXTENSIONS=1 npm run repair)
```

Dieser Test ist wichtig, weil Archiv-/Link-Verhalten erst am entpackten Paket zuverlässig sichtbar wird.

## Pre-Release Installer Test Ohne Upload

Ein Release darf nicht erst nach dem GitHub-Upload zum ersten Mal in einer VM getestet werden. Der Installer kann dasselbe Core-Paket vorab über `-CorePackageUrl` aus einer lokalen Datei oder von einem temporären lokalen HTTP-Server installieren.

Minimaler Ablauf:

```bash
npm run build:release
python3 -m http.server 8787
```

In der Windows-VM dann das lokale Skript und das lokale ZIP verwenden. `<host-ip>` ist die aus der VM erreichbare Adresse des Entwicklungsrechners:

```powershell
$base = "http://<host-ip>:8787"
Invoke-WebRequest -Uri "$base/installer/windows/install.ps1" -OutFile "$env:TEMP\lyfmark-install.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:TEMP\lyfmark-install.ps1" -CorePackageUrl "$base/dist-release/lyfmark-core-1.0.zip" -ProjectName "Release Candidate" -SkipOpenWorkspace
```

Wenn der HTTP-Server in WSL2 läuft, ist `<host-ip>` nicht automatisch die Windows-LAN-IP. WSL2 läuft in einem eigenen NAT-Netz; andere VMs erreichen den WSL-Port nur, wenn Windows den Port weiterleitet. In diesem Fall entweder den Server direkt unter Windows starten oder einen Portproxy einrichten.

Empfohlener Windows-Server statt WSL-Server:

```powershell
cd "\\wsl$\Debian\home\two\projects\lyfmark"
py -3 -m http.server 8787 --bind 0.0.0.0
```

Aus der Windows-VM zuerst die Erreichbarkeit prüfen:

```powershell
Test-NetConnection <windows-host-ip> -Port 8787
```

Wenn der Port blockiert ist, auf dem Windows-Host eine temporäre Firewall-Regel setzen:

```powershell
New-NetFirewallRule -DisplayName "LyfMark local release test 8787" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8787
```

Falls Python unter Windows nicht verfügbar ist, kann alternativ ein Windows-Portproxy auf die aktuelle WSL-IP zeigen. Die WSL-IP muss nach jedem WSL-Neustart neu geprüft werden:

```powershell
wsl hostname -I
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=8787 connectaddress=<wsl-ip> connectport=8787
New-NetFirewallRule -DisplayName "LyfMark local release test 8787" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8787
```

Nach dem Test den Portproxy wieder entfernen:

```powershell
netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=8787
Remove-NetFirewallRule -DisplayName "LyfMark local release test 8787"
```

Alternativ können `installer/windows/install.ps1` und `dist-release/lyfmark-core-1.0.zip` direkt in die VM kopiert werden:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Temp\install.ps1" -CorePackageUrl "C:\Temp\lyfmark-core-1.0.zip" -ProjectName "Release Candidate" -SkipOpenWorkspace
```

Empfohlene VM-Gates:

- Saubere VM mit bereits installierten Tools: prüft Paketdownload/-kopie, Entpacken, lokales Git-Repository, `npm ci`, `npm run repair`, Initial Commit, Extension-Installation und Workspace-Erstellung.
- Frische VM ohne Git/Node/VS Code: prüft zusätzlich die `winget`-Toolinstallation. Diese Prüfung kann GitHub Actions nicht zuverlässig ersetzen, weil Hosted Runner die meisten Tools bereits mitbringen und kein echter Endkunden-Desktop sind.
- Nach erfolgreichem Test VM auf Checkpoint zurücksetzen, statt wiederholt neue GitHub-Releases zu erzeugen.

Erst wenn dieser VM-Test grün ist, werden ZIP und Manifest als GitHub Release Asset veröffentlicht.

## GitHub Release Hochladen

Komfortpfad mit einem GitHub-Token, der Releases schreiben darf:

```bash
npm run release:core
```

Der Befehl baut absichtlich nichts. Er prüft stattdessen vor dem Upload:

- Ausführung aus dem Git-Repository-Root
- passender `package:core`-/`release:*`-Script-Vertrag
- sauberer Working Tree
- Branch `main`
- `origin` zeigt auf `OCEAN-Y-AI/lyfmark`
- GitHub CLI ist verfügbar und mit Release-Schreibrechten authentifiziert
- `HEAD` entspricht `origin/main`
- Release-Tag fehlt oder zeigt bereits auf `HEAD`
- `dist-release/lyfmark-core-1.0.zip` und Manifest existieren
- Manifest passt zu Pakettyp, Paketname, Version, Dateiname, SHA-256, `sourceCommit` und `workingTree`
- bestehende Release-Assets werden nicht versehentlich überschrieben

Wenn ZIP oder Manifest fehlen, zuerst bauen:

```bash
npm run build:release
```

Dry-Run ohne Upload:

```bash
npm run release:core -- --dry-run
```

Wenn ein vorhandener Testrelease vor Kundenauslieferung bewusst ersetzt werden soll:

```bash
npm run release:core -- --clobber
```

`--clobber` nur verwenden, wenn sicher ist, dass noch kein Kunde dieses Asset produktiv nutzt. Nach Kundenauslieferung keine stillen Asset-Ersetzungen durchführen. Stattdessen neue Version bauen und dokumentieren.

Für spätere Pakettypen sind die Befehle bereits reserviert:

```bash
npm run release:template
npm run release:modules
```

Sie brechen aktuell bewusst mit einer klaren Meldung ab, bis Paketdefinitionen, Artefaktprüfungen und Upload-Regeln existieren.

Der Sammelbefehl:

```bash
npm run release
```

prüft anhand der Release-Tags, welche Paketveröffentlichungen ausstehen. Auch dieser Befehl baut nicht selbst; fehlende Artefakte müssen vorher mit dem passenden Build-Befehl erzeugt werden.

## GitHub Release Manuell Hochladen

Dieser Fallback ist der Standard, wenn der lokal verfügbare GitHub-CLI-Token absichtlich eingeschränkt ist oder keine Release-Schreibrechte hat.

Vorbereitung:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse origin/main
npm run build:release
```

Voraussetzungen:

- `git status --short` gibt nichts aus.
- Branch ist `main`.
- `HEAD` und `origin/main` sind identisch.
- `dist-release/lyfmark-core-1.0.zip` existiert.
- `dist-release/lyfmark-core-1.0.manifest.json` existiert.
- Im Manifest passt `sourceCommit` zu `git rev-parse HEAD`.

Manueller GitHub-Ablauf:

1. GitHub öffnen:

```text
https://github.com/OCEAN-Y-AI/lyfmark/releases/new
```

2. `Choose a tag` setzen:

```text
core-v1.0
```

3. Target auf den aktuellen `main`-Commit setzen. Wenn GitHub nur Branch-Auswahl anbietet, `main` wählen und vor dem Veröffentlichen prüfen, dass `main` auf denselben Commit zeigt wie `git rev-parse HEAD`.

4. Release-Titel setzen:

```text
LyfMark Core 1.0
```

5. Release-Beschreibung setzen:

```text
LyfMark Core 1.0.

Commit: <output of git rev-parse HEAD>

Generated by npm run build:release.
```

6. Diese Dateien hochladen:

```text
dist-release/lyfmark-core-1.0.zip
dist-release/lyfmark-core-1.0.manifest.json
```

7. Als normalen Release veröffentlichen, nicht als Draft oder Prerelease, sofern es das aktive Kundenpaket sein soll.

8. Danach die Download-URL-Prüfung aus dem nächsten Abschnitt ausführen.

Nicht die automatisch von GitHub erzeugten Source-Code-Archive als Kundenpaket verwenden. Sie enthalten nicht den geprüften LyfMark-Release-Artefaktvertrag.

## Download-URL Prüfen

Nach dem Upload muss die Installer-Standard-URL erreichbar sein:

```bash
curl -L --fail --output /tmp/lyfmark-core-1.0.zip https://github.com/OCEAN-Y-AI/lyfmark/releases/download/core-v1.0/lyfmark-core-1.0.zip
```

Optional Manifest ebenfalls prüfen:

```bash
curl -L --fail --output /tmp/lyfmark-core-1.0.manifest.json https://github.com/OCEAN-Y-AI/lyfmark/releases/download/core-v1.0/lyfmark-core-1.0.manifest.json
```

## Installer Prüfen

Nach dem Upload den Installer in einer frischen Windows-VM testen.

Direkter Scriptblock-Start:

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/OCEAN-Y-AI/lyfmark/main/installer/windows/install.ps1")))
```

Für gezielte Tests mit Parametern:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri https://raw.githubusercontent.com/OCEAN-Y-AI/lyfmark/main/installer/windows/install.ps1 -OutFile $env:TEMP\lyfmark-install.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File $env:TEMP\lyfmark-install.ps1 -ProjectName "Release Test" -GithubRepositoryUrl "git@github.com:ACCOUNT/REPOSITORY.git"
```

Der VM-Test muss prüfen:

- Projekt wird aus dem Core-Paket heruntergeladen, nicht aus dem Entwicklungsrepository geklont.
- Lokales Git-Repository existiert.
- Branch ist `main`.
- Initial Commit existiert.
- `npm ci` läuft durch.
- `npm run repair` läuft durch.
- VS Code öffnet die Customer-Workspace.
- Desktop-Link wird angelegt.
- Optionaler Push in ein leeres Kunden-GitHub-Repository funktioniert.

## CI Prüfen

Nach Push auf `main` muss der Installer-Workflow grün sein:

```text
.github/workflows/installer-tests.yml
```

Der Workflow prüft unter anderem:

- Installer-Smoke-Tests auf Linux, macOS und Windows
- E2E-Auto-Tests
- Windows-Bootstrap gegen ein frisches Zielverzeichnis
- Core-Paket-Erzeugung, Manifest-Hash, Pflichtdateien und keine `.git`-Daten

## Übergangsgrenzen

Für den nächsten Testkunden ist dieser Stand akzeptiert:

- Core-Paket statt Entwicklungsrepo-Clone
- eigenes Kunden-Git-Repository
- `main` als Branch
- `npm ci`
- initialer Push mit vorhandener leerer Kunden-GitHub-Repository-URL

Noch nicht final:

- vollautomatische GitHub-Repository-Erstellung per OAuth/GitHub-App
- vollständige Paket-Signaturprüfung
- Allowlist-basierter Paketinhalt statt fast gesamtem Repository
