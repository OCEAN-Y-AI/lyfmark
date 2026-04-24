# Modul `background-color`

## Zweck

Erzeugt einen farbigen Abschnitt über die volle Seitenbreite – als Vollton oder Verlauf – und hebt Inhalte klar hervor.

## Wann einsetzen

Nutzen, wenn ein Abschnitt visuell getrennt oder besonders betont werden soll.

## Verwendung (Minimal‑Beispiel)

```md
:::background-color fill="#031936" color="dark"

### Wichtiger Hinweis

Kurzer Abschnitt mit hoher Aufmerksamkeit.

:::
```

## Optionen

- `fill` – Pflicht. Erste Farbe (z. B. `#031936`, `rgb(4,43,92)` oder `var(--color-dark)`).
- `accent` – zweite Farbe für einen Verlauf.
- `direction` – Richtung des Verlaufs: `right` (Standard), `left`, `top`, `bottom`.
- `color` – Textfarbe im Abschnitt: `dark` (Standard) oder `light`.
- `style` – für Sonderfälle (individuelles CSS).

## Beispiel mit Verlauf

```md
:::background-color fill="#031936" accent="#0a2f70" direction="right" color="dark"

### Kontraststarker Abschnitt

Wir platzieren hier eine zentrale Botschaft.

:::
```

## Stolperstellen

- `fill` ist zwingend notwendig.
- Achte auf ausreichend Kontrast zwischen Text und Hintergrund.
