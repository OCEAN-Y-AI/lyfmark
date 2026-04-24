# Templates auswählen und wechseln

Ziel: Sie können das Erscheinungsbild der gesamten Website mit einem einzigen Wert umstellen.

## Zweck

- Ein Template steuert das Grunddesign Ihrer Website.
- Module bleiben inhaltlich gleich, passen ihr Design aber an das aktive Template an.

## So wechseln Sie das aktive Template

1. Öffnen Sie im Projekt-Root die Datei `site.config.yml`.
2. Ändern Sie den Wert bei `defaultTemplate` auf den gewünschten Template-Namen.
3. Speichern Sie die Datei.
4. Starten Sie den lokalen Server neu (`F5` oder `npm run dev`).

Hinweis:

- Beim Start über `npm run dev` wird die Template-Zusammenstellung automatisch aktualisiert.
- Wenn Sie Templates oder Module während der Arbeit manuell hinzufügen oder löschen, führen Sie danach einmal `npm run lyfmark:sync` aus.

  Beispiel:

```yml
defaultTemplate: "primary"
```

## Einzelne Seite bewusst anders darstellen

Wenn nur eine einzelne Seite ein anderes Template nutzen soll, setzen Sie auf dieser Seite im Frontmatter zusätzlich `template`.

Beispiel:

```md
---
title: "Leistungen"
description: "Unsere Leistungen im Überblick"
layout: "~/layouts/primary.astro"
template: "primary"
updated: 2026-04-21
---
```

Regel:

- `template` ist optional.
- Ohne `template` nutzt die Seite automatisch `defaultTemplate` aus `site.config.yml`.
- Bei einem unbekannten Template-Namen bricht der Build mit einer klaren Fehlermeldung und gültigen Optionen ab.

## Was automatisch passiert

- Beim Sync werden die Styles des aktiven Templates neu zusammengestellt.
- Für jedes installierte Modul wird der modulare Basisstyle eingebunden.
- Falls für ein Modul kein templatespezifischer Style vorhanden ist, bleibt das Modul trotzdem funktionsfähig und nutzt den Basisstyle.

## Wichtig für den Alltag

- Sie müssen keine `.astro`- oder `.scss`-Dateien anfassen, um das Standard-Template zu wechseln.
- Wenn ein neues Modul installiert oder entfernt wurde, führen Sie danach erneut `npm run lyfmark:sync` aus.
- Alte, nicht mehr benötigte generierte Template-Dateien werden beim Sync automatisch bereinigt.

## Häufige Stolperstellen

- Wenn ein Template-Wechsel nicht sichtbar wird, wurde der Server meist nicht neu gestartet.
- Wenn ein Template-Name falsch geschrieben ist, meldet der Build einen klaren Fehler mit gültigen Optionen.
- Wenn beim Sync eine Warnung erscheint, bleibt die Website nutzbar. Die Hinweise zeigen nur, wo noch optionale Design-Nacharbeit sinnvoll ist.
