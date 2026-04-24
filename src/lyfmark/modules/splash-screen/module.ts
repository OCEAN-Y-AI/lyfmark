import { ContentModule } from "../../../remark/content-module"
import type { ContentProcessor, DirectiveContentNode } from "../../../remark/types"
import { choiceAttribute, defineAttributes, inlineStyleAttribute, numberAttribute, textAttribute } from "../../../remark/utils/attributes"
import { createHtmlNode } from "../../../remark/utils/nodes"
import { buildStyleAttribute } from "../../../remark/utils/style"
import { escapeHtml } from "../../../remark/utils/text"
import { resolveBackgroundImageLayerPlan } from "../../../remark/utils/background-image-layers"

type SplashDismissMode = "timer-or-click" | "timer" | "click"
type SplashExitAnimation = "fade-out"
type SplashScreenTone = "light" | "dark"

const splashScreenValidators = defineAttributes({
	label: textAttribute({ defaultValue: "Startbildschirm" }),
	color: choiceAttribute<SplashScreenTone>({
		choices: ["light", "dark"],
		defaultValue: "light",
	}),
	dismiss: choiceAttribute<SplashDismissMode>({
		choices: ["timer-or-click", "timer", "click"],
		defaultValue: "timer-or-click",
	}),
	duration: numberAttribute({ defaultValue: 2600, min: 0, max: 600000 }),
	"exit-animation": choiceAttribute<SplashExitAnimation>({
		choices: ["fade-out"],
		defaultValue: "fade-out",
	}),
	"exit-duration": numberAttribute({ defaultValue: 520, min: 0, max: 15000 }),
	"repeat-after": numberAttribute({ defaultValue: 1380, integer: false }),
	style: inlineStyleAttribute(),
	"content-style": inlineStyleAttribute(),
})

const hasRenderableContent = (children: DirectiveContentNode[]): boolean => {
	return children.some((child) => {
		if (child.type === "text") {
			return child.value.trim().length > 0
		}
		if (child.type === "paragraph") {
			return child.children.some((paragraphChild) => {
				if (paragraphChild.type === "text") {
					return paragraphChild.value.trim().length > 0
				}
				return true
			})
		}
		if (child.type === "html") {
			const htmlValue = child.value.trim()
			return htmlValue.length > 0 && !htmlValue.startsWith("<!--")
		}
		return true
	})
}

const splashScreenProcessor: ContentProcessor = (attributes, context) => {
	const { node, file } = context
	const layerPlan = resolveBackgroundImageLayerPlan(node.children, "splash-screen", ["auto", "text"], file)
	const contentNodes = layerPlan.contentNodes
	if (!hasRenderableContent(contentNodes)) {
		file.fail("Bitte füge Inhalte für das splash-screen Modul hinzu.", node)
	}

	const label = attributes["label"] as string
	const color = attributes["color"] as SplashScreenTone
	const dismiss = attributes["dismiss"] as SplashDismissMode
	const duration = attributes["duration"] as number
	const exitAnimation = attributes["exit-animation"] as SplashExitAnimation
	const exitDuration = attributes["exit-duration"] as number
	const repeatAfterMinutes = attributes["repeat-after"] as number
	const inlineStyle = attributes["style"] as string
	const contentInlineStyle = attributes["content-style"] as string
	const hasRepeatAfterAttribute = Object.prototype.hasOwnProperty.call(node.attributes ?? {}, "repeat-after")
	const repeatAfterAttribute = hasRepeatAfterAttribute ? ` data-splash-repeat-minutes="${repeatAfterMinutes}"` : ""

	const rootStyleAttribute = buildStyleAttribute([`--splash-screen-exit-duration:${exitDuration}ms`], inlineStyle)
	const contentStyleAttribute = buildStyleAttribute([], contentInlineStyle)

	const outputNodes: DirectiveContentNode[] = [
		createHtmlNode(
			`<section class="splash-screen splash-screen--tone-${color}" data-bg-image-layer="auto" data-splash-screen data-splash-dismiss-mode="${dismiss}" data-splash-duration="${duration}" data-splash-exit-animation="${exitAnimation}" data-splash-exit-duration="${exitDuration}"${repeatAfterAttribute} aria-label="${escapeHtml(label)}" aria-hidden="true" hidden${rootStyleAttribute}>`,
		),
	]
	outputNodes.push(...layerPlan.renderLayerNodes("auto"))
	outputNodes.push(createHtmlNode(`<div class="splash-screen__content" data-bg-image-layer="text"${contentStyleAttribute}>`))
	outputNodes.push(...layerPlan.renderLayerNodes("text"))
	outputNodes.push(...contentNodes)
	outputNodes.push(createHtmlNode(`</div>`))
	outputNodes.push(createHtmlNode(`</section>`))
	return outputNodes
}

/**
 * splash-screen rendert einen vollflächigen Start-Overlay mit konfigurierbarer Schließlogik.
 */
export const splashScreenModule = ContentModule("splash-screen", splashScreenValidators, splashScreenProcessor)
