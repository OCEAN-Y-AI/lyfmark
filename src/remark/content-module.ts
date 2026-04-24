import type {
	AttributeValidator,
	AttributeValidators,
	ContentProcessor,
	DirectiveModule,
	DirectiveRendererContext,
	FailOnNode,
	NodeAttributes,
} from "./types"

const validateAttributes = (attributeValidators: AttributeValidators, context: DirectiveRendererContext): NodeAttributes => {
	const nodeFail: FailOnNode = (reason) => context.file.fail(reason, context.node)
	const providedAttributes = context.node.attributes ?? {}
	for (const key of Object.keys(providedAttributes)) {
		if (!(key in attributeValidators)) {
			nodeFail(`Unbekanntes Attribut: ${key}`)
		}
	}
	const validated: NodeAttributes = {}
	for (const [key, validator] of Object.entries(attributeValidators)) {
		const attributeValidator: AttributeValidator = validator
		try {
			validated[key] = attributeValidator(providedAttributes[key])
		} catch (error: unknown) {
			if (typeof error === "string") {
				nodeFail(error)
			}
			throw error
		}
	}
	return validated
}

interface ContentModuleOptions {
	readonly selfClosing?: boolean
}

/**
 * Creates a reusable content module that validates attributes before rendering HTML.
 */
export const ContentModule = (
	name: string,
	attributeValidators: AttributeValidators,
	contentProcessor: ContentProcessor,
	options: ContentModuleOptions = {},
): DirectiveModule => ({
	name,
	render: (context) => contentProcessor(validateAttributes(attributeValidators, context), context),
	selfClosing: options.selfClosing ?? false,
})
