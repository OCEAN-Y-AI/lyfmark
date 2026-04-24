# Content-Richtlinien (für Redaktion & Entwicklung)

Ziel: Inhaltspflege nur über Markdown/MDX – klar, robust, SEO- und KI-freundlich.

## Frontmatter (Beispiel)
title: "Seitentitel"
description: "Kurze, prägnante Beschreibung (<= 160 Zeichen)."
layout: "~/layouts/primary.astro"
template?: "primary"
canonical?: "/kanonische-url/"
draft?: false
updated?: 2025-01-01
tags?: ["dienstleistung", "beratung"]
ogImage?: "/og/seitentitel.png"

Empfehlung: `title` und `description` immer setzen. `canonical` nur wenn abweichend/notwendig.

Hinweis zu `template`:

- Wenn `template` fehlt, gilt automatisch das Standard-Template aus `site.config.yml`.
- Verwenden Sie `template` nur, wenn diese Seite bewusst vom Standard abweichen soll.

### Seitenbezogene Farb-Akzente (`color-*`)

Wenn eine Seite einen eigenen Farbakzent braucht, können im Frontmatter `color-*`-Felder gesetzt werden.

Beispiel:

```md
---
title: "Seitentitel"
layout: "~/layouts/primary.astro"
color-highlight: "#f45a4d"
color-light: "#ffffff"
---
```

Regel:
- `color-<name>` überschreibt die CSS-Variable `--color-<name>`.
- Beispiel: `color-highlight` -> `--color-highlight`.
- Werte müssen gültige Farbwerte sein (z. B. `#RRGGBB`, `rgb(...)`, `hsl(...)`, `oklch(...)`, `var(--...)`).
- Hexwerte mit `#` immer in Anführungszeichen schreiben (z. B. `color-highlight: "#ff0000"`), damit der Wert korrekt gelesen wird.

### Redirect-Seite fuer alte URLs

Wenn eine Seite umzieht, legen Sie unter der alten URL eine kurze Redirect-Seite an.

Beispiel:

```md
---
title: "Weiterleitung"
layout: "~/layouts/redirect.astro"
redirectTo: "/neuer-pfad"
updated: 2026-03-25
---
```

Hinweis:

- Die Datei bleibt am alten Pfad bestehen (z. B. `pages/alter-pfad.md`).
- `redirectTo` ist Pflicht.
- Fuer den Leser bleibt die alte URL erreichbar und springt automatisch zur neuen Seite.

### Menü-Pflege
- Das Menü wird zentral in `navigation/menu.md` gepflegt (optional zusätzlich in `navigation/en/menu.md`).
- Das Feld `menu` im Frontmatter wird für die Menüstruktur nicht verwendet.
- Menü-Trenner werden als eigene Zeile `---` gesetzt.
- Für stärkere/geringere visuelle Gewichtung einzelner Menüpunkte können in Menü-Überschriften `**fett**` bzw. `*kursiv*` genutzt werden.

## Überschriften & Struktur
- Pro Seite genau eine H1 (`#`), danach Hierarchie mit `##`, `###`, …
- Kurze Absätze, klare Aussagen; Listen/Tabellen nutzen, wo passend.
- Interne Links: sprechende Linktexte; relative Pfade (z. B. `../angebote/`).

### Inline-Icons (Lucide)
- Dekorative Inline-Icons werden als `[lucide:icon-name]` direkt im Text gesetzt (z. B. `#### [lucide:circle-check] Titel`).
- In HTML-Blöcken funktioniert dieselbe Syntax ebenfalls (z. B. `<a href="…">[lucide:instagram]</a>`).
- Der Icon-Name muss ein gültiges Lucide-Icon sein (z. B. `circle-check`, `phone`, `mail`, `map-pin`).
- Bei ungültigem oder leerem Namen bricht der Build mit klarer Fehlermeldung ab.

## Content-Blocks (einfach wiederverwenden)
Content-Blocks sind wiederverwendbare Bausteine, die du ohne Copy/Paste einfügst.

- Falls der Ordner noch nicht existiert, legen Sie zuerst `content-blocks/` an.
- Datei anlegen: `content-blocks/kontakt.md`
- Einbinden: `:::kontakt` (kein Abschluss nötig)
- Unterordner sind möglich: Datei `content-blocks/team/kontakt.md` wird als `:::team/kontakt` eingebunden.
- Im Basispaket ist als Startpunkt bereits `content-blocks/hero.md` enthalten.
- Frontmatter ist nur nötig, wenn der Block Variablen (`$...`) nutzt:

```md
---
---
```

### Variablen (optional)
- Jede verwendete Variable (`$...`) muss im Frontmatter erklärt werden:

```md
---
color: Farbstil des Blocks
---
```

- Beim Einbinden Variablen als Attribute setzen: `:::kontakt color="dark"`.
- Werden Variablen verwendet, aber nicht im Frontmatter deklariert (oder umgekehrt), bricht der Build mit klarer Fehlermeldung ab.

### `$children` für umschließende Blocks
- Wenn ein Block Inhalt zwischen Öffnen/Schließen aufnehmen soll, im Frontmatter `children` deklarieren und im Block `$children` verwenden.
- Dann wird der Block als umschließend genutzt:

```md
:::team/column title="Ansprechperson"
  Inhalt im Block
:::
```

- Ohne deklarierte `children`-Variable bleibt der Block selbstschließend.

### Wichtige Regeln
- Dateiname muss kebab-case sein (z. B. `kontakt-cta.md`).
- Im Dateinamen sind nur Kleinbuchstaben, Zahlen und Bindestriche erlaubt (keine Umlaute, Leerzeichen oder Sonderzeichen).
- Für Unterordner gilt dieselbe Regel je Ordnersegment; beim Einbinden werden Ordner mit `/` getrennt (`:::ordner/block`).
- Blocknamen dürfen nicht mit eingebauten Modulen kollidieren (z. B. `link`, `tabs`). Bei Kollision gibt es eine klare Meldung zum Umbenennen.

## Medien
- Bilder mit sinnvollem `alt`-Text, Abmessungen (werden perspektivisch automatisiert).
- Nur notwendige Bilder einbinden; SVG bevorzugen für Vektorgrafiken.

## Tonalität & Stil
- Klar, professionell, aktiv; fachlich präzise ohne unnötigen Jargon.
- Verwende konventionelle Rechtschreibung ohne Gender-Markierungen.
- Zielgruppe: Leser ohne Technik-Hintergrund mit klarem Informations- oder Kontaktinteresse.

## SEO-Hinweise
- Pro Seite genau ein Hauptthema; Titel präzise, Description klickstark.
- Vermeide „Thin Content“; nutze Synonyme und relevante Unterthemen.
- Interne Verlinkung zwischen verwandten Seiten (Leistungen, Team, Kontakt, Wissen).

## Entwürfe
- Content-Management über Git, es gibt einen speziellen `release` branch für tatsächliche Releases.

## Häufige Fehler vermeiden
- Mehrere H1-Überschriften, leere Alt-Texte, generische Linktexte ("hier").
- Zu lange Absätze (> 5–6 Zeilen), zu knappe Beschreibungen ohne Keywords.
- Nach Listen (`-`, `1.`) oder Zitaten (`>`) vor dem nächsten `:::`-Modul die Leerzeile vergessen.
