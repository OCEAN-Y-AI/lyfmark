# Template System and Dynamic Style Assembly

Status: Active implementation baseline (`todo.md` steps 5, 6 and 7).

## Goal

Provide deterministic, installer-friendly template switching and module runtime script loading without manual layout edits.

## Source of Truth and Contracts

- Template source:
	- `src/lyfmark/templates/<template-id>/foundation.scss`
- Module source:
	- `src/lyfmark/modules/<module-id>/styles/base.scss` (required)
	- `src/lyfmark/modules/<module-id>/styles/templates/<template-id>.scss` (optional)
- Customer-facing template selection:
	- `site.config.yml` -> `defaultTemplate`
- Module runtime script source:
	- `src/scripts/<module-id>.js` (optional)
	- Shared runtime scripts are explicitly managed (for now: `src/scripts/manual-menu.js`).

## Sync Pipeline

Command:

```bash
npm run lyfmark:sync
```

Optional detailed diagnostics:

```bash
npm run lyfmark:sync:verbose
```

Implementation:

- Generator script: `tools/lyfmark-sync.mjs`
- Generated outputs:
	- `src/lyfmark/generated/styles/templates/<template-id>.scss`
	- `src/lyfmark/generated/template-manifest.ts`
	- `src/lyfmark/generated/template-style-urls.ts`
	- `src/lyfmark/generated/module-runtime-scripts.astro`
	- `src/lyfmark/generated/runtime-scripts.ts`

`src/layouts/primary.astro` resolves the effective template and injects the matching stylesheet URL from `template-style-urls.ts`.  
The layout also keeps shared scripts explicit and imports the generated module runtime include component.

## Assembly Order (per template bundle)

1. Template foundation (`foundation.scss`)
2. Module base style for every installed module
3. Module template override for matching template id (if available)

Ordering is deterministic (alphabetical by template id and module id) to avoid non-reproducible bundles.

## Generated Bundle Cleanup

- During sync, generated template bundles under `src/lyfmark/generated/styles/templates/**` are reconciled with the currently installed templates.
- Stale generated bundle files (for removed templates) are deleted automatically.
- Result: no stale generated CSS artifacts survive template removals.

## Runtime Script Auto-Assembly

- For each installed module id, sync checks if `src/scripts/<module-id>.js` exists.
- Matching files are included in the generated runtime include component (`module-runtime-scripts.astro`) in deterministic module-id order.
- Shared scripts are intentionally kept explicit in `primary.astro` to avoid hiding non-module runtime behavior.

## Effective Template Resolution

Resolution order in `src/layouts/primary.astro`:

1. `frontmatter.template` (optional page override)
2. fallback to `site.config.yml` -> `defaultTemplate`

Validation contract:

- `frontmatter.template` must be a non-empty string when present.
- `defaultTemplate` and `frontmatter.template` must exist in `templateManifest.templates`.
- Unknown template values fail fast with a clear error containing valid template choices.

## Fallback and Warnings

- Missing module template override does not fail the build.
- Fallback is always the module `styles/base.scss`.
- Sync emits non-blocking warning signals for:
	- modules without override for an available template
	- unknown override files (override filename does not match an installed template id)
	- script files in `src/scripts/` that do not match installed module ids and are not in the shared allowlist.
- Default output is concise and action-oriented for non-technical users.
- Full technical lists are available via:
	- `npm run lyfmark:sync:verbose`
	- `.cache/logs/lyfmark-sync.log`

These warning signals are quality feedback for template/design/development and do not block runtime rendering.

## Operational Rules

- `npm run dev` triggers sync automatically via `predev`.
- `npm run build` triggers sync automatically via `prebuild`.
- If templates or modules are added/removed manually during development, run `npm run lyfmark:sync` explicitly before validation.
- Runtime behavior must never depend on module `manifest.json`; manifests remain installer metadata only.

## How to Add a New Template

1. Create `src/lyfmark/templates/<new-template-id>/foundation.scss`.
2. Add optional module overrides under each module:
	- `src/lyfmark/modules/<module-id>/styles/templates/<new-template-id>.scss`
3. Set `defaultTemplate` in `site.config.yml` to the new template id.
4. Run `npm run lyfmark:sync`.
5. Validate with `npm run build` and a visual check (`npm run render:shot`).
