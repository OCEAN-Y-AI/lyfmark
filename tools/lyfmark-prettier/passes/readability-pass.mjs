import {
	getLineKind,
	isBoundaryKind,
	isFenceClose,
	isLikelyHtmlLine,
	parseFenceOpen,
	resolveOpeningDirectiveName,
} from "../line-analysis.mjs"
import { isBlankLine } from "../line-utils.mjs"

/**
 * Second formatting pass.
 * Responsibilities:
 * - enforce deterministic readability blank lines
 * - apply directive-policy grouping behavior
 * - keep parser-critical boundaries explicit (HTML -> directive, split separators)
 *
 * @param {string[]} lines
 * @param {{
 * 	isSelfClosingDirective: (directiveName: string) => boolean,
 * 	shouldGroupWithNextSameDirective: (directiveName: string) => boolean,
 * 	shouldKeepCloseOpenCompactWithSameDirective: (directiveName: string) => boolean
 * }} policyResolver
 * @returns {string[]}
 */
export const applyReadabilityPass = (lines, policyResolver) => {
	const spacedLines = []
	let activeFence = null
	let directiveDepth = 0
	const directiveStack = []

	const pushBlankLine = () => {
		if (!isBlankLine(spacedLines[spacedLines.length - 1] ?? "")) {
			spacedLines.push("")
		}
	}

	for (let index = 0; index < lines.length; index += 1) {
		const currentLine = lines[index] ?? ""
		const trimmedLine = currentLine.trim()
		const currentKind = getLineKind(trimmedLine)
		const depthBeforeLine = directiveDepth
		let closedDirectiveName = ""

		if (activeFence) {
			spacedLines.push(currentLine)
			if (isFenceClose(currentLine, activeFence)) {
				activeFence = null
			}
			continue
		}

		const fenceOpen = parseFenceOpen(currentLine)
		if (fenceOpen) {
			spacedLines.push(currentLine)
			activeFence = fenceOpen
			continue
		}

		if (trimmedLine.length === 0) {
			spacedLines.push(currentLine)
			continue
		}

		if (currentKind === "separator" && depthBeforeLine > 0) {
			pushBlankLine()
		}

		spacedLines.push(currentLine)

		if (currentKind === "directive-close") {
			closedDirectiveName = directiveStack.pop() ?? ""
			directiveDepth = Math.max(directiveDepth - 1, 0)
		}
		if (currentKind === "directive-open") {
			const currentDirectiveName = resolveOpeningDirectiveName(trimmedLine)
			if (currentDirectiveName.length > 0 && !policyResolver.isSelfClosingDirective(currentDirectiveName)) {
				directiveStack.push(currentDirectiveName)
				directiveDepth += 1
			}
		}

		const nextLine = lines[index + 1]
		if (typeof nextLine !== "string" || isBlankLine(nextLine)) {
			continue
		}

		const nextTrimmed = nextLine.trim()
		const nextKind = getLineKind(nextTrimmed)
		const nextDirectiveName = nextKind === "directive-open" ? resolveOpeningDirectiveName(nextTrimmed) : ""

		if (isLikelyHtmlLine(trimmedLine) && isBoundaryKind(nextKind)) {
			pushBlankLine()
			continue
		}

		if (currentKind === "directive-close") {
			if (
				nextKind === "directive-open" &&
				closedDirectiveName.length > 0 &&
				closedDirectiveName === nextDirectiveName &&
				policyResolver.shouldKeepCloseOpenCompactWithSameDirective(closedDirectiveName)
			) {
				continue
			}
			if (nextKind !== "directive-close") {
				pushBlankLine()
			}
			continue
		}

		if (currentKind === "separator" && depthBeforeLine > 0) {
			if (nextKind !== "separator") {
				pushBlankLine()
			}
			continue
		}

		if (currentKind === "other" && nextKind === "directive-open") {
			pushBlankLine()
			continue
		}

		if (currentKind !== "directive-open") {
			continue
		}

		const currentDirectiveName = resolveOpeningDirectiveName(trimmedLine)
		if (!policyResolver.isSelfClosingDirective(currentDirectiveName)) {
			continue
		}

		if (
			nextKind === "directive-open" &&
			nextDirectiveName === currentDirectiveName &&
			policyResolver.shouldGroupWithNextSameDirective(currentDirectiveName)
		) {
			continue
		}

		pushBlankLine()
	}

	return spacedLines
}
