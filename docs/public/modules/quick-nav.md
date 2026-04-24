# Modul `quick-nav`

## Zweck

Zeigt eine feste Schnellnavigation am rechten Seitenrand. Jeder Eintrag ist ein klickbares Symbol als Lucide-Icon oder kleines Bild.

## Wann einsetzen

Nutzen, wenn wichtige Kontakt- oder Sprungziele auf einer Seite jederzeit erreichbar sein sollen.

## Inhalte vorbereiten

-	Einträge immer als ungeordnete Liste schreiben (`- ...`).
-	Jeder Listeneintrag muss genau ein Link sein.
-	Als Linktext entweder `lucide:<icon-name>` oder ein Bildpfad wie `/img/people/person.jpg` verwenden.
-	Für Bild-Einträge kann optional ein Alt-Text im Linktitel ergänzt werden: `- [/img/person.jpg](/personen/beispiel-profil "Portrait Teammitglied")`.

## Verwendung (Minimal-Beispiel)

````md
:::quick-nav color="dark"
- [lucide:phone](tel:+491751234567)
- [lucide:mail](mailto:kontakt@beispiel.de)
:::
````

## Optionen

-	`color` – Farbschema der Navigationspunkte: `dark` (Standard) oder `light`.
-	`size` – Breite der Leiste als CSS-Größe (Standard: `2.8rem`); Höhe und Icon-Größen skalieren proportional.
-	`visible` – Sichtbarkeit pro Gerät als kommagetrennte Liste, z. B. `desktop,mobile` (Standard), `desktop` oder `mobile`.
-	`label` – ARIA-Beschreibung für die gesamte Navigation (Standard: `Schnellnavigation`).
-	`style` – optionales Inline-CSS für Sonderfälle.

## Beispiele

````md
:::quick-nav color="light" size="2.8rem" visible="desktop,mobile"
- [/img/people/team-member.jpg](/personen/beispiel-profil "Portrait Teammitglied")
- [lucide:phone](tel:+491751234567)
- [lucide:mail](mailto:kontakt@beispiel.de)
:::
````

## Stolperstellen

-	Nur ungeordnete Listen (`-`) sind erlaubt, keine nummerierten Listen.
-	Pro Listenpunkt ist genau ein Link erlaubt.
-	Unsichere Protokolle wie `javascript:` oder `data:` sind nicht erlaubt.
-	Bei `lucide:` muss der Icon-Name existieren (z. B. `phone`, `mail`, `map-pin`).
- Die verfügbaren Lucide Icons können hier eingesehen werden: https://lucide.dev/icons/
