# Modul `accent-rule`

## Zweck

Rendert den einheitlichen Design-Strich in fester Größe und mit konfigurierbarer Farbe.

## Wann einsetzen

Nutzen, wenn eine Überschrift visuell unterstrichen oder ein Abschnitt klar getrennt werden soll.

## Verwendung (Minimal‑Beispiel)

```md
:::accent-rule
```

## Optionen

- `kind` – `underline` (Standard, dekorativer Strich) oder `divider` (semantischer Trenner via `<hr>`).
- `before` – optionaler Abstand oberhalb des Strichs als CSS‑Länge.
- `after` – optionaler Abstand unterhalb des Strichs als CSS‑Länge.
- `color` – optionale Strichfarbe als CSS‑Farbwert oder `var(--...)` (Standard: bisherige Highlight-Farbe).
- `style` – für Sonderfälle (individuelles CSS).

## Beispiel mit Sektionstrenner

```md
:::accent-rule kind="divider" before="2rem" after="2rem" color="var(--color-highlight)"
```

## Stolperstellen

- Das Modul steht alleine in der Zeile und benötigt kein schließendes `:::`.
- Inhalt innerhalb des Moduls ist nicht erlaubt.
- Der Strich bleibt geometrisch fix, aber der Modul-Block selbst nutzt die `h1`-Zeilenhöhe aus `typography.scss`, damit der Strich vertikal wie auf einer Headline-Zeile sitzt.
