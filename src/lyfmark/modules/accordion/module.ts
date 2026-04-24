import type { Heading, Paragraph } from "mdast"
import type { VFile } from "vfile"
import { ContentModule } from "../../../remark/content-module"
import type { ContainerDirectiveNode, ContentProcessor, DirectiveContentNode } from "../../../remark/types"
import { defineAttributes, inlineStyleAttribute, textAttribute } from "../../../remark/utils/attributes"
import { collectPlainText } from "../../../remark/utils/content"
import { createHtmlNode } from "../../../remark/utils/nodes"
import { partitionByThematicBreak } from "../../../remark/utils/structure"
import { escapeHtml } from "../../../remark/utils/text"
import { buildStyleAttribute } from "../../../remark/utils/style"
import { resolveBackgroundImageLayerPlan } from "../../../remark/utils/background-image-layers"

interface AccordionSection {
	readonly title: string
	readonly depth: number
	readonly content: DirectiveContentNode[]
}

const accordionValidators = defineAttributes({
	label: textAttribute({ defaultValue: "Akkordeon" }),
	style: inlineStyleAttribute(),
})

const isHeadingNode = (node: DirectiveContentNode): node is Heading => node.type === "heading"

const isParagraphNode = (node: DirectiveContentNode): node is Paragraph => node.type === "paragraph"

const isWhitespaceParagraph = (node: Paragraph): boolean => {
	return node.children.every((child) => child.type === "text" && child.value.trim().length === 0)
}

const isSkippableNode = (node: DirectiveContentNode): boolean => {
	if (isParagraphNode(node)) {
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

const trimSkippableNodes = (nodes: DirectiveContentNode[]): DirectiveContentNode[] => {
	let start = 0
	let end = nodes.length
	while (start < end && isSkippableNode(nodes[start] as DirectiveContentNode)) {
		start += 1
	}
	while (end > start && isSkippableNode(nodes[end - 1] as DirectiveContentNode)) {
		end -= 1
	}
	return nodes.slice(start, end)
}

const hasRenderableContent = (nodes: DirectiveContentNode[]): boolean => {
	return nodes.some((node) => !isSkippableNode(node))
}

const trimSections = (sections: DirectiveContentNode[][]): DirectiveContentNode[][] => {
	return sections.map((section) => trimSkippableNodes(section))
}

const isAllowedHeading = (node: Heading): boolean => node.depth >= 1 && node.depth <= 3

const resolveSections = (
	sections: DirectiveContentNode[][],
	file: VFile,
	rootNode: ContainerDirectiveNode,
): AccordionSection[] => {
	const trimmedSections = trimSections(sections)
	const hasContent = trimmedSections.some((section) => section.length > 0)
	if (!hasContent) {
		file.fail("accordion benötigt mindestens einen Abschnitt.", rootNode)
	}
	return trimmedSections.map((section, index) => {
		if (section.length === 0) {
			file.fail(`Abschnitt ${index + 1} benötigt Inhalte.`, rootNode)
		}
		const firstIndex = section.findIndex((node) => !isSkippableNode(node))
		if (firstIndex < 0) {
			file.fail(`Abschnitt ${index + 1} benötigt Inhalte.`, rootNode)
		}
		const candidate = section[firstIndex] as DirectiveContentNode
		if (!isHeadingNode(candidate) || !isAllowedHeading(candidate)) {
			file.fail(`Abschnitt ${index + 1} muss mit einer Überschrift (#, ## oder ###) beginnen.`, candidate)
		}
		const title = collectPlainText(candidate.children).trim()
		if (title.length === 0) {
			file.fail(`Bitte gib für Abschnitt ${index + 1} einen Titel an.`, candidate)
		}
		const contentNodes = trimSkippableNodes(section.slice(firstIndex + 1))
		if (!hasRenderableContent(contentNodes)) {
			file.fail(`Bitte ergänze eine Beschreibung für Abschnitt ${index + 1}.`, candidate)
		}
		return {
			title,
			depth: candidate.depth,
			content: contentNodes,
		}
	})
}

let accordionInstance = 0

const accordionProcessor: ContentProcessor = (attributes, context) => {
	const { node, file } = context
	const layerPlan = resolveBackgroundImageLayerPlan(node.children, "accordion", ["auto"], file)
	const sections = resolveSections(partitionByThematicBreak(layerPlan.contentNodes), file, node)
	const label = attributes["label"] as string
	const inlineStyle = attributes["style"] as string
	const styleAttribute = buildStyleAttribute([], inlineStyle)
	const instanceId = `accordion-${accordionInstance + 1}`
	accordionInstance += 1
	const items: DirectiveContentNode[] = []

	sections.forEach((section, index) => {
		const triggerId = `${instanceId}-trigger-${index + 1}`
		const panelId = `${instanceId}-panel-${index + 1}`
		items.push(createHtmlNode(`<div class="accordion-module__item">`))
		items.push(createHtmlNode(`<h${section.depth} class="accordion-module__heading">`))
		items.push(
			createHtmlNode(
				`<button type="button" class="accordion-module__trigger" aria-expanded="true" aria-controls="${panelId}" id="${triggerId}" data-accordion-trigger>` +
					`<h4 class="accordion-module__title">${escapeHtml(section.title)}</h4>` +
					`<span class="accordion-module__icon" aria-hidden="true"></span>` +
				`</button>`,
			),
		)
		items.push(createHtmlNode(`</h${section.depth}>`))
		items.push(
			createHtmlNode(
				`<div class="accordion-module__panel" id="${panelId}" role="region" aria-labelledby="${triggerId}" data-accordion-panel>`,
			),
		)
		items.push(...section.content)
		items.push(createHtmlNode(`</div>`))
		items.push(createHtmlNode(`</div>`))
	})

	return [
		createHtmlNode(
			`<section class="accordion-module" data-bg-image-layer="auto" data-accordion-module aria-label="${escapeHtml(label)}"${styleAttribute}>`,
		),
		...layerPlan.renderLayerNodes("auto"),
		...items,
		createHtmlNode(`</section>`),
	]
}

/**
 * accordion rendert klappbare Abschnitte, die mit "---" getrennt sind und per Button ein- oder ausgeblendet werden.
 */
export const accordionModule = ContentModule("accordion", accordionValidators, accordionProcessor)
