# Styles & Design-Tokens

## Organisation
-	Template-Fundamente liegen in `src/lyfmark/templates/<template-id>/foundation.scss`.
-	`src/layouts/primary.astro` bindet das effektive Template-Stylesheet über die generierte URL-Map ein.
-	Tokens und globale Definitionen:
	-	`src/styles/colors.scss`: Farbtoken (nur Basisfarben, keine numerischen Abstufungen).
	-	`src/styles/global.scss`: Font-Faces und Font-Stacks.
	-	`src/styles/typography.scss`: zentrale Typografie-Mixins und Utility-Klassen (Heading-/Display-/Text-Defaults).
-	Komponentennahe Styles liegen in zwei Ebenen:
	-	nicht-modulare Komponenten in `src/styles/modules/*.scss` (z. B. `manual-menu.scss`).
	-	direktive Module konsolidiert in `src/lyfmark/modules/<modul>/styles/base.scss`.
-	SCSS-Imports erfolgen via `@use`.

## Farbmodell (5 Grundfarben)
-	`$color-light`: heller Grundton (z. B. Flächen im Light-Mode)
-	`$color-light-accent`: heller Akzentton
-	`$color-dark`: dunkler Grundton (z. B. Flächen im Dark-Mode)
-	`$color-dark-accent`: dunkler Akzentton
-	`$color-highlight`: Aufmerksamkeitsfarbe
-	Im Root stehen nur diese fünf CSS-Variablen bereit: `--color-light`, `--color-light-accent`, `--color-dark`, `--color-dark-accent`, `--color-highlight`.

## Mode-Logik
-	`dark`: Hintergrund `color-dark`, Text `color-light`.
-	`light`: Hintergrund `color-light`, Text `color-dark`.
-	Sektionen können bewusst zwischen `dark` und `light` wechseln, um Inhalte hervorzuheben oder zu beruhigen.

## Link- und Button-Standards
-	Normale Markdown-Links bleiben Links (kein automatisches Button-Rendering mehr).
-	Globale Link-Basis liegt in `src/lyfmark/modules/link/styles/base.scss` (`a`, `a:hover`, `a:visited`).
-	Buttons laufen über generische Utility-Klassen:
	-	`ui-button`
	-	`ui-button--light` (dunkler Hintergrund, helle Schrift)
	-	`ui-button--dark` (heller Hintergrund, dunkle Schrift)
	-	`ui-button--cta` (aktiviert den Highlight-Schatten für light/dark Buttons)
	-	`ui-button--outline` (Outline-Variante)
	-	`ui-button--destructive` (kritische Aktion)
-	Der Design-Strich ist systemweit vereinheitlicht: Modul `:::accent-rule` und Utility `.ui-highlight-rule` nutzen dieselbe Strichgeometrie (`7.25rem × 0.16rem`) und Farbe (`$color-highlight`).
-	Das Modul `:::accent-rule` richtet seine Zeilenhöhe zusätzlich an den `h1`-Tokens aus `typography.scss` aus, damit der Strich wie auf einer zentrierten Headline-Zeile sitzt.

## Layout-Variablen
-	Globale Breite/Innenabstand laufen über CSS-Variablen in `:root`:
	-	`--layout-page-max-width`
	-	`--layout-inline-padding`
-	`#page`, Menüleiste und Breadcrumb-Container verwenden diese Variablen gemeinsam, damit horizontale Ausrichtung/Padding immer synchron bleibt.

## Fonts
-	Font-Familien sind generisch benannt (`brand-font-*`), damit Kundenwechsel keine API-Änderung im CSS erfordert.
-	Die tatsächlichen Fontdateien bleiben projektspezifisch (`public/fonts/...`).
-	Stack-Tokens: `$font-serif`, `$font-sans`, `$font-serif-bold`, `$font-sans-bold` usw.

## Typografie-Utilities
-	Heading- und Basis-Text-Defaults laufen zentral über `src/styles/typography.scss` (`h1` bis `h6`, `p`, `div`).
-	Zusätzliche Utility-Klassen:
	-	`.display-1`
	-	`.display-2`
	-	`.text-light`
	-	`.text`
	-	`.fineprint`
-	Globaler Grundwert für Zeilenhöhe: `$typography-line-height` (aktuell `1.5`).
-	Modul-Styles sollen Typografie bevorzugt über `@include type.text-style(...)` oder die semantischen Mixins aus `typography.scss` beziehen.

## Token-Beispiel
```scss
@use "sass:color";
@use "global.scss" as *;
@use "colors.scss" as *;

.example {
	color: $color-dark;
	background: color.scale($color-highlight, $lightness: -10%);
	font-family: $font-serif;
}
```

## Konventionen
-	Keine harten Hex-Werte in Komponenten, wenn ein Token sinnvoll ist.
-	Keine kundenspezifischen Präfixe (`eins-*`) in Basis-Styles.
-	Komponenten sollen primär über Token oder CSS-Variablen thembar bleiben.
