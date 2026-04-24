import { ContentModule } from "../../../remark/content-module"
import type { ContentProcessor, DirectiveContentNode } from "../../../remark/types"
import { choiceAttribute, cssColorAttribute, cssSizeAttribute, defineAttributes, inlineStyleAttribute } from "../../../remark/utils/attributes"
import { createHtmlNode } from "../../../remark/utils/nodes"
import { buildStyleAttribute } from "../../../remark/utils/style"

type AccentRuleKind = "underline" | "divider"

const accentRuleValidators = defineAttributes({
	kind: choiceAttribute<AccentRuleKind>({
		choices: ["underline", "divider"],
		defaultValue: "underline",
	}),
	before: cssSizeAttribute({
		defaultValue: "0",
	}),
	after: cssSizeAttribute({
		defaultValue: "0",
	}),
	color: cssColorAttribute({
		defaultValue: "var(--ui-accent-rule-color, var(--color-highlight))",
	}),
	style: inlineStyleAttribute(),
})

const hasVisibleContent = (children: DirectiveContentNode[]): boolean => {
	return children.some((child) => {
		if (child.type === "text") {
			return child.value.trim().length > 0
		}
		return true
	})
}

const accentRuleProcessor: ContentProcessor = (attributes, context) => {
	const { node, file } = context
	if (hasVisibleContent(node.children)) {
		file.fail("Das Modul \"accent-rule\" darf keinen eigenen Inhalt enthalten.", node)
	}

	const kind = attributes["kind"] as AccentRuleKind
	const before = attributes["before"] as string
	const after = attributes["after"] as string
	const color = attributes["color"] as string
	const inlineStyle = attributes["style"] as string
	const styleAttribute = buildStyleAttribute(
		[`--accent-rule-before: ${before}`, `--accent-rule-after: ${after}`, `--accent-rule-color: ${color}`],
		inlineStyle,
	)

	if (kind === "divider") {
		return [createHtmlNode(`<hr class="accent-rule-module accent-rule-module--divider"${styleAttribute} />`)]
	}

	return [
		createHtmlNode(
			`<div class="accent-rule-module accent-rule-module--underline" aria-hidden="true" role="presentation"${styleAttribute}></div>`,
		),
	]
}

/**
 * accent-rule rendert den einheitlichen Design-Strich als Unterstreichung oder Trenner.
 */
export const accentRuleModule = ContentModule("accent-rule", accentRuleValidators, accentRuleProcessor, { selfClosing: true })
