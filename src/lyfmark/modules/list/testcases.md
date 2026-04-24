# list Testcases

## Core

- A minimal valid `:::list` block builds successfully and renders semantic HTML.
- Invalid module content fails with a clear, actionable build error message.
- Rendered output for `list` does not contain raw `:::` directive markers.

## Attributes

- `bullet`: valid values are accepted and invalid values fail fast with a clear message.
- `bullet-class`: valid values are accepted and invalid values fail fast with a clear message.
- `class`: valid values are accepted and invalid values fail fast with a clear message.
- `color`: valid values are accepted and invalid values fail fast with a clear message.
- `display`: valid values are accepted and invalid values fail fast with a clear message.
- `style`: valid values are accepted and invalid values fail fast with a clear message.

## Detailed Regression Scenarios

- `display="auto"` keeps ordered and unordered list card behavior as contract default.
- Ordered lists render numbered card style with stable number area.
- Unordered lists require `bullet`; missing bullet fails fast.
- `bullet` supports lucide token, plain character, and empty bullet with custom class.
- `color` auto-inherits nearest tone context and supports explicit `light|dark` override.
- Mixed list types in one block fail fast.
- Invalid class/bullet-class syntax fails fast.
- Unknown lucide icon names in `bullet` fail fast.
