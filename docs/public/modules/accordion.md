# Modul `accordion`

## Zweck

Erstellt aufklappbare Abschnitte, bei denen zunächst nur der Titel sichtbar ist. Ideal, wenn viele Informationen übersichtlich gebündelt werden sollen.

## Wann einsetzen

Nutzen, wenn mehrere kurze Fragen oder Prozessschritte auf einer Seite Platz finden sollen, ohne die Seite zu lang wirken zu lassen.

## Inhalte vorbereiten

- Jeder Abschnitt beginnt mit einer Überschrift (`#`, `##` oder `###`).
- Abschnitte werden mit einer eigenen Zeile `---` voneinander getrennt.

## Verwendung (Minimal‑Beispiel)

````md
:::accordion label="Häufige Fragen"
### Wie schnell melden Sie sich?
Wir antworten in der Regel innerhalb eines Werktags.

---

### Welche Unterlagen sind hilfreich?
Eine kurze Projektbeschreibung, Ansprechpartner und vorhandene Verträge helfen beim Start.
:::
````

## Optionen

- `label` – kurze Beschreibung für die gesamte Liste (nur nötig, wenn mehrere Accordions auf einer Seite vorkommen).
- `style` – für Sonderfälle (individuelles CSS).

## Stolperstellen

- Jeder Abschnitt braucht eine Überschrift. Ohne Überschrift kann der Abschnitt nicht angezeigt werden.
- Mindestens ein Abschnitt ist erforderlich.
- Der Trenner `---` muss alleine in einer Zeile stehen.
