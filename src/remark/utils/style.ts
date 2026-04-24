import { escapeHtml } from "./text"

/**
 * buildStyleAttribute rendert ein sicheres HTML-`style`-Attribut aus CSS-Deklarationen und optionalen Overrides.
 */
export const buildStyleAttribute = (declarations: readonly string[], inlineStyle: string): string => {
	const normalize = (value: string): string => {
		return value.trim().replace(/;+$/g, "")
	}

	const segments = declarations
		.map((declaration) => normalize(declaration))
		.filter((declaration) => declaration.length > 0)

	const custom = normalize(inlineStyle)
	if (custom.length > 0) {
		segments.push(custom)
	}

	if (segments.length === 0) {
		return ""
	}

	return ` style="${segments.map((segment) => escapeHtml(segment)).join("; ")};"`
}
