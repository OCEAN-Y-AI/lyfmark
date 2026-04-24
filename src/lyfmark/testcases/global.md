# Global LyfMark Testcases

## Directive Parser

- A module closes correctly when `:::` follows directly in the next line without an empty line.
- Nested modules close correctly with consecutive closers (`:::\n:::\n:::`) without additional empty lines.
- A closing `:::` directly after a markdown list item is parsed correctly.
- Opening directive + self-closing directive in consecutive lines are parsed as separate modules.
- Split separators (`---`) inside deeply nested modules remain scoped to the correct module level.
- HTML directly after a module opener is rendered as HTML content and not escaped as code.
- A stray `:::` without matching opener fails with a clear error.

## Manual Menu System

- Missing `navigation/menu.md` fails fast with a clear build error.
- `/en/...` pages resolve `navigation/en/menu.md` first and fall back to `navigation/menu.md`.
- Top-level separators are valid only between menu entries, not at start/end and not duplicated.
- Invalid menu structures fail fast with actionable messages.
- `advertise` sections support rich markdown/module content and preserve expected desktop/mobile behavior.
- Menu changes in root or mirror paths trigger page invalidation and full reload in dev server.

## Redirect Layout

- Redirect pages with valid `redirectTo` perform client redirect and expose a visible fallback link.
- Missing `redirectTo` fails the build with a clear message.
- Unsafe redirect schemes (for example `javascript:`) are blocked.
- Internal redirects keep configured Astro base path behavior.

## Typography Baseline

- Heading and utility typography defaults match the central token contract in `src/styles/typography.scss`.
- Module typography uses shared mixins instead of local hardcoded font values.
- Blockquote italic style remains intact across module contexts.

## LyfMark Formatter

- `parser="markdown"` and `parser="lyfmark-markdown"` produce equivalent formatting in project workflows.
- Formatter keeps 2-space nesting per module level deterministically.
- Formatter inserts required separation lines before module directives where needed.
- Formatter behavior remains compatible with parser rules for grouped directives and nested modules.

## VS Code Extension and URL Completion

- Lucide completion appears only in `[lucide:...]` contexts.
- Directive name completion includes built-in modules plus content blocks.
- URL completion for image and route fields remains optional and never blocks free text.
- Cache invalidation reacts to content-block/page/module/snippet changes.
- Local VSIX install/update path remains reproducible (including WSL remote target behavior).

## Frontmatter Color Overrides

- Page `color-*` frontmatter fields map to `--color-*` variables.
- Valid CSS color values are accepted; invalid/unsafe values fail with clear messages.
- Unquoted hex values fail with actionable guidance.
- `color-highlight` visibly affects default accent-rule rendering when no explicit module color is set.
- `npm run test:frontmatter-colors` covers positive and negative end-to-end paths.

## Baseline Consolidation Gates

- Build remains successful with minimal single-page project content.
- Missing `content-blocks/**` remains non-fatal (content blocks are optional).
- Build formatting flow remains stable even when no content-block files are present.
- `npm run repair` is idempotent, restores required root folders and `src/*` mirrors, and runs `lyfmark:sync` in the same flow.
- Installer wizard validates required tools, runs guided git/ssh setup, and finishes with `npm install` + `npm run repair`.
- Installer CI tests run via GitHub Actions on Linux/macOS/Windows and cover wizard fail-fast + non-interactive wrapper execution.
- Installer E2E auto test runs in a fresh CI VM, executes the full guided install flow, and mocks GitHub URL opening/login-related external interaction.
