# Modul `content-block`

## Zweck

Bindet wiederverwendbare Markdown-Bausteine ein, damit Inhalte zentral gepflegt und auf mehreren Seiten konsistent genutzt werden.

## Wann einsetzen

Nutzen, wenn derselbe Abschnitt mehrfach gebraucht wird (z. B. Kontakt-CTA, Hinweisbox, Footer-Hinweis).

## Inhalte vorbereiten

- Lege eine Datei im Ordner `content-blocks` an, z. B. `kontakt.md`.
- Unterordner sind möglich, z. B. `team/kontakt.md` und Einbindung als `:::team/kontakt`.
- Block-Namen müssen in kebab-case geschrieben sein (nur Kleinbuchstaben, Zahlen, Bindestriche; bei Unterordnern zusätzlich `/`).
- Frontmatter ist optional, solange der Block keine Variablen (`$...`) nutzt.
- Sobald Variablen verwendet werden, ist Frontmatter Pflicht und muss alle Variablen erklären: `variablenname: kurze Beschreibung`.
- Im Basispaket ist bereits ein neutraler Starter-Block enthalten: `content-blocks/hero.md`.

## Variablen deklarieren

Beispiel:

```md
---
title: Überschrift im Block
---

## $title
```

Beim Einbinden wird der Wert als Attribut gesetzt:

```md
:::mein-block title="Aktuelle Hinweise"
```

## `$children` für umschließende Blocks

Wenn ein Block Inhalte zwischen Öffnen und Schließen aufnehmen soll, deklariere im Frontmatter `children` und nutze `$children` im Block:

```md
---
title: Überschrift der Spalte
children: Inhalt der zweiten Spalte
---

:::split
  ## $title

  ---

  $children
:::
```

Einbindung:

```md
:::team/column title="Ansprechpartner"
  Telefon: +49 123 456 789
  [Direkt schreiben](/kontakt)
:::
```

## Verwendung (Minimal-Beispiel)

```md
:::kontakt
```

```md
:::team/kontakt
```

Starter-Block direkt nutzen:

```md
:::hero
title="Willkommen bei unserem Unternehmen"
intro="Wir unterstützen Sie mit klaren Lösungen für Ihr Projekt."
cta-text="Jetzt Kontakt aufnehmen"
cta-url="/kontakt"
```

## Stolperstellen

- Der Block-Name muss exakt dem Dateinamen entsprechen.
- Bei Unterordnern muss die Schreibweise mit `/` exakt stimmen (z. B. `team/kontakt`).
- Sobald der Block Platzhalter wie `$title` nutzt, ist Frontmatter mit passender Variablen-Deklaration zwingend.
- Jede verwendete Variable (`$...`) muss im Frontmatter deklariert und beschrieben sein.
- Variablen im Frontmatter, die im Block nicht genutzt werden, führen ebenfalls zu einer Fehlermeldung.
- `children` darf nicht als Attribut gesetzt werden; dafür wird der Inhalt zwischen `:::` verwendet.
- Fehlende Dateien, fehlende Variablen oder fehlende Abschlussmarker bei `children`-Blocks erzeugen klare Fehlermeldungen.
