# Modul `splash-screen`

## Zweck

Zeigt beim Seitenstart ein echtes Fullscreen-Overlay (wie eine Slide), das die Webseite vollständig überdeckt.
Sichtbar ist nur der Inhalt im `splash-screen`-Block.

## Wann einsetzen

- Für Intro-Slides, Kampagnenstarts oder kurze Einstiege vor dem eigentlichen Seiteninhalt.
- Wenn ein bewusst inszenierter „erster Eindruck“ gewünscht ist.

## Verwendung (Minimal-Beispiel)

````md
:::splash-screen label="Willkommen" color="light" dismiss="timer-or-click" duration="2800" exit-animation="fade-out" exit-duration="520"
# Willkommen
Kurzer Hinweistext oder Kampagnenbotschaft.
:::
````

## Optionen

- `label` – ARIA-Beschriftung des Overlays (Standard: `Startbildschirm`).
- `color` – Farbmodus: `light` (Standard) oder `dark`.
- `dismiss` – Schließlogik: `timer-or-click` (Standard), `timer`, `click`.
- `duration` – Anzeigedauer in Millisekunden für Timer-Modi.
- `exit-animation` – Ausblendanimation (aktuell `fade-out` mit `ease-out` beim Overlay und `ease-in` beim Content-Fade-in).
- `exit-duration` – Gesamtdauer des Übergangs in Millisekunden (Fade-out des Overlays plus Fade-in des Seiteninhalts).
- `repeat-after` – optionale Minuten bis zur nächsten Anzeige. Wenn nicht vorhanden: nur einmalig anzeigen. Wenn `<= 0`: immer anzeigen.
- `style` – optionale Inline-CSS-Deklarationen für den Fullscreen-Container.
- `content-style` – optionale Inline-CSS-Deklarationen für den Inhaltsbereich.

## Hinweise

- Das Modul wird ohne JavaScript nicht angezeigt und blockiert dann keine Inhalte.
- Wenn ein explizites Schließen-Element benötigt wird, kann im Inhalt ein eigenes Element mit `data-splash-dismiss` gesetzt werden.
- Empfohlener Intervallwert: `repeat-after="1380"` (23 Stunden).
- Wenn `repeat-after` geändert oder entfernt wird, wird der gespeicherte Status zurückgesetzt und der Splash erneut angezeigt.

## Stolperstellen

- Leere Inhalte führen zu einem Build-Fehler.
- Attribute müssen gequotet sein (`key="wert"`).
- Bei `dismiss="click"` sollte klar erkennbar sein, dass ein Klick den Overlay beendet.
