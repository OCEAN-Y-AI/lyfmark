# space Testcases

## Core

- A minimal valid `:::space` block builds successfully and renders semantic HTML.
- Invalid module content fails with a clear, actionable build error message.
- Rendered output for `space` does not contain raw `:::` directive markers.

## Attributes

- `size`: valid values are accepted and invalid values fail fast with a clear message.
- `style`: valid values are accepted and invalid values fail fast with a clear message.

## Detailed Regression Scenarios

- Vertical spacing without attributes renders a 4rem gap.
- `size="6"` is interpreted as `6rem`.
- Horizontal spacing inside `split` creates a fixed-width empty column.
- Invalid sizes such as `size="4;"` fail fast with a clear message.
- Single-line `:::space` and inline-open-close syntax both render without leaked directive markers.
