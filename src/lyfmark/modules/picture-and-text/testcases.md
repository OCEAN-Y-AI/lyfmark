# picture-and-text Testcases

## Core

- A minimal valid `:::picture-and-text` block builds successfully and renders semantic HTML.
- Invalid module content fails with a clear, actionable build error message.
- Rendered output for `picture-and-text` does not contain raw `:::` directive markers.

## Attributes

- `align`: valid values are accepted and invalid values fail fast with a clear message.
- `display`: valid values are accepted and invalid values fail fast with a clear message.
- `image`: valid values are accepted and invalid values fail fast with a clear message.
- `image-alt`: valid values are accepted and invalid values fail fast with a clear message.
- `image-height`: valid values are accepted and invalid values fail fast with a clear message.
- `image-width`: valid values are accepted and invalid values fail fast with a clear message.
- `media-bleed`: valid values are accepted and invalid values fail fast with a clear message.
- `overlay`: valid values are accepted and invalid values fail fast with a clear message.
- `style`: valid values are accepted and invalid values fail fast with a clear message.

## Detailed Regression Scenarios

- `display="default"` keeps non-card baseline rendering.
- `display="highlight-card"` renders highlighted card tone contract.
- `align="top|bottom|left|right"` positions media as documented.
- `media-bleed="outer"` bleeds only media layer; text stays within parent padding.
- `image-width|image-height` control rendered media size with responsive cap behavior.
- Overlay contract supports `none` and `gradient-accent-down`; invalid names fail fast.
- When only one paragraph is present in text area, default paragraph margin is normalized.
