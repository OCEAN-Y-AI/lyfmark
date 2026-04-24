# Remark-Workflow & Typecheck

## Scope
- Alle Dateien unter `src/remark/**` (Parser, Registry, Module-Renderer, Utils).
- `astro.config.ts`, sobald dort Remark-Plugins eingetragen/angepasst werden.
- `.vscode/markdown.code-snippets` oder Docs nur, wenn parallel Logik erneuert wird (sonst genügt redaktioneller Review).

## Verbindliche Checks vor Abschluss einer Aufgabe
1. **TypeScript-Kontrolle:** `npm run typecheck` ausführen. Der Befehl ruft `tsc --noEmit` auf und prüft explizit `directives-to-blocks.ts`, Registry und alle Module.
2. **Fehler lesen & beheben:**
	- `tsc` stoppt mit Exit-Code ≠ 0 sowie klarer Dateiangabe (z. B. `src/remark/directives-to-blocks.ts`).
	- Fehler niemals wegcasten – konkrete Ursache fixen (fehlende Typeguards, falsche Rückgabewerte, ungültige Plugin-Signaturen).
3. **Ergebnis dokumentieren:** Sobald `npm run typecheck` ohne Fehler durchläuft, den Erfolg im Task-Hand-off erwähnen.

## Hintergrund & Motivation
- `directives-to-blocks.ts` bildet das AST-„Tor" für sämtliche `:::module`-Blöcke. Jeder Typfehler schlägt sich in nicht buildbaren Seiten nieder.
- Die TypeScript-Prüfung ist schneller als ein vollständiger `astro build`, deckt aber dieselben Contract-Verletzungen in Parser/Renderer ab.
- Plugins, die nicht `RemarkPlugin` entsprechen (z. B. `remark-smartypants`), müssen bewusst gecastet oder durch Wrapper gehärtet werden, damit der Contract klar bleibt.

## Empfohlener Ablauf
1. Änderungen lokal umsetzen (Parser, Module, Registry, Styles, Snippets, Docs).
2. Direkt danach `npm run typecheck` laufen lassen.
3. Optional anschließend `npm run build`, wenn weitere Risiken (SEO/Content) getestet werden sollen.
4. Ergebnis + ggf. bekannte Einschränkungen im Review-Hand-off nennen.

Damit bleibt jede zukünftige Modul-Aufgabe reproduzierbar abgesichert.
