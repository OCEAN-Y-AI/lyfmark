import { ContentModule } from "../../../remark/content-module"
import type { ContentProcessor } from "../../../remark/types"
import { choiceAttribute, defineAttributes, textAttribute, urlAttribute } from "../../../remark/utils/attributes"
import { createHtmlNode } from "../../../remark/utils/nodes"
import { escapeHtml } from "../../../remark/utils/text"
import { resolveInternalUrl } from "../../../remark/utils/base-path"

type LinkStyle = "default" | "outline" | "destructive" | "cta"
type LinkColor = "light" | "dark" | "auto"
type LinkTarget = "none" | "new"
type LinkAlignment = "left" | "center" | "right"

const linkValidators = defineAttributes({
	to: urlAttribute({ required: true }),
	text: textAttribute({ required: true }),
	style: choiceAttribute<LinkStyle>({
		choices: ["default", "outline", "destructive", "cta"],
		defaultValue: "default",
	}),
	color: choiceAttribute<LinkColor>({
		choices: ["light", "dark", "auto"],
		defaultValue: "auto",
	}),
	target: choiceAttribute<LinkTarget>({
		choices: ["none", "new"],
		defaultValue: "none",
	}),
	align: choiceAttribute<LinkAlignment>({
		choices: ["left", "center", "right"],
		defaultValue: "left",
	}),
})

const getTargetAttributes = (target: LinkTarget): string => {
	if (target === "new") {
		return " target=\"_blank\" rel=\"noreferrer noopener\""
	}
	return ""
}

const collectVariantClasses = (style: LinkStyle, color: LinkColor): string[] => {
	const toneClass = color === "dark" ? "ui-button--dark" : color === "light" ? "ui-button--light" : "ui-button--auto"
	const classes = ["ui-button", "ui-button--pill", toneClass]
	if (style === "outline") {
		classes.push("ui-button--outline")
		return classes
	}
	if (style === "destructive") {
		classes.push("ui-button--destructive")
		return classes
	}
	if (style === "cta") {
		classes.push("ui-button--cta")
		return classes
	}
	return classes
}

const linkProcessor: ContentProcessor = (attributes) => {
	const href = resolveInternalUrl(attributes.to as string)
	const label = attributes.text as string
	const style = attributes.style as LinkStyle
	const color = attributes.color as LinkColor
	const target = attributes.target as LinkTarget
	const alignment = attributes.align as LinkAlignment
	const classes = ["link-module__link", ...collectVariantClasses(style, color)]
	const nodes = [
		createHtmlNode(`<div class="link-module link-module--align-${alignment}">`),
		createHtmlNode(
			`<a class="${classes.join(" ")}" href="${escapeHtml(href)}"${getTargetAttributes(target)}>${escapeHtml(label)}</a>`,
		),
		createHtmlNode("</div>"),
	]
	return nodes
}

/**
 * link erzeugt einen einzelnen Link/Button mit Varianten für Stil, Ziel und Ausrichtung.
 */
export const linkModule = ContentModule("link", linkValidators, linkProcessor, { selfClosing: true })
