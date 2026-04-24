import type { AttributeValidator, AttributeValidators } from "../types"

export interface AttributeFactory<TValue> {
	readonly build: (attributeName: string) => AttributeValidator<TValue>
}

type AttributeSchema = Record<string, AttributeFactory<unknown>>

const asText = (value: unknown, attributeName: string): string => {
	if (typeof value !== "string") {
		throw `Das Attribut "${attributeName}" muss als Text angegeben werden.`
	}
	return value
}

const ensureTextValue = (value: unknown, attributeName: string, trim: boolean): string => {
	const textValue = asText(value, attributeName)
	return trim ? textValue.trim() : textValue
}

export const defineAttributes = (schema: AttributeSchema): AttributeValidators => {
	const validators: AttributeValidators = {}
	for (const [key, factory] of Object.entries(schema)) {
		validators[key] = factory.build(key)
	}
	return validators
}

interface TextAttributeOptions {
	readonly required?: boolean
	readonly defaultValue?: string
	readonly trim?: boolean
	readonly allowEmpty?: boolean
}

export const textAttribute = (options: TextAttributeOptions = {}): AttributeFactory<string> => ({
	build: (attributeName) => (value) => {
		if (value === undefined || value === null) {
			if (options.required) {
				throw `Bitte gib für "${attributeName}" einen Wert an.`
			}
			return options.defaultValue ?? ""
		}

		const textValue = ensureTextValue(value, attributeName, options.trim ?? true)
		if (!options.allowEmpty && textValue.length === 0) {
			if (options.required) {
				throw `Bitte gib für "${attributeName}" einen Wert an.`
			}
			return options.defaultValue ?? ""
		}
		return textValue
	},
})

interface ChoiceAttributeOptions<TValue extends string> {
	readonly choices: readonly TValue[]
	readonly defaultValue: TValue
}

export const choiceAttribute = <TValue extends string>(options: ChoiceAttributeOptions<TValue>): AttributeFactory<TValue> => ({
	build: (attributeName) => (value) => {
		if (value === undefined) {
			return options.defaultValue
		}
		const normalized = ensureTextValue(value, attributeName, true)
		if (!options.choices.includes(normalized as TValue)) {
			throw `Das Attribut "${attributeName}" erlaubt nur folgende Werte: ${options.choices.join(", ")}.`
		}
		return normalized as TValue
	},
})

interface UrlAttributeOptions {
	readonly required?: boolean
	readonly defaultValue?: string
}

export const urlAttribute = (options: UrlAttributeOptions = {}): AttributeFactory<string> => ({
	build: (attributeName) => (value) => {
		if (value === undefined || value === null) {
			if (options.required) {
				throw `Bitte gib für "${attributeName}" eine URL an.`
			}
			return options.defaultValue ?? ""
		}
		const urlValue = ensureTextValue(value, attributeName, true)
		const lower = urlValue.toLowerCase()
		if (urlValue.startsWith("/") || urlValue.startsWith("./") || urlValue.startsWith("../") || urlValue.startsWith("#")) {
			return urlValue
		}
		if (/^https?:\/\//.test(lower) || lower.startsWith("mailto:") || lower.startsWith("tel:")) {
			return urlValue
		}
		throw `"${attributeName}" muss mit "http" beginnen, "mailto:"/"tel:" nutzen oder eine interne URL ("/", "./", "../", "#") sein.`
	},
})

interface BooleanAttributeOptions {
	readonly defaultValue?: boolean
}

export const booleanAttribute = (options: BooleanAttributeOptions = {}): AttributeFactory<boolean> => ({
	build: (attributeName) => (value) => {
		if (value === undefined || value === null) {
			return options.defaultValue ?? false
		}
		if (typeof value === "boolean") {
			return value
		}
		if (value === "true" || value === "1") {
			return true
		}
		if (value === "false" || value === "0") {
			return false
		}
		throw `"${attributeName}" muss als "true" oder "false" angegeben werden.`
	},
})

interface NumberAttributeOptions {
	readonly required?: boolean
	readonly defaultValue?: number
	readonly min?: number
	readonly max?: number
	readonly integer?: boolean
}

