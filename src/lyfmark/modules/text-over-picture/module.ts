import { ContentModule } from "../../../remark/content-module"
import type { ContentProcessor, DirectiveContentNode } from "../../../remark/types"
import { choiceAttribute, cssSizeAttribute, defineAttributes, inlineStyleAttribute, textAttribute } from "../../../remark/utils/attributes"
import { resolveBackgroundImageLayerPlan } from "../../../remark/utils/background-image-layers"
import { createHtmlNode } from "../../../remark/utils/nodes"
import { buildStyleAttribute } from "../../../remark/utils/style"
import { escapeHtml } from "../../../remark/utils/text"

type VerticalAlignment = "start" | "center" | "end"
type ContentTone = "light" | "dark"

const textOverPictureValidators = defineAttributes({
	image: textAttribute({ required: true }),
	"image-alt": textAttribute(),
	"align-y": choiceAttribute<VerticalAlignment>({ choices: ["start", "center", "end"], defaultValue: "end" }),
	color: choiceAttribute<ContentTone>({ choices: ["light", "dark"], defaultValue: "light" }),
	width: cssSizeAttribute({ defaultValue: "", numericUnit: "px" }),
	height: cssSizeAttribute({ defaultValue: "", numericUnit: "px" }),
	overlay: textAttribute({ defaultValue: "none" }),
	style: inlineStyleAttribute(),
})

const OVERLAY_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const textOverPictureProcessor: ContentProcessor = (attributes, context) => {
	const { node, file } = context
	const layerPlan = resolveBackgroundImageLayerPlan(node.children, "text-over-picture", ["auto", "media", "text"], file)
	const contentNodes = layerPlan.contentNodes
	if (contentNodes.length === 0) {
		file.fail("Bitte füge Textinhalt für text-over-picture hinzu.", node)
	}

	const imageUrl = attributes["image"] as string
	const imageAlt = attributes["image-alt"] as string
	const alignY = attributes["align-y"] as VerticalAlignment
	const tone = attributes["color"] as ContentTone
	const width = (attributes["width"] as string) ?? ""
	const height = (attributes["height"] as string) ?? ""
	const overlay = attributes["overlay"] as string
	const inlineStyle = attributes["style"] as string

	const hasFixedSize = width.length > 0 && height.length > 0
	const hasOverlay = overlay !== "none"

	if (hasOverlay && !OVERLAY_NAME_PATTERN.test(overlay)) {
		file.fail(`Das Attribut "overlay" muss ein slug sein (z. B. "gradient-accent-down") oder "none".`, node)
	}

	const sectionClasses = [
		"text-over-picture",
		`text-over-picture--tone-${tone}`,
		`text-over-picture--align-${alignY}`,
		hasFixedSize ? "text-over-picture--fixed-size" : "text-over-picture--auto-size",
	]

	const sectionStyles: string[] = []
	if (hasFixedSize) {
		sectionStyles.push(`--text-over-picture-width: ${width}`)
		sectionStyles.push(`--text-over-picture-height: ${height}`)
	}
	if (hasOverlay) {
		sectionStyles.push(`--text-over-picture-overlay: var(--overlay-${overlay})`)
	}
	const sectionStyleAttribute = buildStyleAttribute(sectionStyles, inlineStyle)

	const imageStyles: string[] = []
	if (hasFixedSize) {
		imageStyles.push("width: 100%")
		imageStyles.push("height: 100%")
	} else {
		imageStyles.push(width.length > 0 ? `width: ${width}` : "width: auto")
		imageStyles.push(height.length > 0 ? `height: ${height}` : "height: auto")
	}
	imageStyles.push("object-fit: cover")
	imageStyles.push("object-position: center")
	const imageStyleAttribute = buildStyleAttribute(imageStyles, "")

	const nodes: DirectiveContentNode[] = []
	nodes.push(
		createHtmlNode(
			`<section class="${sectionClasses.join(" ")}" data-bg-image-layer="auto" aria-label="Text über Bild"${sectionStyleAttribute}>`,
		),
	)
	nodes.push(...layerPlan.renderLayerNodes("auto"))
	nodes.push(createHtmlNode(`<figure class="text-over-picture__media" data-bg-image-layer="media">`))
	nodes.push(...layerPlan.renderLayerNodes("media"))
	nodes.push(
		createHtmlNode(
			`<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(imageAlt)}" loading="lazy" decoding="async"${imageStyleAttribute} />`,
		),
	)
	nodes.push(createHtmlNode(`</figure>`))
	nodes.push(createHtmlNode(`<div class="text-over-picture__content" data-bg-image-layer="text">`))
	nodes.push(...layerPlan.renderLayerNodes("text"))
	nodes.push(...contentNodes)
	nodes.push(createHtmlNode(`</div>`))
	nodes.push(createHtmlNode(`</section>`))
	return nodes
}

/**
 * text-over-picture rendert ein einzelnes Bild als Fläche und legt frei kombinierbare Inhalte darüber.
 */
export const textOverPictureModule = ContentModule(
	"text-over-picture",
	textOverPictureValidators,
	textOverPictureProcessor,
)
