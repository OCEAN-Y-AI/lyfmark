# text-over-picture Testcases

## Core

- A minimal valid `:::text-over-picture` block builds successfully and renders semantic HTML.
- Invalid module content fails with a clear, actionable build error message.
- Rendered output for `text-over-picture` does not contain raw `:::` directive markers.

## Attributes

- `align-y`: valid values are accepted and invalid values fail fast with a clear message.
- `color`: valid values are accepted and invalid values fail fast with a clear message.
- `height`: valid values are accepted and invalid values fail fast with a clear message.
- `image`: valid values are accepted and invalid values fail fast with a clear message.
- `image-alt`: valid values are accepted and invalid values fail fast with a clear message.
- `overlay`: valid values are accepted and invalid values fail fast with a clear message.
- `style`: valid values are accepted and invalid values fail fast with a clear message.
- `width`: valid values are accepted and invalid values fail fast with a clear message.

## Detailed Regression Scenarios

- Module renders one base image with content overlay.
- Optional `image-alt` is rendered correctly.
- `align-y="start|center|end"` controls vertical overlay position.
- `width|height` fixed mode and auto-dimension mode both behave predictably.
- Overlay contract supports `none` and `gradient-accent-down`; invalid names fail fast.
- Consecutive modules without empty lines stay grouped in one row.
- Empty line between modules starts a new row.
