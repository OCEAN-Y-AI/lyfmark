import type { Heading, Paragraph, Text } from "mdast"
import type { VFile } from "vfile"
import { ContentModule } from "../../../remark/content-module"
import type { ContainerDirectiveNode, ContentProcessor, DirectiveContentNode } from "../../../remark/types"
import { choiceAttribute, defineAttributes, inlineStyleAttribute, textAttribute } from "../../../remark/utils/attributes"
import type { BackgroundImageLayerPlan } from "../../../remark/utils/background-image-layers"
import { collectPlainText } from "../../../remark/utils/content"
import { createHtmlNode } from "../../../remark/utils/nodes"
import { escapeHtml } from "../../../remark/utils/text"
import { buildStyleAttribute } from "../../../remark/utils/style"
import { resolveBackgroundImageLayerPlan } from "../../../remark/utils/background-image-layers"

type TabsTone = "light" | "dark" | "transparent-light" | "transparent-dark"
type TabsButtonVariantClass = "ui-button--dark" | "ui-button--light"

interface TabDefinition {
	readonly label: string
	readonly content: DirectiveContentNode[]
	readonly layerPlan: BackgroundImageLayerPlan
}

const tabsValidators = defineAttributes({
	label: textAttribute({ defaultValue: "Abschnitte wechseln" }),
	color: choiceAttribute<TabsTone>({
		choices: ["light", "dark", "transparent-light", "transparent-dark"],
		defaultValue: "light",
	}),
	style: inlineStyleAttribute(),
})

const isWhitespaceText = (node: DirectiveContentNode): node is Text => {
	return node.type === "text" && node.value.trim().length === 0
}

const isHeadingNode = (node: DirectiveContentNode): node is Heading => {
	return node.type === "heading"
}

const isParagraphNode = (node: DirectiveContentNode): node is Paragraph => {
	return node.type === "paragraph"
}

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

const hasRenderableContent = (nodes: DirectiveContentNode[]): boolean => {
	return nodes.some((node) => !isSkippableNode(node))
}

const isBackgroundImageDirectiveNode = (node: DirectiveContentNode): node is ContainerDirectiveNode => {
	return node.type === "containerDirective" && node.name === "background-image"
}

interface TabsGlobalSplit {
	readonly globalNodes: DirectiveContentNode[]
	readonly tabNodes: DirectiveContentNode[]
}

const splitGlobalNodesFromTabs = (
	nodes: readonly DirectiveContentNode[],
	file: VFile,
	rootNode: ContainerDirectiveNode,
): TabsGlobalSplit => {
	const globalNodes: DirectiveContentNode[] = []
	let firstTabHeadingIndex = -1

	for (let index = 0; index < nodes.length; index += 1) {
		const node = nodes[index]
		if (isSkippableNode(node)) {
			globalNodes.push(node)
			continue
		}
		if (isBackgroundImageDirectiveNode(node)) {
			globalNodes.push(node)
			continue
		}
		if (isHeadingNode(node) && node.depth === 3) {
			firstTabHeadingIndex = index
			break
		}
		file.fail(
			`Inhalt vor dem ersten Tab ist nicht erlaubt. Erlaubt sind nur ":::background-image" sowie Leerzeilen/Kommentare.`,
			node,
		)
	}

	const tabNodes = firstTabHeadingIndex === -1 ? [] : [...nodes.slice(firstTabHeadingIndex)]
	if (tabNodes.length === 0 && nodes.length > globalNodes.length) {
		file.fail(`tabs benötigt Abschnitte mit "###"-Überschriften.`, rootNode)
	}

	return {
		globalNodes,
		tabNodes,
	}
}

const partitionTabSections = (nodes: DirectiveContentNode[]): DirectiveContentNode[][] => {
	const sections: DirectiveContentNode[][] = []
	let current: DirectiveContentNode[] = []

	nodes.forEach((node, index) => {
		if (node.type === "thematicBreak") {
			let lookaheadIndex = index + 1
			let nextSignificant: DirectiveContentNode | null = null
			while (lookaheadIndex < nodes.length) {
				const lookahead = nodes[lookaheadIndex]
				if (!isSkippableNode(lookahead)) {
					nextSignificant = lookahead
					break
				}
				lookaheadIndex += 1
			}

			if (nextSignificant && nextSignificant.type === "heading" && nextSignificant.depth === 3) {
				sections.push(current)
				current = []
				return
			}
		}

		current.push(node)
	})

	sections.push(current)
	return sections
}

const resolveHeadingForSection = (
	section: DirectiveContentNode[],
	index: number,
	file: VFile,
	rootNode: ContainerDirectiveNode,
): { heading: Heading; headingIndex: number } => {
	const headingIndex = section.findIndex((candidate) => !isWhitespaceText(candidate))
	const anchorNode = headingIndex >= 0 ? section[headingIndex] : rootNode.children[0]
	if (!anchorNode) {
		file.fail(`Tab ${index + 1} benötigt Inhalte.`, rootNode)
	}
	if (!isHeadingNode(anchorNode) || anchorNode.depth !== 3) {
		file.fail(`Tab ${index + 1} muss mit einer \"###\"-Überschrift für den Tab-Titel beginnen.`, anchorNode)
	}
	return {
		heading: anchorNode,
		headingIndex,
	}
}

