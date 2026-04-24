import type { NodeAttributes } from "../types"
import { choiceAttribute, textAttribute, type AttributeFactory, urlAttribute } from "./attributes"
import { escapeHtml } from "./text"

export type CtaVariant = "primary" | "secondary" | "ghost"

interface CtaAttributesOptions {
	readonly required?: boolean
	readonly defaultVariant?: CtaVariant
}

interface AttributeGroup {
	readonly [attributeName: string]: AttributeFactory<unknown>
}

export const ctaAttributeGroup = (prefix: string, options: CtaAttributesOptions = {}): AttributeGroup => {
	const required = options.required ?? true
	return {
		[`${prefix}-label`]: textAttribute({ required, allowEmpty: false }),
		[`${prefix}-url`]: urlAttribute({ required }),
		[`${prefix}-variant`]: choiceAttribute<CtaVariant>({
			choices: ["primary", "secondary", "ghost"],
			defaultValue: options.defaultVariant ?? "primary",
		}),
	}
}

export interface CtaDefinition {
	readonly label: string
	readonly url: string
	readonly variant: CtaVariant
}

export const resolveCta = (attributes: NodeAttributes, prefix: string): CtaDefinition | null => {
	const label = attributes[`${prefix}-label`]
	const url = attributes[`${prefix}-url`]
	const variant = attributes[`${prefix}-variant`] as CtaVariant | undefined
	if (typeof label !== "string" || label.length === 0) {
		return null
	}
	if (typeof url !== "string" || url.length === 0) {
		return null
	}
	return {
		label,
		url,
		variant: variant ?? "primary",
	}
}

export const formatCtaButtons = (ctas: readonly CtaDefinition[], baseClass: string): string => {
	return ctas
		.map((cta) => {
			return `<a class="${baseClass} ${baseClass}--${cta.variant}" href="${escapeHtml(cta.url)}">${escapeHtml(cta.label)}</a>`
		})
		.join("")
}
