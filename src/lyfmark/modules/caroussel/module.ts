import type { Paragraph } from "mdast"
import type { VFile } from "vfile"
import { ContentModule } from "../../../remark/content-module"
import type { ContainerDirectiveNode, ContentProcessor, DirectiveContentNode } from "../../../remark/types"
import { choiceAttribute, defineAttributes, inlineStyleAttribute, textAttribute } from "../../../remark/utils/attributes"
import { createHtmlNode } from "../../../remark/utils/nodes"
import { partitionByThematicBreak } from "../../../remark/utils/structure"
import { escapeHtml } from "../../../remark/utils/text"
import { buildStyleAttribute } from "../../../remark/utils/style"
import { resolveBackgroundImageLayerPlan } from "../../../remark/utils/background-image-layers"

type CarousselTone = "light" | "dark" | "auto"
type CarousselDisplay = "revolver" | "cut-elements"

const carousselValidators = defineAttributes({
	label: textAttribute({ defaultValue: "Kartenkarussell" }),
	color: textAttribute({ defaultValue: "" }),
	display: choiceAttribute<CarousselDisplay>({ choices: ["revolver", "cut-elements"], defaultValue: "revolver" }),
	style: inlineStyleAttribute(),
})

const isParagraph = (node: DirectiveContentNode): node is Paragraph => node.type === "paragraph"

const isWhitespaceParagraph = (node: Paragraph): boolean => {
	return node.children.every((child) => child.type === "text" && child.value.trim().length === 0)
}

const isSkippableNode = (node: DirectiveContentNode): boolean => {
	if (isParagraph(node)) {
		return isWhitespaceParagraph(node)
	}
	if (node.type === "html") {
		const value = node.value.trim()
		return value.length === 0 || value.startsWith("<!--")
	}
	if (node.type === "text") {
		return node.value.trim().length === 0
	}
	return false
}

const hasRenderableContent = (nodes: DirectiveContentNode[]): boolean => {
	return nodes.some((node) => !isSkippableNode(node))
}

const normalizeSections = (sections: DirectiveContentNode[][]): DirectiveContentNode[][] => {
	return sections
		.map((section) => {
			const trimmed = [...section]
			while (trimmed.length > 0 && isSkippableNode(trimmed[0] as DirectiveContentNode)) {
				trimmed.shift()
			}
			while (trimmed.length > 0 && isSkippableNode(trimmed[trimmed.length - 1] as DirectiveContentNode)) {
				trimmed.pop()
			}
			return trimmed
		})
		.filter((section) => section.length > 0)
}

const requireCards = (sections: DirectiveContentNode[][], file: VFile, rootNode: ContainerDirectiveNode): DirectiveContentNode[][] => {
	const usable = normalizeSections(sections)
	if (usable.length < 2) {
		file.fail("caroussel benötigt mindestens zwei durch '---' getrennte Karten.", rootNode)
	}
	usable.forEach((section, index) => {
		if (!hasRenderableContent(section)) {
			file.fail(`Karte ${index + 1} benötigt Inhalt.`, rootNode)
		}
	})
	return usable
}

let carousselInstance = 0

const carousselProcessor: ContentProcessor = (attributes, context) => {
	const { node, file } = context
	const layerPlan = resolveBackgroundImageLayerPlan(node.children, "caroussel", ["auto"], file)
	const sections = partitionByThematicBreak(layerPlan.contentNodes)
	const cards = requireCards(sections, file, node)
	const requestedTone = (attributes["color"] as string).trim().toLowerCase()
	let tone: CarousselTone = "auto"
	if (requestedTone.length > 0) {
		if (requestedTone !== "light" && requestedTone !== "dark") {
			file.fail(`Das Attribut "color" erlaubt nur die Werte "light" oder "dark".`, node)
		}
		tone = requestedTone === "dark" ? "dark" : "light"
	}
	const display = attributes["display"] as CarousselDisplay
	const label = attributes["label"] as string
	const inlineStyle = attributes["style"] as string
	const styleAttribute = buildStyleAttribute([], inlineStyle)
	const instanceId = `caroussel-${carousselInstance + 1}`
	carousselInstance += 1
	const viewportId = `${instanceId}-viewport`

	const slideNodes: DirectiveContentNode[] = []
	cards.forEach((card, index) => {
		slideNodes.push(createHtmlNode(`<li class="caroussel__slide" data-caroussel-slide data-caroussel-index="${index}">`))
		slideNodes.push(createHtmlNode(`<article class="caroussel__card">`))
		slideNodes.push(createHtmlNode(`<div class="caroussel__card-content">`))
		slideNodes.push(...card)
		slideNodes.push(createHtmlNode(`</div></article></li>`))
	})

	return [
		createHtmlNode(
			`<section class="caroussel caroussel--tone-${tone} caroussel--display-${display}" data-bg-image-layer="auto" data-caroussel data-caroussel-display="${display}" aria-label="${escapeHtml(label)}"${styleAttribute}>`,
		),
		...layerPlan.renderLayerNodes("auto"),
		createHtmlNode(`<div class="caroussel__viewport" id="${viewportId}" data-caroussel-viewport tabindex="0">`),
		createHtmlNode(`<ul class="caroussel__track" data-caroussel-track role="list">`),
		...slideNodes,
		createHtmlNode(`</ul>`),
		createHtmlNode(`</div>`),
		createHtmlNode(`<div class="caroussel__controls ui-arrow-group" role="group" aria-label="Karten wechseln">`),
		createHtmlNode(`<button type="button" class="caroussel__arrow caroussel__arrow--prev ui-arrow-button" data-caroussel-prev aria-controls="${viewportId}" aria-label="Vorherige Karte">` + `<span aria-hidden="true">&#8592;</span>` + `</button>`),
		createHtmlNode(`<button type="button" class="caroussel__arrow caroussel__arrow--next ui-arrow-button" data-caroussel-next aria-controls="${viewportId}" aria-label="Nächste Karte">` + `<span aria-hidden="true">&#8594;</span>` + `</button>`),
		createHtmlNode(`</div>`),
		createHtmlNode(`</section>`),
	]
}

/**
 * caroussel rendert mehrere Karten als Karussell mit wählbarer Darstellung (revolver oder cut-elements).
 */
export const carousselModule = ContentModule("caroussel", carousselValidators, carousselProcessor)