const compileTabs = (
	sections: DirectiveContentNode[][],
	file: VFile,
	rootNode: ContainerDirectiveNode,
): TabDefinition[] => {
	const usableSections = sections.filter((section) => hasRenderableContent(section))
	if (usableSections.length < 2) {
		file.fail("tabs benötigt mindestens zwei durch '---' getrennte Abschnitte.", rootNode)
	}
	return usableSections.map((section, index) => {
		const sectionLayerPlan = resolveBackgroundImageLayerPlan(section, "tabs", ["auto", "text"], file)
		const sectionContentNodes = sectionLayerPlan.contentNodes
		const { heading, headingIndex } = resolveHeadingForSection(sectionContentNodes, index, file, rootNode)
		const label = collectPlainText(heading.children).trim()
		if (label.length === 0) {
			file.fail(`Bitte gib für Tab ${index + 1} einen aussagekräftigen Titel an.`, heading)
		}
		const contentWithoutHeading =
			headingIndex >= 0
				? sectionContentNodes.filter((_, nodeIndex) => nodeIndex !== headingIndex)
				: sectionContentNodes
		return {
			label,
			content: contentWithoutHeading,
			layerPlan: sectionLayerPlan,
		}
	})
}

const resolveTabsButtonVariantClass = (tone: TabsTone): TabsButtonVariantClass => {
	if (tone === "dark" || tone === "transparent-dark") {
		return "ui-button--dark"
	}
	return "ui-button--light"
}

let tabsInstance = 0

const tabsProcessor: ContentProcessor = (attributes, context) => {
	const { node, file } = context
	const globalSplit = splitGlobalNodesFromTabs(node.children, file, node)
	const globalLayerPlan = resolveBackgroundImageLayerPlan(globalSplit.globalNodes, "tabs", ["auto", "text"], file)
	if (hasRenderableContent(globalLayerPlan.contentNodes)) {
		file.fail(
			`Globaler Inhalt vor dem ersten Tab ist nicht erlaubt. Nutze dort nur ":::background-image".`,
			node,
		)
	}
	const sections = partitionTabSections(globalSplit.tabNodes)
	const tabs = compileTabs(sections, file, node)
	const sectionId = `tabs-module-${tabsInstance + 1}`
	tabsInstance += 1
	const moduleLabel = attributes["label"] as string
	const tone = attributes["color"] as TabsTone
	const buttonVariantClass = resolveTabsButtonVariantClass(tone)
	const inlineStyle = attributes["style"] as string
	const styleAttribute = buildStyleAttribute([], inlineStyle)
	const controls: DirectiveContentNode[] = []
	const panels: DirectiveContentNode[] = []
	tabs.forEach((tab, index) => {
		const tabId = `${sectionId}-tab-${index + 1}`
		const panelId = `${sectionId}-panel-${index + 1}`
		const isActive = index === 0
		const buttonClasses = ["tabs-module__tab", "ui-button", "ui-button--pill", buttonVariantClass]
		if (!isActive) {
			buttonClasses.push("ui-button--outline")
		}
		controls.push(
			createHtmlNode(
				`<button type="button" class="${buttonClasses.join(" ")}${isActive ? " tabs-module__tab--active" : ""}" role="tab" id="${tabId}" aria-controls="${panelId}" aria-selected="${isActive ? "true" : "false"}" tabindex="${isActive ? "0" : "-1"}" data-tabs-trigger>\n` +
						`\t<span>${escapeHtml(tab.label)}</span>` +
					`</button>`,
			),
		)
		panels.push(
			createHtmlNode(
				`<div class="tabs-module__panel${isActive ? " tabs-module__panel--active" : ""}" role="tabpanel" id="${panelId}" aria-labelledby="${tabId}" data-tabs-panel data-bg-image-layer="auto">`,
			),
		)
		panels.push(...tab.layerPlan.renderLayerNodes("auto"))
		panels.push(createHtmlNode(`<div class="tabs-module__panel-content" data-bg-image-layer="text">`))
		panels.push(...tab.layerPlan.renderLayerNodes("text"))
		panels.push(...tab.content)
		panels.push(createHtmlNode(`</div>`))
		panels.push(createHtmlNode(`</div>`))
	})

	return [
			createHtmlNode(
				`<section class="tabs-module tabs-module--tone-${tone}" data-bg-image-layer="auto" data-tabs-module aria-label="${escapeHtml(moduleLabel)}"${styleAttribute}>`,
			),
			...globalLayerPlan.renderLayerNodes("auto"),
			createHtmlNode(`<div class="tabs-module__controls" role="tablist" aria-label="${escapeHtml(moduleLabel)}">`),
			...controls,
			createHtmlNode(`</div>`),
			createHtmlNode(`<div class="tabs-module__panels" data-bg-image-layer="text">`),
			...globalLayerPlan.renderLayerNodes("text"),
			...panels,
			createHtmlNode(`</div>`),
			createHtmlNode(`</section>`),
	]
}

/**
 * tabs blendet mehrere Abschnitte zwischen "---"-Trennern als klickbare Registerkarten (light/dark/transparent) ein.
 */
export const tabsModule = ContentModule("tabs", tabsValidators, tabsProcessor)
