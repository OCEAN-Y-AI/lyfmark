# Modul `page-teaser`

## Zweck

Zeigt Seiten aus einem Verzeichnis als Kartenraster, als gestapelte Karten, als Revolver‑Karussell oder als frei definierte Template-Liste.

## Wann einsetzen

Nutzen, wenn mehrere Artikel, Themen oder Profile schnell überblickt werden sollen.

## Inhalte vorbereiten (Frontmatter der Zielseiten)

Frontmatter ist der Block zwischen `---` ganz oben in der Datei.

Pflichtfelder:

- `title` - Titel der Vorschau.
- `summary`, `thumbnail` oder `author-image` - mindestens eines davon.

Optional:

- `thumbnail` - Bild-URL für die Karte.
- `thumbnail-alt` - Alternativtext für das Thumbnail (Fallback: `title`).
- `author-image` - Bild-URL für Portrait-/Autorenbilder.
- `author-image-alt` - Alternativtext für `author-image` (Fallback: `title`).
- `updated` - Datum für `order="recent"` (Format `YYYY-MM-DD`).
- `teaser-ignore` - beliebiger Wert: Datei wird ignoriert.

Hinweis: `index.md` wird immer ignoriert.
Wenn `thumbnail` und `author-image` gleichzeitig gesetzt sind:
- In `display="cards"` nutzt die erste (hervorgehobene) Karte `thumbnail`.
- Weitere Karten nutzen bei vorhandenem `author-image` das Profilbild im kompakten Querformat.
- In den anderen Darstellungen (`stacked-cards`, `revolver-caroussel`, `template`) hat `thumbnail` Vorrang.

Beispiel-Frontmatter:

````md
---
title: "Artikelüberschrift"
summary: "Kurzfassung in ein bis zwei Sätzen."
updated: 2025-02-01
thumbnail: "/img/teaser-demo.jpg"
thumbnail-alt: "Symbolisches Vorschaubild"
---
````

Beispiel für ein Profil ohne `thumbnail`:

````md
---
title: "Musterprofil"
summary: "Kurzprofil mit Schwerpunkt auf Medienrecht."
author-image: "/img/team/profil-max.jpg"
author-image-alt: "Portrait von Max Muster"
updated: 2025-03-14
---
````

## Verhalten bei `display="cards"`

- Alle Seiten werden als einzelne Karten ausgegeben.
- Auf größeren Viewports nutzt das Modul ein festes 2x3-Raster.
- Das erste Element wird als hervorgehobene Karte gerendert und belegt die ersten zwei Grid-Plätze.
- Die erste Karte bleibt farblich gleich wie die übrigen Karten und unterscheidet sich nur durch ihre Größe.
- Standardmäßig zeigt nur die hervorgehobene Karte ein Bild.
- Nicht-Feature-Karten mit `author-image` werden als kompaktes Bild-Text-Layout dargestellt (Bild links, Text rechts).
- Das gilt auch dann, wenn zusätzlich `thumbnail` gepflegt ist.
- Die Karten haben feste Höhen, damit große Bilder das Raster nicht aufblähen.
- Sobald im Zwei-Spalten-Layout pro Karte weniger als `18rem` Breite übrig blieben, wechselt das Raster auf eine Spalte.
- Ohne `limit` bleibt die Liste vollständig und zeigt ab dem sechsten Element einen horizontal scrollbaren Bereich.
- Mit `limit="x"` wird die Ausgabe auf `x` Einträge begrenzt; die Karten ordnen sich dann ohne Scrollbalken responsiv an.

## Verhalten bei `display="stacked-cards"`

- Die Einträge werden als gestapelte Karten mit Pfeilnavigation gerendert.
- Sichtbar sind immer genau drei Kartenpositionen.
- Beim Blättern bleibt die Geometrie gleich, nur die Inhalte rotieren durch die sichtbaren Positionen.
- Jede Karte nutzt dasselbe Layout:
  Bild oben (wenn `thumbnail` vorhanden), darunter Titel, optionaler Text und der Button-Bereich.
- Fehlt `thumbnail`, zeigt die Karte nur den Textbereich.
- Wenn `thumbnail` fehlt, aber `author-image` gesetzt ist, wird `author-image` als Kartenbild genutzt.
- Alle Karten übernehmen die Höhe der größten Karte im Modul.
- Der letzte Block mit Button-Link wird am unteren Kartenrand ausgerichtet.

## Verhalten bei `display="revolver-caroussel"`

- Die Einträge werden im gleichen Revolver‑Karussell wie beim Modul `caroussel` gezeigt.
- Sichtbar sind drei Kartenpositionen (links, Mitte, rechts); die mittige Karte ist der Fokus.
- Jede Karte nutzt dasselbe Layout:
  Bild oben (wenn `thumbnail` vorhanden), darunter Titel, optionaler Text und der Button-Bereich.
