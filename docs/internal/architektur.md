# Überblick & Architektur

## Zielbild

LyfMark ist ein statisches, sehr performantes Astro-Basissystem für branchenneutrale Websites. Inhalte werden redaktionell in Markdown gepflegt, während technische Komplexität im Kernsystem gekapselt bleibt.

## Verbindlicher Strukturvertrag

### Kunden-Arbeitsbereiche (Root)

- `pages/` – Seiteninhalte (1:1 URL-Mapping).
- `content-blocks/` – wiederverwendbare Content-Blocks.
- `navigation/` – Menüquellen (`menu.md`, optional sprachspezifisch).
- `forms/` – Formular-Presets (`*.html`) für `:::form`.
- `public/` – statische Assets.
- `docs/public/**` – Endkundendokumentation.

### Technischer Kern

- `src/lyfmark/**` enthält die technische Produktlogik (Module, Registry, Sync/Build-Helfer, interne Testfälle).
- `src/layouts/**`, `src/components/**`, `src/remark/**`, `src/utils/**` enthalten Framework-Integration und Laufzeitlogik.

### Spiegelpfade für Astro/Tooling (kein Git-Artefakt)

Folgende Pfade werden lokal durch `npm repair` als Link/Junction erzeugt:

- `src/pages -> ../pages`
- `src/content-blocks -> ../content-blocks`
- `src/navigation -> ../navigation`
- `src/forms -> ../forms`

Regel:

- Diese Links werden nicht versioniert.
- Falls stattdessen echte Verzeichnisse an diesen Stellen existieren, bricht `npm repair` mit klarer Fehlermeldung ab.
- `npm repair` prüft/erstellt zusätzlich die Root-Arbeitsordner, führt anschließend `lyfmark:sync` aus und zeigt eine kompakte Health-Zusammenfassung.

## Konfiguration

- Kundennahe Website-Basiswerte werden über `site.config.yml` im Root gepflegt.
- TS-Dateien unter `src/config/**` konsumieren und validieren diese Konfiguration; sie sind nicht der primäre Bearbeitungspunkt für Endkunden.

## Template-System (Styles)

- `defaultTemplate` aus `site.config.yml` bestimmt das aktive Basis-Template.
- `npm run lyfmark:sync` erzeugt daraus deterministische Style-Bundles unter `src/lyfmark/generated/styles/**`.
- `src/layouts/primary.astro` lädt das effektive Seiten-Template über die generierte URL-Map `src/lyfmark/generated/template-style-urls.ts` in den Head.
- Auf Seitenebene hat `frontmatter.template` Vorrang; ohne Override gilt `site.config.yml -> defaultTemplate`.
- Modul-Template-Overrides sind optional; ohne Override greift automatisch der modulare Basisstyle.

## Navigation

- Menüquellen kommen aus `navigation/menu.md` (optional `navigation/en/menu.md`).
- Technisch wird weiterhin über den Spiegelpfad `src/navigation/**` geladen.
- Ungültige Menüstruktur oder ungültige interne Links brechen den Build bewusst (Fail-fast).

## Build/Runtime

- SSG-First (Astro static output).
- Client-Skripte nur progressive Verbesserung, nie fachliche Quelle der Wahrheit.
- Modulbezogene Runtime-Skripte werden über `npm run lyfmark:sync` automatisch in `src/lyfmark/generated/module-runtime-scripts.astro` zusammengestellt; Shared-Skripte bleiben explizit im Layout.
- Node 22 LTS als Zielbasis.

## Qualitätsziele

- Semantisch sauberes HTML ohne JavaScript-Abhängigkeit für Kerninhalte.
- Hohe Wartbarkeit durch klare Trennung zwischen Kundeninhalt (Root) und Kerntechnik (`src/lyfmark`).
- Konsistente, plattformübergreifende Entwicklung auf Windows/macOS/Linux.
