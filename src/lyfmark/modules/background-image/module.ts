import { ContentModule } from "../../../remark/content-module"
import type { ContentProcessor, DirectiveContentNode } from "../../../remark/types"
import { collectAccessiblePlainText } from "../../../remark/utils/content"
import { createHtmlNode } from "../../../remark/utils/nodes"
import { escapeHtml } from "../../../remark/utils/text"
import {
	backgroundImageLayerValidators,
	renderBackgroundImageLayerNodes,
	resolveBackgroundImageLayerPlan,
	resolveStandaloneBackgroundImageConstraint,
	validateBackgroundImageLayerAttributes,
} from "../../../remark/utils/background-image-layers"

const backgroundImageValidators = backgroundImageLayerValidators

const backgroundImageProcessor: ContentProcessor = (attributes, context) => {
	const { node, file } = context
	const layerPlan = resolveBackgroundImageLayerPlan(node.children, "background-image", ["auto", "text"], file)
	const contentNodes = layerPlan.contentNodes
	if (contentNodes.length === 0) {
		file.fail("Bitte füge Inhalte für das background-image Modul hinzu.", node)
	}
	const labelText = collectAccessiblePlainText(contentNodes)
	const ariaLabel = labelText.length > 0 ? labelText : "Dekorierter Abschnitt"
	const layerAttributes = validateBackgroundImageLayerAttributes(attributes, file, node)
	const ownTargetLayer = resolveStandaloneBackgroundImageConstraint(
		layerAttributes.constraint,
		"background-image",
		["auto", "text"],
		file,
		node,
	)
	const ownLayerNodes = renderBackgroundImageLayerNodes(layerAttributes, layerAttributes.constraint)
	const autoLayerNodes = ownTargetLayer === "auto" ? ownLayerNodes : []
	const textLayerNodes = ownTargetLayer === "text" ? ownLayerNodes : []

	const nodes: DirectiveContentNode[] = []
	nodes.push(createHtmlNode(`<section class="background-image-module" data-bg-image-layer="auto" aria-label="${escapeHtml(ariaLabel)}">`))
	nodes.push(...autoLayerNodes)
	nodes.push(...layerPlan.renderLayerNodes("auto"))
	nodes.push(createHtmlNode(`<div class="background-image-module__inner" data-bg-image-layer="text">`))
	nodes.push(...textLayerNodes)
	nodes.push(...layerPlan.renderLayerNodes("text"))
	nodes.push(...contentNodes)
	nodes.push(createHtmlNode(`</div>`))
	nodes.push(createHtmlNode(`</section>`))
	return nodes
}

/**
 * background-image platziert frei positionierbare Hintergrundgrafiken hinter beliebigen Inhalten.
 */
export const backgroundImageModule = ContentModule("background-image", backgroundImageValidators, backgroundImageProcessor)
