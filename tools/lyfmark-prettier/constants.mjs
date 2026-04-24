/**
 * Shared constants and default directive policies for LyfMark formatter passes.
 * Policies encode module semantics, not user-editable preferences.
 */
export const INDENT_WIDTH = 2

export const OPEN_DIRECTIVE_PATTERN = /^:::([a-z0-9-]+(?:\/[a-z0-9-]+)*)(?:\s+.*)?$/i
export const CLOSE_DIRECTIVE_PATTERN = /^:::\s*$/
export const MODULE_SEPARATOR_PATTERN = /^---\s*$/
export const LIST_MARKER_PATTERN = /^(?:[-+*]\s+|\d+\.\s+)/
export const BLOCKQUOTE_MARKER_PATTERN = /^>\s?/u
export const FENCE_MARKER_PATTERN = /^(`{3,}|~{3,})/
export const HEADING_MARKER_PATTERN = /^#{1,6}\s/u
export const HTML_COMMENT_PATTERN = /^<!--/u

/**
 * Freezes a policy object to keep formatter behavior deterministic.
 *
 * @param {{selfClosing?: boolean, groupWithNextSameDirective?: boolean, keepCloseOpenCompactWithSameDirective?: boolean, swallowImmediateClose?: boolean}} policy
 */
const freezePolicy = (policy) => Object.freeze(policy)

/**
 * Baseline policy for directives without explicit behavior.
 */
export const EMPTY_DIRECTIVE_POLICY = freezePolicy({
	selfClosing: false,
	groupWithNextSameDirective: false,
	keepCloseOpenCompactWithSameDirective: false,
	swallowImmediateClose: false,
})

/**
 * Built-in policy registry.
 * Keep this list as the single source of truth for directive-specific formatter behavior.
 */
export const BUILTIN_DIRECTIVE_POLICIES = Object.freeze({
	"accent-rule": freezePolicy({
		...EMPTY_DIRECTIVE_POLICY,
		selfClosing: true,
	}),
	anchor: freezePolicy({
		...EMPTY_DIRECTIVE_POLICY,
		selfClosing: true,
		swallowImmediateClose: true,
	}),
	"content-block": freezePolicy({
		...EMPTY_DIRECTIVE_POLICY,
		selfClosing: true,
	}),
	link: freezePolicy({
		...EMPTY_DIRECTIVE_POLICY,
		selfClosing: true,
		groupWithNextSameDirective: true,
	}),
	space: freezePolicy({
		...EMPTY_DIRECTIVE_POLICY,
		selfClosing: true,
	}),
	"text-over-picture": freezePolicy({
		...EMPTY_DIRECTIVE_POLICY,
		keepCloseOpenCompactWithSameDirective: true,
	}),
})
