# LyfMark Product Strategy

Status: Active internal baseline for upcoming template deliveries.

## Product Positioning

- Product name for the modular Markdown/Remark system is `LyfMark`.
- Legacy customer project names must not appear in product naming or distribution artifacts.
- LyfMark is designed as a reusable technical core for multiple future customer websites.

## Delivery Model

- Default delivery target is a ready-to-use customer-owned GitHub project based on a versioned LyfMark release package.
- The installer must not clone the internal LyfMark development repository into customer projects.
- Expected customer workflow is:
	1. Start the installer.
	2. Enter project and GitHub account information.
	3. Let the installer create the local project, create the customer GitHub repository, push the initial `main` branch, and open VS Code.
	4. Start editing content immediately.
- Customer repositories are intentionally independent from Lyfeld IT. Customers may continue with Lyfeld IT, continue with another provider, or modify their own project with AI/experts, as long as they do not resell LyfMark itself.
- Tooling must work out of the box with repository-local configuration and dependencies.
- Project dependencies must be installed with `npm ci` in customer setup flows.

## Release and Trust Model

- Core version `1.0` is the first planned release package for the next test customer.
- GitHub is the internal development platform and temporary release/download host, not the cryptographic root of trust.
- Release packages are built locally/offline, then uploaded as release assets.
- Long-term package verification uses an embedded LyfMark root public key, one root-signed release public key per package version, a signed manifest, and a SHA-256 check of the package ZIP.
- Details: `docs/internal/release-packaging-security.md`.

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
