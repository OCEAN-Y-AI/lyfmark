import type { Parent } from "mdast"
import type { DirectiveContentNode } from "../types"

type ParentContent = DirectiveContentNode & Parent

type TextValueNode = DirectiveContentNode & { value: string }

const INLINE_LUCIDE_TOKEN_PATTERN = /\[lucide:\s*[^\]\n]+?\s*\]/giu
const MULTI_SPACE_PATTERN = /\s+/gu

const hasChildren = (node: DirectiveContentNode): node is ParentContent => {
	return Array.isArray((node as Parent).children)
}

const hasTextValue = (node: DirectiveContentNode): node is TextValueNode => {
	return typeof (node as TextValueNode).value === "string"
}

const isPlainTextType = (node: DirectiveContentNode): boolean => {
	return node.type === "text" || node.type === "inlineCode"
}

const collectNodeText = (node: DirectiveContentNode): string => {
	if (hasTextValue(node) && isPlainTextType(node)) {
		return node.value
	}

	if (hasChildren(node)) {
		return collectPlainText(node.children as DirectiveContentNode[])
	}

	return ""
}

/**
 * Collects all visible text nodes from the provided MDAST fragment and joins them with spaces.
 */
export const collectPlainText = (nodes: DirectiveContentNode[]): string => {
	return nodes
		.map(collectNodeText)
		.map((segment) => segment.trim())
		.filter((segment) => segment.length > 0)
		.join(" ")
}

/**
 * Removes inline icon tokens from already-collected plain text.
 * Useful for accessible labels where markup placeholders should not be spoken.
 */
export const stripInlineLucideTokens = (value: string): string => {
	return value.replace(INLINE_LUCIDE_TOKEN_PATTERN, " ").replace(MULTI_SPACE_PATTERN, " ").trim()
}

/**
 * Collects plain text and strips unsupported inline marker syntax for assistive labels.
 */
export const collectAccessiblePlainText = (nodes: DirectiveContentNode[]): string => {
	return stripInlineLucideTokens(collectPlainText(nodes))
}

export const summarizePlainText = (nodes: DirectiveContentNode[], maxLength = 160): string => {
	const text = collectPlainText(nodes)
	if (text.length <= maxLength) {
		return text
	}
	return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

export const firstSentence = (nodes: DirectiveContentNode[]): string => {
	const text = collectPlainText(nodes)
	const endIndex = text.search(/[.!?]\s/)
	if (endIndex === -1) {
		return text
	}
	return text.slice(0, endIndex + 1)
}
