import { ContentModule } from "../../../remark/content-module"
import type { ContentProcessor, DirectiveContentNode } from "../../../remark/types"
import { choiceAttribute, cssColorAttribute, cssSizeAttribute, defineAttributes, inlineStyleAttribute, textAttribute } from "../../../remark/utils/attributes"
import { collectAccessiblePlainText } from "../../../remark/utils/content"
import { createHtmlNode } from "../../../remark/utils/nodes"
import { escapeHtml } from "../../../remark/utils/text"
import { buildStyleAttribute } from "../../../remark/utils/style"
import { resolveBackgroundImageLayerPlan } from "../../../remark/utils/background-image-layers"

type HighlightTone = "dark" | "light" | "auto"
type BackgroundDirection = "right" | "left" | "top" | "bottom"

const DIRECTION_VALUES: Record<BackgroundDirection, string> = {
	right: "to right",
	left: "to left",
	top: "to top",
	bottom: "to bottom",
}

const highlightCardValidators = defineAttributes({
	label: textAttribute({ required: false, defaultValue: "" }),
	color: choiceAttribute<HighlightTone>({
		choices: ["dark", "light", "auto"],
		defaultValue: "auto",
	}),
	fill: cssColorAttribute(),
	accent: cssColorAttribute(),
	width: cssSizeAttribute(),
	"min-width": cssSizeAttribute(),
	"max-width": cssSizeAttribute(),
	style: inlineStyleAttribute(),
	direction: choiceAttribute<BackgroundDirection>({
		choices: ["right", "left", "top", "bottom"],
		defaultValue: "right",
	}),
})

const resolveAriaLabel = (attributes: Record<string, unknown>, children: DirectiveContentNode[]): string => {
	const provided = (attributes["label"] as string) ?? ""
	if (provided.length > 0) {
		return provided
	}
	const fallback = collectAccessiblePlainText(children)
	if (fallback.length > 0) {
		return fallback
	}
	return "Hervorgehobener Abschnitt"
}

const buildHighlightCardStyles = (
	primary: string | null,
	secondary: string | null,
	direction: BackgroundDirection,
	width: string,
	minWidth: string,
	maxWidth: string,
	inlineStyle: string,
): string => {
	const declarations: string[] = []

	if (primary && primary.length > 0) {
		const directionValue = DIRECTION_VALUES[direction]
		if (secondary && secondary.length > 0) {
			declarations.push(
				`--highlight-card-background: linear-gradient(${directionValue}, ${primary}, ${secondary})`,
			)
		} else {
			declarations.push(`--highlight-card-background: ${primary}`)
		}
	}

	const hasWidth = width.length > 0
	const hasMinWidth = minWidth.length > 0
	const hasMaxWidth = maxWidth.length > 0

	if (hasWidth && hasMinWidth) {
		declarations.push(`min-width: ${minWidth}`)
		declarations.push(`max-width: ${width}`)
		return buildStyleAttribute(declarations, inlineStyle)
	}

	if (hasWidth && hasMaxWidth) {
		declarations.push(`min-width: ${width}`)
		declarations.push(`max-width: ${maxWidth}`)
		return buildStyleAttribute(declarations, inlineStyle)
	}

	if (hasWidth) {
		declarations.push(`width: ${width}`)
	}

	if (hasMinWidth) {
		declarations.push(`min-width: ${minWidth}`)
	}

	if (hasMaxWidth) {
		declarations.push(`max-width: ${maxWidth}`)
	}

	return buildStyleAttribute(declarations, inlineStyle)
}

const highlightCardProcessor: ContentProcessor = (attributes, context) => {
	const { node, file } = context
	const layerPlan = resolveBackgroundImageLayerPlan(node.children, "highlight-card", ["auto", "text"], file)
	const contentNodes = layerPlan.contentNodes
	if (contentNodes.length === 0) {
		file.fail("Bitte füge Inhalt für das highlight-card Modul hinzu.", node)
	}
	const ariaLabel = resolveAriaLabel(attributes, contentNodes)
	const nodes: DirectiveContentNode[] = []

	const tone = attributes["color"] as HighlightTone
	const toneClass = `highlight-card--tone-${tone}`
	const fillColor = (attributes["fill"] as string) ?? ""
	const accentColor = (attributes["accent"] as string) ?? ""
	const direction = attributes["direction"] as BackgroundDirection
	const width = ((attributes["width"] as string) ?? "").trim()
	const minWidth = ((attributes["min-width"] as string) ?? "").trim()
	const maxWidth = ((attributes["max-width"] as string) ?? "").trim()
	if (width.length > 0 && minWidth.length > 0 && maxWidth.length > 0) {
		file.fail(
			`Die Kombination aus "width", "min-width" und "max-width" ist nicht erlaubt. ` +
				`Nutze entweder nur "width" oder "width" zusammen mit genau einem der beiden Attribute "min-width"/"max-width".`,
			node,
		)
	}
	const inlineStyle = attributes["style"] as string
	const styleAttribute = buildHighlightCardStyles(fillColor, accentColor, direction, width, minWidth, maxWidth, inlineStyle)
	nodes.push(createHtmlNode(`<section class="highlight-card ${toneClass}" data-bg-image-layer="auto" aria-label="${escapeHtml(ariaLabel)}"${styleAttribute}>`))
	nodes.push(...layerPlan.renderLayerNodes("auto"))
	nodes.push(createHtmlNode(`<div class="highlight-card__inner" data-bg-image-layer="text">`))
	nodes.push(...layerPlan.renderLayerNodes("text"))
	nodes.push(...contentNodes)
	nodes.push(createHtmlNode(`</div></section>`))
	return nodes
}

/**
 * highlight-card erzeugt einen kontrastreichen Kartenrahmen für beliebige Inhalte.
 */
export const highlightCardModule = ContentModule("highlight-card", highlightCardValidators, highlightCardProcessor)
