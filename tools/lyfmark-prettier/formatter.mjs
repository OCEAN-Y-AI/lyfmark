import { createDirectivePolicyResolver } from "./directive-policies.mjs"
import { normalizeLineEndings } from "./line-utils.mjs"
import { applyIndentationPass } from "./passes/indentation-pass.mjs"
import { applyReadabilityPass } from "./passes/readability-pass.mjs"

/**
 * Formats LyfMark-flavored Markdown deterministically for parser-safe module rendering.
 * Contract:
 * - Keeps trailing newline behavior stable.
 * - Applies indentation and readability passes in fixed order.
 *
 * @param {string} source
 * @param {{filepath?: string}} options
 * @returns {string}
 */
export const formatLyfMarkMarkdown = (source, options = {}) => {
	if (typeof source !== "string" || source.length === 0) {
		return source
	}

	const normalized = normalizeLineEndings(source)
	const hadTrailingNewline = normalized.endsWith("\n")
	const lines = normalized.split("\n")
	if (hadTrailingNewline) {
		lines.pop()
	}

	const directivePolicyResolver = createDirectivePolicyResolver(options)
	const indentedLines = applyIndentationPass(lines, directivePolicyResolver)
	const spacedLines = applyReadabilityPass(indentedLines, directivePolicyResolver)
	const formatted = spacedLines.join("\n")
	return hadTrailingNewline ? `${formatted}\n` : formatted
}
