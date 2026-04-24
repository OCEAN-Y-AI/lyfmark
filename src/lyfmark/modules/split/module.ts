import { ContentModule } from "../../../remark/content-module"
import type { ContainerDirectiveNode, ContentProcessor, DirectiveContentNode } from "../../../remark/types"
import { defineAttributes, inlineStyleAttribute, textAttribute } from "../../../remark/utils/attributes"
import { resolveBackgroundImageLayerPlan } from "../../../remark/utils/background-image-layers"
import { createHtmlNode } from "../../../remark/utils/nodes"
import { buildStyleAttribute } from "../../../remark/utils/style"
import { partitionByThematicBreak } from "../../../remark/utils/structure"
import type { VFile } from "vfile"

const WEIGHT_VALUE_PATTERN = /^(?:\d+(?:\.\d+)?|\.\d+)$/

const splitValidators = defineAttributes({
	weight: textAttribute(),
	style: inlineStyleAttribute(),
})

const parseWeightTemplate = (
	rawWeight: string,
	columnsCount: number,
	file: VFile,
	node: ContainerDirectiveNode,
): string | null => {
	const trimmedWeight = rawWeight.trim()
	if (trimmedWeight.length === 0) {
		return null
	}

	const rawValues = trimmedWeight.split(/\s+/u).filter((value) => value.length > 0)
	if (rawValues.length !== columnsCount) {
		file.fail(`split: "weight" muss genau ${columnsCount} Werte enthalten (ein Wert pro Spalte).`, node)
	}

	const normalizedValues = rawValues.map((rawValue) => {
		if (!WEIGHT_VALUE_PATTERN.test(rawValue)) {
			file.fail(`split: "weight" erlaubt nur positive Zahlen, z. B. "1 2 1". Ungültiger Wert: "${rawValue}".`, node)
		}
		const numericValue = Number.parseFloat(rawValue)
		if (!Number.isFinite(numericValue) || numericValue <= 0) {
			file.fail(`split: "weight" erlaubt nur Werte größer 0. Ungültiger Wert: "${rawValue}".`, node)
		}
		return String(numericValue)
	})

	return normalizedValues.map((value) => `minmax(0, ${value}fr)`).join(" ")
}

const splitProcessor: ContentProcessor = (attributes, context) => {
	const { node, file } = context
	const layerPlan = resolveBackgroundImageLayerPlan(node.children, "split", ["auto"], file)
	const columnContent = partitionByThematicBreak(layerPlan.contentNodes)
	const columnsCount = columnContent.length
	if (columnsCount < 2) {
		file.fail(`split benötigt mindestens zwei Spalten. Füge eine Trennlinie "---" hinzu.`, node)
	}
	if (columnsCount > 4) {
		file.fail(`split unterstützt maximal vier Spalten. Reduziere die Anzahl der Trennlinien "---".`, node)
	}

	const columnsMarkup: DirectiveContentNode[] = []
	const declarations: string[] = []
	const inlineStyle = attributes["style"] as string
	const weightTemplate = parseWeightTemplate(attributes["weight"] as string, columnsCount, file, node)
	if (weightTemplate) {
		declarations.push(`--split-columns-template: ${weightTemplate}`)
	}
	const styleAttribute = buildStyleAttribute(declarations, inlineStyle)

	columnContent.forEach((columnNodes) => {
		const isEmpty = columnNodes.length === 0
		const emptyClass = isEmpty ? " split__column--empty" : ""
		const ariaHidden = isEmpty ? " aria-hidden=\"true\"" : ""
		columnsMarkup.push(createHtmlNode(`<div class="split__column${emptyClass}"${ariaHidden}>`))
		if (!isEmpty) {
			columnsMarkup.push(...columnNodes)
		}
		columnsMarkup.push(createHtmlNode(`</div>`))
	})

	return [
		createHtmlNode(`<section class="split split--cols-${columnsCount}" data-bg-image-layer="auto" aria-label="Mehrspaltiger Bereich"${styleAttribute}>`),
		...layerPlan.renderLayerNodes("auto"),
		...columnsMarkup,
		createHtmlNode(`</section>`),
	]
}

/**
 * split distributes content into 2-4 columns separated by thematic breaks,
 * with optional per-column weights via the "weight" attribute.
 */
export const splitModule = ContentModule("split", splitValidators, splitProcessor)
