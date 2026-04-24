import { ContentModule } from "../../../remark/content-module"
import type { ContentProcessor, DirectiveContentNode } from "../../../remark/types"
import { cssSizeAttribute, defineAttributes, inlineStyleAttribute } from "../../../remark/utils/attributes"
import { createHtmlNode } from "../../../remark/utils/nodes"
import { buildStyleAttribute } from "../../../remark/utils/style"

const spaceValidators = defineAttributes({
	size: cssSizeAttribute({
		defaultValue: "4rem",
	}),
	style: inlineStyleAttribute(),
})

const hasVisibleContent = (children: DirectiveContentNode[]): boolean => {
	return children.some((child) => {
		if (child.type === "text") {
			return child.value.trim().length > 0
		}
		return true
	})
}

const spaceProcessor: ContentProcessor = (attributes, context) => {
	const { node, file } = context
	if (hasVisibleContent(node.children)) {
		file.fail("Das Modul \"space\" darf keinen eigenen Inhalt enthalten.", node)
	}
	const size = attributes["size"] as string
	const inlineStyle = attributes["style"] as string
	const styleAttribute = buildStyleAttribute([`--space-module-size: ${size}`], inlineStyle)
	const html = `<div class="space-module" aria-hidden="true" role="presentation" ${styleAttribute}></div>`
	return [createHtmlNode(html)]
}

/**
 * space adds configurable vertical spacing to markdown content.
 * Contract: the `direction` attribute is not supported.
 */
export const spaceModule = ContentModule("space", spaceValidators, spaceProcessor, { selfClosing: true })
