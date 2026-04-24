# link Testcases

## Core

- A minimal valid `:::link` block builds successfully and renders semantic HTML.
- Invalid module content fails with a clear, actionable build error message.
- Rendered output for `link` does not contain raw `:::` directive markers.

## Attributes

- `align`: valid values are accepted and invalid values fail fast with a clear message.
- `color`: valid values are accepted and invalid values fail fast with a clear message.
- `style`: valid values are accepted and invalid values fail fast with a clear message.
- `target`: valid values are accepted and invalid values fail fast with a clear message.
- `text`: valid values are accepted and invalid values fail fast with a clear message.
- `to`: valid values are accepted and invalid values fail fast with a clear message.

## Detailed Regression Scenarios

- `align="left|center|right"` aligns button container as expected.
- `style="default|cta|outline|destructive"` applies documented visual contracts.
- `color` inheritance from nearest tone container works when `color` is omitted.
- Explicit `color` always overrides inherited tone.
- Invalid align values fail fast.
- `target="new"` enforces `_blank` with safe `rel` attributes.
- Consecutive link directives without empty lines form one row; empty line starts a new row.
