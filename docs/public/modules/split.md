# Modul `split`

## Zweck

Teilt Inhalte in gleich breite Spalten auf.

## Wann einsetzen

Nutzen, wenn mehrere Inhalte nebeneinander stehen sollen (Text‑Text, Text‑CTA, etc.).

## Inhalte vorbereiten

- Spalten werden mit einer eigenen Zeile `---` getrennt.
- Leere Spalten sind erlaubt (einfach zwischen zwei `---` nichts schreiben).

## Verwendung (Minimal-Beispiel)

```md
:::split
  ### Linke Spalte
  Kurzer Einstieg oder Modul.
  ---
  ### Rechte Spalte
  Beliebiger Markdown-Content.
:::
```

## Beispiel mit Gewichtung

```md
:::split weight="1 2 1"
  ### Spalte 1
  Schmal.
  ---
  ### Spalte 2
  Breiter Mittelpunkt.
  ---
  ### Spalte 3
  Schmal.
:::
```

## Optionen

- `weight` – optionale Spaltengewichtung als Zahlenliste mit Leerzeichen (z. B. `weight="1 2 1"`).
- `style` – für Sonderfälle (individuelles CSS).

## Stolperstellen

- `split` erkennt die Spalten automatisch über `---` und unterstützt 2 bis 4 Spalten.
- Bei gesetztem `weight` muss die Anzahl der Werte exakt der Spaltenanzahl entsprechen.
- Alle `weight`-Werte müssen positive Zahlen sein (keine `0`, keine negativen Werte, kein Text).
- Der Trenner `---` muss alleine in einer Zeile stehen.
- In jeder Spalte wird beim ersten direkten Element `margin-top` und beim letzten direkten Element `margin-bottom` automatisch auf `0` gesetzt.
