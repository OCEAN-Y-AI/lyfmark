import { INDENT_WIDTH } from "./constants.mjs"
import {
	getLineKind,
	isBlockquoteLine,
	isBoundaryKind,
	isListMarkerLine,
	startsNewMarkdownBlock,
} from "./line-analysis.mjs"

/**
 * Shared, mostly pure line utilities used across formatter passes.
 */

/**
 * @param {number} count
 * @returns {string}
 */
export const repeatSpaces = (count) => (count > 0 ? " ".repeat(count) : "")

/**
 * Converts directive nesting depth to left indentation in spaces.
 *
 * @param {number} depth
 * @returns {number}
 */
export const resolveContextualIndent = (depth) => {
	if (depth <= 0) {
		return 0
	}
	return depth * INDENT_WIDTH
}

/**
 * @param {string} value
 * @returns {string}
 */
export const normalizeLineEndings = (value) => value.replace(/\r\n?/gu, "\n")

/**
 * @param {string} line
 */
export const isBlankLine = (line) => line.trim().length === 0

/**
 * @param {string} line
 * @returns {number}
 */
export const countLeadingSpaces = (line) => {
	let count = 0
	let index = 0
	while (index < line.length) {
		const character = line[index]
		if (character === " ") {
			count += 1
			index += 1
			continue
		}
		if (character === "\t") {
			count += INDENT_WIDTH
			index += 1
			continue
		}
		break
	}
	return count
}

/**
 * Returns the latest non-empty line from an output buffer.
 *
 * @param {string[]} lines
 * @returns {string | null}
 */
export const getLastNonEmptyLine = (lines) => {
	for (let index = lines.length - 1; index >= 0; index -= 1) {
		if (!isBlankLine(lines[index])) {
			return lines[index] ?? null
		}
	}
	return null
}

/**
 * Detects whether current output tail still belongs to a list/blockquote context.
 * Used to enforce mandatory blank line before starting a module after list containers.
 *
 * @param {string[]} lines
 * @returns {boolean}
 */
export const isListContextTail = (lines) => {
	const previousLine = getLastNonEmptyLine(lines)
	if (!previousLine) {
		return false
	}
	if (isListMarkerLine(previousLine) || isBlockquoteLine(previousLine)) {
		return true
	}
	const previousTrimmed = previousLine.trimStart()
	const previousKind = getLineKind(previousTrimmed)
	if (previousKind !== "other") {
		return false
	}
	if (countLeadingSpaces(previousLine) < 2 && !previousLine.startsWith("\t")) {
		return false
	}

	for (let index = lines.length - 2; index >= 0; index -= 1) {
		const probe = lines[index] ?? ""
		if (isBlankLine(probe)) {
			continue
		}
		return isListMarkerLine(probe) || isBlockquoteLine(probe)
	}
	return false
}

/**
 * Decides whether a queued blank line should be materialized in output.
 *
 * @param {string} previousLine
 * @param {string} nextTrimmedLine
 * @param {"blank" | "directive-close" | "directive-open" | "separator" | "other"} nextKind
 * @returns {boolean}
 */
export const shouldKeepPendingBlank = (previousLine, nextTrimmedLine, nextKind) => {
	if (!previousLine) {
		return false
	}
	if ((isListMarkerLine(previousLine) || isBlockquoteLine(previousLine)) && nextKind === "directive-open") {
		return true
	}
	const previousKind = getLineKind(previousLine.trim())
	if (isBoundaryKind(previousKind) || isBoundaryKind(nextKind)) {
		return previousKind === "directive-close" && nextKind === "directive-open"
	}
	if (nextTrimmedLine.length === 0) {
		return false
	}
	return true
}

/**
 * Normalizes one module-content line to the effective indentation context.
 *
 * @param {string} line
 * @param {number} depth
 * @param {string[]} outputLines
 * @returns {string}
 */
export const normalizeModuleContentLine = (line, depth, outputLines) => {
	if (isBlankLine(line)) {
		return line
	}

	const targetIndent = resolveContextualIndent(depth)
	const trimmedLine = line.trimStart()
	if (trimmedLine.length === 0) {
		return ""
	}

	if (startsNewMarkdownBlock(trimmedLine)) {
		return `${repeatSpaces(targetIndent)}${trimmedLine}`
	}

	const previousLine = getLastNonEmptyLine(outputLines)
	if (previousLine && isListMarkerLine(previousLine.trimStart())) {
		return `${repeatSpaces(targetIndent + INDENT_WIDTH)}${trimmedLine}`
	}
	if (previousLine && countLeadingSpaces(previousLine) > targetIndent && !startsNewMarkdownBlock(previousLine.trimStart())) {
		return `${repeatSpaces(targetIndent + INDENT_WIDTH)}${trimmedLine}`
	}
	return `${repeatSpaces(targetIndent)}${trimmedLine}`
}
