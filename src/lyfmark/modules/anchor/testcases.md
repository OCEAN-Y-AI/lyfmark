# anchor Testcases

## Core

- A minimal valid `:::anchor` block builds successfully and renders semantic HTML.
- Invalid module content fails with a clear, actionable build error message.
- Rendered output for `anchor` does not contain raw `:::` directive markers.

## Attributes

- `name`: valid values are accepted and invalid values fail fast with a clear message.

## Detailed Regression Scenarios

- `name` resolves to a stable valid anchor id.
- Duplicate anchor names on a page fail fast.
- Collisions with generated heading ids fail fast.
- Empty or invalid `name` fails fast.
- Anchor is self-closing and must not contain body content.
- Legacy trailing close marker directly after anchor opener is removed by formatter and does not close parent blocks.
