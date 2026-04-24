# split Testcases

## Core

- A minimal valid `:::split` block builds successfully and renders semantic HTML.
- Invalid module content fails with a clear, actionable build error message.
- Rendered output for `split` does not contain raw `:::` directive markers.

## Attributes

- `style`: valid values are accepted and invalid values fail fast with a clear message.
- `weight`: valid values are accepted and invalid values fail fast with a clear message.

## Detailed Regression Scenarios

- Column count is derived strictly from `---` separators and supports 2-4 columns.
- `weight` value count must match column count exactly.
- Invalid weight values (`0`, negative, non-numeric) fail fast.
- Mobile breakpoint collapses to one column regardless of weight.
- Nested directives may contain internal `---` without affecting split column parsing.
- Empty columns remain valid.
- First/last child margin normalization per column remains stable.
