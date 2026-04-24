# Modul `list`

## Zweck

Formatiert Markdown-Listen als grafische Kartenliste und sorgt für eine einheitliche Darstellung in hellen und dunklen Bereichen.

## Wann einsetzen

Nutzen, wenn Arbeitsschritte oder Aufzählungen visuell klar und im Kartenstil dargestellt werden sollen.

## Inhalte vorbereiten

-	Im Modul sind als direkter Inhalt nur Markdown-Listen erlaubt: ungeordnet (`-`) und geordnet (`1.`).
-	Geordnete Listen (`1.`) werden automatisch als nummerierte Karten dargestellt.
-	Ungeordnete Listen (`-`) benötigen ein `bullet`-Attribut (z. B. Lucide-Icon), damit der Kartenstil eindeutig ist.
-	Gemischte Listenarten (`1.` und `-` im selben Modul) sind nicht erlaubt.
-	Ohne `color` übernimmt das Modul automatisch den hellen/dunklen Ton des nächstliegenden Bereichs.
-	Für Lucide-Bullets kann im Attribut `bullet` ein Token wie `[lucide:circle-check]` verwendet werden.

## Verwendung (Minimal-Beispiel)

````md
:::list
1. **Ist-Analyse**
   Vorhandene Informationen und Risiken erfassen.
2. **Priorisierung**
   Die wichtigsten Handlungsfelder zuerst festlegen.
3. **Umsetzung**
   Maßnahmen schrittweise umsetzen und nachhalten.
:::
````

## Optionen

-	`color` – Optional. `auto` (Standard), `light` oder `dark`. Steuert Hintergrund, Text und Rahmen der nummerierten Kartenliste.
-	`display` – `auto` (Standard). Die Darstellung ist für künftige Varianten vorbereitet.
-	`bullet` – Pflicht bei ungeordneten Listen (`-`). Erlaubt freien Text/Zeichen (z. B. `•`) oder Lucide-Token (z. B. `[lucide:circle-check]`).
-	`class` – Optionale CSS-Klassen am Modul-Wrapper (fortgeschrittene Nutzung).
-	`bullet-class` – Optionale CSS-Klassen direkt am Bullet-Element (fortgeschrittene Nutzung).
-	`style` – Optionales Inline-CSS für Sonderfälle.

## Beispiele

````md
:::list
1. **Schritt eins**
   Ausgangslage sauber dokumentieren.
2. **Schritt zwei**
   Maßnahmen priorisieren und abstimmen.
3. **Schritt drei**
   Umsetzung begleiten und Ergebnis prüfen.
:::
````

````md
:::list class="list-compact" bullet="[lucide:circle-check]" bullet-class="text-highlight"
- Vertragsprüfung
- Risiko-Mapping
- Maßnahmenplan
:::
````

## Stolperstellen

-	Als direkter Modulinhalt sind nur Listen erlaubt; Absätze oder andere Module gehören außerhalb.
-	Nummerierte Schritte müssen als echte Markdown-Liste geschrieben werden (`1.`, `2.`, `3.`), damit die Kartenansicht greift.
-	Ungeordnete Listen (`-`) benötigen das Attribut `bullet`, sonst bricht der Build mit einer klaren Fehlermeldung ab.
-	`1.` und `-` im selben `:::list`-Block sind nicht erlaubt.
-	Im nummerierten Kartenstil wird der erste Absatz je Punkt als Überschrift (`h4`) dargestellt; folgende Absätze bleiben Fließtext.
-	Mit `color="light"` oder `color="dark"` kann die automatische Tonübernahme gezielt überschrieben werden.
-	Ein Lucide-Bullet muss als Token geschrieben werden (z. B. `[lucide:circle-check]`).
-	Unbekannte Lucide-Namen führen zu einer klaren Fehlermeldung beim Build.
