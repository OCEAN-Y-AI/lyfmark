import type { Heading, Html, Parent, Root, Text } from "mdast"
import type { RemarkPlugin } from "@astrojs/markdown-remark"
import type { Node } from "unist"
import type { VFile } from "vfile"
import GithubSlugger from "github-slugger"
import { visit } from "unist-util-visit"
import type { DirectiveContentNode } from "./types"
import { collectPlainText } from "./utils/content"
import { decorateLucideSvg, lookupLucideIcon } from "./utils/lucide"

const LUCIDE_INLINE_PATTERN = /\[lucide:\s*([^\]\n]+?)\s*\]/gi
const LUCIDE_INLINE_HEADING_FLAG = "lucideInlineHeading"

const isParentWithChildren = (node: unknown): node is Parent & { children: Node[] } => {
	return Array.isArray((node as Parent)?.children)
}

const isTextNode = (node: unknown): node is Text => {
	return (node as Text)?.type === "text"
}

const isHeadingNode = (node: unknown): node is Heading => {
	return (node as Heading)?.type === "heading"
}

const renderLucideInlineSvg = (rawIconName: string, file: VFile, sourceNode: Text | Html): string => {
	const iconLookup = lookupLucideIcon(rawIconName)
	if (iconLookup.normalizedIconName.length === 0) {
		file.fail(`lucide-inline: Der Lucide-Name ist leer. Nutze z. B. [lucide:circle-check].`, sourceNode)
	}
	if (!iconLookup.svg) {
		file.fail(
			`lucide-inline: Unbekanntes Lucide-Icon "${rawIconName}". Beispiel für gültige Namen: circle-check, phone, mail, map-pin.`,
			sourceNode,
		)
	}

	return decorateLucideSvg(iconLookup.svg, {
		className: "lucide-inline-icon",
		ariaHidden: true,
		focusable: false,
		width: "1em",
		height: "1em",
		style: "vertical-align: middle;",
	})
}

const buildReplacementNodes = (value: string, file: VFile, sourceNode: Text): (Text | Html)[] => {
	const pattern = new RegExp(LUCIDE_INLINE_PATTERN.source, "gi")
	const matches = Array.from(value.matchAll(pattern))
	if (matches.length === 0) {
		return [{ type: "text", value }]
	}

	const replacementNodes: (Text | Html)[] = []
	let cursor = 0

	for (const match of matches) {
		const fullMatch = match[0]
		const rawIconName = (match[1] ?? "").trim()
		const matchIndex = match.index ?? 0

		if (matchIndex > cursor) {
			replacementNodes.push({
				type: "text",
				value: value.slice(cursor, matchIndex),
			})
		}

		replacementNodes.push({
			type: "html",
			value: renderLucideInlineSvg(rawIconName, file, sourceNode),
		})

		cursor = matchIndex + fullMatch.length
	}

	if (cursor < value.length) {
		replacementNodes.push({
			type: "text",
			value: value.slice(cursor),
		})
	}

	return replacementNodes
}

const replaceInlineIconsInTextSegment = (value: string, file: VFile, sourceNode: Html): string => {
	const pattern = new RegExp(LUCIDE_INLINE_PATTERN.source, "gi")
	return value.replace(pattern, (_fullMatch, rawIconName: string) => {
		return renderLucideInlineSvg(rawIconName.trim(), file, sourceNode)
	})
}

const replaceInlineIconsInHtmlValue = (value: string, file: VFile, sourceNode: Html): string => {
	let result = ""
	let textSegment = ""
	let insideTag = false
	let activeQuote: "\"" | "'" | null = null

	const flushTextSegment = (): void => {
		if (textSegment.length === 0) {
			return
		}
		result += replaceInlineIconsInTextSegment(textSegment, file, sourceNode)
		textSegment = ""
	}

	for (const character of value) {
		if (insideTag) {
			result += character
			if (activeQuote) {
				if (character === activeQuote) {
					activeQuote = null
				}
				continue
			}
			if (character === "\"" || character === "'") {
				activeQuote = character
				continue
			}
			if (character === ">") {
				insideTag = false
			}
			continue
		}

		if (character === "<") {
			flushTextSegment()
			insideTag = true
			result += character
			continue
		}

		textSegment += character
	}

	flushTextSegment()
	return result
}

export const inlineLucideIcons: RemarkPlugin = () => {
	return (tree: Root, file: VFile): void => {
		const slugger = new GithubSlugger()

		visit(tree, "text", (node, index, parent) => {
			if (!isTextNode(node) || !isParentWithChildren(parent) || typeof index !== "number") {
				return
			}
			if (!/\[lucide:/i.test(node.value)) {
				return
			}

			const replacementNodes = buildReplacementNodes(node.value, file, node)
			if (replacementNodes.length === 1 && isTextNode(replacementNodes[0]) && replacementNodes[0].value === node.value) {
				return
			}

			const children = parent.children as unknown[]
			children.splice(index, 1, ...(replacementNodes as unknown[]))
			if (isHeadingNode(parent)) {
				const headingData = (parent.data ??= {}) as Record<string, unknown>
				headingData[LUCIDE_INLINE_HEADING_FLAG] = true
			}
			return index + replacementNodes.length
		})

		visit(tree, "html", (node) => {
			if (typeof node.value !== "string" || !/\[lucide:/i.test(node.value)) {
				return
			}
			node.value = replaceInlineIconsInHtmlValue(node.value, file, node)
		})

		visit(tree, "heading", (node) => {
			if (!isHeadingNode(node)) {
				return
			}

			const headingText = collectPlainText(node.children as unknown as DirectiveContentNode[])
			const generatedSlug = slugger.slug(headingText)

			const headingData = (node.data ??= {}) as Record<string, unknown>
			const hasInlineIcon = headingData[LUCIDE_INLINE_HEADING_FLAG] === true
			if (!hasInlineIcon) {
				return
			}
			if (generatedSlug.length === 0) {
				file.fail(`lucide-inline: Überschriften mit [lucide:...] benötigen sichtbaren Text.`, node)
			}

			const properties = (headingData.hProperties ??= {}) as Record<string, unknown>
			const hasCustomId = typeof properties.id === "string" && properties.id.trim().length > 0
			if (!hasCustomId) {
				properties.id = generatedSlug
			}
		})
	}
}
