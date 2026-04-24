# Modul `highlight-card`

## Zweck

Erstellt eine hervorgehobene, flache Karte für zentrale Botschaften, inklusive Hintergrund, Innenabstand und abgerundeten Ecken.

## Wann einsetzen

Nutzen, wenn ein Abschnitt besonders ins Auge fallen soll (z. B. Kernbotschaft, wichtiger Hinweis, CTA‑Bereich).

## Verwendung (Minimal‑Beispiel)

```md
:::highlight-card

## Mandanten‑Update

Wir melden uns innerhalb eines Werktags mit einer ersten Einschätzung.

[Kontakt aufnehmen](/kontakt)
:::
```

## Optionen

- `label` – kurze Beschreibung der Karte (nützlich bei mehreren Karten auf einer Seite).
- `color` – `auto` (Standard), `dark` oder `light`.
- `color="auto"` invertiert den nächstliegenden Ton-Kontext:
  in hellen Bereichen wird die Karte dunkel, in dunklen Bereichen hell.
- `color="light"` rendert zusätzlich einen Outline-Rahmen in `color-dark-accent`.
- `fill` – feste Hintergrundfarbe statt Standard‑Verlauf.
- `accent` – zweite Farbe für einen Verlauf.
- `direction` – Verlaufsrichtung: `right`, `left`, `top`, `bottom`.
- `width` – gewünschte Breite; alleine genutzt bedeutet feste Breite.
- `min-width` – minimale Breite
- `max-width` – maximale Breite
- `style` – für Sonderfälle (individuelles CSS).

Breitenlogik:
- `width` alleine → feste Breite.
- `width` + `min-width` → `width` wird bevorzugt, das Element schrumpft wenn nötig bis `min-width`.
- `width` + `max-width` → `max-width` wird bevorzugt, das Element schrumpft wenn nötig bis `width`.

## Beispiel mit Farbe

```md
:::highlight-card color="light" fill="#1f1c54" accent="#f45a4d" direction="bottom" width="48rem"

## Sofort verfügbare Unterstützung

Wir priorisieren dringende Projekte innerhalb eines Werktags.

[Kontakt aufnehmen](/kontakt)
:::
```

## Stolperstellen

- Mindestens ein Inhaltselement ist erforderlich.
- `width`, `min-width` und `max-width` dürfen nicht alle gleichzeitig verwendet werden.
- Die Karte hat bewusst keinen Shadow (Flat Style).
- Wenn das letzte Element ein Link ist (`:::link`, Link-Row ohne Leerzeile oder ein einzelner Markdown-Link), wird dieses automatisch an den unteren Kartenrand geschoben.
- Das erste direkte Element startet ohne `margin-top`, das letzte direkte Element ohne `margin-bottom` (verhindert zusätzlichen Leerraum bei reinen Absatzkarten).
- `:::picture-and-text media-bleed="outer"` kann in der Karte genutzt werden; die Medienfläche bleedt dabei bis an den Kartenrand, während Text weiterhin den Innenabstand einhält.
