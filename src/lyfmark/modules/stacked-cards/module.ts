import type { Paragraph } from "mdast"
import type { VFile } from "vfile"
import { ContentModule } from "../../../remark/content-module"
import type { ContainerDirectiveNode, ContentProcessor, DirectiveContentNode } from "../../../remark/types"
import { defineAttributes, inlineStyleAttribute, textAttribute } from "../../../remark/utils/attributes"
import { createHtmlNode } from "../../../remark/utils/nodes"
import { partitionByThematicBreak } from "../../../remark/utils/structure"
import { escapeHtml } from "../../../remark/utils/text"
import { buildStyleAttribute } from "../../../remark/utils/style"
import { resolveBackgroundImageLayerPlan } from "../../../remark/utils/background-image-layers"

type StackedCardsTone = "light" | "dark" | "auto"

const stackedCardsValidators = defineAttributes({
	label: textAttribute({ defaultValue: "Kartenstapel" }),
	color: textAttribute({ defaultValue: "" }),
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

const requireCards = (
	sections: DirectiveContentNode[][],
	file: VFile,
	rootNode: ContainerDirectiveNode,
): DirectiveContentNode[][] => {
	const cards = normalizeSections(sections)
	if (cards.length === 0) {
		file.fail("stacked-cards benötigt mindestens eine Karte mit Inhalt.", rootNode)
	}
	cards.forEach((card, index) => {
		if (!hasRenderableContent(card)) {
			file.fail(`Karte ${index + 1} benötigt Inhalt.`, rootNode)
		}
	})
	return cards
}

let stackedCardsInstance = 0

const stackedCardsProcessor: ContentProcessor = (attributes, context) => {
	const { node, file } = context
	const layerPlan = resolveBackgroundImageLayerPlan(node.children, "stacked-cards", ["auto"], file)
	const sections = partitionByThematicBreak(layerPlan.contentNodes)
	const cards = requireCards(sections, file, node)
	const label = attributes["label"] as string
	const requestedTone = (attributes["color"] as string).trim().toLowerCase()
	let tone: StackedCardsTone = "auto"
	if (requestedTone.length > 0) {
		if (requestedTone !== "light" && requestedTone !== "dark") {
			file.fail(`Das Attribut "color" erlaubt nur die Werte "light" oder "dark".`, node)
		}
		tone = requestedTone === "dark" ? "dark" : "light"
	}
	const inlineStyle = attributes["style"] as string
	const styleAttribute = buildStyleAttribute([], inlineStyle)
	const instanceId = `stacked-cards-${stackedCardsInstance + 1}`
	stackedCardsInstance += 1
	const viewportId = `${instanceId}-viewport`

	const cardNodes: DirectiveContentNode[] = []
	cards.forEach((card, index) => {
		const cardNumber = index + 1
		const cardOffset = index
		const isActive = index === 0
		const isVisible = cardOffset <= 2
		const cardClasses = ["stacked-cards__item"]
		if (isActive) {
			cardClasses.push("stacked-cards__item--active")
		}
		if (!isVisible) {
			cardClasses.push("stacked-cards__item--hidden")
		}
		const itemId = `${instanceId}-card-${cardNumber}`
		cardNodes.push(
			createHtmlNode(
				`<li class="${cardClasses.join(" ")}" data-stacked-cards-item data-stacked-cards-index="${index}" data-stacked-cards-offset="${cardOffset}" aria-hidden="${isActive ? "false" : "true"}"${isActive ? "" : " inert"}>`,
			),
		)
		cardNodes.push(
			createHtmlNode(
				`<article class="stacked-cards__card" aria-label="Karte ${cardNumber} von ${cards.length}">`,
			),
		)
		cardNodes.push(
			createHtmlNode(
				`<header class="stacked-cards__card-header" id="${itemId}"><span class="stacked-cards__card-number">${cardNumber}.</span></header>`,
			),
		)
		cardNodes.push(createHtmlNode(`<div class="stacked-cards__card-body">`))
		cardNodes.push(...card)
		cardNodes.push(createHtmlNode(`</div></article></li>`))
	})

	const hasControls = cards.length > 1

	return [
		createHtmlNode(
			`<section class="stacked-cards stacked-cards--tone-${tone}" data-bg-image-layer="auto" data-stacked-cards aria-label="${escapeHtml(label)}" data-stacked-cards-size="${cards.length}"${styleAttribute}>`,
		),
		...layerPlan.renderLayerNodes("auto"),
		createHtmlNode(`<div class="stacked-cards__viewport" id="${viewportId}" data-stacked-cards-viewport tabindex="0">`),
		createHtmlNode(`<ol class="stacked-cards__list" data-stacked-cards-list role="list">`),
		...cardNodes,
		createHtmlNode(`</ol></div>`),
		...(hasControls
			? [
					createHtmlNode(`<div class="stacked-cards__controls ui-arrow-group" role="group" aria-label="Karten wechseln">`),
					createHtmlNode(
						`<button type="button" class="stacked-cards__arrow stacked-cards__arrow--prev ui-arrow-button ui-arrow-button--outline" data-stacked-cards-prev aria-controls="${viewportId}" aria-label="Vorherige Karte">` +
							`<span aria-hidden="true">&#8592;</span>` +
						`</button>`,
					),
					createHtmlNode(
						`<button type="button" class="stacked-cards__arrow stacked-cards__arrow--next ui-arrow-button" data-stacked-cards-next aria-controls="${viewportId}" aria-label="Nächste Karte">` +
							`<span aria-hidden="true">&#8594;</span>` +
						`</button>`,
					),
					createHtmlNode(`</div>`),
				]
			: []),
		createHtmlNode(`</section>`),
	]
}

/**
 * stacked-cards zeigt beliebig viele Karten als versetzten Stapel mit Pfeilnavigation.
 */
export const stackedCardsModule = ContentModule("stacked-cards", stackedCardsValidators, stackedCardsProcessor)
