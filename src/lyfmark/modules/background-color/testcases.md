# background-color Testcases

## Core

- A minimal valid `:::background-color` block builds successfully and renders semantic HTML.
- Invalid module content fails with a clear, actionable build error message.
- Rendered output for `background-color` does not contain raw `:::` directive markers.

## Attributes

- `accent`: valid values are accepted and invalid values fail fast with a clear message.
- `color`: valid values are accepted and invalid values fail fast with a clear message.
- `direction`: valid values are accepted and invalid values fail fast with a clear message.
- `fill`: valid values are accepted and invalid values fail fast with a clear message.
- `style`: valid values are accepted and invalid values fail fast with a clear message.

## Detailed Regression Scenarios

- `fill` alone renders a full-width color area.
- `fill` + `accent` + `direction` renders gradients as configured.
- Missing `accent` falls back to solid fill.
- `color="dark"` swaps text/heading tone while preserving button/link logic.
- Nested modules with explicit tone keep nearest-container tone precedence.
- Invalid color values fail fast.
- Wrapper label extraction stays safe when inline lucide icons are present.
