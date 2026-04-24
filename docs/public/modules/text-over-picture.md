# Modul `text-over-picture`

## Zweck

Rendert genau ein Bild als Fläche und legt beliebige Inhalte darüber.

## Wann einsetzen

Nutzen, wenn Text, Buttons oder zusätzliche Elemente direkt auf einem Motiv sitzen sollen (Hero-Kacheln, Teaser, Logo-Overlays).

## Verwendung (Minimal-Beispiel)

```md
:::text-over-picture image="/img/hero.jpg" image-alt="Abstraktes Hintergrundmotiv"
## Klarer Einstieg
Kurzer Text mit Link direkt über dem Bild.
[Jetzt starten](/kontakt)
:::
```

## Optionen

- `image` – Pflicht. Bildpfad für die Modulfläche.
- `image-alt` – Optional. Alternativtext.
- `align-y` – vertikale Inhaltsposition: `start`, `center`, `end` (Standard `end`).
- `color` – Inhaltsfarbe: `light` (dunkler Text) oder `dark` (heller Text), Standard `light`.
- `width` / `height` – optionale Zielgröße. Sind beide gesetzt, wird die Fläche fix auf diese Größe gesetzt.
- `overlay` – optionaler Overlay-Name aus `src/styles/overlays.scss` (z. B. `gradient-accent-down`), Standard `none`.
- `style` – optionale CSS-Deklarationen für Sonderfälle.

## Hinweise

- Das Modul nutzt immer genau ein Basisbild.
- Fehlt `width` oder `height`, bleibt die fehlende Dimension automatisch (`auto`) und das Bild bleibt mit `object-fit: cover` gesetzt.
- Fehlen `width` und `height`, bestimmt die natürliche Bildgröße die Modulgröße.
- Mehrere `:::text-over-picture` ohne Leerzeile dazwischen werden automatisch als gemeinsame Zeile (`flex-wrap`) gerendert.
- Mit Leerzeile zwischen zwei Modulen beginnt eine neue Zeile.

## Stolperstellen

- `image` ist erforderlich.
- `overlay` muss als slug angegeben werden (z. B. `gradient-accent-down`).