export const numberAttribute = (options: NumberAttributeOptions = {}): AttributeFactory<number> => ({
	build: (attributeName) => (value) => {
		if (value === undefined || value === null) {
			if (options.required) {
				throw `Bitte gib für "${attributeName}" einen Wert an.`
			}
			return options.defaultValue ?? 0
		}
		const textValue = ensureTextValue(value, attributeName, true)
		const numericValue = Number.parseFloat(textValue)
		if (Number.isNaN(numericValue)) {
			throw `"${attributeName}" muss eine Zahl sein.`
		}
		if ((options.integer ?? true) && !Number.isInteger(numericValue)) {
			throw `"${attributeName}" muss eine ganze Zahl sein.`
		}
		if (typeof options.min === "number" && numericValue < options.min) {
			throw `"${attributeName}" muss mindestens ${options.min} sein.`
		}
		if (typeof options.max === "number" && numericValue > options.max) {
			throw `"${attributeName}" darf höchstens ${options.max} sein.`
		}
		return numericValue
	},
})

interface CssSizeAttributeOptions {
	readonly required?: boolean
	readonly defaultValue?: string
	readonly numericUnit?: "rem" | "px"
}

const CSS_NUMBER_VALUE = /^-?\d+(?:\.\d+)?$/
const CSS_FORBIDDEN_CHARACTERS = /[;{}]/

const normalizeCssSizeValue = (value: string, numericUnit: "rem" | "px"): string => {
	if (CSS_NUMBER_VALUE.test(value)) {
		return `${value}${numericUnit}`
	}
	return value
}

export const cssSizeAttribute = (options: CssSizeAttributeOptions = {}): AttributeFactory<string> => ({
	build: (attributeName) => (value) => {
		if (value === undefined || value === null) {
			if (options.required) {
				throw `Bitte gib für "${attributeName}" einen Wert an.`
			}
			return options.defaultValue ?? ""
		}
		const textValue = ensureTextValue(value, attributeName, true)
		if (textValue.length === 0) {
			if (options.required) {
				throw `Bitte gib für "${attributeName}" einen Wert an.`
			}
			return options.defaultValue ?? ""
		}
		if (CSS_FORBIDDEN_CHARACTERS.test(textValue)) {
			throw `"${attributeName}" darf keine Sonderzeichen wie ; oder {} enthalten.`
		}
		return normalizeCssSizeValue(textValue, options.numericUnit ?? "rem")
	},
})

interface CssColorAttributeOptions {
	readonly required?: boolean
	readonly defaultValue?: string
}

const CSS_COLOR_FORBIDDEN_CHARACTERS = /[;{}]/

export const cssColorAttribute = (options: CssColorAttributeOptions = {}): AttributeFactory<string> => ({
	build: (attributeName) => (value) => {
		if (value === undefined || value === null) {
			if (options.required) {
				throw `Bitte gib für "${attributeName}" einen Farbwert an.`
			}
			return options.defaultValue ?? ""
		}
		const textValue = ensureTextValue(value, attributeName, true)
		if (textValue.length === 0) {
			if (options.required) {
				throw `Bitte gib für "${attributeName}" einen Farbwert an.`
			}
			return options.defaultValue ?? ""
		}
		if (CSS_COLOR_FORBIDDEN_CHARACTERS.test(textValue)) {
			throw `"${attributeName}" darf keine Sonderzeichen wie ; oder {} enthalten.`
		}
		return textValue
	},
})

interface InlineStyleAttributeOptions {
	readonly required?: boolean
	readonly defaultValue?: string
}

const INLINE_STYLE_FORBIDDEN_CHARACTERS = /[{}]/

export const inlineStyleAttribute = (options: InlineStyleAttributeOptions = {}): AttributeFactory<string> => ({
	build: (attributeName) => (value) => {
		if (value === undefined || value === null) {
			if (options.required) {
				throw `Bitte gib für "${attributeName}" einen Wert an.`
			}
			return options.defaultValue ?? ""
		}

		const textValue = ensureTextValue(value, attributeName, false).trim()
		if (textValue.length === 0) {
			if (options.required) {
				throw `Bitte gib für "${attributeName}" einen Wert an.`
			}
			return options.defaultValue ?? ""
		}

		if (INLINE_STYLE_FORBIDDEN_CHARACTERS.test(textValue)) {
			throw `"${attributeName}" darf keine geschweiften Klammern enthalten. Verwende nur eine Liste von CSS-Deklarationen, z. B. "max-width: 60rem; margin: 0 auto".`
		}

		if (!textValue.includes(":")) {
			throw `"${attributeName}" muss eine Liste von CSS-Deklarationen sein, z. B. "max-width: 60rem;".`
		}

		return textValue
	},
})


export const requiredTextAttribute = (attributeName: string): AttributeValidator<string> => {
	return textAttribute({ required: true }).build(attributeName)
}
