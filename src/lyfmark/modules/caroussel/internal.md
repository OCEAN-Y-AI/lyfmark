# caroussel

## Purpose

This directory contains the complete internal implementation contract for the `caroussel` directive module.

## Entry Points

- Module source: `module.ts`
- Base styles: `styles/base.scss`
- Export symbol: `carousselModule`

## Contract

- The directive name is `caroussel`.
- Validation must fail fast with actionable messages for invalid input.
- Rendering must never leak raw `:::` markers into generated HTML.

## Installer Metadata

Installer-only metadata is stored in `manifest.json`. Runtime behavior must not depend on this metadata file.
