# Modul `thumb-scroll`

## Zweck

Kombiniert Bild und Text in einem Slider. Der Text wechselt per Pfeil oder Wischgeste.

## Wann einsetzen

Nutzen, wenn mehrere kurze Inhalte mit Bild‑Bezug vorgestellt werden sollen (z. B. Insights, Schwerpunkte, Referenzen).

## Inhalte vorbereiten

- Jeder Eintrag besteht aus einem optionalen Bild und einem Text‑Block.
- Einträge werden mit einer eigenen Zeile `---` getrennt.
- Bilder stehen als eigene Markdown‑Zeile: `![Alttext](/img/pfad.jpg)`.

## Verwendung (Minimal‑Beispiel)

````md
:::thumb-scroll label="Insights der Woche" color="light"
![Referenzfoto](/img/team-demo.jpg)

### Litigation‑Playbooks
Wir verknüpfen Claims, Timelines und Ansprechpartner:innen.
[Sofort kontaktieren](/kontakt)

---

### Ohne Bild
Auch reine Text‑Beiträge sind erlaubt.
:::
````

## Optionen

- `label` – kurze Beschreibung der Slider‑Sektion.
- `color` – `auto` (Standard), `dark` oder `light`.
- `image-width` – feste Breite für das Bild (Pixelwert).
- `image-height` – feste Höhe für das Bild (Pixelwert).
- `overlay` – optionaler Overlay-Name aus `src/styles/overlays.scss` (z. B. `gradient-accent-down`), Standard `none`.
- `style` – für Sonderfälle (individuelles CSS).

## Hinweise

- Wenn ein Absatz **nur aus einem Link** besteht, wird er als Button am unteren Rand angezeigt.
- Ist das letzte Slide-Element ein Link-Block (`:::link`-Zeile oder Link-Row), wird dieser am unteren Rand des Textbereichs ausgerichtet.
- Bei mehreren Slides bleibt rechts im Textbereich bewusst Platz, damit CTA-Buttons nicht in die Navigationspfeile laufen.
- Die Navigationspfeile nutzen das globale `ui-arrow-button`-Design (links hell, rechts dunkel).
- Das Overlay gilt einheitlich für alle Bilder eines `thumb-scroll`-Moduls.
- Bei `color="auto"` orientiert sich das Modul am nächsthöheren Light/Dark-Kontext (Klassen-Ton, sonst berechnete Text-/Hintergrundfarbe).
- Text-only Slides erhalten automatisch einen Innenabstand, auch wenn sie mit Bild-Slides gemischt sind.

## Stolperstellen

- Jeder Eintrag braucht mindestens Text oder ein Bild.
- Das Bild muss alleine in einer Zeile stehen.
- Der Trenner `---` muss alleine in einer Zeile stehen.
