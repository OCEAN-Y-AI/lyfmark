# LyfMark Release Packaging and Trust Model

Stand: 28.04.2026

## Ziel

LyfMark-Kunden sollen ein eigenes, autarkes GitHub-Projekt erhalten. Das Kundenprojekt basiert auf einem geprüften LyfMark-Core-Paket und enthält keine Git-Historie oder Entwicklungsbindung an das interne LyfMark-Repository.

Das interne GitHub-Repository bleibt Entwicklungsquelle und vorübergehender Download-Host. Es ist nicht die Vertrauenswurzel für Kundeninstallationen.

Operativer Entwicklerablauf für konkrete Releases: `docs/internal/release-flow.md`.

## Produktentscheidung

- Core-Version `1.0` ist das erste Paket für den nächsten Testkunden.
- Der Installer klont nicht mehr das Entwicklungsrepository.
- Der Installer lädt ein versioniertes Core-Release-Paket, entpackt es lokal und initialisiert daraus ein neues Git-Repository für den Kunden.
- Kunden-Repositories liegen bewusst unter Kontrolle des Kunden. LyfMark darf nicht voraussetzen, dass Lyfeld IT Zugriff auf diese Repositories hat.
- Der Standardpfad nutzt einen normalen GitHub-SSH-Key des Kunden. Zusätzliche projektbezogene Schlüssel sind für die Zielgruppe zu erklärungsintensiv und bleiben Beratungs-/Expertenoption.
- `npm ci` ist der Standardinstallationsbefehl für Projektabhängigkeiten, damit der ausgelieferte `package-lock.json` reproduzierbar genutzt wird.

## Release-Artefakte

Für `core 1.0` sollen folgende Artefakte entstehen:

```text
lyfmark-core-1.0.zip
lyfmark-core-1.0.manifest.json
lyfmark-core-1.0.manifest.sig
lyfmark-core-1.0.release-key.json
lyfmark-core-1.0.release-key.sig
```

Aktueller pragmatischer Paketumfang:

- gesamter Repository-Inhalt ohne `.git`
- später durch explizite Allowlist ersetzt

Nicht das automatisch von GitHub generierte Source-Archiv verwenden. Der Release-Build muss ein bewusst erzeugtes LyfMark-Artefakt sein.

Aktueller Build-Befehl für Core `1.0`:

```bash
npm run build:release
```

Das Ergebnis liegt unter `dist-release/` und wird nicht in Git versioniert. Der Upload ist ein getrennter Schritt und baut keine Artefakte:

```bash
npm run release:core
```

## Offline-Release-Prozess

GitHub Actions ist nicht die Build-Vertrauenswurzel. Der Core-Build ist aktuell nur das kontrollierte Erzeugen einer ZIP-Datei und kann deshalb lokal/offline erfolgen.

Zielprozess:

1. Sauberen Checkout der freizugebenden Version vorbereiten.
2. Offline Release-Key für exakt eine Paketversion erzeugen, z. B. `core 1.0`.
3. Release-Key-Metadata mit dem offline gehaltenen Root Key signieren.
4. Paketinhalt deterministisch zusammenstellen.
5. ZIP erzeugen.
6. SHA-256 des ZIP berechnen.
7. Manifest erzeugen.
8. Manifest mit dem privaten Release Key signieren.
9. Artefakte zu GitHub Release oder später eigenem Download-Server hochladen.

Der private Root Key und der private Release Key dürfen nicht in GitHub Actions Secrets oder im Repository liegen.

## Trust Chain

Der Installer enthält fest eingebettet:

```text
LyfMark root public key
```

Prüfung vor dem Entpacken:

1. `release-key.json` wurde vom Root Key signiert.
2. `release-key.json` gilt exakt für Paketname, Pakettyp und Version.
3. `manifest.json` wurde vom Release Key signiert.
4. Manifest beschreibt exakt das angeforderte Paket.
5. SHA-256 des heruntergeladenen ZIP entspricht dem Manifest.
6. Erst danach wird entpackt.

Ein Release Public Key ist effektiv nur einmal für genau eine Version gültig. Für jede neue Paketversion wird offline ein neuer Release Key erzeugt und root-signiert.

## Manifest-Vertrag

Beispiel:

```json
{
	"packageType": "core",
	"packageName": "lyfmark-core",
	"version": "1.0",
	"asset": "lyfmark-core-1.0.zip",
	"sha256": "<sha256>",
	"sourceRepository": "OCEAN-Y-AI/lyfmark",
	"sourceCommit": "<commit-sha>",
	"workingTree": "clean-release",
	"createdAt": "2026-04-28T00:00:00.000Z"
}
```

## Release-Key-Metadata-Vertrag

Beispiel:

```json
{
	"keyId": "lyfmark-core-1.0",
	"packageType": "core",
	"packageName": "lyfmark-core",
	"version": "1.0",
	"publicKey": "<public-key>",
	"createdAt": "2026-04-28T00:00:00.000Z"
}
```

Die Gültigkeit darf nicht allgemein formuliert sein. Der Key muss auf genau das eine Paket begrenzt sein.

## Keine vertrauenswürdigen Release-Indizes

