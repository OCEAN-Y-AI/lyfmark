const COLOR_FRONTMATTER_KEY_PATTERN = /^color-[a-z0-9-]+$/u
const COLOR_HEX_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/u
const COLOR_NAMED_PATTERN = /^[a-zA-Z][a-zA-Z0-9-]*$/u
const COLOR_FUNCTION_PATTERN = /^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix)\([a-zA-Z0-9\s.,%+\-/*#()]+\)$/iu
const COLOR_VAR_PATTERN = /^var\(--[a-z0-9-]+(?:\s*,\s*[a-zA-Z0-9\s.,%+\-/*#()]+)?\)$/iu
const UNSAFE_COLOR_VALUE_PATTERN = /["'`;{}<>`]/u

interface ThemeOverrideEntry {
	readonly cssVariableName: string
	readonly cssVariableValue: string
}

const describeFrontmatterValueType = (value: unknown): string => {
	if (value === null) {
		return "leer/null"
	}
	if (Array.isArray(value)) {
		return "Liste"
	}
	return typeof value
}

const createNonStringFrontmatterError = (key: string, rawValue: unknown): Error => {
	const valueType = describeFrontmatterValueType(rawValue)
	const hexHint = ` Für Hexwerte mit "#" sind Anführungszeichen Pflicht, z. B. ${key}: "#ff0000".`
	return new Error(`Frontmatter-Feld "${key}" muss ein Textwert sein (aktueller Typ: ${valueType}).${hexHint}`)
}

const isSupportedColorValue = (value: string): boolean => {
	if (UNSAFE_COLOR_VALUE_PATTERN.test(value)) {
		return false
	}
	return (
		COLOR_HEX_PATTERN.test(value) ||
		COLOR_FUNCTION_PATTERN.test(value) ||
		COLOR_VAR_PATTERN.test(value) ||
		COLOR_NAMED_PATTERN.test(value)
	)
}

const resolveThemeOverrideEntry = (key: string, rawValue: unknown): ThemeOverrideEntry => {
	if (typeof rawValue !== "string") {
		throw createNonStringFrontmatterError(key, rawValue)
	}
	const cssVariableValue = rawValue.trim()
	if (cssVariableValue.length === 0) {
		throw new Error(`Frontmatter-Feld "${key}" darf nicht leer sein.`)
	}
	if (!isSupportedColorValue(cssVariableValue)) {
		throw new Error(
			`Frontmatter-Feld "${key}" enthält keinen gültigen Farbwert. ` +
				`Erlaubt sind z. B. #RRGGBB, rgb(...), hsl(...), oklch(...), var(--...).`,
		)
	}
	return {
		cssVariableName: `--${key}`,
		cssVariableValue,
	}
}

/**
 * Extracts page-scoped color overrides from frontmatter keys like "color-highlight".
 * Contract: throws descriptive errors on invalid key/value combinations.
 */
export const resolveColorThemeOverrides = (frontmatter: Record<string, unknown> | undefined): readonly ThemeOverrideEntry[] => {
	if (!frontmatter) {
		return []
	}

	const entries: ThemeOverrideEntry[] = []
	for (const [key, rawValue] of Object.entries(frontmatter)) {
		const normalizedKey = key.trim()
		if (!normalizedKey.toLowerCase().startsWith("color-")) {
			continue
		}
		if (!COLOR_FRONTMATTER_KEY_PATTERN.test(normalizedKey)) {
			throw new Error(
				`Frontmatter-Feld "${key}" ist ungültig. ` +
					`Erlaubt sind nur color-Keys in Kleinbuchstaben, z. B. "color-highlight".`,
			)
		}
		entries.push(resolveThemeOverrideEntry(normalizedKey, rawValue))
	}

	return entries.sort((left, right) => left.cssVariableName.localeCompare(right.cssVariableName))
}

/**
 * Builds a safe inline CSS style string for theme overrides.
 */
export const buildThemeOverrideStyleAttribute = (entries: readonly ThemeOverrideEntry[]): string | undefined => {
	if (entries.length === 0) {
		return undefined
	}
	return entries.map((entry) => `${entry.cssVariableName}: ${entry.cssVariableValue}`).join("; ")
}
