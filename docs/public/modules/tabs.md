# Modul `tabs`

## Zweck

Erzeugt Registerkarten aus mehreren Abschnitten, die der Leser per Klick wechseln kann.

## Wann einsetzen

Nutzen, wenn mehrere Inhalte auf kleinem Raum geordnet werden sollen.

## Inhalte vorbereiten

- Jeder Tab beginnt mit einer `###`‑Überschrift.
- Die erste `###`‑Überschrift dient nur als Tab-Titel und wird im Tab-Inhalt nicht zusätzlich angezeigt.
- Tabs werden mit einer eigenen Zeile `---` getrennt.

## Verwendung (Minimal‑Beispiel)

````md
:::tabs
### Strategie
Wir priorisieren Maßnahmen nach Wirkung und Aufwand.

---

### Umsetzung
Jeder Tab kann Listen, Links oder weitere Module enthalten.
:::
````

## Optionen

- `color` – `light` (Standard), `dark`, `transparent-light`, `transparent-dark`.
- `label` – kurze Beschreibung der Tab‑Gruppe (nützlich bei mehreren Tabs auf einer Seite).
- `style` – für Sonderfälle (individuelles CSS).

## Design-Verhalten

- Die Tab-Buttons verwenden die globalen `ui-button`-Styles aus dem Link-Modul.
- Aktiver Tab: Solid-Variante, inaktive Tabs: passende `outline`-Variante.

## Background-Image Verhalten

- `:::background-image` innerhalb eines Tabs wirkt nur in diesem Tab-Panel.
- `:::background-image` vor dem ersten `###` innerhalb von `:::tabs` wirkt global hinter allen Tabs.
- Vor dem ersten `###` sind nur `:::background-image` sowie Leerzeilen/Kommentare erlaubt.

## Stolperstellen

- Es braucht mindestens zwei Tabs.
- Jeder Tab muss mit einer `###`‑Überschrift starten.
- Der Trenner `---` muss alleine in einer Zeile stehen.
