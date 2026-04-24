# Instructions für die Entwicklung (LyfMark – Astro)

Ziel dieses Dokuments: Klare Leitplanken, wie in diesem Projekt konsistent, performant und SEO-/KI-freundlich entwickelt wird – nach dem Prinzip: It just works.
Dieses Dokument und die docs unter (./docs) **IMMER** unaufgefordert aktuell halten, und bei Bedarf einlesen.

## Leitprinzipien
- Einfachheit (KIS): So wenig bewegliche Teile wie möglich. Bevorzugt statisch, klar, nachvollziehbar.
- Performance-first: Standard ist 100/100 bei Lighthouse Performance/SEO/Best Practices/Accessibility.
- SEO-by-default: Sinnvolle Defaults für Titel, Beschreibung, Canonical, Schema.org, OG/Twitter.
- AI-Readability: Saubere Semantik, klare Überschriftenhierarchie, reiches strukturiertes Markup.
- Content-first: Seiten als `.md`/`.mdx` mit Frontmatter, redaktionsfreundlich ohne Build-/Code-Anpassungen.
- Zero-config-Komponenten: Komponenten funktionieren out-of-the-box (sinnvolle Defaults, ARIA, keine Pflicht-Props).

## Tech-Stack & Grenzen
- Astro 6, SSG (statisch) bevorzugt; Inseln nur, wenn nötig.
- TypeScript überall; strict mindset. Keine `any`-Leaks.
- Styles in `src/styles/primary.scss`; optionale Imports (z. B. `colors.scss`, `global.scss`).
- Alias `~/*` → `src/*` (siehe `tsconfig.json`).

## Projektkonventionen
- Dateien/Namen: kebab-case für Dateien/Ordner, PascalCase für Komponenten.
- Komponenten: `.astro` bevorzugt; nur clientseitiges JS, wenn fachlich erforderlich (`client:*` sparsam).
- Accessibility: Labels, ARIA, Fokus-Reihenfolge, Kontrast. Teste mit Tastatur.
- Semantik: `h1`–`h6` korrekt schachteln, Listen als `<ul>/<ol>`, Tabellen mit `<thead>/<tbody>`.
- Bilder: Immer `alt`, feste `width/height`, bevorzugt `astro:assets`/`<Image />` (später einführen).

## Content (md/mdx)
- Jede Seite als `.md` (`.mdx` nur wenn nötig). Beispiel-Frontmatter:
  title: "Seitentitel"
  description: "Kurze, prägnante Beschreibung (<= 160 Zeichen)."
  layout: "~/layouts/primary.astro"
  canonical?: "/kanonische-url/"
  draft?: false
  updated?: 2025-01-01
  tags?: ["dienstleistung", "beratung"]
  ogImage?: "/og/seitentitel.png"
- Slug = Dateiname. Verzeichnisse bilden IA/Breadcrumbs automatisch.
- Überschriften: genau ein `#` pro Seite (H1), darunter `##` usw.
- Interne Links relativ (`../pfad/`), sprechende Linktexte (keine „hier“).

### Menü-Generierung
- Das Menü wird zentral über `src/navigation/menu.md` gepflegt.
- Für englische Seiten unter `/en/` wird zuerst `src/navigation/en/menu.md` verwendet; falls diese fehlt, greift der Fallback auf `src/navigation/menu.md`.
- Fehler in der Menüstruktur oder ungültige Links brechen den Build bewusst ab (Fail-fast).

## Styles
- Alle globalen Styles in `primary.scss`; thematische Aufteilung via `@use`/`@forward` erlaubt.
- Design Tokens: Farben in `colors.scss`, Fonts/Stacks in `global.scss`.
- Namenskonvention: BEM-ähnlich oder semantische, kurze Klassen; kein übermäßiger Tiefen-Selector.
- Keine Inline-Styles im Markup, außer bewusst für kritische Fälle.

## SEO & Strukturierte Daten
- Default-Meta über gemeinsame Head-/SEO-Komponente (geplant). Bis dahin: sinnvolle Titel/Deskriptionen im Frontmatter pflegen.
- Schema.org: Organization, BreadcrumbList, WebSite, Article (bei Insights) – später zentral in SEO-Komponente bündeln.
- Sitemap, robots.txt, Canonicals: in Build/Head sichern (geplant).

## Performance-Standards
- Minimales TS (aber klar & verständlich wenn verwendet). Keine großen Client-Bundles ohne Nutzen.
- Bilder optimiert, lazy, korrekte Größen; SVG inline nur klein.
- Fonts: WOFF2, `font-display: swap`; nur wirklich genutzte Schnitte.
- Prüfe LCP/CLS/INP in Lighthouse. Ziel: LCP < 2.5s, CLS ≈ 0.

## Arbeitsweise
- Node 22 LTS, npm. Befehle: `npm run dev`, `npm run build`, `npm run preview`.
- Commits: konventionell (feat, fix, docs, refactor, chore, style). Klare, kurze Messages.
- Branches: simpel benennen, mit Kürzel beginnen, keine Unterordner. Beispiel `sf-breadcrumbs`.
- Code-Review-Selbstcheck (vor PR):
  - Erfüllt es „It just works“ ohne Konfiguration?
  - Kein ungenutztes JS/TS/CSS? Keine Regressions in Lighthouse/SEO?
  - Barrierefreiheit (Keyboard, ARIA)?
  - Content bleibt vollständig über `.md/.mdx` pflegbar?

## Checklisten (Kurz)
- Inhalt: H1 exakt 1×, Frontmatter vollständig, interne Links ok, Alt-Texte vorhanden.
- SEO: Title/Description, Canonical, OG/Twitter, Schema geplant/angetragen, noindex für Drafts.
- Performance: Bildgrößen, Lazy, Fonts swap, kein unnötiges JS.
- QA: Build läuft, 404 vorhanden, robots/sitemap sinnvoll, keine Konsolenfehler.

Diese Datei ist die maßgebliche Referenz für Stil & Qualität. Bei Abweichungen: Einfachheit, Performance, Redaktionsfreundlichkeit priorisieren.
