# splash-screen Testcases

## Core

- A minimal valid `:::splash-screen` block builds successfully and renders semantic HTML.
- Invalid module content fails with a clear, actionable build error message.
- Rendered output for `splash-screen` does not contain raw `:::` directive markers.

## Attributes

- `color`: valid values are accepted and invalid values fail fast with a clear message.
- `content-style`: valid values are accepted and invalid values fail fast with a clear message.
- `dismiss`: valid values are accepted and invalid values fail fast with a clear message.
- `duration`: valid values are accepted and invalid values fail fast with a clear message.
- `exit-animation`: valid values are accepted and invalid values fail fast with a clear message.
- `exit-duration`: valid values are accepted and invalid values fail fast with a clear message.
- `label`: valid values are accepted and invalid values fail fast with a clear message.
- `repeat-after`: valid values are accepted and invalid values fail fast with a clear message.
- `style`: valid values are accepted and invalid values fail fast with a clear message.

## Detailed Regression Scenarios

- Overlay covers full viewport and shows only splash content.
- `dismiss="timer-or-click"`, `dismiss="timer"`, and `dismiss="click"` each follow the documented behavior.
- `repeat-after` controls recurrence correctly, including `0`/negative always-show behavior.
- Changing or removing `repeat-after` invalidates previous persistence state.
- `exit-animation="fade-out"` removes overlay after transition without layout jump.
- Custom `data-splash-dismiss` controls close the splash explicitly.
- Empty splash content fails fast.
- With JavaScript disabled, page remains usable because splash starts hidden.
