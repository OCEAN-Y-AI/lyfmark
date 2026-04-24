# Modul `contact-form`

## Zweck

Erstellt eine Kontaktsektion mit standardisierten Formularfeldern. Überschrift, Unterzeile und Begleittext werden redaktionell gepflegt.

## Wann einsetzen

Nutzen, wenn Besucher direkt Kontakt aufnehmen sollen, ohne die Seite zu verlassen.

## Verwendung (Minimal‑Beispiel)

````md
:::contact-form heading="Kontaktieren Sie uns" submit="Nachricht senden"
Sie erreichen uns telefonisch, per E‑Mail oder direkt über das Formular.
:::
````

## Optionen

- `heading` – Pflicht. Hauptüberschrift der Sektion.
- `subheading` – kurze Unterzeile unter der Überschrift.
- `submit` – Pflicht. Text des Absenden‑Buttons.
- `style` – für Sonderfälle (individuelles CSS).

## Beispiel mit Unterzeile

````md
:::contact-form heading="Kontaktieren Sie uns" subheading="Wir melden uns kurzfristig" submit="Nachricht senden"
Gern mit einer kurzen Beschreibung Ihres Anliegens.
:::
````

## Stolperstellen

- `heading` und `submit` sind zwingend erforderlich.
