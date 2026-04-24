import { formatLyfMarkMarkdown } from "./formatter.mjs"

/**
 * Creates a minimal Prettier parser definition that delegates to LyfMark formatter output.
 * AST is intentionally a simple wrapper because formatting already happens in parse().
 */
const createParserDefinition = () => {
	return {
		parse: (text, options) => {
			return {
				type: "LyfMarkDocument",
				content: formatLyfMarkMarkdown(text, options),
			}
		},
		astFormat: "lyfmark-ast",
		locStart: () => 0,
		locEnd: (node) => {
			if (typeof node?.content === "string") {
				return node.content.length
			}
			return 0
		},
	}
}

/**
 * Parser exports.
 * `markdown` is mapped intentionally for VS Code parity when parser is forced externally.
 */
export const parsers = {
	"lyfmark-markdown": createParserDefinition(),
	// VSCode Prettier extension may force parser="markdown"; map it to LyfMark to keep parity with CLI formatting.
	markdown: createParserDefinition(),
}

/**
 * Printer export for the synthetic LyfMark AST format.
 */
export const printers = {
	"lyfmark-ast": {
		print: (path) => {
			const node = path.getValue()
			return typeof node?.content === "string" ? node.content : ""
		},
	},
}

/**
 * Default Prettier plugin export.
 */
const plugin = {
	parsers,
	printers,
}

export { formatLyfMarkMarkdown }
export default plugin
