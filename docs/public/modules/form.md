# Modul `form`

## Zweck

Bindet ein vordefiniertes Formular-Preset ein und kombiniert es optional mit einem redaktionellen Einleitungstext.

## Wann einsetzen

Nutzen, wenn Felder, Button-Text und Zieladresse zentral vorgegeben sein sollen, Redakteure aber Überschrift und Begleittext frei pflegen.

## Inhalte vorbereiten

- Lege ein Preset als HTML-Datei in `forms` an (z. B. `newsletter.html`).
- Platzhalter im Preset werden mit `$name` geschrieben (z. B. `$target-url`).
- Wird ein Platzhalter verwendet, muss derselbe Parameter beim Modulaufruf gesetzt werden (`target-url="..."`).
- Im Basispaket sind zwei neutrale Presets enthalten: `newsletter.html` und `basic-contact.html`.

## Verwendung (Minimal-Beispiel)

````md
:::form preset="newsletter" target-url="https://example.com/newsletter-signup"
## Newsletter
Bleiben Sie auf dem Laufenden.
:::
````

## Optionen

- `preset` – Pflicht. Dateiname des Formular-Presets ohne Endung (z. B. `newsletter` für `newsletter.html`).
- `style` – Optionales Inline-CSS für Sonderfälle.
- Weitere Attribute – Werden als Preset-Variablen verwendet. Beispiel: `target-url="..."` ersetzt `$target-url`.

## Beispiele

````md
:::form preset="newsletter" target-url="https://example.com/newsletter-signup"
## **Zum Newsletter anmelden**
Melden Sie sich zu unserem Newsletter an und bleiben Sie über News, Urteile & Unterhaltung auf dem Laufenden.
:::
````

````md
:::form preset="basic-contact" target-url="https://example.com/contact" submit-label="Nachricht senden"
## Kontakt
Schreiben Sie uns direkt über dieses Formular.
:::
````

## Stolperstellen

- Das Preset muss genau ein `<form>...</form>` enthalten.
- Das `<form>` im Preset muss `method="post"` und ein `action`-Attribut haben.
- Fehlende oder zusätzliche Preset-Variablen führen zu einer klaren Build-Fehlermeldung.
