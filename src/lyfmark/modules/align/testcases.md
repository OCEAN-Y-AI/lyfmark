# align Testcases

## Core

- A minimal valid `:::align` block builds successfully and renders semantic HTML.
- Invalid module content fails with a clear, actionable build error message.
- Rendered output for `align` does not contain raw `:::` directive markers.

## Attributes

- `fill`: valid values are accepted and invalid values fail fast with a clear message.
- `style`: valid values are accepted and invalid values fail fast with a clear message.
- `text`: valid values are accepted and invalid values fail fast with a clear message.
- `x`: valid values are accepted and invalid values fail fast with a clear message.
- `y`: valid values are accepted and invalid values fail fast with a clear message.

## Detailed Regression Scenarios

- Defaults resolve to `x=left`, `y=top`, `text=left`, `fill=both`.
- `x|y` centering positions content in available area.
- `x=center` centers container but does not implicitly center text.
- `x=right` + `text=right` aligns content and text right.
- `fill=none|width|height|both` switches occupied area consistently.
- Empty content fails fast.
