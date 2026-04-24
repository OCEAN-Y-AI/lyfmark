import { ContentModule } from "../../../remark/content-module"
import type { ContentProcessor } from "../../../remark/types"
import { choiceAttribute, defineAttributes, inlineStyleAttribute } from "../../../remark/utils/attributes"
import { createHtmlNode } from "../../../remark/utils/nodes"
import { buildStyleAttribute } from "../../../remark/utils/style"

type HorizontalAlign = "left" | "center" | "right"
type VerticalAlign = "top" | "center" | "bottom"
type TextAlign = "left" | "center" | "right"
type FillMode = "none" | "width" | "height" | "both"

const alignValidators = defineAttributes({
	x: choiceAttribute<HorizontalAlign>({
		choices: ["left", "center", "right"],
		defaultValue: "left",
	}),
	y: choiceAttribute<VerticalAlign>({
		choices: ["top", "center", "bottom"],
		defaultValue: "top",
	}),
	text: choiceAttribute<TextAlign>({
		choices: ["left", "center", "right"],
		defaultValue: "left",
	}),
	fill: choiceAttribute<FillMode>({
		choices: ["none", "width", "height", "both"],
		defaultValue: "both",
	}),
	style: inlineStyleAttribute(),
})

const alignProcessor: ContentProcessor = (attributes, context) => {
	const { node, file } = context
	if (node.children.length === 0) {
		file.fail("Bitte fuege Inhalte fuer das align Modul hinzu.", node)
	}

	const x = attributes["x"] as HorizontalAlign
	const y = attributes["y"] as VerticalAlign
	const text = attributes["text"] as TextAlign
	const fill = attributes["fill"] as FillMode
	const inlineStyle = attributes["style"] as string
	const styleAttribute = buildStyleAttribute([], inlineStyle)
	const className = `align-module align-module--x-${x} align-module--y-${y} align-module--text-${text} align-module--fill-${fill}`

	return [
		createHtmlNode(`<div class="${className}"${styleAttribute}>`),
		createHtmlNode(`<div class="align-module__inner">`),
		...node.children,
		createHtmlNode(`</div>`),
		createHtmlNode(`</div>`),
	]
}

/**
 * align positioniert Inhalte innerhalb der Grenzen des direkt umgebenden Strukturelements.
 */
export const alignModule = ContentModule("align", alignValidators, alignProcessor)
