# highlight-card

## Purpose

This directory contains the complete internal implementation contract for the `highlight-card` directive module.

## Entry Points

- Module source: `module.ts`
- Base styles: `styles/base.scss`
- Export symbol: `highlightCardModule`

## Contract

- The directive name is `highlight-card`.
- Validation must fail fast with actionable messages for invalid input.
- Rendering must never leak raw `:::` markers into generated HTML.

## Installer Metadata

Installer-only metadata is stored in `manifest.json`. Runtime behavior must not depend on this metadata file.
