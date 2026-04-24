# Modul `background-wave`

## Zweck

Zeigt eine dekorative Drahtgitter-Welle hinter einem Inhaltsbereich und animiert sie als ruhige Wasseroberflaeche.

## Wann einsetzen

Wenn ein Abschnitt ein lebendiges, aber nicht ablenkendes Wellenelement als visuelle Tiefe braucht.

## Verwendung (Minimal-Beispiel)

```md
:::background-wave algorithm="wave" frequency="0.6" intensity="0.5" scale="1.4"

## Dynamische Wasserstruktur im Hintergrund

Der Inhalt bleibt normal lesbar, waehrend die Welle dezent animiert.

:::
```

## Optionen

- `algorithm` - Bewegungsmodell: `wave` (sanftes Meer) oder `rain` (zufaellige Regentropfen-Ripples).
- `frequency` - Bewegungsfrequenz von `0` bis `2` (wie oft sich Wellen/Ripples pro Zeit veraendern).
- `intensity` - Staerke des Displacements von `0` bis `2`.
- `scale` - Groesse der Muster von `0.25` bis `3` (hoeher = grobflaechiger, niedriger = feiner).
- `position` - Positionierung: `center` (Standard), `left`, `right`, `fill`, `contain`.
- `alt` - Optional. Alternativtext fuer das Hintergrundbild.
- `zoom` - Skaliert die Wellenkomposition einheitlich in WebGL und im statischen Fallback (`1` = Originalgroesse, `0.5` = halb, `2` = doppelt).
- `relative-to` - Bezug der Grafikflaeche: `module` (Standard), `viewport`, `viewport-x`, `viewport-y`. Die Einstellung steuert den sichtbaren Rahmen, nicht den Zoom der Welle.
- `offset-x` / `offset-y` - Versatz (z. B. `50%`, `-10%`, `8rem`).
- `width` / `height` - feste Groessenangaben fuer die Hintergrund-SVG.
- `rotation` - Rotation in Grad.
- `flip` - Spiegelung: `none`, `horizontal`, `vertical`, `both`.
- `opacity` - Gesamte Deckkraft des Wellenlayers (`0` bis `1`).
- `style` - Sonderfaelle am Modul-Wrapper.
- `asset-style` - Sonderfaelle fuer die Hintergrund-SVG.

## Beispiel fuer ruhigen Hero-Hintergrund

```md
:::background-wave
algorithm="wave"
frequency="0.5"
intensity="0.45"
scale="1.6"
position="center"
zoom="0.9"
relative-to="module"
height="120%"
offset-x="40%"

# Strategische Beratung mit ruhiger visueller Fuehrung

:::
```

## Stolperstellen

- Das Modul ist rein dekorativ. Fachliche Kerninformationen immer im eigentlichen Inhalt belassen.
- Die Renderqualitaet wird ueber WebGL2 erzeugt. Wenn WebGL2 nicht verfuegbar ist oder ein Laufzeitfehler auftritt, bleibt die Grafik statisch sichtbar (ohne Animation), wie bei `background-image`.
- `width` / `height`, `zoom`, `offset-x` und `offset-y` bleiben auf unterschiedlichen Fensterformaten visuell stabil. So kann die Komposition einmal festgelegt und ueber Geraete hinweg wiederverwendet werden.
- `relative-to="viewport-x"` bleibt in der Hoehe auf den Abschnitt begrenzt, kann in der Breite aber ueber das Browserfenster hinauslaufen.
- Fuer gezielte manuelle Gesamtskalierung kann optional `--background-wave-composition-scale` im Modul-`style` gesetzt werden.
- Zoom/Offsets bleiben im statischen Fallback und im WebGL-Pfad konsistent.
- `prefers-reduced-motion` wird automatisch respektiert; dann bleibt die Welle statisch.

## Schnelle Presets

- Ruhig (`wave`): `frequency="0.4"` `intensity="0.35"` `scale="1.8"`
- Ausgewogen (`wave`): `frequency="0.7"` `intensity="0.6"` `scale="1.3"`
- Dezenter Regen (`rain`): `frequency="0.6"` `intensity="0.45"` `scale="1.2"`
