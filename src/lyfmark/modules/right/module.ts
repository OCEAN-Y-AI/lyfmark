import { ContentModule } from "../../../remark/content-module"
import type { ContentProcessor, DirectiveContentNode } from "../../../remark/types"
import { defineAttributes, inlineStyleAttribute, textAttribute } from "../../../remark/utils/attributes"
import { collectAccessiblePlainText } from "../../../remark/utils/content"
import { createHtmlNode } from "../../../remark/utils/nodes"
import { escapeHtml } from "../../../remark/utils/text"
import { buildStyleAttribute } from "../../../remark/utils/style"
import { resolveBackgroundImageLayerPlan } from "../../../remark/utils/background-image-layers"

const rightValidators = defineAttributes({
	label: textAttribute({ required: false, defaultValue: "" }),
	style: inlineStyleAttribute(),
})

const resolveAriaLabel = (attributes: Record<string, unknown>, children: DirectiveContentNode[]): string => {
	const provided = (attributes["label"] as string) ?? ""
	if (provided.length > 0) {
		return provided
	}
	const fallback = collectAccessiblePlainText(children)
	return fallback.length > 0 ? fallback : "Rechts ausgerichteter Abschnitt"
}

const rightProcessor: ContentProcessor = (attributes, context) => {
	const { node, file } = context
	const layerPlan = resolveBackgroundImageLayerPlan(node.children, "right", ["auto", "text"], file)
	const contentNodes = layerPlan.contentNodes
	if (contentNodes.length === 0) {
		context.file.fail("Bitte füge Inhalte für das right Modul hinzu.", node)
	}
	const ariaLabel = resolveAriaLabel(attributes, contentNodes)
	const inlineStyle = attributes["style"] as string
	const styleAttribute = buildStyleAttribute([], inlineStyle)
	return [
		createHtmlNode(`<section class="right-block" data-bg-image-layer="auto" aria-label="${escapeHtml(ariaLabel)}"${styleAttribute}>`),
		...layerPlan.renderLayerNodes("auto"),
		createHtmlNode(`<div class="right-block__inner" data-bg-image-layer="text">`),
		...layerPlan.renderLayerNodes("text"),
		...contentNodes,
		createHtmlNode(`</div>`),
		createHtmlNode(`</section>`),
	]
}

/**
 * right richtet beliebige Inhalte an der rechten Kante des verfügbaren Containers aus.
 */
export const rightModule = ContentModule("right", rightValidators, rightProcessor)
