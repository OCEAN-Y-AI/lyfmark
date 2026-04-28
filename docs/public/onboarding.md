# Onboarding für die Redaktion (Visual Studio Code)

Ziel dieser Anleitung: Sie können ohne technische Vorkenntnisse selbstständig an Website-Inhalten arbeiten und Änderungen sicher mit dem Team synchronisieren.

## Was Sie nach diesem Onboarding können

- Das vom Installer eingerichtete Projekt sicher öffnen.
- Den Astro-Server direkt in VSC mit `F5` starten (Primärweg).
- Inhalte in Markdown-Dateien bearbeiten.
- Änderungen mit Git in VSC committen, pushen, pullen und Konflikte lösen.

## 1) Einmalige Einrichtung am Rechner

Starten Sie den Installer für Ihr Betriebssystem (`docs/public/installation.md`). Der Installer richtet die benötigten Programme ein, verbindet das Projekt mit GitHub und öffnet danach automatisch die vorbereitete Kundenansicht in Visual Studio Code.

Nach der Installation können Sie das Projekt jederzeit über den Desktop-Link wieder öffnen.

Wenn Sie einem bereits bestehenden Projekt beitreten und dafür eine Repository-Adresse erhalten haben, öffnen Sie das Projekt über Visual Studio Code. Führen Sie danach einmal im Terminal aus:

```bash
npm ci
```

## 2) Website lokal starten (Primärweg: Run & Debug mit `F5`)

### Standardweg

- Öffnen Sie links den Bereich `Run and Debug`.
- Wählen Sie oben die Konfiguration `Development server`.
- Klicken sie auf die Play button oder drücken Sie `F5`.
- Im Terminal erscheint ein lokaler Link (meist `http://localhost:4321`). Öffnen Sie diesen im Browser.

### Alternative

- Öffnen Sie `Terminal > New Terminal`.
- Führen Sie aus:

```bash
npm run dev
```

### Server stoppen:

- Primär: in VSC `Shift+F5` (Stop Debugging).
- Alternativ: im Terminal `Strg+C` (Windows/Linux) oder `Ctrl+C` (macOS).

## 3) Getting Started

1. `Git: Pull` ausführen, um den aktuellen Stand des Projektes vom Server zu laden.
2. Server mit `F5` starten.
3. Eine `.md`-Datei unter `pages` öffnen.
4. Einen Absatz anpassen und speichern.
5. Änderung im Browser prüfen.
6. Änderung committen und pushen (siehe Abschnitt 5).

Hinweis: Als Redaktion bearbeiten Sie in der Regel Inhalte in `.md`-Dateien. Technische Dateien nur bewusst und mit klarer Rücksprache ändern.

### 3.1 Template wechseln (wenn nötig)

- Das aktive Basis-Design stellen Sie in `site.config.yml` über `defaultTemplate` um.
- Führen Sie danach einmal `npm run lyfmark:sync` aus und starten Sie den Server neu.
- Eine kurze Schritt-für-Schritt-Anleitung finden Sie in `docs/public/templates.md`.

## 4) Git-Grundlagen

- `Remote`: Das zentrale Repository im Internet (Team-Stand).
- `Local`: Ihre lokale Arbeitskopie auf dem Rechner.
- `Commit`: Speichert Ihre Änderung lokal mit einer kurzen Beschreibung.
- `Push`: Lädt Ihre lokalen Commits in das Remote-Repository hoch.
- `Pull`: Holt neue Änderungen vom Remote-Repository auf Ihren Rechner.
- `Sync`: Führt Pull und Push als Kombi aus.

Für die Redaktion gilt meist: Arbeiten auf `main`, sauber in kleinen Schritten committen, regelmäßig pullen.

## 5) Täglicher Arbeitsablauf

1. Vor Arbeitsbeginn `Pull` ausführen.
	- Gibt es ein Problem den Server zu starten? Führen Sie einmal `npm ci` aus.
	- Bleibt die Struktur nach Updates inkonsistent (z. B. fehlende Ordnerverknüpfung), führen Sie einmal `npm run repair` aus und starten Sie danach den Server erneut.
2. Inhalte bearbeiten und speichern.
3. Links `Source Control` öffnen.
4. Geänderte Dateien prüfen.
5. Commit-Nachricht schreiben (z. B. `Startseite: Abschnitt Leistungen aktualisiert`).
6. `Commit` klicken.
7. `Push` klicken (oder `Sync Changes`).
8. Nach dem Push kurz prüfen, ob keine Fehlermeldung angezeigt wurde.

## 6) Merge-Konflikte lösen

Ein Merge-Konflikt tritt auf wenn zwei Personen dieselbe Stelle ändern. Das passiert häufiger mal, hier muss man nicht vorsichtig sein, dafür ist Git da.

So gehen Sie in VSC vor:

1. Starten Sie `Pull` oder `Sync`.
2. Wenn ein Konflikt gemeldet wird, öffnen Sie die betroffene Datei über `Source Control`.
3. VSC zeigt Optionen wie `Accept Current`, `Accept Incoming` oder `Accept Both`.
4. Wählen Sie die passende Variante und prüfen Sie den Text inhaltlich.
> Falls die Konflikte komplex sind, kann die Stelle auch von Hand korrigiert werden. Halten Sie ggf. Rücksprache mit ihren Kollegen um nicht versehentlich Änderungen ihrer Kollegen zu revidieren.
5. Speichern Sie die Datei.
6. Wiederholen Sie das für alle Konfliktdateien.
7. Committen Sie die Konfliktauflösung (Merge-Commit).
8. Pushen Sie den Commit.

