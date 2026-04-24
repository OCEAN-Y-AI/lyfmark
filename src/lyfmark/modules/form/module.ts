import type { Paragraph } from "mdast"
import type { DirectiveContentNode, DirectiveModule } from "../../../remark/types"
import { inlineStyleAttribute } from "../../../remark/utils/attributes"
import { renderFormPresetMarkup } from "../../../remark/utils/form-presets"
import { createHtmlNode } from "../../../remark/utils/nodes"
import { buildStyleAttribute } from "../../../remark/utils/style"
import { escapeHtml } from "../../../remark/utils/text"

const RESERVED_ATTRIBUTES = new Set(["preset", "style"])
const VARIABLE_NAME_PATTERN = /^[a-z0-9-]+$/
const styleAttributeValidator = inlineStyleAttribute().build("style")

const isParagraphNode = (node: DirectiveContentNode): node is Paragraph => node.type === "paragraph"

const isWhitespaceParagraph = (node: Paragraph): boolean => {
	return node.children.every((child) => child.type === "text" && child.value.trim().length === 0)
}

const isSkippableNode = (node: DirectiveContentNode): boolean => {
	if (isParagraphNode(node)) {
		return isWhitespaceParagraph(node)
	}
	if (node.type === "text") {
		return node.value.trim().length === 0
	}
	if (node.type === "html") {
		const value = node.value.trim()
		return value.length === 0 || value.startsWith("<!--")
	}
	return false
}

const hasRenderableContent = (children: DirectiveContentNode[]): boolean => {
	return children.some((child) => !isSkippableNode(child))
}

interface FormModuleAttributes {
	readonly preset: string
	readonly inlineStyle: string
	readonly variables: Record<string, string>
}

const asNonEmptyText = (value: unknown, key: string, moduleNode: DirectiveContentNode, fail: (reason: string, node: DirectiveContentNode) => never): string => {
	if (typeof value !== "string") {
		fail(`form: Das Attribut "${key}" muss als Text angegeben werden.`, moduleNode)
	}
	const trimmed = value.trim()
	if (trimmed.length === 0) {
		fail(`form: Das Attribut "${key}" darf nicht leer sein.`, moduleNode)
	}
	return trimmed
}

const normalizeAttributes = (
	attributes: Record<string, unknown>,
	moduleNode: DirectiveContentNode,
	fail: (reason: string, node: DirectiveContentNode) => never,
): FormModuleAttributes => {
	const presetValue = attributes["preset"]
	if (presetValue === undefined || presetValue === null) {
		fail(`form: Bitte gib das Attribut "preset" an.`, moduleNode)
	}
	const preset = asNonEmptyText(presetValue, "preset", moduleNode, fail)

	let inlineStyle = ""
	try {
		inlineStyle = styleAttributeValidator(attributes["style"]) as string
	} catch (error: unknown) {
		if (typeof error === "string") {
			fail(error, moduleNode)
		}
		throw error
	}
	const variables: Record<string, string> = {}

	for (const [key, value] of Object.entries(attributes)) {
		if (RESERVED_ATTRIBUTES.has(key)) {
			continue
		}
		if (!VARIABLE_NAME_PATTERN.test(key)) {
			fail(`form: Attribut "${key}" ist ungültig. Erlaubt sind nur Kleinbuchstaben, Zahlen und Bindestriche.`, moduleNode)
		}
		variables[key] = asNonEmptyText(value, key, moduleNode, fail)
	}

	return {
		preset,
		inlineStyle,
		variables,
	}
}

/**
 * form rendert ein HTML-Formular aus einem Preset und kombiniert es optional mit redaktionellem Markdown-Einleitungstext.
 */
export const formModule: DirectiveModule = {
	name: "form",
	render: (context) => {
		const { node, file } = context
		const attributes = normalizeAttributes(node.attributes ?? {}, node, (reason, failNode) => file.fail(reason, failNode))
		const formMarkup = renderFormPresetMarkup(attributes.preset, attributes.variables, file, node)
		const styleAttribute = buildStyleAttribute([], attributes.inlineStyle)
		const nodes: DirectiveContentNode[] = [
			createHtmlNode(
				`<section class="form-module" data-form-module data-form-preset="${escapeHtml(attributes.preset)}"${styleAttribute}>`,
			),
		]

		if (hasRenderableContent(node.children)) {
			nodes.push(createHtmlNode(`<div class="form-module__content">`))
			nodes.push(...node.children)
			nodes.push(createHtmlNode(`</div>`))
		}

		nodes.push(createHtmlNode(`<div class="form-module__preset">`))
		nodes.push(createHtmlNode(formMarkup))
		nodes.push(createHtmlNode(`</div></section>`))

		return nodes
	},
}
