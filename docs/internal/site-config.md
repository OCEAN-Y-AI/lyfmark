# Site Config (`site.config.yml`)

Status: Verbindlicher Konfigurations-Einstieg für Kundenprojekte.

## Zweck

`site.config.yml` ist die zentrale, kundennahe Basiskonfiguration im Projekt-Root. Endkunden sollen Website-Basiswerte dort pflegen können, ohne TypeScript-Dateien bearbeiten zu müssen.

## Grundregeln

- Quelle der Wahrheit: `site.config.yml` im Root.
- Konsumierende Technik: Loader/Validator unter `src/lyfmark/config/**`.
- `src/config/**` enthält nur technische Adapter/Defaults, keine primäre Kundenbearbeitung.
- Ungültige Werte führen zu klaren, handlungsorientierten Build-Fehlern (Fail-fast).

## Typische Felder (vertraglich)

- Site-Metadaten (Titel, Beschreibung, Locale-Default)
- Branding-Basis (z. B. Menümarke Text/Bild)
- Template-Default (`defaultTemplate`)

Hinweis: Das konkrete Feldschema wird mit der Loader-Implementierung stabilisiert und versioniert.

## Verbindliches Schema (v1)

Pflichtfelder im Root:

- `brandName` (`string`)
- `defaultTitle` (`string`)
- `defaultDescription` (`string`)
- `defaultLocale` (`string`, muss in `supportedLocales` enthalten sein)
- `supportedLocales` (`string[]`, mindestens ein Eintrag, keine Duplikate)
- `defaultTemplate` (`string`)
- `menu` (`object`)

Pflichtfelder in `menu`:

- `panelTone` (`"light"` oder `"dark"`)
- `brand` (`object`)

`menu.brand` Varianten:

1. Text-Brand:
	- `type: "text"`
	- `text` (`string`)
	- `href` (`string`)
	- optional: `html` (`string`)
2. Bild-Brand:
	- `type: "image"`
	- `src` (`string`)
	- `alt` (`string`)
	- `href` (`string`)

Unbekannte Keys werden als Konfigurationsfehler behandelt (Fail-fast), damit Tippfehler nicht unbemerkt bleiben.

## Referenzbeispiel

```yml
brandName: "LyfMark"
defaultTitle: "LyfMark"
defaultDescription: "Modulares, kundenneutrales Website-Basissystem für Markdown-first Inhalte."
defaultLocale: "de"
supportedLocales:
  - "de"
  - "en"
defaultTemplate: "primary"
menu:
  panelTone: "light"
  brand:
    type: "text"
    text: "LyfMark"
    html: "<span class=\"manual-menu__brand-emphasis\">Lyf</span><span class=\"manual-menu__brand-regular\">Mark</span>"
    href: "/"
```

## Laufzeitverhalten

- Loader-Pfad: `src/lyfmark/config/site-config.ts`
- Adapter für bestehende Imports: `src/config/site.ts`
- Bei fehlender/ungültiger Konfiguration bricht der Build mit klarer Fehlermeldung ab.
- `defaultTemplate` wird von `tools/lyfmark-sync.mjs` ausgewertet und auf vorhandene Template-IDs unter `src/lyfmark/templates/**` validiert.
- Bei ungültigem `defaultTemplate` bricht der Sync/Build mit einer klaren Fehlermeldung inklusive gültiger Template-Optionen ab.
- In der Seitenausgabe gilt: `frontmatter.template` (falls gesetzt) hat Vorrang, sonst wird `defaultTemplate` verwendet.

## Abgrenzung

Nicht in `site.config.yml`:

- Modulinterne Runtime-Implementierungsdetails
- Lizenzprüfungsdaten
- Buildinterne technische Schalter ohne Kundenrelevanz