Ein Release-Index ist nicht Teil der Vertrauenskette. Wenn später ein Katalog verwendet wird, darf er nur als unvertrauenswürdige Suchhilfe für URLs dienen. Wahrheit entsteht ausschließlich durch die Signaturkette und das Manifest.

Für den Start sind berechenbare Asset-Namen und direkte Release-URLs einfacher und weniger fehleranfällig.

## Installer-Zielablauf

1. Installer lädt Bootstrap-Skript oder wird später als signierter Wrapper gestartet.
2. Installer prüft/installiert Systemprogramme.
3. Installer lädt Core-Paket, Manifest, Signaturen und Release-Key-Metadata.
4. Installer verifiziert die Signaturkette.
5. Installer entpackt das Core-Paket.
6. Installer initialisiert ein neues Git-Repository:
	- `git init`
	- `git branch -M main`
	- `git add .`
	- `git commit -m "Initial LyfMark website"`
7. Installer richtet GitHub für den Kunden ein:
	- GitHub-Anmeldung per Browser/OAuth/Device Flow
	- neues Repository im Kundenaccount erstellen
	- Kunden-SSH-Key prüfen/erzeugen und bei GitHub hinterlegen
	- `origin` auf das Kundenrepository setzen
	- initialen Push auf `main` ausführen
8. Installer führt `npm ci` aus.
9. Installer führt `npm run repair` aus.
10. Installer installiert die LyfMark-VS-Code-Extension.
11. Installer erstellt Desktop-Link und öffnet die Customer-Workspace.

## Fehlerbehandlung

Gut automatisch erkennbar:

- Release-Paket fehlt.
- Manifest oder Signatur fehlt.
- Signaturkette ungültig.
- ZIP-Hash passt nicht zum Manifest.
- GitHub-Login wurde nicht abgeschlossen.
- Repo-Name existiert bereits.
- GitHub-Token hat nicht genug Rechte.
- SSH-Key konnte nicht bei GitHub hinterlegt werden.
- Push schlägt wegen fehlender Rechte oder nicht leerem Remote fehl.
- Netzwerk/TLS/Proxy-Fehler.

Nicht sinnvoll vollständig automatisierbar:

- Kunde besitzt keinen GitHub-Account.
- Organisation blockiert OAuth/GitHub-App/SSH-Key-Anlage.
- Kunde will ein bestehendes Repository mit Inhalt verwenden.
- Firmen-Proxy bricht TLS-Vertrauen oder manipuliert Zertifikate.

## Spätere Erweiterungspakete

Templates und Module sind unabhängig vom Core und werden später über denselben Paketmechanismus installiert:

- Kauf und Berechtigungen liegen auf dem LyfMark-Server.
- Installer/Downloader fragt per Token-Flow ab, welche Pakete erlaubt sind.
- Download erfolgt paketweise.
- Jedes Paket besitzt Manifest, Signatur und paketgebundenen Release Key.
- Keine Runtime-/Build-Lizenzprüfung gegen den Server.

Ältere Templates oder Module dürfen installierbar bleiben, wenn der Kunde sie bewusst wählt und die Kompatibilitätsregeln erfüllt sind.

## Sicherheitsgrenzen

Dieses Modell schützt gegen:

- manipulierte Downloads
- kompromittierte Release-Assets ohne Zugriff auf Release-Key
- Man-in-the-middle-Angriffe gegen Paketdaten
- versehentliche falsche Paketversionen

Dieses Modell schützt nicht gegen:

- kompromittierte lokale Kundenrechner
- kompromittierten privaten Release-Key
- bösartige Änderungen, die vor dem Offline-Release bewusst signiert wurden
- Supply-Chain-Risiken in npm-Abhängigkeiten

`npm ci` reduziert npm-Drift, ersetzt aber keine vollständige Dependency-Supply-Chain-Absicherung. Eine spätere Offline-/Cache-/Lockfile-Verifikation bleibt ein eigener Sicherheitsbaustein.

## Pragmatischer nächster Testkunden-Stand

Für den nächsten Testkunden genügt ein bewusst begrenzter Zwischenstand:

- Core-Paket `1.0` lokal bauen und als GitHub Release Asset hochladen.
- Installer lädt ZIP statt Git-Repository.
- Installer initialisiert daraus ein lokales Git-Repository mit `main`.
- Installer nutzt `npm ci`.
- Initialer Push wird unterstützt, wenn eine vorhandene leere Kunden-GitHub-Repository-URL übergeben oder eingegeben wird.
- Vollautomatische GitHub-Repository-Erstellung per OAuth/GitHub-App bleibt Folgearbeit, weil dafür ein registrierter Client und ein finaler Berechtigungsfluss benötigt werden.
- Signaturprüfung wird als Zielarchitektur dokumentiert und kann zunächst als klare Release-Dateistruktur vorbereitet werden, falls die vollständige Kryptoprüfung den Testkunden-Termin gefährdet.

Wenn Sicherheitsprüfung im ersten Testkunden-Installer noch nicht vollständig aktiv ist, muss das explizit als interner Übergangsstand markiert bleiben und darf nicht als finaler Sicherheitszustand kommuniziert werden.
