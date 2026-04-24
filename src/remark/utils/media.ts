import type { NodeAttributes } from "../types"
import { textAttribute, type AttributeFactory, urlAttribute } from "./attributes"

interface MediaGroupOptions {
	readonly required?: boolean
}

interface AttributeGroup {
	readonly [attributeName: string]: AttributeFactory<unknown>
}

export const mediaAttributeGroup = (prefix: string, options: MediaGroupOptions = {}): AttributeGroup => {
	const required = options.required ?? false
	return {
		[`${prefix}-src`]: urlAttribute({ required }),
		[`${prefix}-alt`]: textAttribute({ required, allowEmpty: false }),
	}
}

export interface MediaDefinition {
	readonly src: string
	readonly alt: string
}

export const resolveMedia = (attributes: NodeAttributes, prefix: string): MediaDefinition | null => {
	const src = attributes[`${prefix}-src`]
	const alt = attributes[`${prefix}-alt`]
	if (typeof src !== "string" || src.length === 0) {
		return null
	}
	return {
		src,
		alt: typeof alt === "string" && alt.length > 0 ? alt : "",
	}
}
