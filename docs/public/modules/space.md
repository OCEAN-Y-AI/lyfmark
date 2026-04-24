# Modul `space`

## Zweck

Erzeugt gezielte vertikale Leerflächen zwischen Abschnitten.

## Wann einsetzen

Nutzen, wenn zwischen zwei Inhalten zusätzlicher Abstand nach oben/unten nötig ist.

## Verwendung (Minimal‑Beispiel)

```md
:::space
```

## Optionen

- `size` – Abstand als CSS‑Länge (z. B. `4rem`, `24px`). Reine Zahlen werden als `rem` interpretiert.
- `style` – für Sonderfälle (individuelles CSS).

## Beispiel mit größerem Abstand

```md
:::space size="5rem"
```

## Stolperstellen

- Das Modul steht alleine in der Zeile und benötigt kein schließendes `:::`.
