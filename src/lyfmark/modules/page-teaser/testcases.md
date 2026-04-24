# page-teaser Testcases

## Core

- A minimal valid `:::page-teaser` block builds successfully and renders semantic HTML.
- Invalid module content fails with a clear, actionable build error message.
- Rendered output for `page-teaser` does not contain raw `:::` directive markers.

## Attributes

- `button`: valid values are accepted and invalid values fail fast with a clear message.
- `color`: valid values are accepted and invalid values fail fast with a clear message.
- `display`: valid values are accepted and invalid values fail fast with a clear message.
- `from`: valid values are accepted and invalid values fail fast with a clear message.
- `height-caroussel`: valid values are accepted and invalid values fail fast with a clear message.
- `height-focus`: valid values are accepted and invalid values fail fast with a clear message.
- `label`: valid values are accepted and invalid values fail fast with a clear message.
- `limit`: valid values are accepted and invalid values fail fast with a clear message.
- `order`: valid values are accepted and invalid values fail fast with a clear message.
- `style`: valid values are accepted and invalid values fail fast with a clear message.

## Detailed Regression Scenarios

- `from` supports path resolution relative to project pages and current file path context.
- Root `index.md` in source path is ignored; nested `index.md` files can still be teaser sources.
- `teaser-ignore` excludes entries.
- Entry contract requires `title` plus one of `summary|thumbnail|author-image`.
- `display=cards|stacked-cards|revolver-caroussel|template` respects documented behavior.
- Image source fallback and precedence (`thumbnail` vs `author-image`) remains deterministic.
- `limit` applies server-side item limiting; no limit keeps all items.
- Grid featured-card behavior and author-card layout remain stable.
- Sorting and filtering (`recent|random|ascending|descending`, `exact`) remain deterministic with clear validation failures.
- Invalid filter lines/fields fail fast with actionable messages.
- Missing template placeholders fail fast.
- `order=random` shuffles client-side while preserving featured/author display contracts.
- Frontmatter changes in teaser source pages update preview in dev without restart.
