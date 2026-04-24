# form Testcases

## Core

- A minimal valid `:::form` block builds successfully and renders semantic HTML.
- Invalid module content fails with a clear, actionable build error message.
- Rendered output for `form` does not contain raw `:::` directive markers.

## Detailed Regression Scenarios

- Preset HTML is loaded from `forms/<preset>.html` as canonical source.
- If `forms/**` is temporarily absent, legacy projects can still resolve presets from physical `src/forms/**` fallback paths.
- Module markdown body renders above form output.
- Missing required preset variables fail fast.
- Extra variables not used by preset fail fast.
- Preset names containing `/` or `\\` fail fast.
- Preset must contain exactly one `<form>` element.
- `<form>` must include `method="post"` and `action`.
