# quick-nav Testcases

## Core

- A minimal valid `:::quick-nav` block builds successfully and renders semantic HTML.
- Invalid module content fails with a clear, actionable build error message.
- Rendered output for `quick-nav` does not contain raw `:::` directive markers.

## Attributes

- `color`: valid values are accepted and invalid values fail fast with a clear message.
- `label`: valid values are accepted and invalid values fail fast with a clear message.
- `size`: valid values are accepted and invalid values fail fast with a clear message.
- `style`: valid values are accepted and invalid values fail fast with a clear message.
- `visible`: valid values are accepted and invalid values fail fast with a clear message.

## Detailed Regression Scenarios

- Only unordered list input is valid.
- Each list item must contain exactly one link.
- Lucide and image entries render as click targets.
- Optional image alt text can be supplied via link title.
- Unknown lucide names fail fast.
- Unsafe URL schemes are rejected.
- `size` scales rail and item geometry consistently.
- `visible="desktop|mobile|desktop,mobile"` behaves as documented.
