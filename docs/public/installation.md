# Installation (Doppelklick)

Wenn Sie neu starten, nutzen Sie bitte den Installer für Ihr Betriebssystem. Sie müssen dafür kein Terminal manuell öffnen.

## 1) Installer starten

- Windows: `installer/windows/install.cmd`
- macOS: `installer/macos/install.command`
- Linux: `installer/linux/install.sh`

Der Installer führt Sie Schritt für Schritt durch:

- Prüfung von Node.js, npm, Git und SSH
- Git-Basisangaben (Name/E-Mail)
- SSH-Key für GitHub
- Projektvorbereitung mit Strukturprüfung

## 2) Nach dem Installer

- VS Code öffnet sich automatisch mit der vorbereiteten Kundenansicht.
- Zusätzlich legt der Installer einen Desktop-Link für das Projekt an.
- Starten Sie den lokalen Server:
	- `F5` oder `npm run dev`

## 3) Wenn später etwas nicht startet

Falls nach Updates eine Strukturabweichung auftaucht, reicht in der Regel:

```bash
npm run repair
```
