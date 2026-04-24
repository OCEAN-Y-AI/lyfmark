# Performance-Checkliste

## JavaScript
- Kein JS als Default. Inseln nur bei Bedarf (`client:*` sparsam).
- Keine großen Bibliotheken ohne klaren Nutzen.

## Bilder
- Optimierte Formate (WebP/AVIF), responsive Größen; Lazy-Loading.
- Feste `width/height`, korrekte `sizes`; Platzhalter vermeiden Layout-Shift.

## Fonts
- WOFF2, Subsetting wo möglich, `font-display: swap`.
- Nur tatsächlich verwendete Schnitte einbinden.

## CSS
- Kompakt, ohne tiefe Selektoren; kritische Regeln früh laden.
- Keine ungenutzten Utilities/Resets.

## Netzwerk
- HTTP Caching nutzen; unnötige Requests vermeiden.
- Preload/Preconnect gezielt, nicht überall.

## Messung
- Lighthouse (Mobil und Desktop), Web Vitals (LCP/CLS/INP).
- LCP-Element identifizieren (meist Hero-Bild/Text) und optimieren.
