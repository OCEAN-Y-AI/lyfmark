# typo Testcases

## Core

- A minimal valid `:::typo` block builds successfully and renders semantic HTML.
- Invalid module content fails with a clear, actionable build error message.
- Rendered output for `typo` does not contain raw `:::` directive markers.

## Attributes

- `as`: valid values are accepted and invalid values fail fast with a clear message.
- `class`: valid values are accepted and invalid values fail fast with a clear message.
- `style`: valid values are accepted and invalid values fail fast with a clear message.

## Detailed Regression Scenarios

- `class` is required and invalid class syntax fails fast.
- `as` renders the requested semantic element.
- Multiple classes are accepted and deduplicated.
- Inline style is attached to the wrapper.
- Markdown content inside `:::typo` remains markdown, not flattened plain text.
- Empty content fails fast.
