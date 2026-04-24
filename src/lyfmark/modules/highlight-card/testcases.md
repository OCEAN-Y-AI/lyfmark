# highlight-card Testcases

## Core

- A minimal valid `:::highlight-card` block builds successfully and renders semantic HTML.
- Invalid module content fails with a clear, actionable build error message.
- Rendered output for `highlight-card` does not contain raw `:::` directive markers.

## Attributes

- `accent`: valid values are accepted and invalid values fail fast with a clear message.
- `color`: valid values are accepted and invalid values fail fast with a clear message.
- `direction`: valid values are accepted and invalid values fail fast with a clear message.
- `fill`: valid values are accepted and invalid values fail fast with a clear message.
- `label`: valid values are accepted and invalid values fail fast with a clear message.
- `max-width`: valid values are accepted and invalid values fail fast with a clear message.
- `min-width`: valid values are accepted and invalid values fail fast with a clear message.
- `style`: valid values are accepted and invalid values fail fast with a clear message.
- `width`: valid values are accepted and invalid values fail fast with a clear message.

## Detailed Regression Scenarios

- Default tone keeps gradient card style.
- `color="light"` renders light card with dark text and accent border.
- `color="auto"` inverts nearest tone context and falls back stably when no context exists.
- Card remains flat style (no shadow) across tone variants.
- Width contract for `width|min-width|max-width` is enforced, including invalid combined states.
- Last-link anchoring keeps CTA/link area at card bottom.
- Embedded `picture-and-text` with `media-bleed="outer"` bleeds media while text keeps card padding.
