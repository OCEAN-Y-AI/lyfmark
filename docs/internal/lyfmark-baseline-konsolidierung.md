# LyfMark Baseline-Konsolidierung

Stand: 17.04.2026

## Ziel

Aus dem ehemaligen Testkundenprojekt wird ein langfristig wartbares, kundenneutrales Basisprodukt mit klarer Trennung zwischen redaktionellem Kundenbereich und technischer Kernlogik.

## Final festgelegte Architekturentscheidungen

- Keine Provisorien: Zielarchitektur wird direkt umgesetzt.
- Kunden-Arbeitsbereiche liegen im Root: `pages/`, `content-blocks/`, `navigation/`, `forms/`, `public/`, `docs/public/**`.
- Technischer Kern liegt unter `src/lyfmark/**`.
- `pages` bleibt 1:1 URL-Mapping.
- Kundenkonfiguration erfolgt über `site.config.yml` im Root.
- Module werden als selbstständige Einheiten unter `src/lyfmark/modules/<modul>/` organisiert (Code, Styles, interne Doku, Testfälle, optionale Manifest-Metadaten).

## Root-/Mirror-Prinzip

Astro und bestehendes Tooling nutzen weiterhin `src/*`-Pfade. Diese Pfade sind jedoch nur technische Spiegel auf Root-Ordner und werden lokal erzeugt:

- `src/pages -> ../pages`
- `src/content-blocks -> ../content-blocks`
- `src/navigation -> ../navigation`
- `src/forms -> ../forms`

Betriebsregel:

- Spiegelpfade werden nicht in Git versioniert.
- Wiederherstellung/Reparatur erfolgt über `npm repair`.
- Bei Konflikten (echtes Verzeichnis statt Link/Junction) wird bewusst abgebrochen, statt still zu überschreiben.

## Template- und Modulstrategie (fachlich beschlossen)

- Ein Default-Template wird zentral in `site.config.yml` über `defaultTemplate` gesetzt.
- Styles werden über einen Sync-Lauf (`npm run lyfmark:sync`) je Template automatisch gebündelt.
- Modulverzeichnisse enthalten neben Basisstyles optional template-spezifische Styles.
- Beim Sync werden fehlende modulbezogene Template-Overrides als interne Warnung gemeldet.
- Fehlende Overrides blockieren den Kundenbetrieb nicht; Fallback ist immer der modulare Basisstyle.

## Betrieb und Support

- Installer kümmert sich um Erstsetup für nicht-technische Nutzer.
- Der Erstsetup-Flow läuft über OS-Wrapper (`installer/windows|macos|linux`) und den Wizard `tools/installer/wizard.mjs`.
- Kundeninstallationen entstehen aus versionierten LyfMark-Release-Paketen, nicht aus einem Clone des internen Entwicklungsrepositories.
- Das lokale Kundenprojekt wird als neues Git-Repository mit Branch `main` initialisiert und in ein neu erstelltes GitHub-Repository des Kunden gepusht.
- Projektabhängigkeiten werden im Installer mit `npm ci` installiert.
- Laufende Strukturreparaturen erfolgen lokal über `npm repair`.
- Lizenzprüfungen für Module finden nur initial beim Download/Install statt, nicht während Laufzeit/Build.
