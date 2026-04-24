# background-image Testcases

## Core

- A minimal valid `:::background-image` block builds successfully and renders semantic HTML.
- Invalid module content fails with a clear, actionable build error message.
- Rendered output for `background-image` does not contain raw `:::` directive markers.

## Detailed Regression Scenarios

- Default `constraint` uses module layer positioning.
- Optional `alt` renders empty string when omitted.
- `constraint="viewport"`, `viewport-x`, and `viewport-y` match expected overflow behavior.
- Unsupported layer names fail fast and list valid layers.
- Rotation, opacity, and flip values apply predictably.
- Background image in `highlight-card` with `constraint="auto"` stays clipped to card bounds.
