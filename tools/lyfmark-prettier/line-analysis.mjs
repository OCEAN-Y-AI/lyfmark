import {
	BLOCKQUOTE_MARKER_PATTERN,
	CLOSE_DIRECTIVE_PATTERN,
	FENCE_MARKER_PATTERN,
	HEADING_MARKER_PATTERN,
	HTML_COMMENT_PATTERN,
	LIST_MARKER_PATTERN,
	MODULE_SEPARATOR_PATTERN,
	OPEN_DIRECTIVE_PATTERN,
} from "./constants.mjs"

/**
 * Line classifiers and structural probes used by formatter passes.
 * These functions are intentionally pure to keep pass behavior predictable.
 */

/**
 * Classifies a trimmed line into directive or content categories.
 *
 * @param {string} trimmedLine
 * @returns {"blank" | "directive-close" | "directive-open" | "separator" | "other"}
 */
export const getLineKind = (trimmedLine) => {
	if (trimmedLine.length === 0) {
		return "blank"
	}
	if (CLOSE_DIRECTIVE_PATTERN.test(trimmedLine)) {
		return "directive-close"
	}
	if (OPEN_DIRECTIVE_PATTERN.test(trimmedLine)) {
		return "directive-open"
	}
	if (MODULE_SEPARATOR_PATTERN.test(trimmedLine)) {
		return "separator"
	}
	return "other"
}

/**
 * Indicates whether a line kind is a structural boundary in directive parsing.
 *
 * @param {string} kind
 */
export const isBoundaryKind = (kind) => {
	return kind === "directive-open" || kind === "directive-close" || kind === "separator"
}

/**
 * @param {string} line
 */
export const isListMarkerLine = (line) => LIST_MARKER_PATTERN.test(line.trimStart())

/**
 * @param {string} line
 */
export const isBlockquoteLine = (line) => BLOCKQUOTE_MARKER_PATTERN.test(line.trimStart())

/**
 * Detects whether a line should start a new Markdown block within module content.
 *
 * @param {string} trimmedLine
 */
export const startsNewMarkdownBlock = (trimmedLine) => {
	if (trimmedLine.length === 0) {
		return false
	}
	if (isListMarkerLine(trimmedLine) || isBlockquoteLine(trimmedLine)) {
		return true
	}
	if (HEADING_MARKER_PATTERN.test(trimmedLine) || HTML_COMMENT_PATTERN.test(trimmedLine)) {
		return true
	}
	return getLineKind(trimmedLine) !== "other"
}

/**
 * Heuristic used to protect HTML blocks from swallowing following directives.
 *
 * @param {string} trimmedLine
 */
export const isLikelyHtmlLine = (trimmedLine) => {
	return trimmedLine.startsWith("<")
}

/**
 * Extracts normalized directive name from an opening directive line.
 *
 * @param {string} trimmedLine
 */
export const resolveOpeningDirectiveName = (trimmedLine) => {
	const openingMatch = OPEN_DIRECTIVE_PATTERN.exec(trimmedLine)
	return (openingMatch?.[1] ?? "").toLowerCase()
}

/**
 * Parses opening markdown fence info, or returns null when not a fence opener.
 *
 * @param {string} line
 * @returns {{character: string, length: number} | null}
 */
export const parseFenceOpen = (line) => {
	const trimmedLine = line.trimStart()
	const match = FENCE_MARKER_PATTERN.exec(trimmedLine)
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

/**
 * Validates whether a line closes the currently active fence.
 *
 * @param {string} line
 * @param {{character: string, length: number}} fence
 */
export const isFenceClose = (line, fence) => {
	const trimmedLine = line.trimStart()
	let cursor = 0
	while (cursor < trimmedLine.length && trimmedLine[cursor] === fence.character) {
		cursor += 1
	}
	if (cursor < fence.length) {
		return false
	}
	const remainder = trimmedLine.slice(cursor)
	return remainder.trim().length === 0
}
