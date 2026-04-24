# Modul `align`

## Zweck

Richtet Inhalte innerhalb des direkt umgebenden Strukturelements aus (horizontal, vertikal und Textausrichtung).

## Wann einsetzen

Nutzen, wenn Inhalte in einer Spalte, Karte oder einem Tab gezielt an einer Ecke oder mittig sitzen sollen.

## Verwendung (Minimal-Beispiel)

```md
:::align x="center" y="center"
![Dekoratives Motiv](/img/ellipse.png)
:::
```

## Optionen

- `x` - horizontale Ausrichtung: `left` (Standard), `center`, `right`.
- `y` - vertikale Ausrichtung: `top` (Standard), `center`, `bottom`.
- `text` - Textausrichtung innerhalb des Inhalts: `left` (Standard), `center`, `right`.
- `fill` - genutzte Containerflaeche: `both` (Standard), `none`, `width`, `height`.
- `style` - fuer Sonderfaelle (individuelles CSS).

## Design-Verhalten

- Standard `fill="both"` nutzt die Grenzen des direkten Eltern-Containers als Ausrichtungsflaeche.
- Dadurch funktioniert `y="center"` in Strukturlayouts wie `split` oder `tabs` relativ zur jeweiligen Spalte.

## Stolperstellen

- Ohne Inhalt bricht das Modul mit einer klaren Fehlermeldung ab.