- Die Bildfläche ist auf `24rem` Breite und `25rem` Höhe ausgelegt und skaliert bei sehr schmalen Viewports proportional mit.
- Fehlt `thumbnail`, zeigt die Karte nur den Textbereich.
- Wenn `thumbnail` fehlt, aber `author-image` gesetzt ist, wird `author-image` als Kartenbild genutzt.
- Der Textbereich richtet sich an der längsten Karte aus; alle anderen Karten übernehmen diese Höhe.
- Alle Karten bleiben dadurch in der Gesamtgeometrie stabil.
- Der Button-Bereich bleibt am unteren Kartenrand ausgerichtet.
- Auch bei nur einem oder zwei Einträgen bleibt die Revolver-Darstellung aktiv.

## Verwendung (Minimal-Beispiel)

````md
:::page-teaser from="insight" order="recent" limit="5" button="Zum Artikel"

:::
````

## Optionen

- `from` - Pflicht. Ordner mit den Seiten (z. B. `from="insight"`).
- `display` - `cards` (Standard), `stacked-cards`, `revolver-caroussel` oder `template`.
- `color` - `light` (Standard) oder `dark`.
- `order` - `recent` (Standard), `random`, `ascending`, `descending`.
- `limit` - optionale Obergrenze der angezeigten Einträge.
- `label` - kurze Bezeichnung des Moduls, sinnvoll bei mehreren Page-Teasern auf einer Seite.
- `button` - Text des Karten- oder Template-Links.
- `height-focus` - feste Höhe der hervorgehobenen Karte.
- `height-caroussel` - feste Höhe einer normalen Kartenzeile.
- `style` - für Sonderfälle (individuelles CSS).

## Feste Plätze und Filter (`display="cards"`, `display="stacked-cards"` oder `display="revolver-caroussel"`)

Im Inhaltsbereich des Moduls kannst du feste Plätze vergeben und filtern:

- Zeilen mit einer Zahl sind feste Plätze.
- Zeilen mit `-` sind Filter.

Beispiel:

````md
:::page-teaser from="insight" order="random" limit="5" button="Zum Artikel"
1. /insight/markenrecht
2. /insight/abmahnung

- Author: Max Mustermann, Anna Beispiel
- Category: Datenschutz
- Summary: Marke

:::
````

### Feste Plätze

- Die Zahl ist der Platz in der Liste (z. B. `1.` steht ganz oben).
- Lücken sind erlaubt.
- Feste Plätze und Filter funktionieren unabhängig von `order`.
- Bei `order="random"` bleiben feste Plätze stabil; nur die übrigen Einträge werden gemischt.

Beispiel:

````md
1. /insight/markenrecht
6. /insight/abmahnung
````

### Filter

- Alle Filter-Zeilen müssen passen.
- Innerhalb einer Zeile reicht einer der Werte (Komma-Trennung).
- Groß/Klein ist egal.
- `exact` bedeutet: "genau so", z. B. `- Category exact: Marke`.
- Filter funktionieren mit allen Sortierungen (`recent`, `random`, `ascending`, `descending`).
- Filter-Zeilen müssen mit `-` beginnen (`- Feld: Wert`).
- Andere nicht-leere Zeilen im Konfigurationsbereich führen zu einer klaren Fehlermeldung statt still ignoriert zu werden.

Die Filter prüfen nur die Felder im Frontmatter der Seiten.

## Template-Darstellung (`display="template"`)

Wenn du das Layout selbst bestimmen willst, kannst du im Modul ein eigenes Template schreiben. Platzhalter wie `$title` oder `$summary` werden aus dem Frontmatter ersetzt.

Beispiel:

````md
:::page-teaser from="personen" display="template" order="random" limit="3" button="Zum Profil"
# $title
$summary

:::link to="/kontakt" text="Direkt anfragen" style="outline" align="left"
:::
````

## Stolperstellen

- Für `order="recent"` muss jedes Element ein `updated`-Datum haben.
- Mindestens `summary`, `thumbnail` oder `author-image` ist Pflicht.
- Wenn Filter keine Treffer liefern, stoppt der Build mit einer verständlichen Fehlermeldung.
- Wenn ein Filterfeld nicht existiert (z. B. Tippfehler), nennt die Fehlermeldung die verfügbaren Frontmatter-Felder.
- Wenn `display="template"` gesetzt ist, braucht das Modul eigenen Inhalt.
- Wenn der Block leer ist, eine Leerzeile vor dem schließenden `:::` lassen.
- Wenn `thumbnail` und `author-image` gleichzeitig gesetzt sind, gilt:
  In `display="cards"` nutzt die erste Karte `thumbnail`, weitere Karten mit `author-image` nutzen das Profilbild im Querformat.
  In den übrigen Darstellungen gewinnt `thumbnail`.

## Beispiel für gestapelte Karten

````md
:::page-teaser from="insight" display="stacked-cards" order="recent" color="dark" button="Zum Artikel"

:::
````

## Beispiel für Revolver-Karussell

````md
:::page-teaser from="insight" display="revolver-caroussel" order="recent" color="dark" button="Zum Artikel"

:::
````
