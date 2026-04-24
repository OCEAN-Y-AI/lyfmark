import { ContentModule } from "../../../remark/content-module"
import type { ContainerDirectiveNode, ContentProcessor, DirectiveContentNode } from "../../../remark/types"
import { choiceAttribute, defineAttributes, inlineStyleAttribute, textAttribute } from "../../../remark/utils/attributes"
import { createHtmlNode } from "../../../remark/utils/nodes"
import { escapeHtml } from "../../../remark/utils/text"
import { buildStyleAttribute } from "../../../remark/utils/style"
import type { VFile } from "vfile"

type TypoElement = "div" | "p" | "span" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "strong" | "em"

const typoValidators = defineAttributes({
	class: textAttribute({ required: true }),
	as: choiceAttribute<TypoElement>({
		choices: ["div", "p", "span", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "em"],
		defaultValue: "div",
	}),
	style: inlineStyleAttribute(),
})

const CSS_CLASS_TOKEN = /^[A-Za-z_][A-Za-z0-9_-]*$/

const normalizeClassNames = (rawClassNames: string, file: VFile, node: ContainerDirectiveNode): string => {
	const tokens = rawClassNames
		.split(/\s+/u)
		.map((token) => token.trim())
		.filter((token) => token.length > 0)

	if (tokens.length === 0) {
		file.fail("Bitte gib für das typo Modul mindestens eine CSS-Klasse im Attribut \"class\" an.", node)
	}

	for (const token of tokens) {
		if (!CSS_CLASS_TOKEN.test(token)) {
			file.fail(
				`Ungültige CSS-Klasse \"${token}\" im Attribut \"class\". Erlaubt sind Buchstaben, Zahlen, \"-\" und \"_\".`,
				node,
			)
		}
	}

	const uniqueTokens = [...new Set(tokens)]
	return uniqueTokens.join(" ")
}

const hasRenderableContent = (nodes: DirectiveContentNode[]): boolean => {
	return nodes.some((node) => {
		const value = (node as { value?: unknown }).value
		if (typeof value === "string") {
			return value.trim().length > 0
		}

		const children = (node as { children?: DirectiveContentNode[] }).children
		if (Array.isArray(children)) {
			return hasRenderableContent(children)
		}

		return true
	})
}

const typoProcessor: ContentProcessor = (attributes, context) => {
	const { node, file } = context
	if (!hasRenderableContent(node.children)) {
		file.fail("Bitte füge einen Textinhalt für das typo Modul hinzu.", node)
	}

	const classNames = normalizeClassNames(attributes["class"] as string, file, node)
	const elementName = attributes["as"] as TypoElement
	const finalClassNames = `typo-module ${classNames}`
	const inlineStyle = attributes["style"] as string
	const styleAttribute = buildStyleAttribute([], inlineStyle)

	return [
		createHtmlNode(`<${elementName} class="${escapeHtml(finalClassNames)}"${styleAttribute}>`),
		...node.children,
		createHtmlNode(`</${elementName}>`),
	]
}

/**
 * typo rendert einen frei klassifizierten Wrapper und erhält darin die reguläre Markdown-Struktur.
 */
export const typoModule = ContentModule("typo", typoValidators, typoProcessor)
