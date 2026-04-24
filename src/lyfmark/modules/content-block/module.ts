import { ContentModule } from "../../../remark/content-module"
import type { ContentProcessor, DirectiveContentNode, DirectiveModule, DirectiveRendererContext } from "../../../remark/types"
import { defineAttributes, textAttribute } from "../../../remark/utils/attributes"
import { contentBlockAllowsChildren, parseVarsAttribute, renderContentBlockNodes, renderContentBlockNodesFromAttributes } from "../../../remark/utils/content-blocks"

const contentBlockValidators = defineAttributes({
	name: textAttribute({ required: true }),
	vars: textAttribute({ required: false, allowEmpty: true }),
})

const DIRECTIVE_START_LINE_KEY = "__directiveStartLine"
const DIRECTIVE_END_LINE_KEY = "__directiveEndLine"

const hasVisibleContent = (children: DirectiveContentNode[]): boolean => {
	return children.some((child) => {
		if (child.type === "text") {
			return child.value.trim().length > 0
		}
		return true
	})
}

const trimBlankEdges = (lines: string[]): string[] => {
	const output = [...lines]
	while (output.length > 0 && output[0]?.trim().length === 0) {
		output.shift()
	}
	while (output.length > 0 && output[output.length - 1]?.trim().length === 0) {
		output.pop()
	}
	return output
}

const countLeadingWhitespace = (line: string): number => {
	let count = 0
	while (count < line.length && /\s/u.test(line[count] ?? "")) {
		count += 1
	}
	return count
}

const stripCommonIndent = (lines: string[]): string[] => {
	const nonEmptyLines = lines.filter((line) => line.trim().length > 0)
	if (nonEmptyLines.length === 0) {
		return lines
	}
	const commonIndent = nonEmptyLines.reduce((minimum, line) => {
		const indent = countLeadingWhitespace(line)
		return Math.min(minimum, indent)
	}, Number.POSITIVE_INFINITY)
	if (!Number.isFinite(commonIndent) || commonIndent <= 0) {
		return lines
	}
	return lines.map((line) => line.slice(Math.min(commonIndent, line.length)))
}

const extractChildrenMarkdown = (context: DirectiveRendererContext): string => {
	const { node, file } = context
	const source = typeof file.value === "string" ? file.value : file.toString()
	const lines = source.replace(/\r\n?/gu, "\n").split("\n")
	const startLine = node.data?.[DIRECTIVE_START_LINE_KEY]
	const endLine = node.data?.[DIRECTIVE_END_LINE_KEY]
	if (typeof startLine !== "number" || typeof endLine !== "number") {
		return ""
	}
	if (endLine <= startLine) {
		return ""
	}
	const closeLineIndex = endLine - 1
	const closeLine = lines[closeLineIndex] ?? ""
	if (closeLine.trim() !== ":::") {
		file.fail(
			`Das schließende ":::" von "${node.name}" muss allein in einer eigenen Zeile stehen. Einrückung ist erlaubt.`,
			node,
		)
	}
	const bodyLines = lines.slice(startLine, endLine - 1)
	return stripCommonIndent(trimBlankEdges(bodyLines)).join("\n")
}

const contentBlockProcessor: ContentProcessor = (attributes, context) => {
	const { node, file } = context
	if (hasVisibleContent(node.children)) {
		file.fail("content-block ist selbstschließend und darf keine Inhalte enthalten.", node)
	}
	const name = attributes["name"] as string
	const vars = attributes["vars"] as string
	const variables = parseVarsAttribute(vars, file, name)
	return renderContentBlockNodes(name, variables, file)
}

/**
 * content-block binds reusable markdown blocks from customer-facing `content-blocks/`.
 */
export const contentBlockModule = ContentModule("content-block", contentBlockValidators, contentBlockProcessor, {
	selfClosing: true,
})

export const createInlineContentBlockModule = (name: string): DirectiveModule => {
	const supportsChildren = contentBlockAllowsChildren(name)
	return {
		name,
		selfClosing: !supportsChildren,
		render: (context: DirectiveRendererContext) => {
			const { node, file } = context
			if (!supportsChildren && hasVisibleContent(node.children)) {
				file.fail(`"${name}" ist selbstschließend und darf keine Inhalte enthalten.`, node)
			}
			const attributes = node.attributes ?? {}
			const childrenMarkdown = supportsChildren ? extractChildrenMarkdown(context) : undefined
			return renderContentBlockNodesFromAttributes(name, attributes, file, { childrenMarkdown })
		},
	}
}
