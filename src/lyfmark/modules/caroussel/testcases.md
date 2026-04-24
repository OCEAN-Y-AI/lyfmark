# caroussel Testcases

## Core

- A minimal valid `:::caroussel` block builds successfully and renders semantic HTML.
- Invalid module content fails with a clear, actionable build error message.
- Rendered output for `caroussel` does not contain raw `:::` directive markers.

## Attributes

- `color`: valid values are accepted and invalid values fail fast with a clear message.
- `display`: valid values are accepted and invalid values fail fast with a clear message.
- `label`: valid values are accepted and invalid values fail fast with a clear message.
- `style`: valid values are accepted and invalid values fail fast with a clear message.

## Detailed Regression Scenarios

- At least two cards are required.
- `display=revolver` is default, `cut-elements` enables legacy mode.
- Revolver shows three visible positions with cyclic navigation.
- Center card scale boost remains stable.
- Card base size normalization keeps module height stable across slides.
- Drag/swipe navigation works and suppresses accidental text selection.
- Arrow controls use shared arrow button styling and dark-tone backing surface.
- Active card tone is inverted relative to module tone.
- Nested module `---` separators stay scoped and do not create extra cards.
