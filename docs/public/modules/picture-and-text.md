# Modul `picture-and-text`

## Zweck

Stellt Bild und Text flexibel dar, wahlweise mit Bild links, rechts, oben oder unten.

## Wann einsetzen

Nutzen, wenn ein Bild eine Aussage stützen soll (z. B. Team, Produkt, Leistung).

## Verwendung (Minimal‑Beispiel)

```md
:::picture-and-text image="/img/deco-wave.svg" image-alt="Dekorative Wellenform"

### KI‑Governance ohne Reibungsverluste

Wir übersetzen regulatorische Anforderungen in konkrete Projektpläne.

[Kickoff planen](/kontakt)
:::
```

## Optionen

- `align` – `left` (Standard), `right`, `top` oder `bottom`.
- `display` – `default` (Standard) oder `highlight-card`.  
  `highlight-card` zeigt Bild und Text im hervorgehobenen Kartenstil mit dunklem Hintergrund und hellem Text.
- `media-bleed` – `none` (Standard) oder `outer`. `outer` lässt die Medienfläche in den Parent-Padding-Bereich ausbrechen.
- `image` – Pflicht. Pfad zur Bilddatei.
- `image-alt` – Optional. Alternativtext für das Bild.
- `image-width` / `image-height` – feste Pixelwerte für das Bild.
- `overlay` – optionaler Overlay-Name aus `src/styles/overlays.scss` (z. B. `gradient-accent-down`), Standard `none`.
- `style` – für Sonderfälle (individuelles CSS).

## Hinweise

- `image-width`/`image-height` steuern die tatsächliche Mediengröße im Modul.
- Die Größe wird nur responsiv begrenzt (`max-width: 100%`), falls der verfügbare Platz kleiner ist.
- Overlay-Presets werden zentral in `src/styles/overlays.scss` gepflegt und im Modul per `overlay="<name>"` referenziert.
- Wenn ein Overlay-Name nicht existiert, wird kein Overlay dargestellt (kein Build-Fehler).
- `media-bleed="outer"` ist für Kartenlayouts gedacht, in denen Bildkanten bündig am äußeren Kartenrand liegen sollen, während der Text weiterhin den Card-Innenabstand nutzt.
- Für generisches Parent-Bleeding setzt der Container die Variablen `--picture-parent-bleed-inline` und `--picture-parent-bleed-block` (optional fein granular über `-start`/`-end`).
- Wenn der Textbereich exakt nur aus einem Absatz (`p`) besteht, wird dessen Standard-Margin automatisch entfernt, damit kompakte Karten nicht unnötig Höhe verlieren.

## Beispiel mit Bild rechts

```md
:::picture-and-text align="right" image="/img/team.jpg" image-alt="Team im Gespräch" image-width="720" image-height="430" overlay="gradient-accent-down"

### Beratung, die mitdenkt

Wir begleiten Projekte von der Strategie bis zur Umsetzung.

[Team kennenlernen](/team)
:::
```

## Beispiel mit Bild unten

```md
:::picture-and-text align="bottom" image="/img/team.jpg" image-alt="Team im Gespräch" image-width="720" image-height="430"

### Beratung mit klarem Fokus

Wir starten mit den wichtigsten Fragen und zeigen danach die passende visuelle Einordnung.

[Ablauf ansehen](/leistungen)
:::
```

## Beispiel im Highlight-Card-Stil

```md
:::picture-and-text display="highlight-card" align="left" image="/img/team.jpg" image-alt="Team in einem Workshop" image-width="720" image-height="430"

### Klarer Einstieg für komplexe Themen

Sie kombinieren Bild und Einordnung in einem aufmerksamkeitsstarken Kartenstil.

[Mehr erfahren](/insights)
:::
```

## Stolperstellen

- `image` sowie `image-width` und `image-height` sind erforderlich.
- Breite und Höhe sollten zum tatsächlichen Bild passen, sonst wirkt es verzerrt.
