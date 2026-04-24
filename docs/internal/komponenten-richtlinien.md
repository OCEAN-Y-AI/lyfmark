# Komponenten-Richtlinien (It just works)

## Grundsätze
- Zero-Config: Sinnvolle Defaults, minimale Pflicht-Props, Barrierefreiheit integriert.
- SSR-first: Serverseitig rendern; Client-JS/TS nur, wenn zwingend notwendig.
- Stabilität: Defensive Props-Validierung (TypeScript), robuste Fallbacks.

## API-Design
- Klare, Laien-verständliche, kurze Prop-Namen; optionale Props mit sinnvollen Defaults.
- Slots für Inhalt, wo passend; semantische Wrapper (`nav`, `section`, `article`).
- Keine globale Zustandskoppelung; keine Seiteneffekte.
- Müssen von Laien in .md Dateien über `::` Notation einfach verwendbar sein.

## Barrierefreiheit
- ARIA-Attribute, `aria-label`/`aria-labelledby` bei Navigation/Listen.
- Fokus-Management, Tastaturbedienung sicherstellen.
- Sichtbare Fokuszustände, ausreichender Kontrast.

### Navigation/ Menü
- `ManualMenu.astro` liefert das globale `<nav>` auf Basis der zentralen Menüvorlage in `navigation/menu.md` (technisch gespiegelt über `src/navigation/menu.md`).
- Tiefere Menü-Abschnitte werden über `src/components/manual-menu/ManualMenuSection.astro` rekursiv gerendert, damit die Top-Komponente schlank bleibt.
- Für `/en/`-Pfade wird zuerst `navigation/en/menu.md` geladen (technisch über `src/navigation/en/menu.md`), sonst Fallback auf die Standarddatei.
- Optionaler Sonderabschnitt `## advertise` pro Top-Level-Menüpunkt erlaubt freien Inhalt im rechten Panelbereich.
- Auf Mobile wird das Menü als Burger-Menü mit iOS-ähnlicher Untermenü-Navigation (Zurück-Button) dargestellt; Tastaturbedienung und sichtbare Fokuszustände bleiben Pflicht.
- Die Brand-Fläche links (Text oder Bild) muss über zentrale Konfiguration steuerbar bleiben.
- Aktiver Zustand und visuelle Trenner werden nur über CSS-Klassen gelöst, nicht über kundenspezifische Hardcodes.

## Styling
- Klassen-Namespace pro Komponente (z. B. `.breadcrumbs-component`).
- Keine Leaks in globale Styles; Styles so lokal wie möglich halten.
- Variablen/Token nutzen (Farben, Fonts, Abstände).

## Performance
- Keine großen Dependencies einführen; Inseln gezielt.
- Renderkosten niedrig halten; Listen effizient rendern.

## Beispiele (aus dem Projekt)
- `Breadcrumbs.astro`: automatische Erzeugung aus `Astro.url.pathname`, sinnvolle Defaults (Root-Label, Separator), semantisches `<nav>` + ARIA.

## Review-Checkliste pro Komponente
- Funktioniert ohne Props? Sind Defaults sinnvoll?
- Semantisch korrekt, ARIA vollständig, Tastaturbedienung möglich?
- Styles isoliert, Tokens genutzt, keine Inline-Styles?
- Kein unnötiges JS? SSR-Output passt?
