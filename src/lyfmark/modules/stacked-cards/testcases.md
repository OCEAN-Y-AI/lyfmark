# stacked-cards Testcases

## Core

- A minimal valid `:::stacked-cards` block builds successfully and renders semantic HTML.
- Invalid module content fails with a clear, actionable build error message.
- Rendered output for `stacked-cards` does not contain raw `:::` directive markers.

## Attributes

- `color`: valid values are accepted and invalid values fail fast with a clear message.
- `label`: valid values are accepted and invalid values fail fast with a clear message.
- `style`: valid values are accepted and invalid values fail fast with a clear message.

## Detailed Regression Scenarios

- Cards are split by `---` and auto-numbered.
- `color` follows explicit and inherited tone contracts.
- Arrow navigation cycles through all cards.
- Active card is interactive; background cards are preview-only (`aria-hidden` + `inert`).
- Maximum three visual stack positions are shown at a time.
- Card heights are normalized to tallest card.
- Last link area can be anchored to card bottom.
- Background blur levels apply only to non-active cards.
- Nested directive separators remain scoped and do not create extra cards.
