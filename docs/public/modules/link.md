# Modul `link`

## Zweck

Erzeugt einen einzelnen Button‑Link mit konsistentem Styling.

## Wann einsetzen

Nutzen, wenn ein klarer Call‑to‑Action ohne weitere Layout‑Module benötigt wird.

## Verwendung (Minimal‑Beispiel)

```md
:::link to="/kontakt" text="Direkt beraten lassen"
```

## Optionen

- `to` – Pflicht. Ziel‑URL (z. B. `/kontakt`, `https://…`, `mailto:`, `tel:`).
- `text` – Pflicht. Button‑Text.
- `style` – `default` (Standard), `cta`, `outline` oder `destructive`.
- `color` – Optional. `light` oder `dark`. Ohne Angabe übernimmt der Button automatisch den Ton des nächstliegenden Bereichs (hell/dunkel).
- `target` – `none` (Standard) oder `new` (öffnet in neuem Tab).
- `align` – Ausrichtung: `left` (Standard), `center`, `right`.
- Nur `style="cta"` nutzt den Highlight‑Schatten. `default` bleibt bewusst ohne Shadow.

## Beispiel mit Varianten

```md
:::link to="/kontakt" text="Direkt beraten lassen" style="default"

:::link to="/kontakt" text="Direkt beraten lassen" style="cta"

:::link to="/team" text="Unser Team" style="outline" align="center"

:::link to="/legal/avv.pdf" text="AVV herunterladen" style="outline" color="dark" target="new" align="right"
```

## Stolperstellen

- `to` und `text` sind zwingend erforderlich.
- `destructive` nutzt die Outline-Form mit Highlight-Rahmen (`$color-highlight`).
- Ohne `color` passt sich der Button dem nächstliegenden hellen/dunklen Bereich an.
- Mehrere `:::link` direkt untereinander ohne Leerzeile werden als gemeinsame Zeile mit `space-between` gerendert.
- Mit Leerzeile zwischen zwei `:::link` beginnt der nächste Link in einer neuen Zeile.
