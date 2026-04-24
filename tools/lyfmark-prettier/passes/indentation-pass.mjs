import {
	getLineKind,
	isFenceClose,
	parseFenceOpen,
	resolveOpeningDirectiveName,
} from "../line-analysis.mjs"
import {
	getLastNonEmptyLine,
	isBlankLine,
	isListContextTail,
	normalizeModuleContentLine,
	repeatSpaces,
	resolveContextualIndent,
	shouldKeepPendingBlank,
} from "../line-utils.mjs"

/**
 * First formatting pass.
 * Responsibilities:
 * - normalize directive indentation by nesting depth
 * - preserve fence blocks
 * - collapse uncontrolled blank streaks into deterministic spacing signals
 *
 * @param {string[]} lines
 * @param {{
 * 	isSelfClosingDirective: (directiveName: string) => boolean,
 * 	shouldSwallowImmediateClose: (directiveName: string) => boolean
 * }} policyResolver
 * @returns {string[]}
 */
export const applyIndentationPass = (lines, policyResolver) => {
	const outputLines = []
	let depth = 0
	const directiveStack = []
	let activeFence = null
	let pendingBlank = false
	let optionalCloseDirectiveName = ""

	/**
	 * Flushes a pending blank line when surrounding context contract allows it.
	 *
	 * @param {string} nextTrimmedLine
	 * @param {"blank" | "directive-close" | "directive-open" | "separator" | "other"} nextKind
	 */
	const flushPendingBlank = (nextTrimmedLine, nextKind) => {
		if (!pendingBlank) {
			return
		}
		pendingBlank = false
		const previousLine = getLastNonEmptyLine(outputLines)
		if (!previousLine) {
			return
		}
		if (shouldKeepPendingBlank(previousLine, nextTrimmedLine, nextKind) && !isBlankLine(outputLines[outputLines.length - 1] ?? "")) {
			outputLines.push("")
		}
	}

	for (const line of lines) {
		const trimmedLine = line.trim()
		const lineKind = getLineKind(trimmedLine)

		if (!activeFence && lineKind === "blank") {
			pendingBlank = true
			continue
		}

		if (activeFence) {
			optionalCloseDirectiveName = ""
			outputLines.push(line)
			if (isFenceClose(line, activeFence)) {
				activeFence = null
			}
			continue
		}

		flushPendingBlank(trimmedLine, lineKind)

		const fenceOpen = parseFenceOpen(line)
		if (fenceOpen) {
			optionalCloseDirectiveName = ""
			const indentedFenceLine = depth > 0 ? `${repeatSpaces(resolveContextualIndent(depth))}${trimmedLine}` : line
			outputLines.push(indentedFenceLine)
			activeFence = fenceOpen
			continue
		}

		if (lineKind === "directive-close") {
			if (optionalCloseDirectiveName.length > 0) {
				optionalCloseDirectiveName = ""
				continue
			}
			optionalCloseDirectiveName = ""
			if (isListContextTail(outputLines) && !isBlankLine(outputLines[outputLines.length - 1] ?? "")) {
				outputLines.push("")
			}
			directiveStack.pop()
			depth = Math.max(depth - 1, 0)
			outputLines.push(`${repeatSpaces(resolveContextualIndent(depth))}:::`)
			continue
		}

		if (lineKind === "directive-open") {
			optionalCloseDirectiveName = ""
			if (isListContextTail(outputLines) && !isBlankLine(outputLines[outputLines.length - 1] ?? "")) {
				outputLines.push("")
			}

			const directiveName = resolveOpeningDirectiveName(trimmedLine)
			outputLines.push(`${repeatSpaces(resolveContextualIndent(depth))}${trimmedLine}`)
			const isSelfClosingDirective = policyResolver.isSelfClosingDirective(directiveName)
			if (!isSelfClosingDirective) {
				depth += 1
				directiveStack.push(directiveName)
				continue
			}
			if (policyResolver.shouldSwallowImmediateClose(directiveName)) {
				optionalCloseDirectiveName = directiveName
			}
			continue
		}

		optionalCloseDirectiveName = ""

		if (lineKind === "separator") {
			outputLines.push(`${repeatSpaces(resolveContextualIndent(depth))}---`)
			continue
		}

		if (trimmedLine.length > 0) {
			outputLines.push(normalizeModuleContentLine(line, depth, outputLines))
			continue
		}

		outputLines.push(line)
	}

	return outputLines
}
