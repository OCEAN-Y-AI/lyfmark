# Documentation Structure (Public vs Internal)

Status: Active structure (baseline for all new documentation).

## Goal

- Separate customer-facing guidance from internal engineering/product documentation.
- Prevent accidental leakage of internal strategy and implementation details into customer docs.

## Target Structure

- `docs/public/**`: Content intended for customer handover and non-technical editing workflows.
- `docs/internal/**`: Internal architecture, engineering workflows, product strategy, QA operations, and roadmap notes.

## Rules

- New customer-facing documentation must be created in `docs/public/**`.
- New internal-only documentation must be created in `docs/internal/**`.
- Root-level `docs/` contains only entry points and shared navigation (`docs/README.md`).
- For future restructurings, keep redirects/links stable until all references are updated.

## Current Mapping

### Public

- `docs/public/onboarding.md`
- `docs/public/content-richtlinien.md`
- `docs/public/menu.md`
- `docs/public/templates.md`
- `docs/public/modules/**`
- `docs/public/examples/**`

### Internal

- `docs/internal/workflows/**`
- `docs/internal/architektur.md`
- `docs/internal/lyfmark-baseline-konsolidierung.md`
- `docs/internal/template-system.md`
- `docs/internal/site-config.md`
- `docs/internal/komponenten-richtlinien.md`
- `docs/internal/theme-system.md`
- `docs/internal/styles-styleguide.md`
- `docs/internal/seo-checkliste.md`
- `docs/internal/performance-checkliste.md`
- `docs/internal/install.md`
- `docs/internal/kunden-doku-leitfaden.md`
- `docs/internal/release-flow.md`
- `docs/internal/release-packaging-security.md`
