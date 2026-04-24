# Theme-System (Basis)

## Ziel
Dieses Dokument beschreibt das abstrahierte Theme-Basissystem, das bei neuen Kundenprojekten wiederverwendet wird.

## Primäre Quelle
-	Code: `src/styles/colors.scss`
-	Template-Fundament: `src/lyfmark/templates/<template-id>/foundation.scss` (`:root`)
-	Seitenausgabe: `src/layouts/primary.astro` lädt pro Seite das effektive Template-Stylesheet aus `src/lyfmark/generated/template-style-urls.ts`

## Beziehung zum Template-System

-	Die technische Bündelung der Styles erfolgt über `npm run lyfmark:sync`.
-	Details zu Build-Reihenfolge, Fallbacks und Generator-Ausgaben stehen in `docs/internal/template-system.md`.

## Farbrollen
-	`color-light` – heller Grundton
-	`color-light-accent` – heller Akzentton
-	`color-dark` – dunkler Grundton
-	`color-dark-accent` – dunkler Akzentton
-	`color-highlight` – Aufmerksamkeitsfarbe

## Farbregel
-	Es gibt nur die fünf Basistoken (`light`, `light-accent`, `dark`, `dark-accent`, `highlight`).
-	Numerische Farbvarianten (`-5`, `-7` usw.) sind nicht Teil des Basissystems.

## Dark/Light-Mode auf Abschnittsebene
-	`tone-dark`: dunkler Hintergrund + heller Text.
-	`tone-light`: heller Hintergrund + dunkler Text.
-	Module dürfen den Ton pro Abschnitt wechseln, damit Seiten dynamisch akzentuiert werden können.

## Kundenwechsel
Bei einem neuen Kunden werden in der Regel nur diese Stellen angepasst:
1.	`src/styles/colors.scss` (Farbwerte)
2.	`src/styles/global.scss` (Fontdateien/Familiennamen)
3.	`site.config.yml` im Root (Titel, Beschreibung, Locale-Defaults, Template-Default)

## Nicht Teil des Basissystems
-	Seitenspezifische Inhalte in `pages/**` (technisch gespiegelt über `src/pages/**`).
-	Kundenspezifische Assets, die bewusst projektspezifisch bleiben (z. B. individuelle Marken-Grafiken).