## 7) Markdown und `:::`-Module: das Wichtigste für die Redaktion

### 7.1 Aufbau einer Seiten-Datei (`.md`)

- Am Anfang steht das Frontmatter zwischen `---`.
- Danach folgt der eigentliche Inhalt mit Überschriften und Fließtext.

Mindestfelder im Frontmatter:

- `title`
- `description`
- `layout`
- `updated`

### 7.2 Grundlagen in Markdown

- `#` ist die Hauptüberschrift der Seite.
- `##` und `###` sind Unterüberschriften.
- Links schreiben Sie als `[Linktext](/ziel-seite)`.

#### Sprungmarken (Anchor-Links)

- Überschriften sind automatisch anspringbar.
- Beispiel: `## Leistungen` kann mit `/seite#leistungen` verlinkt werden.
- Für stabile, selbst benannte Sprungziele können Sie `:::anchor` nutzen:

```md
:::anchor name="leistungen"
```

### 7.3 `:::`-Module verwenden

Ein Modul startet mit `:::modulname` und endet mit `:::`.

Merksatz zur Leerzeile:

- Sie können Module auch ohne zusätzliche Leerzeilen schreiben; LyfMark formatiert die Datei beim Speichern in eine klare Standardform.
- Nach einem abgeschlossenen Modulblock und nach einem selbstschließenden Modul steht in der Standardform eine Leerzeile.
- Zwei schließende Zeilen `:::` direkt hintereinander bleiben ohne Leerzeile.
- Mehrere `:::link` direkt untereinander bleiben ohne Leerzeile in derselben Link‑Reihe. Eine Leerzeile startet eine neue Link‑Reihe.
- Nach einer Liste (`-`, `1.`) oder einem Zitat (`>`) sorgt LyfMark automatisch für die nötige Trenn‑Leerzeile vor dem nächsten Modul.

Beispiel (korrekt nach Liste):

```md
:::highlight-card
- Punkt A
:::

:::space size="2rem"
```

Beispiel (korrekt nach Zitat):

```md
:::highlight-card
> Kurzer Hinweis
:::

:::space size="2rem"
```

Beispiel:

```md
:::highlight-card label="Hinweis" color="light"

## Kurzer Titel

Das ist ein Beispielinhalt.
:::
```

### 7.4 URL-Vorschläge in Modulen

Wenn die Projekt-Erweiterung `LyfMark VS Code` installiert ist, erhalten Sie in URL-Feldern passende Vorschläge mit `Strg+Leertaste` (Windows/Linux) oder `Ctrl+Space` (macOS).

Beispiele:

- In `:::background-image url="..."` werden Bilddateien aus `public` vorgeschlagen.
- In `:::link to="..."` werden gültige interne Seitenpfade vorgeschlagen.

Wichtig: Vorschläge sind freiwillig. Sie können jederzeit einen eigenen Freitext-Wert eintragen (z. B. externe URL).

### 7.5 Alte URL weiterleiten (Redirect)

Wenn eine Seite umgezogen ist, lassen Sie am alten Pfad eine Redirect-Seite stehen:

```md
---
title: Weiterleitung
layout: ~/layouts/redirect.astro
redirectTo: /neuer-pfad
updated: 2026-03-25
---
```

- `redirectTo` ist Pflicht.
- Die Datei liegt am alten Pfad und leitet automatisch zur neuen Seite weiter.

## 8) Wo finde ich vertiefende Infos?

Weitere Unterlagen im Projekt:

- `docs/public/README.md` (Startseite der Kundendokumentation)
- `docs/public/content-richtlinien.md` (Redaktionsregeln)
- `docs/public/templates.md` (Template auswählen/wechseln)
- `docs/public/modules/README.md` (alle verfügbaren `:::`-Module)
- `docs/public/examples/README.md` (konkrete Modulbeispiele)
- `docs/public/menu.md` (Menüpflege)

Externe Grundlagen:

- VS Code Source Control Quickstart: https://code.visualstudio.com/docs/sourcecontrol/quickstart
- VS Code Merge-Konflikte: https://code.visualstudio.com/docs/sourcecontrol/merge-conflicts
- GitHub Branches (erweiterte Arbeitsweise): https://docs.github.com/github/collaborating-with-issues-and-pull-requests/about-branches

## 9) Häufige Probleme

### `git` wird nicht erkannt

Git ist nicht installiert oder VSC wurde nach der Installation nicht neu gestartet.

### `npm` wird nicht erkannt

Node.js (LTS) ist nicht installiert oder VSC wurde nach der Installation nicht neu gestartet.

### `F5` startet den Server nicht

- Prüfen, ob im Bereich `Run and Debug` die Konfiguration `Development server` ausgewählt ist.
- Falls es trotzdem nicht läuft, als Fallback `npm run dev` im Terminal starten.
