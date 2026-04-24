# LyfMark Product Strategy

Status: Active internal baseline for upcoming template deliveries.

## Product Positioning

- Product name for the modular Markdown/Remark system is `LyfMark`.
- Legacy customer project names must not appear in product naming or distribution artifacts.
- LyfMark is designed as a reusable technical core for multiple future customer websites.

## Delivery Model

- Default delivery target is a ready-to-use base template.
- Expected customer workflow is:
	1. Download ZIP.
	2. Extract ZIP.
	3. Open folder in VS Code.
	4. Start editing content immediately.
- Tooling must work out of the box with repository-local configuration and dependencies.

## Formatter Requirements

- The Markdown formatter setup must be customer-agnostic and independent from project-specific design.
- `:::` directive indentation rules are part of LyfMark authoring UX, not customer custom logic.
- Preferred setup is local Prettier integration that runs without customer-side manual formatter configuration.
- Distribution model for the formatter is repository-local only (no Marketplace release, no public npm publish).

## Module Productization

- Current visual design is a study, not a long-term visual baseline.
- Modules are expected to be largely reusable, but not guaranteed as a fixed set.
- Future packaging may merge modules into configurable variants (for example via `preset` or `display` parameters).
- Paid feature tiers per module/feature bundle are expected; architecture should keep modules separable and licensable.

## Engineering Implications

- Keep module APIs generic and customer-neutral.
- Avoid assumptions tied to a single brand, legal domain, or content model.
- Treat CSS themes/templates as swappable layers above the shared LyfMark module/parsing core.
