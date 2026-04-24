import type { Code, HTML, Paragraph, Parent, Root } from "mdast"
import type { RemarkPlugin } from "@astrojs/markdown-remark"
import type { VFile } from "vfile"
import { unified } from "unified"
import remarkParse from "remark-parse"
import GithubSlugger from "github-slugger"
import { getDirectiveModule, getKnownDirectiveNames } from "../lyfmark/registry/index"
import type { ContainerDirectiveNode, DirectiveContentNode } from "./types"
import { createHtmlNode } from "./utils/nodes"

type AttributeMap = Record<string, string>

const OPEN_PATTERN = /^:::([a-z0-9-]+(?:\/[a-z0-9-]+)*)(.*)$/i
const CLOSE_PATTERN = /^:::\s*$/u
const TEXT_OVER_PICTURE_DIRECTIVE = "text-over-picture"
const DIRECTIVE_START_LINE_KEY = "__directiveStartLine"
const DIRECTIVE_END_LINE_KEY = "__directiveEndLine"
const LIST_MARKER_PATTERN = /^(?:[-+*]\s+|\d+\.\s+)/
const BLOCKQUOTE_MARKER_PATTERN = /^>\s?/u
const ANCHOR_MODULE_MARKER_PATTERN = /\bdata-anchor-module=(["'])true\1/iu
const ANCHOR_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u
const isParagraph = (node: unknown): node is Paragraph => (node as Paragraph)?.type === "paragraph"
const isCodeNode = (node: unknown): node is Code => (node as Code)?.type === "code"
const isHtmlNode = (node: unknown): node is HTML => (node as HTML)?.type === "html"
const isHeadingNode = (node: unknown): node is { type: "heading"; children: unknown[]; data?: Record<string, unknown> } =>
	(node as { type?: string })?.type === "heading"
const isTextLikeNode = (node: unknown): node is { type: "text" | "inlineCode"; value: string } => {
	const type = (node as { type?: string })?.type
	return (type === "text" || type === "inlineCode") && typeof (node as { value?: unknown })?.value === "string"
}
const hasChildren = (node: unknown): node is Parent & { children: unknown[] } => Array.isArray((node as Parent)?.children)

interface FenceState {
	character: string
	length: number
}

const parseFenceState = (line: string): FenceState | null => {
	const trimmedLine = line.trimStart()
	const match = /^(`{3,}|~{3,})/u.exec(trimmedLine)
	if (!match) {
		return null
	}
	const marker = match[1] ?? ""
	const markerCharacter = marker[0]
	if (!markerCharacter) {
		return null
	}
	return {
		character: markerCharacter,
		length: marker.length,
	}
}

const isFenceCloseLine = (line: string, fence: FenceState): boolean => {
	const trimmedLine = line.trimStart()
	let cursor = 0
	while (cursor < trimmedLine.length && trimmedLine[cursor] === fence.character) {
		cursor += 1
	}
	if (cursor < fence.length) {
		return false
	}
	return trimmedLine.slice(cursor).trim().length === 0
}

const getNodeStartLine = (node: unknown): number | null => {
	const position = (node as { position?: { start?: { line?: number } } })?.position
	const line = position?.start?.line
	return typeof line === "number" ? line : null
}

const getNodeEndLine = (node: unknown): number | null => {
	const position = (node as { position?: { end?: { line?: number } } })?.position
	const line = position?.end?.line
	return typeof line === "number" ? line : null
}

const annotateDirectiveLinesFromNode = (directive: ContainerDirectiveNode, sourceNode: unknown): void => {
	const startLine = getNodeStartLine(sourceNode)
	const endLine = getNodeEndLine(sourceNode) ?? startLine
	const currentData = directive.data ?? {}
	directive.data = {
		...currentData,
		...(typeof startLine === "number" ? { [DIRECTIVE_START_LINE_KEY]: startLine } : {}),
		...(typeof endLine === "number" ? { [DIRECTIVE_END_LINE_KEY]: endLine } : {}),
	}
}

const setDirectiveEndLineFromNode = (directive: ContainerDirectiveNode, sourceNode: unknown): void => {
	const endLine = getNodeEndLine(sourceNode) ?? getNodeStartLine(sourceNode)
	if (typeof endLine !== "number") {
		return
	}
	const currentData = directive.data ?? {}
	directive.data = {
		...currentData,
		[DIRECTIVE_END_LINE_KEY]: endLine,
	}
}

const isTextOverPictureDirectiveNode = (node: DirectiveContentNode): node is ContainerDirectiveNode => {
	return isContainerDirectiveNode(node) && node.name === TEXT_OVER_PICTURE_DIRECTIVE
}

const isAnchorDirectiveNode = (node: DirectiveContentNode): node is ContainerDirectiveNode => {
	return isContainerDirectiveNode(node) && node.name === "anchor"
}

const getDirectiveLineValue = (node: ContainerDirectiveNode, key: string): number | null => {
	const value = node.data?.[key]
	return typeof value === "number" ? value : null
}

const getCurrentScopeChildren = (
	stack: OpenDirectiveFrame[],
	out: DirectiveContentNode[],
): DirectiveContentNode[] => {
	const frame = stack[stack.length - 1]
	return frame ? frame.directive.children : out
}

const getLastMeaningfulScopeNode = (
	stack: OpenDirectiveFrame[],
	out: DirectiveContentNode[],
): DirectiveContentNode | null => {
	const scopeNodes = getCurrentScopeChildren(stack, out)
	for (let index = scopeNodes.length - 1; index >= 0; index -= 1) {
		const candidate = scopeNodes[index]
		if (!candidate) {
			continue
		}
		if (isParagraph(candidate) && isWhitespaceParagraphNode(candidate)) {
			continue
		}
		return candidate
	}
	return null
}

const consumeOptionalAnchorClosing = (
	stack: OpenDirectiveFrame[],
	out: DirectiveContentNode[],
	closingCount: number,
): number => {
	if (closingCount <= 0) {
		return closingCount
	}
	const lastNode = getLastMeaningfulScopeNode(stack, out)
	if (!lastNode || !isAnchorDirectiveNode(lastNode)) {
		return closingCount
	}
	return closingCount - 1
}

const isSameSourceRow = (left: ContainerDirectiveNode, right: ContainerDirectiveNode): boolean => {
	const leftEndLine = getDirectiveLineValue(left, DIRECTIVE_END_LINE_KEY)
	const rightStartLine = getDirectiveLineValue(right, DIRECTIVE_START_LINE_KEY)
	if (typeof leftEndLine !== "number" || typeof rightStartLine !== "number") {
		return false
	}
	return rightStartLine - leftEndLine <= 1
}

const wrapTextOverPictureRows = (nodes: DirectiveContentNode[]): { nodes: DirectiveContentNode[]; changed: boolean } => {
	const wrapped: DirectiveContentNode[] = []
	let changed = false
	let cursor = 0

	while (cursor < nodes.length) {
		const candidate = nodes[cursor]
		if (!candidate || !isTextOverPictureDirectiveNode(candidate)) {
			wrapped.push(candidate as DirectiveContentNode)
			cursor += 1
			continue
		}

		const group: DirectiveContentNode[] = [candidate]
		let groupCursor = cursor + 1
		let lastDirective = candidate
		while (groupCursor < nodes.length) {
			const nextCandidate = nodes[groupCursor]
			if (!nextCandidate || !isTextOverPictureDirectiveNode(nextCandidate)) {
				break
			}
			if (!isSameSourceRow(lastDirective, nextCandidate)) {
				break
			}
			group.push(nextCandidate)
			lastDirective = nextCandidate
			groupCursor += 1
		}

		if (group.length > 1) {
			wrapped.push(createHtmlNode(`<div class="text-over-picture-row">`))
			wrapped.push(...group)
			wrapped.push(createHtmlNode(`</div>`))
			changed = true
		} else {
			wrapped.push(group[0] as DirectiveContentNode)
		}

		cursor = groupCursor
	}

	return { nodes: wrapped, changed }
}

const parseAttributes = (raw: string, file: VFile, node: Paragraph): AttributeMap => {
	const attributes: AttributeMap = {}
	let index = 0

	while (index < raw.length) {
		while (index < raw.length && /\s/.test(raw[index])) {
			index += 1
		}

		if (index >= raw.length) {
			break
		}

		const keyMatch = /^[a-zA-Z][a-zA-Z0-9-]*/.exec(raw.slice(index))
		if (!keyMatch) {
			file.fail(`Ungültiges Attribut in Modul-Definition: "${raw.slice(index).trim()}".`, node)
		}
		const key = keyMatch![0]
		index += key.length

		while (index < raw.length && /\s/.test(raw[index])) {
			index += 1
		}

		if (raw[index] !== "=") {
			file.fail(`Nach Attribut "${key}" wird ein "=" erwartet.`, node)
		}
		index += 1

		while (index < raw.length && /\s/.test(raw[index])) {
			index += 1
		}

		const quote = raw[index]
		if (quote !== '"' && quote !== "'") {
			file.fail(`Attribute müssen in einfachen oder doppelten Anführungszeichen stehen (Fehler bei "${key}").`, node)
		}
		index += 1

		let value = ""
		while (index < raw.length && raw[index] !== quote) {
			value += raw[index]
			index += 1
		}

		if (raw[index] !== quote) {
			file.fail(`Unvollständiger Wert für Attribut "${key}".`, node)
		}
		index += 1

		attributes[key] = value
	}

	return attributes
}

const extractDirectiveMeta = (
	node: Paragraph,
	file: VFile,
): { name: string; attributes: AttributeMap; remainingLines: string[] } | null => {
	const lines = extractRawParagraphLines(node, file)
	if (!lines || lines.length === 0) {
		return null
	}

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
		const line = lines[lineIndex] ?? ""
		if (line.trim().length === 0) {
			continue
		}
		const match = OPEN_PATTERN.exec(line.trim())
		if (!match) {
			return null
		}

		const [, name, remaining = ""] = match
		const trimmed = remaining.trim()
		const attributes = trimmed.length > 0 ? parseAttributes(trimmed, file, node) : {}
		const remainingLines = [...lines]
		remainingLines[lineIndex] = ""
		return { name, attributes, remainingLines }
	}

	return null
}

interface SelfClosingDirectiveLineMeta {
	name: string
	attributes: AttributeMap
}

const extractSelfClosingDirectiveLineMetas = (node: Paragraph, file: VFile): SelfClosingDirectiveLineMeta[] | null => {
	let rawText = ""
	for (const child of node.children) {
		if (child.type === "text") {
			rawText += child.value
			continue
		}
		if (child.type === "break") {
			rawText += "\n"
			continue
		}
		return null
	}

	const lines = rawText
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.filter((line) => line.length > 0)

	if (lines.length < 2) {
		return null
	}

	const metas: SelfClosingDirectiveLineMeta[] = []
	for (const line of lines) {
		const match = OPEN_PATTERN.exec(line)
		if (!match) {
			return null
		}
		const [, name, remaining = ""] = match
		const moduleEntry = getDirectiveModule(name)
		if (!moduleEntry) {
			failUnknownDirective(file, name, node)
		}
		if (moduleEntry?.selfClosing !== true) {
			return null
		}

		const trimmed = remaining.trim()
		const attributes = trimmed.length > 0 ? parseAttributes(trimmed, file, node) : {}
		metas.push({ name, attributes })
	}

	return metas
}

const countTrailingClosings = (value: string): number => {
	let index = 0
	let count = 0

	while (index < value.length) {
		while (index < value.length && /\s/.test(value[index])) {
			index += 1
		}
		if (index >= value.length) {
			break
		}
		if (isStandaloneClosingToken(value, index)) {
			count += 1
			index += 3
			continue
		}
		return 0
	}

	return count
}

const isStandaloneClosingToken = (value: string, startIndex: number): boolean => {
	if (!value.startsWith(":::", startIndex)) {
		return false
	}
	const nextCharacter = value[startIndex + 3]
	return nextCharacter === undefined || /\s/.test(nextCharacter)
}

const countLeadingClosings = (value: string): { count: number; consumedLength: number } => {
	let index = 0
	let count = 0

	while (index < value.length) {
		while (index < value.length && /\s/.test(value[index])) {
			index += 1
		}
		if (index >= value.length) {
			break
		}
		if (isStandaloneClosingToken(value, index)) {
			count += 1
			index += 3
			continue
		}
		break
	}

	return {
		count,
		consumedLength: index,
	}
}

const isDirectiveMarkerLine = (line: string): boolean => {
	const trimmedLine = line.trim()
	if (trimmedLine.length === 0) {
		return false
	}
	if (OPEN_PATTERN.exec(trimmedLine)) {
		return true
	}
	return countTrailingClosings(trimmedLine) > 0
}

const extractRawParagraphLines = (node: Paragraph, file: VFile): string[] | null => {
	let rawFromNode: string | null = ""
	for (const child of node.children) {
		if (child.type === "text") {
			rawFromNode += child.value
			continue
		}
		if (child.type === "html") {
			rawFromNode += child.value
			continue
		}
		if (child.type === "break") {
			rawFromNode += "\n"
			continue
		}
		rawFromNode = null
		break
	}

	const startLine = getNodeStartLine(node)
	const endLine = getNodeEndLine(node)
	if (typeof startLine === "number" && typeof endLine === "number" && endLine >= startLine) {
		const sourceLines = getSourceLines(file)
		const slicedLines = sourceLines.slice(startLine - 1, endLine)
		if (slicedLines.length === endLine - startLine + 1) {
			if (typeof rawFromNode === "string") {
				const normalizedSource = slicedLines.join("\n").replace(/\r\n?/gu, "\n")
				const normalizedNode = rawFromNode.replace(/\r\n?/gu, "\n")
				if (normalizedSource !== normalizedNode) {
					return normalizedNode.split("\n")
				}
			}
			return slicedLines
		}
	}

	if (rawFromNode === null) {
		return null
	}
	return rawFromNode.replace(/\r\n?/gu, "\n").split("\n")
}

const paragraphChildrenFromRawText = (rawText: string): Paragraph["children"] => {
	const lines = rawText.replace(/\r\n?/gu, "\n").split("\n")
	const children: Paragraph["children"] = []
	for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
		const line = lines[lineIndex]
		if (line.length > 0) {
			children.push({ type: "text", value: line })
		}
		if (lineIndex < lines.length - 1) {
			children.push({ type: "break" })
		}
	}
	return children
}

const getSourceLines = (file: VFile): string[] => {
	const raw = typeof file.value === "string" ? file.value : file.toString()
	return raw.replace(/\r\n?/gu, "\n").split("\n")
}

const normalizeDirectiveScopedIndentationForParsing = (rawSource: string): string => {
	const normalizedSource = rawSource.replace(/\r\n?/gu, "\n")
	const hasTrailingNewline = normalizedSource.endsWith("\n")
	const sourceLines = normalizedSource.split("\n")
	if (hasTrailingNewline) {
		sourceLines.pop()
	}

	const normalizedLines: string[] = []
	let directiveDepth = 0
	let activeFence: FenceState | null = null

	for (const sourceLine of sourceLines) {
		const trimmedLine = sourceLine.trim()
		const trimmedStartLine = sourceLine.trimStart()
		const leadingSpaces = countLeadingSpacesInLine(sourceLine)

		let nextLine = sourceLine
		if (!activeFence && directiveDepth > 0 && trimmedLine.length > 0 && leadingSpaces >= 4) {
			nextLine = `  ${trimmedStartLine}`
		}
		normalizedLines.push(nextLine)

		if (activeFence) {
			if (isFenceCloseLine(sourceLine, activeFence)) {
				activeFence = null
			}
			continue
		}

		const openedFence = parseFenceState(sourceLine)
		if (openedFence) {
			activeFence = openedFence
			continue
		}

		if (CLOSE_PATTERN.test(trimmedLine)) {
			directiveDepth = Math.max(directiveDepth - 1, 0)
			continue
		}

		const openMatch = OPEN_PATTERN.exec(trimmedLine)
		if (!openMatch) {
			continue
		}
		const directiveName = openMatch[1] ?? ""
		const moduleEntry = getDirectiveModule(directiveName)
		const isSelfClosing = moduleEntry?.selfClosing === true
		if (!isSelfClosing) {
			directiveDepth += 1
		}
	}

	const serialized = normalizedLines.join("\n")
	return hasTrailingNewline ? `${serialized}\n` : serialized
}

const isFencedCodeStart = (line: string): boolean => /^\s*(`{3,}|~{3,})/u.test(line)

const countLeadingSpacesInLine = (line: string): number => {
	let count = 0
	while (count < line.length && line[count] === " ") {
		count += 1
	}
	return count
}

const stripLeadingSpaces = (line: string, removeCount: number): string => {
	let cursor = 0
	while (cursor < line.length && cursor < removeCount && line[cursor] === " ") {
		cursor += 1
	}
	return line.slice(cursor)
}

const dedentRecoveredCodeValue = (value: string): string => {
	const normalizedLines = value.replace(/\r\n?/gu, "\n").split("\n")
	const firstNonEmptyLine = normalizedLines.find((line) => line.trim().length > 0)
	if (!firstNonEmptyLine) {
		return value
	}
	const baseIndent = countLeadingSpacesInLine(firstNonEmptyLine)
	if (baseIndent === 0) {
		return value
	}
	return normalizedLines.map((line) => stripLeadingSpaces(line, baseIndent)).join("\n")
}

const shiftNodeLinePositions = (node: unknown, lineOffset: number): void => {
	if (!node || typeof node !== "object" || lineOffset === 0) {
		return
	}

	const position = (node as { position?: { start?: { line?: number }; end?: { line?: number } } }).position
	if (position?.start?.line) {
		position.start.line += lineOffset
	}
	if (position?.end?.line) {
		position.end.line += lineOffset
	}

	if (hasChildren(node)) {
		for (const child of node.children) {
			shiftNodeLinePositions(child, lineOffset)
		}
	}
}

const parseFragmentToNodes = (rawText: string, sourceStartLine: number | null): DirectiveContentNode[] => {
	if (rawText.trim().length === 0) {
		return []
	}
	const parsedRoot = unified().use(remarkParse).parse(rawText) as Root
	const parsedNodes = [...(parsedRoot.children as unknown as DirectiveContentNode[])]
	if (typeof sourceStartLine === "number") {
		const lineOffset = sourceStartLine - 1
		for (const child of parsedNodes) {
			shiftNodeLinePositions(child, lineOffset)
		}
	}
	return parsedNodes
}

const recoverDirectiveCodeBlock = (node: Code, file: VFile): DirectiveContentNode[] | null => {
	if (typeof node.value !== "string" || node.value.trim().length === 0) {
		return null
	}

	const sourceStartLine = getNodeStartLine(node)
	const sourceLines = getSourceLines(file)
	if (typeof sourceStartLine === "number") {
		const sourceLine = sourceLines[sourceStartLine - 1] ?? ""
		if (isFencedCodeStart(sourceLine)) {
			return null
		}
	}

	const hasDirectiveMarker = node.value
		.replace(/\r\n?/gu, "\n")
		.split("\n")
		.some((line) => isDirectiveMarkerLine(line))
	if (!hasDirectiveMarker) {
		return null
	}

	const recoveredSource = dedentRecoveredCodeValue(node.value)
	const recoveredTree = unified().use(remarkParse).parse(recoveredSource) as Root
	const recoveredChildren = [...(recoveredTree.children as unknown as DirectiveContentNode[])]
	if (recoveredChildren.length === 1 && isCodeNode(recoveredChildren[0]) && recoveredChildren[0].value === node.value) {
		return null
	}

	if (typeof sourceStartLine === "number") {
		const lineOffset = sourceStartLine - 1
		for (const child of recoveredChildren) {
			shiftNodeLinePositions(child, lineOffset)
		}
	}

	return recoveredChildren
}

const recoverDirectiveHtmlBlock = (node: HTML): DirectiveContentNode[] | null => {
	if (typeof node.value !== "string" || node.value.trim().length === 0) {
		return null
	}

	const sourceLines = node.value.replace(/\r\n?/gu, "\n").split("\n")
	const firstDirectiveLineIndex = sourceLines.findIndex((line) => isDirectiveMarkerLine(line))
	if (firstDirectiveLineIndex < 0) {
		return null
	}

	const htmlPrefixLines = sourceLines.slice(0, firstDirectiveLineIndex)
	const directiveLines = sourceLines.slice(firstDirectiveLineIndex)
	if (directiveLines.length === 0) {
		return null
	}

	const directiveStartLine = getNodeStartLine(node)
	const fragmentStartLine = typeof directiveStartLine === "number" ? directiveStartLine + firstDirectiveLineIndex : null
	const recoveredDirectiveNodes = parseFragmentToNodes(directiveLines.join("\n"), fragmentStartLine)
	if (recoveredDirectiveNodes.length === 0) {
		return null
	}

	const recoveredNodes: DirectiveContentNode[] = []
	const htmlPrefixValue = htmlPrefixLines.join("\n")
	if (htmlPrefixValue.trim().length > 0) {
		const htmlPrefixNode: HTML = {
			...node,
			value: htmlPrefixValue,
		}
		const startLine = getNodeStartLine(node)
		const prefixEndLine = typeof startLine === "number" ? startLine + htmlPrefixLines.length - 1 : null
		if (typeof startLine === "number" && typeof prefixEndLine === "number") {
			const sourcePosition = (node as { position?: { start?: Record<string, unknown>; end?: Record<string, unknown> } }).position
			;(htmlPrefixNode as { position?: unknown }).position = {
				...(sourcePosition ?? {}),
				start: {
					...(sourcePosition?.start ?? {}),
					line: startLine,
				},
				end: {
					...(sourcePosition?.end ?? {}),
					line: prefixEndLine,
				},
			}
		}
		recoveredNodes.push(htmlPrefixNode as unknown as DirectiveContentNode)
	}

	recoveredNodes.push(...recoveredDirectiveNodes)
	return recoveredNodes
}

const createParagraphFromChildren = (template: Paragraph, children: Paragraph["children"]): Paragraph | null => {
	if (children.length === 0) {
		return null
	}
	return {
		...template,
		children,
	}
}

const createParagraphFromLines = (template: Paragraph, lines: string[], startLineOffset: number): Paragraph | null => {
	if (lines.length === 0) {
		return null
	}
	const children = paragraphChildrenFromRawText(lines.join("\n"))
	if (children.length === 0) {
		return null
	}

	const nextNode: Paragraph = {
		...template,
		children,
	}
	const sourceStartLine = getNodeStartLine(template)
	if (typeof sourceStartLine === "number") {
		const sourcePosition = (template as { position?: { start?: Record<string, unknown>; end?: Record<string, unknown> } }).position
		const segmentStartLine = sourceStartLine + startLineOffset
		const segmentEndLine = segmentStartLine + lines.length - 1
		;(nextNode as { position?: unknown }).position = {
			...(sourcePosition ?? {}),
			start: {
				...(sourcePosition?.start ?? {}),
				line: segmentStartLine,
			},
			end: {
				...(sourcePosition?.end ?? {}),
				line: segmentEndLine,
			},
		}
	}
	return nextNode
}

const splitParagraphByDirectiveMarkerLines = (node: Paragraph, file: VFile): DirectiveContentNode[] | null => {
	const lines = extractRawParagraphLines(node, file)
	if (!lines || lines.length < 2) {
		return null
	}
	const firstNonEmptyLine = lines.find((line) => line.trim().length > 0)?.trimStart() ?? ""
	if (LIST_MARKER_PATTERN.test(firstNonEmptyLine) || BLOCKQUOTE_MARKER_PATTERN.test(firstNonEmptyLine)) {
		return null
	}
	const nodeStartLine = getNodeStartLine(node)

	const hasDirectiveMarkers = lines.some((line) => isDirectiveMarkerLine(line))
	if (!hasDirectiveMarkers) {
		return null
	}

	const selfClosingDirectiveRow = extractSelfClosingDirectiveLineMetas(node, file)
	if (selfClosingDirectiveRow) {
		return null
	}

	type DirectiveLineInfo = {
		kind: "opening" | "closing"
		selfClosingOpening: boolean
	}

	const getDirectiveLineInfo = (line: string): DirectiveLineInfo => {
		const trimmedLine = line.trim()
		const openingMatch = OPEN_PATTERN.exec(trimmedLine)
		if (openingMatch) {
			const directiveName = openingMatch[1] ?? ""
			const moduleEntry = getDirectiveModule(directiveName)
			if (!moduleEntry) {
				failUnknownDirective(file, directiveName, node)
			}
			return {
				kind: "opening",
				selfClosingOpening: moduleEntry?.selfClosing === true,
			}
		}
		return {
			kind: "closing",
			selfClosingOpening: false,
		}
	}

	const splitDirectiveSegmentIntoParagraphs = (segmentLines: string[], segmentStartOffset: number): DirectiveContentNode[] => {
		const nodes: DirectiveContentNode[] = []
		let lineCursor = 0

		while (lineCursor < segmentLines.length) {
			const currentLine = segmentLines[lineCursor] ?? ""
			const currentInfo = getDirectiveLineInfo(currentLine)
			if (currentInfo.kind === "opening" && currentInfo.selfClosingOpening) {
				let batchEnd = lineCursor + 1
				while (batchEnd < segmentLines.length) {
					const nextInfo = getDirectiveLineInfo(segmentLines[batchEnd] ?? "")
					if (nextInfo.kind !== "opening" || !nextInfo.selfClosingOpening) {
						break
					}
					batchEnd += 1
				}
				const paragraph = createParagraphFromLines(node, segmentLines.slice(lineCursor, batchEnd), segmentStartOffset + lineCursor)
				if (paragraph) {
					nodes.push(paragraph)
				}
				lineCursor = batchEnd
				continue
			}

			const paragraph = createParagraphFromLines(node, [currentLine], segmentStartOffset + lineCursor)
			if (paragraph) {
				nodes.push(paragraph)
			}
			lineCursor += 1
		}

		return nodes
	}

	const hasRegularLines = lines.some((line) => !isDirectiveMarkerLine(line))
	if (!hasRegularLines) {
		const splitDirectiveParagraphs = splitDirectiveSegmentIntoParagraphs(lines, 0)
		return splitDirectiveParagraphs.length > 1 ? splitDirectiveParagraphs : null
	}

	const segments: DirectiveContentNode[] = []
	let segmentStart = 0
	let segmentLines: string[] = []
	let segmentIsDirective: boolean | null = null

	const flushSegment = (): void => {
		if (segmentLines.length === 0 || segmentIsDirective === null) {
			segmentLines = []
			return
		}
		if (segmentIsDirective && segmentLines.length > 1) {
			segments.push(...splitDirectiveSegmentIntoParagraphs(segmentLines, segmentStart))
			segmentLines = []
			return
		}
		const fragmentStartLine = typeof nodeStartLine === "number" ? nodeStartLine + segmentStart : null
		const parsedSegmentNodes = parseFragmentToNodes(segmentLines.join("\n"), fragmentStartLine)
		segments.push(...parsedSegmentNodes)
		segmentLines = []
	}

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
		const line = lines[lineIndex] ?? ""
		const lineIsDirective = isDirectiveMarkerLine(line)
		if (segmentIsDirective === null) {
			segmentIsDirective = lineIsDirective
			segmentStart = lineIndex
		} else if (segmentIsDirective !== lineIsDirective) {
			flushSegment()
			segmentIsDirective = lineIsDirective
			segmentStart = lineIndex
		}
		segmentLines.push(line)
	}
	flushSegment()

	return segments.length > 1 ? segments : null
}

const normalizeParagraphDirectiveBoundaries = (nodes: DirectiveContentNode[], file: VFile): { nodes: DirectiveContentNode[]; changed: boolean } => {
	const normalized: DirectiveContentNode[] = []
	let changed = false

	for (const node of nodes) {
		if (!isParagraph(node)) {
			normalized.push(node)
			continue
		}

		const splitNodes = splitParagraphByDirectiveMarkerLines(node, file)
		if (!splitNodes) {
			normalized.push(node)
			continue
		}

		normalized.push(...splitNodes)
		changed = true
	}

	return { nodes: normalized, changed }
}

interface SplitClosingMarkersResult {
	count: number
	beforeNode: Paragraph | null
	afterNode: Paragraph | null
}

const splitClosingMarkers = (node: Paragraph): SplitClosingMarkersResult => {
	for (let childIndex = 0; childIndex < node.children.length; childIndex += 1) {
		const child = node.children[childIndex]
		if (child.type !== "text") {
			continue
		}

		let closingPosition = child.value.indexOf(":::")
		while (closingPosition !== -1 && !isStandaloneClosingToken(child.value, closingPosition)) {
			closingPosition = child.value.indexOf(":::", closingPosition + 3)
		}
		if (closingPosition === -1) {
			continue
		}

		let tail = child.value.slice(closingPosition)
		let hasUnsupportedTailChild = false
		for (let nextIndex = childIndex + 1; nextIndex < node.children.length; nextIndex += 1) {
			const nextChild = node.children[nextIndex]
			if (nextChild.type === "text") {
				tail += nextChild.value
				continue
			}
			if (nextChild.type === "break") {
				tail += "\n"
				continue
			}
			hasUnsupportedTailChild = true
			break
		}

		if (hasUnsupportedTailChild) {
			continue
		}

		const closingInfo = countLeadingClosings(tail)
		if (closingInfo.count === 0) {
			continue
		}

		const beforeText = child.value.slice(0, closingPosition).replace(/\s+$/u, "")
		const beforeChildren = node.children.slice(0, childIndex) as Paragraph["children"]
		if (beforeText.length > 0) {
			beforeChildren.push({ type: "text", value: beforeText })
		}
		const beforeNode = createParagraphFromChildren(node, beforeChildren)

		const afterText = tail.slice(closingInfo.consumedLength).replace(/^\s+/u, "")
		const afterChildren = paragraphChildrenFromRawText(afterText)
		const afterNode = createParagraphFromChildren(node, afterChildren)

		return {
			count: closingInfo.count,
			beforeNode,
			afterNode,
		}
	}

	return {
		count: 0,
		beforeNode: null,
		afterNode: null,
	}
}

const stripClosingMarkers = (node: Paragraph): { count: number; keepNode: boolean } => {
	for (let childIndex = 0; childIndex < node.children.length; childIndex += 1) {
		const child = node.children[childIndex]
		if (child.type !== "text") {
			continue
		}

		const closingPosition = child.value.indexOf(":::")
		if (closingPosition === -1) {
			continue
		}

		let tail = child.value.slice(closingPosition)
		let hasUnsupportedTailChild = false
		for (let nextIndex = childIndex + 1; nextIndex < node.children.length; nextIndex += 1) {
			const nextChild = node.children[nextIndex]
			if (nextChild.type === "text") {
				tail += nextChild.value
				continue
			}
			if (nextChild.type === "break") {
				tail += "\n"
				continue
			}
			hasUnsupportedTailChild = true
			break
		}

		if (hasUnsupportedTailChild) {
			continue
		}

		const closingCount = countTrailingClosings(tail)
		if (closingCount === 0) {
			continue
		}

		const before = child.value.slice(0, closingPosition).replace(/\s+$/u, "")
		const retainedChildren = node.children.slice(0, childIndex)
		if (before.length > 0) {
			retainedChildren.push({ type: "text", value: before })
		}
		node.children = retainedChildren as Paragraph["children"]
		return { count: closingCount, keepNode: node.children.length > 0 }
	}

	return { count: 0, keepNode: true }
}

interface NestedClosingResult {
	count: number
	locationNode: Paragraph | DirectiveContentNode
}

const extractNestedTrailingClosings = (node: DirectiveContentNode): NestedClosingResult => {
	if (isParagraph(node)) {
		const closing = stripClosingMarkers(node)
		return {
			count: closing.count,
			locationNode: node,
		}
	}

	if (!hasChildren(node)) {
		return {
			count: 0,
			locationNode: node,
		}
	}

	const children = node.children as DirectiveContentNode[]
	for (let index = children.length - 1; index >= 0; index -= 1) {
		const candidate = children[index]
		const nested = extractNestedTrailingClosings(candidate)
		if (nested.count > 0) {
			if (isParagraph(candidate) && candidate.children.length === 0) {
				children.splice(index, 1)
			}
			return nested
		}

		if (isParagraph(candidate) && isWhitespaceParagraphNode(candidate)) {
			continue
		}
		break
	}

	return {
		count: 0,
		locationNode: node,
	}
}

const isWhitespaceParagraphNode = (node: Paragraph): boolean => {
	return node.children.every((child) => {
		if (child.type === "text") {
			return child.value.trim().length === 0
		}
		return child.type === "break"
	})
}

interface OpenDirectiveFrame {
	directive: ContainerDirectiveNode
	opener: Paragraph
}

const appendToCurrentScope = (stack: OpenDirectiveFrame[], out: DirectiveContentNode[], node: DirectiveContentNode): void => {
	const frame = stack[stack.length - 1]
	if (frame) {
		frame.directive.children.push(node)
		return
	}
	out.push(node)
}

const failUnknownDirective = (file: VFile, name: string, node: Paragraph | ContainerDirectiveNode): never => {
	if (name.includes("/")) {
		file.fail(
			`Content-Block "${name}" wurde nicht gefunden. Lege die Datei "content-blocks/${name}.md" an.`,
			node as unknown as never,
		)
		throw new Error("Unreachable: vfile.fail did not throw.")
	}
	file.fail(
		`Unbekanntes Modul "${name}". Verfügbare Module: ${getKnownDirectiveNames().join(", " ) || "(keine)"}. ` +
			`Lege alternativ eine Datei "content-blocks/${name}.md" an, um "${name}" als Content-Block zu nutzen.`,
		node as unknown as never,
	)
	throw new Error("Unreachable: vfile.fail did not throw.")
}

const parseDirectivesInParent = (parent: Parent, file: VFile): boolean => {
	let changed = false
	const out: DirectiveContentNode[] = []
	const stack: OpenDirectiveFrame[] = []
	const normalizedNodes = normalizeParagraphDirectiveBoundaries([...(parent.children as unknown[] as DirectiveContentNode[])], file)
	if (normalizedNodes.changed) {
		changed = true
	}
	const inputNodes = [...normalizedNodes.nodes]

	for (let inputIndex = 0; inputIndex < inputNodes.length; inputIndex += 1) {
		const child = inputNodes[inputIndex] as DirectiveContentNode

		if (isCodeNode(child)) {
			const recoveredNodes = recoverDirectiveCodeBlock(child, file)
			if (recoveredNodes && recoveredNodes.length > 0) {
				inputNodes.splice(inputIndex, 1, ...recoveredNodes)
				inputIndex -= 1
				changed = true
				continue
			}
		}

		if (isHtmlNode(child)) {
			const recoveredNodes = recoverDirectiveHtmlBlock(child)
			if (recoveredNodes && recoveredNodes.length > 0) {
				inputNodes.splice(inputIndex, 1, ...recoveredNodes)
				inputIndex -= 1
				changed = true
				continue
			}
		}

		if (isParagraph(child)) {
			const selfClosingMetas = extractSelfClosingDirectiveLineMetas(child, file)
			if (selfClosingMetas) {
				const directives = selfClosingMetas.map<ContainerDirectiveNode>((meta) => ({
					type: "containerDirective",
					name: meta.name,
					attributes: meta.attributes,
					children: [],
				}))
				for (const directive of directives) {
					annotateDirectiveLinesFromNode(directive, child)
				}
				const isInlineLinkRow = directives.length > 1 && directives.every((directive) => directive.name === "link")
				if (isInlineLinkRow) {
					appendToCurrentScope(stack, out, createHtmlNode(`<div class="link-module-row">`))
				}
				for (const directive of directives) {
					appendToCurrentScope(stack, out, directive)
				}
				if (isInlineLinkRow) {
					appendToCurrentScope(stack, out, createHtmlNode(`</div>`))
				}
				changed = true
				continue
			}

			const meta = extractDirectiveMeta(child, file)
			if (meta) {
				const { name, attributes, remainingLines } = meta
				const moduleEntry = getDirectiveModule(name)
				if (!moduleEntry) {
					failUnknownDirective(file, name, child)
				}
				const resolvedModuleEntry = moduleEntry as NonNullable<typeof moduleEntry>

				const openerContentNodes = parseFragmentToNodes(
					remainingLines.join("\n"),
					getNodeStartLine(child),
				)

				const directiveNode: ContainerDirectiveNode = {
					type: "containerDirective",
					name,
					attributes,
					children: [],
				}
				annotateDirectiveLinesFromNode(directiveNode, child)

				for (const openerContentNode of openerContentNodes) {
					if (isParagraph(openerContentNode) && isWhitespaceParagraphNode(openerContentNode)) {
						continue
					}
					directiveNode.children.push(openerContentNode)
				}

				const inlineClosing = stripClosingMarkers(child)
				if (resolvedModuleEntry.selfClosing === true || inlineClosing.count > 0) {
					appendToCurrentScope(stack, out, directiveNode)
					const consumedByCurrentDirective = resolvedModuleEntry.selfClosing === true ? 0 : inlineClosing.count > 0 ? 1 : 0
					const remainingClosings = Math.max(inlineClosing.count - consumedByCurrentDirective, 0)
					for (let closeIndex = 0; closeIndex < remainingClosings; closeIndex += 1) {
						const frame = stack.pop()
						if (!frame) {
							file.fail("Unerwarteter Abschluss \":::\" ohne öffnendes Modul.", child)
						}
						setDirectiveEndLineFromNode(frame.directive, child)
						appendToCurrentScope(stack, out, frame.directive)
					}
					changed = true
					continue
				}

				stack.push({ directive: directiveNode, opener: child })
				changed = true
				continue
			}

			const closing = splitClosingMarkers(child)
			if (closing.count > 0) {
				let remainingClosingCount = closing.count
				if (!closing.beforeNode || isWhitespaceParagraphNode(closing.beforeNode)) {
					remainingClosingCount = consumeOptionalAnchorClosing(stack, out, remainingClosingCount)
				}
				if (remainingClosingCount === 0) {
					changed = true
					continue
				}
				if (stack.length === 0 || stack.length < remainingClosingCount) {
					file.fail("Unerwarteter Abschluss \":::\" ohne öffnendes Modul.", child)
				}
				if (closing.beforeNode && !isWhitespaceParagraphNode(closing.beforeNode)) {
					appendToCurrentScope(stack, out, closing.beforeNode)
				}
				for (let index = 0; index < remainingClosingCount; index += 1) {
					const frame = stack.pop()
					if (!frame) {
						file.fail("Unerwarteter Abschluss \":::\" ohne öffnendes Modul.", child)
					}
					setDirectiveEndLineFromNode(frame.directive, child)
					appendToCurrentScope(stack, out, frame.directive)
				}
				if (closing.afterNode && !isWhitespaceParagraphNode(closing.afterNode)) {
					inputNodes.splice(inputIndex + 1, 0, closing.afterNode)
				}
				changed = true
				continue
			}
		}

		const nestedClosing = extractNestedTrailingClosings(child)
		if (nestedClosing.count > 0) {
			if (stack.length === 0 || stack.length < nestedClosing.count) {
				file.fail("Unerwarteter Abschluss \":::\" ohne öffnendes Modul.", nestedClosing.locationNode)
			}
			appendToCurrentScope(stack, out, child)
			for (let index = 0; index < nestedClosing.count; index += 1) {
				const frame = stack.pop()
				if (!frame) {
					file.fail("Unerwarteter Abschluss \":::\" ohne öffnendes Modul.", nestedClosing.locationNode)
				}
				setDirectiveEndLineFromNode(frame.directive, nestedClosing.locationNode)
				appendToCurrentScope(stack, out, frame.directive)
			}
			changed = true
			continue
		}

		appendToCurrentScope(stack, out, child)
	}

	if (stack.length > 0) {
		const open = stack[stack.length - 1]
		file.fail(`Fehlender Abschluss ":::" für Modul "${open.directive.name}".`, open.opener)
	}

	const wrappedRows = wrapTextOverPictureRows(out)
	if (wrappedRows.changed) {
		changed = true
	}
	parent.children = wrappedRows.nodes as unknown as Parent["children"]

	for (const child of parent.children as unknown[]) {
		if (hasChildren(child)) {
			if (parseDirectivesInParent(child as unknown as Parent, file)) {
				changed = true
			}
		}
	}

	return changed
}

const isContainerDirectiveNode = (node: unknown): node is ContainerDirectiveNode => {
	return (node as ContainerDirectiveNode)?.type === "containerDirective"
}

const collectHeadingTextForSlug = (nodes: unknown[]): string => {
	let combined = ""
	for (const node of nodes) {
		if (isTextLikeNode(node)) {
			combined += node.value
			continue
		}
		if (hasChildren(node)) {
			combined += collectHeadingTextForSlug(node.children)
		}
	}
	return combined
}

const resolveHeadingId = (
	node: { children: unknown[]; data?: Record<string, unknown> },
	slugger: GithubSlugger,
): string | null => {
	const customId = (node.data?.hProperties as { id?: unknown } | undefined)?.id
	if (typeof customId === "string" && customId.trim().length > 0) {
		return customId.trim()
	}
	const headingText = collectHeadingTextForSlug(node.children)
	if (headingText.trim().length === 0) {
		return null
	}
	return slugger.slug(headingText)
}

const extractAnchorIdFromHtmlValue = (value: string): string | undefined => {
	if (!ANCHOR_MODULE_MARKER_PATTERN.test(value)) {
		return undefined
	}
	const idMatch = /\bid=(["'])(.*?)\1/iu.exec(value)
	if (!idMatch) {
		return ""
	}
	return idMatch[2] ?? ""
}

const validateAnchorIdUniqueness = (tree: Root, file: VFile): void => {
	const slugger = new GithubSlugger()
	const usedAnchors = new Map<string, { source: string }>()

	const registerAnchorId = (anchorId: string, source: string, node: unknown): void => {
		const existing = usedAnchors.get(anchorId)
		if (existing) {
			file.fail(
				`Die Anchor-ID "${anchorId}" ist doppelt vergeben (${existing.source} und ${source}). Bitte nutze eindeutige Anchor-Namen.`,
				node as never,
			)
		}
		usedAnchors.set(anchorId, { source })
	}

	const collectFromParent = (parent: Parent): void => {
		for (const child of parent.children as unknown[]) {
			if (isHeadingNode(child)) {
				const headingId = resolveHeadingId(child, slugger)
				if (headingId && headingId.length > 0) {
					registerAnchorId(headingId, "Überschrift", child)
				}
			}
			if (isHtmlNode(child)) {
				const anchorId = extractAnchorIdFromHtmlValue(child.value)
				if (anchorId !== undefined) {
					if (anchorId.trim().length === 0) {
						file.fail(`Das Modul "anchor" konnte keine gültige ID erzeugen.`, child)
					}
					if (!ANCHOR_ID_PATTERN.test(anchorId)) {
						file.fail(
							`Die Anchor-ID "${anchorId}" ist ungültig. Erlaubt sind Kleinbuchstaben, Zahlen und Bindestriche.`,
							child,
						)
					}
					registerAnchorId(anchorId, "anchor-Modul", child)
				}
			}
			if (hasChildren(child)) {
				collectFromParent(child as unknown as Parent)
			}
		}
	}

	collectFromParent(tree as unknown as Parent)
}

const renderDirectivesInParent = (parent: Parent, file: VFile): boolean => {
	let changed = false
	for (let index = 0; index < parent.children.length; index += 1) {
		const candidate = (parent.children as unknown[])[index]

		if (isContainerDirectiveNode(candidate)) {
			const moduleEntry = getDirectiveModule(candidate.name)
			if (!moduleEntry) {
				failUnknownDirective(file, candidate.name, candidate)
			}
			const resolvedModuleEntry = moduleEntry as NonNullable<typeof moduleEntry>
			const replacementNodes = resolvedModuleEntry.render({ node: candidate, file })
			const children = parent.children as unknown[]
			children.splice(index, 1, ...(replacementNodes as unknown as Parent["children"]))
			index += replacementNodes.length - 1
			changed = true
			continue
		}

		if (hasChildren(candidate)) {
			if (renderDirectivesInParent(candidate as unknown as Parent, file)) {
				changed = true
			}
		}
	}
	return changed
}

export const applyDirectivesToTree = (tree: Root, file: VFile): void => {
	const rawSource = typeof file.value === "string" ? file.value : file.toString()
	const normalizedSource = normalizeDirectiveScopedIndentationForParsing(rawSource)
	if (normalizedSource !== rawSource) {
		file.value = normalizedSource
	}
	const normalizedRoot = unified().use(remarkParse).parse(normalizedSource) as Root
	tree.children = normalizedRoot.children
	if ((normalizedRoot as { position?: unknown }).position) {
		;(tree as { position?: unknown }).position = (normalizedRoot as { position?: unknown }).position
	}

	parseDirectivesInParent(tree as unknown as Parent, file)
	while (renderDirectivesInParent(tree as unknown as Parent, file)) {
		continue
	}
	validateAnchorIdUniqueness(tree, file)
}

export const directivesToBlocks: RemarkPlugin = () => {
	return (tree: Root, file: VFile): void => {
		applyDirectivesToTree(tree, file)
	}
}
