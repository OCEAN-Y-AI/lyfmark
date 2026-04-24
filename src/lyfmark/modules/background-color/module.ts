import { ContentModule } from "../../../remark/content-module"
import type { ContentProcessor } from "../../../remark/types"
import { choiceAttribute, cssColorAttribute, defineAttributes, inlineStyleAttribute } from "../../../remark/utils/attributes"
import { collectAccessiblePlainText } from "../../../remark/utils/content"
import { createHtmlNode } from "../../../remark/utils/nodes"
import { escapeHtml } from "../../../remark/utils/text"
import { buildStyleAttribute } from "../../../remark/utils/style"
import { resolveBackgroundImageLayerPlan } from "../../../remark/utils/background-image-layers"

type BackgroundDirection = "right" | "left" | "top" | "bottom"
type TextTone = "dark" | "light"

const DIRECTION_VALUES: Record<BackgroundDirection, string> = {
	right: "to right",
	left: "to left",
	top: "to top",
	bottom: "to bottom",
}

const backgroundColorValidators = defineAttributes({
	fill: cssColorAttribute({ required: true }),
	accent: cssColorAttribute(),
	direction: choiceAttribute<BackgroundDirection>({
		choices: ["right", "left", "top", "bottom"],
		defaultValue: "right",
	}),
	color: choiceAttribute<TextTone>({
		choices: ["dark", "light"],
		defaultValue: "dark",
	}),
	style: inlineStyleAttribute(),
})

const buildBackgroundColorStyles = (
	primary: string,
	secondary: string | null,
	direction: BackgroundDirection,
	inlineStyle: string,
): string => {
	const declarations = [`--background-color-primary: ${primary}`]
	if (secondary && secondary.length > 0) {
		declarations.push(`--background-color-direction: ${DIRECTION_VALUES[direction]}`)
		declarations.push(`--background-color-secondary: ${secondary}`)
	}
	return buildStyleAttribute(declarations, inlineStyle)
}

const backgroundColorProcessor: ContentProcessor = (attributes, context) => {
	const { node, file } = context
	const layerPlan = resolveBackgroundImageLayerPlan(node.children, "background-color", ["auto"], file)
	const contentNodes = layerPlan.contentNodes
	if (contentNodes.length === 0) {
		file.fail("Bitte füge Inhalte für das background-color Modul hinzu.", node)
	}
	const primaryColor = attributes["fill"] as string
	const secondaryColor = (attributes["accent"] as string) ?? ""
	const direction = attributes["direction"] as BackgroundDirection
	const variant = secondaryColor.length > 0 ? "gradient" : "solid"
	const inlineStyle = attributes["style"] as string
	const styleAttribute = buildBackgroundColorStyles(primaryColor, secondaryColor.length > 0 ? secondaryColor : null, direction, inlineStyle)
	const tone = attributes["color"] as TextTone
	const toneClass = tone === "light" ? " background-color-module--tone-light" : " background-color-module--tone-dark"
	const ariaLabel = collectAccessiblePlainText(contentNodes)
	const label = ariaLabel.length > 0 ? ariaLabel : "Hervorgehobener Bereich"
	return [
		createHtmlNode(
			`<section class="background-color-module background-color-module--${variant}${toneClass}" data-bg-image-layer="auto" aria-label="${escapeHtml(label)}"${styleAttribute}>`,
		),
		...layerPlan.renderLayerNodes("auto"),
		createHtmlNode(`<div class="background-color-module__inner">`),
		...contentNodes,
		createHtmlNode(`</div>`),
		createHtmlNode(`</section>`),
	]
}

/**
 * background-color hebt Inhaltsbereiche mit vollflächigen Farben innerhalb des sichtbaren Abschnitts hervor.
 */
export const backgroundColorModule = ContentModule("background-color", backgroundColorValidators, backgroundColorProcessor)
