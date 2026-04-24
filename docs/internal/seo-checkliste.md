# SEO-Checkliste

## Meta & Head
- Title vorhanden, präzise, < 60 Zeichen.
- Meta-Description vorhanden, klickstark, 140–160 Zeichen.
- Canonical-URL korrekt (oder weglassen, wenn eindeutig).
- OG/Twitter: Titel, Beschreibung, Bild (falls sinnvoll) – künftig per SEO-Komponente.

## Strukturierte Daten
- Organization, WebSite (SearchAction), BreadcrumbList global.
- Article/BlogPosting für Insights/News.
- LocalBusiness optional (Adresse, Öffnungszeiten), sobald vorhanden.

## Inhalt & Struktur
- Genau eine H1; saubere Hierarchie; sinnvolle Absätze & Listen.
- Eindeutiger Themenschwerpunkt pro Seite.
- Interne Links zwischen verwandten Seiten (Themen/Leistungen/Team).
- Navigation: Menü-Links sind statisch im HTML (nicht per JS), damit Crawler/LLMs sie zuverlässig sehen.

## Technik
- Saubere URLs (kebab-case, sprechend); keine doppelten Inhalte.
- Robots: `Allow: /`; Drafts auf `noindex` (künftig per Frontmatter-Logik).
- Sitemap automatisch erzeugen (geplant).

## Performance & UX (Ranking-Signale)
- LCP < 2.5s, CLS ≈ 0; Bilder optimiert, lazy.
- Guter Kontrast, Keyboard-Navigation, semantisches HTML.
- Mobilfreundlich: Viewport korrekt, Text lesbar, Buttons bedienbar.
