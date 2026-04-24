# background-wave Testcases

## Core

- A minimal valid `:::background-wave` block builds successfully and renders semantic HTML.
- Invalid module content fails with a clear, actionable build error message.
- Rendered output for `background-wave` does not contain raw `:::` directive markers.

## Attributes

- `algorithm`: valid values are accepted and invalid values fail fast with a clear message.
- `alt`: valid values are accepted and invalid values fail fast with a clear message.
- `asset-style`: valid values are accepted and invalid values fail fast with a clear message.
- `fit`: valid values are accepted and invalid values fail fast with a clear message.
- `flip`: valid values are accepted and invalid values fail fast with a clear message.
- `frequency`: valid values are accepted and invalid values fail fast with a clear message.
- `height`: valid values are accepted and invalid values fail fast with a clear message.
- `intensity`: valid values are accepted and invalid values fail fast with a clear message.
- `offset-x`: valid values are accepted and invalid values fail fast with a clear message.
- `offset-y`: valid values are accepted and invalid values fail fast with a clear message.
- `opacity`: valid values are accepted and invalid values fail fast with a clear message.
- `position`: valid values are accepted and invalid values fail fast with a clear message.
- `relative-to`: valid values are accepted and invalid values fail fast with a clear message.
- `rotation`: valid values are accepted and invalid values fail fast with a clear message.
- `scale`: valid values are accepted and invalid values fail fast with a clear message.
- `style`: valid values are accepted and invalid values fail fast with a clear message.
- `url`: valid values are accepted and invalid values fail fast with a clear message.
- `width`: valid values are accepted and invalid values fail fast with a clear message.
- `zoom`: valid values are accepted and invalid values fail fast with a clear message.

## Detailed Regression Scenarios

- `algorithm="wave"` and `algorithm="rain"` produce distinct motion models.
- `position` anchors (`left|right|center|fill|contain`) remain stable across viewport resizes.
- Explicit `fit` overrides position presets.
- WebGL and static fallback paths keep consistent transform composition (zoom/offset/rotation/flip).
- `relative-to` changes reference frame without breaking composition scale.
- Reduced-motion users receive static rendering.
- HiDPI rendering remains stable without flicker.
- `render:wave-matrix` scenarios remain reproducible for viewport comparisons.
