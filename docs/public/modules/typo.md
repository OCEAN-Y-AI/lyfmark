# Modul `typo`

## Zweck

Rendert einen einzelnen Text mit frei wählbaren CSS-Klassen (z. B. `display-1`, `display-2`, `text-light`).

## Wann einsetzen

- Wenn ein einzelner Text gezielt mit einer bestehenden Typografie-Klasse dargestellt werden soll.
- Wenn Redakteur:innen die Typografie ohne HTML-`span` nutzen sollen.

## Verwendung (Minimal-Beispiel)

````md
:::typo class="display-1"
Klarer Einstiegs-Claim
:::
````

## Optionen

- `class` – Pflichtfeld. Eine oder mehrere CSS-Klassen, getrennt durch Leerzeichen.
- `as` – optionales HTML-Element (Standard: `div`). Erlaubt: `div`, `p`, `span`, `h1`-`h6`, `strong`, `em`.

## Wann welches `as`?

- `h2`/`h3` – wenn der Text eine echte Abschnittsüberschrift ist und in die Seitenstruktur gehört.
- `p` – wenn der Text als normaler Absatz oder Einleitung gelesen werden soll.
- `span` – wenn nur ein kurzer Inline-Teil innerhalb anderer Inhalte ausgezeichnet werden soll.
- `strong`/`em` – wenn einzelne Aussagen bewusst hervorgehoben werden sollen.

Wenn Sie unsicher sind, lassen Sie `as` weg. Dann wird standardmäßig `div` verwendet.

## Hinweise

- Der Modulinhalt wird als Text gelesen und in einem einzelnen Element ausgegeben.
- Typische Kombinationen sind `class="display-1"` und `class="display-2"`.
- Mehrere Klassen sind möglich, z. B. `class="display-2 text-light"`.

## Beispiel mit `as`

````md
:::typo class="display-2" as="h2"
Leistungen im Überblick
:::
````

## Stolperstellen

- `class` ist verpflichtend.
- Ungültige Klassennamen (Sonderzeichen wie `;`, `{`, `}`) führen zu einem Build-Fehler.
- Leerer Inhalt führt zu einem Build-Fehler.
