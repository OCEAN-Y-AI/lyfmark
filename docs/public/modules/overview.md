# Modul‑Übersicht

Kurzer Überblick über alle Module. Details stehen in den jeweiligen Modul‑Dateien.

## Merkhilfe für `:::`-Module

- Sie können Module ohne zusätzliche Leerzeilen schreiben; LyfMark formatiert beim Speichern automatisch in eine lesbare Standardform.
- In dieser Standardform steht nach abgeschlossenen Modulblöcken und nach selbstschließenden Modulen jeweils eine Leerzeile.
- Zwei schließende Zeilen `:::` direkt hintereinander bleiben ohne Leerzeile.
- Mehrere `:::link` direkt untereinander bleiben in derselben Link‑Reihe; eine Leerzeile startet die nächste Reihe.
- Für bessere Lesbarkeit darf Modulinhalt eingerückt werden (Standard: 2 Leerzeichen; in verschachtelten `split`-Bereichen kann automatisch 3 Leerzeichen genutzt werden).

- `highlight-card` – Hervorgehobene Karte für zentrale Botschaften.
- `picture-and-text` – Bild‑Text‑Kombination mit wählbarer Ausrichtung.
- `text-over-picture` – Einzelbild mit frei positionierbaren Inhalten als Overlay.
- `thumb-scroll` – Bild/Text‑Slider mit Wechsel per Pfeil oder Wischgeste.
- `caroussel` – Karten‑Karussell mit `revolver`-Standard und optionaler `cut-elements`-Legacy-Ansicht.
- `stacked-cards` – Versetzter Kartenstapel mit nummerierten Headern und Pfeilnavigation.
- `page-teaser` – Vorschaueinträge aus einem Verzeichnis als Card-Grid, Stacked-Cards, Revolver-Karussell oder Template-Liste.
- `split` – Inhalte über `---` automatisch auf 2–4 Spalten verteilen.
- `align` – Inhalte innerhalb des direkten Eltern-Containers horizontal/vertikal ausrichten.
- `anchor` – Zusätzliche Sprungziele mit stabilen Anchor-IDs aus Freitext anlegen.
- `tabs` – Registerkarten aus mehreren Abschnitten.
- `accordion` – Klappbare Abschnitte mit Titel und Beschreibung.
- `accent-rule` – Einheitlicher Design-Strich als Unterstreichung oder Trenner.
- `right` – Inhalt am rechten Rand ausrichten.
- `quick-nav` – Feste Schnellnavigation am rechten Rand mit Bild- oder Lucide-Icons.
- `space` – Gezielte Leerflächen erzeugen.
- `splash-screen` – Vollflächiger Einstieg mit zeit- oder klickgesteuerter Ausblendung.
- `background-color` – Vollton‑ oder Verlaufshintergrund über die Seitenbreite.
- `background-image` – Dekorative Hintergrundgrafiken.
- `background-wave` – Animierte Drahtgitter-Welle mit auswählbarem Wasserstil.
- `link` – Einzelner Button‑Link mit Stil‑Optionen.
- `list` – Nummerierte Schritte als Kartenliste sowie ungeordnete Listen mit optionalem Bullet-Stil (Text oder Lucide-Icon).
- `form` – Formular aus HTML-Preset mit optionalem Einleitungstext in Markdown.
- `typo` – Einzelner Text mit frei wählbaren Typografie-Klassen.
- `content-block` – Wiederverwendbare Markdown‑Bausteine.
- `contact-form` – Kontaktsektion mit Formular und Einleitungstext.
