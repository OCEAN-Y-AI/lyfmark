# content-block Testcases

## Core

- A minimal valid `:::content-block` block builds successfully and renders semantic HTML.
- Invalid module content fails with a clear, actionable build error message.
- Rendered output for `content-block` does not contain raw `:::` directive markers.

## Attributes

- `name`: valid values are accepted and invalid values fail fast with a clear message.
- `vars`: valid values are accepted and invalid values fail fast with a clear message.

## Detailed Regression Scenarios

- Root and nested block names resolve to markdown files in `content-blocks/**` as canonical source.
- If `content-blocks/**` is temporarily absent, legacy projects can still resolve blocks from physical `src/content-blocks/**` fallback paths.
- Blocks without placeholders can be used without frontmatter.
- Placeholder usage requires declared variables with non-empty descriptions.
- Unknown or unused declared vars fail fast.
- Missing block files and empty files fail fast with actionable errors.
- Self-reference and cyclic inclusion are blocked.
- Blocks with `children` support wrapper syntax and enforce closing marker rules.
- Self-closing-only blocks reject child content.
- Name collisions with built-in modules fail fast.
- Dev changes in `content-blocks` trigger page invalidation and full reload.
