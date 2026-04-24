# thumb-scroll Testcases

## Core

- A minimal valid `:::thumb-scroll` block builds successfully and renders semantic HTML.
- Invalid module content fails with a clear, actionable build error message.
- Rendered output for `thumb-scroll` does not contain raw `:::` directive markers.

## Attributes

- `color`: valid values are accepted and invalid values fail fast with a clear message.
- `image-height`: valid values are accepted and invalid values fail fast with a clear message.
- `image-width`: valid values are accepted and invalid values fail fast with a clear message.
- `label`: valid values are accepted and invalid values fail fast with a clear message.
- `overlay`: valid values are accepted and invalid values fail fast with a clear message.
- `style`: valid values are accepted and invalid values fail fast with a clear message.

## Detailed Regression Scenarios

- Slides are split by `---`; empty slide content fails fast.
- Nested directives may include internal `---` without creating extra slides.
- Image slides require standalone markdown image lines.
- Text-only slides are allowed and get dedicated padding behavior.
- Navigation supports cyclic arrows and swipe gestures.
- Single-slide mode hides arrow controls.
- `color=auto` inherits nearest tone context.
- `image-width|image-height` scale media without distortion.
- Link-only trailing content anchors to bottom CTA area.
- Overlay contract supports `none` and `gradient-accent-down`; invalid names fail fast.
