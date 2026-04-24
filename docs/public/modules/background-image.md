# Modul `background-image`

## Zweck

Platziert dekorative Bilder im Hintergrund eines Abschnitts, ohne den eigentlichen Inhalt zu verändern.

## Wann einsetzen

Nutzen, wenn ein Abschnitt visuell aufgewertet werden soll (Wellen, Illustrationen, Übergänge).

## Verwendung (Minimal‑Beispiel)

```md
:::background-image url="/img/waves.svg" position="fill"

## Übergang mit Wellenmotiv

Dieser Abschnitt bekommt eine Hintergrundgrafik.

:::
```

## Optionen

- `url` – Pflicht. Pfad zur Bild- oder SVG‑Datei.
- `alt` – Optional. Alternativtext für die Grafik.
- `position` – Positionierung: `center` (Standard), `left`, `right`, `fill`, `contain`.
- `constraint` – Ziel-Layer für das Bild. Standard: `auto`.
  - Sonderwerte: `viewport`, `viewport-x`
  - Modul-Layer: `auto`, optional `text`, `media` oder projektspezifische Layernamen.
- `offset-x` / `offset-y` – Versatz der Grafik (z. B. `50%`, `-10%`, `8rem`).
- `width` / `height` – feste Größenangaben (z. B. `320px`, `20rem`).
- `rotation` – Drehung in Grad, z. B. `-12` oder `30`.
- `opacity` – Transparenz von `0` bis `1`.
- `flip` – Spiegelung: `none` (Standard), `horizontal`, `vertical`, `both`.
- `fit` – wie das Bild in seiner Fläche sitzt: `contain` (Standard), `cover`, `fill`, `scale-down`, `none`.
- `style` – für Sonderfälle (individuelles CSS).
- `asset-style` – Sonderfälle direkt am Bild (z. B. `filter: blur(2px)`).

## Beispiel mit freier Positionierung

```md
:::background-image url="/img/deco.svg" position="right" constraint="viewport" rotation="46" width="320px" fit="contain" offset-x="50%" offset-y="-20%"

### Dezente Ecke oben rechts

:::
```

## Layer-Zuordnung

- `background-image` wird immer relativ zum umgebenden Modul aufgelöst.
- Ohne `constraint` wird `auto` genutzt.
- `constraint="text"` oder `constraint="media"` funktionieren nur, wenn das Zielmodul diesen Layer anbietet.
- Bei unbekanntem Layer bricht der Build mit einer klaren Fehlermeldung ab.

## Stolperstellen

- Hintergrundgrafiken sind rein dekorativ. Wichtige Inhalte gehören in normale Bilder.
- Große Dateien verlangsamen die Seite – Bilder vorher optimieren.
