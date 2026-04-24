import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { load } from "js-yaml"

export type MenuBrandConfig =
	| {
			readonly type: "text"
			readonly text: string
			readonly html?: string
			readonly href: string
	  }
	| {
			readonly type: "image"
			readonly src: string
			readonly alt: string
			readonly href: string
	  }

export interface SiteConfig {
	readonly brandName: string
	readonly defaultTitle: string
	readonly defaultDescription: string
	readonly defaultLocale: string
	readonly supportedLocales: readonly string[]
	readonly defaultTemplate: string
	readonly menu: {
		readonly panelTone: "light" | "dark"
		readonly brand: MenuBrandConfig
	}
}

export type SiteLocale = SiteConfig["supportedLocales"][number]

const SITE_CONFIG_FILE_NAME = "site.config.yml"
const SITE_CONFIG_FILE_PATH = resolve(process.cwd(), SITE_CONFIG_FILE_NAME)

const ROOT_KEYS = [
	"brandName",
	"defaultTitle",
	"defaultDescription",
	"defaultLocale",
	"supportedLocales",
	"defaultTemplate",
	"menu",
] as const

const MENU_KEYS = ["panelTone", "brand"] as const
const MENU_TEXT_BRAND_KEYS = ["type", "text", "html", "href"] as const
const MENU_IMAGE_BRAND_KEYS = ["type", "src", "alt", "href"] as const

const formatConfigError = (message: string): Error =>
	new Error(`[LyfMark][${SITE_CONFIG_FILE_NAME}] ${message}`)

const throwConfigError = (message: string): never => {
	throw formatConfigError(message)
}

const asRecord = (value: unknown, fieldPath: string): Record<string, unknown> => {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throwConfigError(`"${fieldPath}" must be an object.`)
	}
	return value as Record<string, unknown>
}

const assertAllowedKeys = (
	record: Record<string, unknown>,
	allowedKeys: readonly string[],
	fieldPath: string,
): void => {
	for (const key of Object.keys(record)) {
		if (!allowedKeys.includes(key)) {
			throwConfigError(`Unknown key "${fieldPath}.${key}". Allowed keys: ${allowedKeys.join(", ")}.`)
		}
	}
}

const toRequiredString = (value: unknown, fieldPath: string): string => {
	if (typeof value !== "string") {
		throwConfigError(`"${fieldPath}" must be a string.`)
	}
	const normalized = (value as string).trim()
	if (normalized.length === 0) {
		throwConfigError(`"${fieldPath}" must not be empty.`)
	}
	return normalized
}

const readRequiredString = (record: Record<string, unknown>, key: string, fieldPath: string): string =>
	toRequiredString(record[key], fieldPath)

const readOptionalString = (record: Record<string, unknown>, key: string, fieldPath: string): string | undefined => {
	const value = record[key]
	if (value === undefined) {
		return undefined
	}
	return toRequiredString(value, fieldPath)
}

const readChoice = <T extends string>(
	record: Record<string, unknown>,
	key: string,
	fieldPath: string,
	allowedValues: readonly T[],
): T => {
	const value = readRequiredString(record, key, fieldPath)
	const typedValue = value as T
	if (!allowedValues.includes(typedValue)) {
		throwConfigError(`"${fieldPath}" must be one of: ${allowedValues.join(", ")}.`)
	}
	return typedValue
}

const readRequiredStringArray = (record: Record<string, unknown>, key: string, fieldPath: string): readonly string[] => {
	const value = record[key]
	if (!Array.isArray(value)) {
		throwConfigError(`"${fieldPath}" must be an array of strings.`)
	}
	const entries = value as unknown[]
	if (entries.length === 0) {
		throwConfigError(`"${fieldPath}" must contain at least one locale.`)
	}

	const locales = entries.map((entry, index) => toRequiredString(entry, `${fieldPath}[${index}]`))

	const uniqueLocales = new Set(locales)
	if (uniqueLocales.size !== locales.length) {
		throwConfigError(`"${fieldPath}" must not contain duplicate locales.`)
	}

	return locales
}

const parseBrandConfig = (brandValue: unknown): MenuBrandConfig => {
	const brandRecord = asRecord(brandValue, "menu.brand")
	const brandType = readChoice(brandRecord, "type", "menu.brand.type", ["text", "image"] as const)

	if (brandType === "text") {
		assertAllowedKeys(brandRecord, MENU_TEXT_BRAND_KEYS, "menu.brand")
		const html = readOptionalString(brandRecord, "html", "menu.brand.html")

		return {
			type: "text",
			text: readRequiredString(brandRecord, "text", "menu.brand.text"),
			href: readRequiredString(brandRecord, "href", "menu.brand.href"),
			...(html ? { html } : {}),
		}
	}

	assertAllowedKeys(brandRecord, MENU_IMAGE_BRAND_KEYS, "menu.brand")
	return {
		type: "image",
		src: readRequiredString(brandRecord, "src", "menu.brand.src"),
		alt: readRequiredString(brandRecord, "alt", "menu.brand.alt"),
		href: readRequiredString(brandRecord, "href", "menu.brand.href"),
	}
}

const parseSiteConfig = (document: unknown): SiteConfig => {
	const rootRecord = asRecord(document, "root")
	assertAllowedKeys(rootRecord, ROOT_KEYS, "root")

	const supportedLocales = readRequiredStringArray(rootRecord, "supportedLocales", "supportedLocales")
	const defaultLocale = readRequiredString(rootRecord, "defaultLocale", "defaultLocale")
	if (!supportedLocales.includes(defaultLocale)) {
		throwConfigError(`"defaultLocale" must exist in "supportedLocales".`)
	}

	const menuRecord = asRecord(rootRecord.menu, "menu")
	assertAllowedKeys(menuRecord, MENU_KEYS, "menu")

	return {
		brandName: readRequiredString(rootRecord, "brandName", "brandName"),
		defaultTitle: readRequiredString(rootRecord, "defaultTitle", "defaultTitle"),
		defaultDescription: readRequiredString(rootRecord, "defaultDescription", "defaultDescription"),
		defaultLocale,
		supportedLocales,
		defaultTemplate: readRequiredString(rootRecord, "defaultTemplate", "defaultTemplate"),
		menu: {
			panelTone: readChoice(menuRecord, "panelTone", "menu.panelTone", ["light", "dark"] as const),
			brand: parseBrandConfig(menuRecord.brand),
		},
	}
}

/**
 * Loads and validates the root-level customer configuration.
 * The result is fail-fast by contract and never silently corrected.
 */
export const loadSiteConfig = (): SiteConfig => {
	if (!existsSync(SITE_CONFIG_FILE_PATH)) {
		throwConfigError(
			`Missing "${SITE_CONFIG_FILE_NAME}" in project root. Add the file to configure title, description and defaults.`,
		)
	}

	let content = ""
	try {
		content = readFileSync(SITE_CONFIG_FILE_PATH, "utf8")
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error)
		throwConfigError(`Unable to read "${SITE_CONFIG_FILE_NAME}": ${detail}`)
	}

	if (content.trim().length === 0) {
		throwConfigError(`"${SITE_CONFIG_FILE_NAME}" is empty. Provide the required configuration keys.`)
	}

	let parsedDocument: unknown
	try {
		parsedDocument = load(content)
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error)
		throwConfigError(`Invalid YAML syntax: ${detail}`)
	}

	return parseSiteConfig(parsedDocument)
}

/**
 * Shared singleton used by layouts and components during build and dev.
 */
export const siteConfig = loadSiteConfig()
