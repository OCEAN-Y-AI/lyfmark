# tabs Testcases

## Core

- A minimal valid `:::tabs` block builds successfully and renders semantic HTML.
- Invalid module content fails with a clear, actionable build error message.
- Rendered output for `tabs` does not contain raw `:::` directive markers.

## Attributes

- `color`: valid values are accepted and invalid values fail fast with a clear message.
- `label`: valid values are accepted and invalid values fail fast with a clear message.
- `style`: valid values are accepted and invalid values fail fast with a clear message.

## Detailed Regression Scenarios

- First `###` in each tab is used as button label and not duplicated in panel body.
- At least two tab sections are required and must be separated by `---`.
- Each section must start with `###`; invalid headings fail fast.
- `color="light|dark|transparent-light|transparent-dark"` applies the expected active/inactive button variants.
- Keyboard behavior (Arrow keys, Home, End) works through `public/scripts/tabs.js`.
- Without JavaScript, all tab panels remain visible.
- Nested directives containing their own `---` stay scoped and do not create extra tabs.
