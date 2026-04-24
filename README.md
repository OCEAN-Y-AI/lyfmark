# LyfMark Base Template

Kundenneutrales Astro-Basispaket für Markdown-first Webseiten mit LyfMark-Modulen.

## Schnellstart

```bash
npm install
npm run dev
```

## Wichtige Ordner

```text
docs/          Dokumentation (public + internal)
public/        Statische Assets
src/pages/     Seiteninhalte als Markdown (Start mit Demo-`index.md`)
src/navigation Menüdefinition (`menu.md`)
```

## Relevante Befehle

- `npm run dev` lokaler Entwicklungsserver
- `npm run build` Produktionsbuild
- `npm run preview` lokale Build-Vorschau
- `npm run typecheck` TypeScript-Prüfung
- `npm run test:lyfmark-prettier` Formatter-Regressionstests

## Dokumentations-Einstieg

- Kundenseite/Redaktion: `docs/public/README.md`
- Internes Engineering: `docs/internal/architektur.md`
