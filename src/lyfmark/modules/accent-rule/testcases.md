# accent-rule Testcases

## Core

- A minimal valid `:::accent-rule` block builds successfully and renders semantic HTML.
- Invalid module content fails with a clear, actionable build error message.
- Rendered output for `accent-rule` does not contain raw `:::` directive markers.

## Attributes

- `after`: valid values are accepted and invalid values fail fast with a clear message.
- `before`: valid values are accepted and invalid values fail fast with a clear message.
- `color`: valid values are accepted and invalid values fail fast with a clear message.
- `kind`: valid values are accepted and invalid values fail fast with a clear message.
- `style`: valid values are accepted and invalid values fail fast with a clear message.

## Detailed Regression Scenarios

- Decorative line renders with fixed visual dimensions and highlight tone by default.
- `kind="divider"` renders semantic `<hr>` without visual size drift.
- `before` and `after` map to spacing above and below the line.
- Numeric spacing values are interpreted as `rem`.
- `color` accepts hex and CSS variable values.
- Alignment follows surrounding text alignment contexts.
- Any module body content fails fast with a clear error.
