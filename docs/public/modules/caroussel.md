# Modul `caroussel`

## Zweck

Zeigt mehrere Inhalte als klick- und wischbares Karten-Karussell.
Standard ist die Darstellung `revolver` mit 3D‑ähnlicher Rotation um eine virtuelle Zylinderform.

## Wann einsetzen

Nutzen, wenn wenige Kerninhalte mit klarer Fokuskarte nacheinander gezeigt werden sollen.

## Inhalte vorbereiten

- Jede Karte ist normaler Markdown‑Inhalt.
- Karten werden mit einer eigenen Zeile `---` getrennt.

## Verwendung (Minimal‑Beispiel)

````md
:::caroussel label="Unsere Schwerpunkte"
### Compliance
Kurzer Überblick über Compliance‑Beratung.

---

### Transaktionen
Begleitung von Due Diligence bis Closing.

---

### Litigation
Strategie, Verfahren, Verhandlung.
:::
````

## Optionen

- `display` – `revolver` (Standard) oder `cut-elements`.
- `color` – `light` oder `dark`; ohne Angabe übernimmt das Modul den Farbton des nächstliegenden übergeordneten Bereichs.
- `label` – kurze Beschreibung für das Karussell (hilfreich bei mehreren Karussells).
- `style` – für Sonderfälle (individuelles CSS).

## Darstellungen

### `display="revolver"` (Standard)

- Es sind immer drei Kartenpositionen sichtbar: links, Mitte, rechts.
- Die mittige Karte ist die aktive Fokuskarte.
- Die mittige Karte ist visuell ca. 10% größer als die seitlichen Karten.
- Beim Wechsel rotiert die Ansicht: Mitte wandert zur Seite, Seitenkarte rückt in die Mitte.
- Falls mehr als drei Karten vorhanden sind, erscheint beim Wechsel zusätzlich eine temporäre Einblend-Karte im Hintergrund.
- Die Pfeile stehen unten links unter dem Karussell.
- Die aktive Karte invertiert den Modulton (`light` -> aktive Karte `dark`, `dark` -> aktive Karte `light`).
- Alle Karten erhalten dieselbe Basisgröße (größte Karte als Referenz), damit die Modulhöhe stabil bleibt.
- Die Fokuskarte bleibt immer vollständig sichtbar und wirkt in der Animation stabil.

### `display="cut-elements"`

- Vorherige klassische Karussell-Darstellung mit seitlich angeschnittenen Karten.
- Endloses Scroll-/Snap-Verhalten mit Pfeilen und Drag.

## Beispiel mit Legacy-Darstellung

````md
:::caroussel display="cut-elements" color="light" label="Zusammenarbeit"
### Erstgespräch
Kurzer Einstieg.

---

### Umsetzung
Iterative Begleitung.

---

### Ergebnis
Praxisfähiger Fahrplan.
:::
````

## Stolperstellen

- Mindestens zwei Karten sind erforderlich.
- Der Trenner `---` muss alleine in einer Zeile stehen.
- Für die 3D‑Wirkung in `revolver` sind mindestens drei Karten empfehlenswert.
