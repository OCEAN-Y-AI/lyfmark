import type { VFile } from "vfile"
import { ContentModule } from "../../../remark/content-module"
import type { ContentProcessor, DirectiveContentNode } from "../../../remark/types"
import { defineAttributes, textAttribute } from "../../../remark/utils/attributes"
import { createHtmlNode } from "../../../remark/utils/nodes"
import { escapeHtml, slugify } from "../../../remark/utils/text"

const ANCHOR_REGISTRY_KEY = "__lyfmarkAnchorModuleIds"
const ANCHOR_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const anchorValidators = defineAttributes({
	name: textAttribute({ required: true }),
})

const hasVisibleContent = (children: DirectiveContentNode[]): boolean => {
	return children.some((child) => {
		if (child.type === "text") {
			return child.value.trim().length > 0
		}
		return true
	})
}

const getOrCreateAnchorRegistry = (file: VFile): Set<string> => {
	const existingValue = file.data[ANCHOR_REGISTRY_KEY]
	if (existingValue instanceof Set) {
		return existingValue as Set<string>
	}
	const created = new Set<string>()
	file.data[ANCHOR_REGISTRY_KEY] = created
	return created
}

const anchorProcessor: ContentProcessor = (attributes, context) => {
	const { node, file } = context
	if (hasVisibleContent(node.children)) {
		file.fail("Das Modul \"anchor\" darf keinen eigenen Inhalt enthalten.", node)
	}

	const rawAnchorName = attributes["name"] as string
	const anchorId = slugify(rawAnchorName, "")
	if (anchorId.length === 0) {
		file.fail(`Das Attribut "name" benötigt sichtbaren Text, aus dem ein Anchor gebildet werden kann.`, node)
	}
	if (!ANCHOR_ID_PATTERN.test(anchorId)) {
		file.fail(`Der erzeugte Anchor "${anchorId}" ist ungültig. Nutze bitte Buchstaben und Zahlen im Namen.`, node)
	}

	const anchorRegistry = getOrCreateAnchorRegistry(file)
	if (anchorRegistry.has(anchorId)) {
		file.fail(`Der Anchor "${anchorId}" ist bereits vorhanden. Bitte nutze einen eindeutigen Namen.`, node)
	}
	anchorRegistry.add(anchorId)

	return [createHtmlNode(`<span id="${escapeHtml(anchorId)}" class="anchor-module" data-anchor-module="true" aria-hidden="true"></span>`)]
}

/**
 * anchor creates a dedicated in-page target from free text.
 * Contract: the generated id must be stable, valid, and unique within one page.
 */
export const anchorModule = ContentModule("anchor", anchorValidators, anchorProcessor, { selfClosing: true })
