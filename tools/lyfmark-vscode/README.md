# LyfMark VS Code

Lokale VS Code Erweiterung für kontextbezogene URL-Vorschläge in LyfMark-Direktiven und Frontmatter.

Aktueller Standard:

- Bildfelder schlagen Bilddateien aus `public/**` vor.
- Linkfelder schlagen interne Seitenpfade aus `src/pages/**` vor.
- Frontmatter-Bildfelder (`thumbnail`, `author-image`) schlagen ebenfalls Bilddateien aus `public/**` vor.
- In `[lucide:...]`-Kontexten werden passende Lucide-Iconnamen vorgeschlagen (inklusive Fallback-Liste, falls `lucide-static` im Workspace nicht aufloesbar ist).
- In offenen `[...]`-Kontexten priorisiert die Erweiterung Lucide-Vorschläge und bietet dort keine Modulnamen-Suggestions an.
- Workspace-Snippets nutzen nur modulnamenbasierte Prefixe (ohne `:::...`), damit im Lucide-Kontext keine kollidierenden Modul-Snippets auftauchen.
- In `:::`-Kontexten liefert die Erweiterung direkt Snippet-Completion (inkl. passender Modulstruktur), sodass kein doppelter Completion-Schritt noetig ist.

Regeln pflegen:

- `rules.cjs` anpassen.
- Neue Modul-Felder als `module` + `attribute` eintragen.
- Neue Frontmatter-Felder als `field` eintragen.

Paket bauen:

```bash
npx @vscode/vsce package --allow-missing-repository
```
