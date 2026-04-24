# accordion Testcases

## Core

- A minimal valid `:::accordion` block builds successfully and renders semantic HTML.
- Invalid module content fails with a clear, actionable build error message.
- Rendered output for `accordion` does not contain raw `:::` directive markers.

## Attributes

- `label`: valid values are accepted and invalid values fail fast with a clear message.
- `style`: valid values are accepted and invalid values fail fast with a clear message.

## Detailed Regression Scenarios

- A single section is valid without `---`.
- Each section must start with `#`, `##`, or `###`.
- Empty content after section heading fails fast.
- Multiple sections are split strictly by `---`.
- Nested directives can contain internal `---` without creating extra accordion entries.
