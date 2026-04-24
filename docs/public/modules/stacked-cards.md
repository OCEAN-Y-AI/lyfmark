# Modul `stacked-cards`

## Zweck

Zeigt mehrere Inhalte als gestapelten Kartenblock. Leser können mit Pfeilen von Karte zu Karte blättern.

## Wann einsetzen

Nutzen, wenn mehrere zusammenhängende Informationen kompakt und visuell hervorgehoben dargestellt werden sollen.

## Inhalte vorbereiten

- Jede Karte enthält normalen Markdown-Inhalt.
- Karten werden mit einer eigenen Zeile `---` getrennt.
- Die Kartennummer im Header wird automatisch gesetzt (`1.`, `2.`, `3.` usw.).

## Verwendung (Minimal-Beispiel)

````md
:::stacked-cards label="Leistungsübersicht" color="light"
### Analyse
Kurzer Überblick zur Ausgangslage.

---

### Umsetzung
Konkrete Maßnahmen und Zuständigkeiten.
:::
````

## Optionen

- `label` – kurze Beschreibung des Kartenstapels (hilfreich bei mehreren Modulen auf einer Seite).
- `color` – expliziter Ton `light` oder `dark`; ohne Angabe übernimmt das Modul automatisch den Ton des nächstliegenden übergeordneten Bereichs mit Farbkontext.
- `style` – für gezielte Sonderfälle mit individuellem CSS.

## Visuelles Verhalten

- Es sind immer genau drei Kartenpositionen sichtbar.
- Die aktive Karte liegt vorne unten rechts.
- Die zwei weiteren sichtbaren Karten liegen dahinter, schrittweise nach oben links versetzt.
- Beim Blättern bleibt diese Geometrie gleich; nur die Karteninhalte rotieren durch die drei sichtbaren Positionen.
- Alle Karten übernehmen automatisch die Höhe der größten Karte im jeweiligen Modul.
- Enthält das letzte umschließende Element einer Karte einen Link, wird dieser Kartenabschluss automatisch am unteren Rand ausgerichtet.

## Beispiel mit drei Karten

````md
:::stacked-cards label="Projektphasen"
### Phase 1
Ziele definieren und Prioritäten festlegen.

---

### Phase 2
Maßnahmen umsetzen und Ergebnisse prüfen.

---

### Phase 3
Ergebnisse konsolidieren und nächste Schritte planen.
:::
````

## Stolperstellen

- Der Trenner `---` muss alleine in einer Zeile stehen.
- Jede Karte braucht eigenen Inhalt.
- Es gibt keine feste Obergrenze für die Anzahl der Karten.
- Wenn `color` fehlt, wird der Farbton automatisch vom nächstliegenden übergeordneten Farbbereich übernommen.
- Auch bei mehr als drei definierten Karten bleiben immer nur drei Karten gleichzeitig sichtbar.
