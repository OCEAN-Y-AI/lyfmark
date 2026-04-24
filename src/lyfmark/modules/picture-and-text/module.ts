import type { Paragraph } from "mdast"
import { ContentModule } from "../../../remark/content-module"
import type { ContentProcessor, DirectiveContentNode } from "../../../remark/types"
import { choiceAttribute, defineAttributes, inlineStyleAttribute, numberAttribute, textAttribute } from "../../../remark/utils/attributes"
import { createHtmlNode } from "../../../remark/utils/nodes"
import { escapeHtml } from "../../../remark/utils/text"
import { buildStyleAttribute } from "../../../remark/utils/style"
import { resolveBackgroundImageLayerPlan } from "../../../remark/utils/background-image-layers"

type PictureAlignment = "left" | "right" | "top" | "bottom"
type PictureMediaBleed = "none" | "outer"
type PictureDisplay = "default" | "highlight-card"

const pictureAndTextValidators = defineAttributes({
	align: choiceAttribute<PictureAlignment>({ choices: ["left", "right", "top", "bottom"], defaultValue: "left" }),
	display: choiceAttribute<PictureDisplay>({ choices: ["default", "highlight-card"], defaultValue: "default" }),
	"media-bleed": choiceAttribute<PictureMediaBleed>({ choices: ["none", "outer"], defaultValue: "none" }),
	image: textAttribute({ required: true }),
	"image-alt": textAttribute(),
	"image-width": numberAttribute({ required: true, min: 1 }),
	"image-height": numberAttribute({ required: true, min: 1 }),
	overlay: textAttribute({ defaultValue: "none" }),
	style: inlineStyleAttribute(),
})

const OVERLAY_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const isParagraphNode = (node: DirectiveContentNode): node is Paragraph => node.type === "paragraph"

const pictureAndTextProcessor: ContentProcessor = (attributes, context) => {
	const { node, file } = context
	const layerPlan = resolveBackgroundImageLayerPlan(node.children, "picture-and-text", ["auto", "text", "media"], file)
	const contentNodes = layerPlan.contentNodes
	if (contentNodes.length === 0) {
		context.file.fail("Bitte füge Textinhalt für picture-and-text hinzu.", node)
	}
	const align = attributes["align"] as PictureAlignment
	const display = attributes["display"] as PictureDisplay
	const imageUrl = attributes["image"] as string
	const imageAlt = attributes["image-alt"] as string
	const imageWidth = attributes["image-width"] as number
	const imageHeight = attributes["image-height"] as number
	const mediaBleed = attributes["media-bleed"] as PictureMediaBleed
	const overlay = attributes["overlay"] as string
	const nodes: DirectiveContentNode[] = []

	const inlineStyle = attributes["style"] as string
	const styleAttribute = buildStyleAttribute([], inlineStyle)
	const hasOverlay = overlay !== "none"
	if (hasOverlay && !OVERLAY_NAME_PATTERN.test(overlay)) {
		file.fail(
			`Das Attribut "overlay" muss ein slug sein (z. B. "gradient-accent-down") oder "none".`,
			node,
		)
	}
	const hasSingleParagraphContent = contentNodes.length === 1 && isParagraphNode(contentNodes[0])
	const overlayStyleAttribute = hasOverlay ? ` style="--picture-media-overlay: var(--overlay-${overlay});"` : ""
	const mediaClass = hasOverlay ? "picture-and-text__media picture-and-text__media--overlay" : "picture-and-text__media"
	const contentClass = hasSingleParagraphContent
		? "picture-and-text__content picture-and-text__content--single-paragraph"
		: "picture-and-text__content"

	nodes.push(
		createHtmlNode(
			`<section class="picture-and-text picture-and-text--${align} picture-and-text--display-${display} picture-and-text--media-bleed-${mediaBleed}" data-bg-image-layer="auto" aria-label="Bild- und Textbereich"${styleAttribute}>`,
		),
	)
	nodes.push(...layerPlan.renderLayerNodes("auto"))
	nodes.push(createHtmlNode(`<figure class="${mediaClass}" data-bg-image-layer="media"${overlayStyleAttribute}>`))
	nodes.push(...layerPlan.renderLayerNodes("media"))
	nodes.push(
		createHtmlNode(
			`<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(imageAlt)}" width="${imageWidth}" height="${imageHeight}" loading="lazy" decoding="async" />`,
		),
	)
	nodes.push(createHtmlNode(`</figure>`))
	nodes.push(createHtmlNode(`<div class="${contentClass}" data-bg-image-layer="text">`))
	nodes.push(...layerPlan.renderLayerNodes("text"))
	nodes.push(...contentNodes)
	nodes.push(createHtmlNode(`</div></section>`))
	return nodes
}

/**
 * picture-and-text ordnet ein Bild mit fester Breite-Höhe-Kombination links/rechts oder ober-/unterhalb einer flexiblen Textfläche an.
 */
export const pictureAndTextModule = ContentModule(
	"picture-and-text",
	pictureAndTextValidators,
	pictureAndTextProcessor,
)
