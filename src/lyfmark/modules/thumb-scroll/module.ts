import type { HTML, Image, Paragraph, Text } from "mdast"
import type { VFile } from "vfile"
import { ContentModule } from "../../../remark/content-module"
import type { ContainerDirectiveNode, ContentProcessor, DirectiveContentNode } from "../../../remark/types"
import { choiceAttribute, cssSizeAttribute, defineAttributes, inlineStyleAttribute, textAttribute } from "../../../remark/utils/attributes"
import { partitionByThematicBreak } from "../../../remark/utils/structure"
import { createHtmlNode } from "../../../remark/utils/nodes"
import { escapeHtml } from "../../../remark/utils/text"
import { buildStyleAttribute } from "../../../remark/utils/style"
import { resolveBackgroundImageLayerPlan } from "../../../remark/utils/background-image-layers"

/**
 * SlideMedia beschreibt eine optionale Bildquelle inklusive Alternativtext.
 */
interface SlideMedia {
	readonly url: string
	readonly alt: string
}

/**
 * SlideDefinition bündelt Medien, Inhaltsabschnitte und optionale Call-to-Action-Absätze eines Elements.
 */
interface SlideDefinition {
	readonly media: SlideMedia | null
	readonly content: DirectiveContentNode[]
	readonly actions: Paragraph[]
}

interface CompiledSlides {
	readonly slides: SlideDefinition[]
	readonly trailingNodes: DirectiveContentNode[]
}

type ThumbScrollTone = "dark" | "light" | "auto"

const thumbScrollValidators = defineAttributes({
	label: textAttribute({ defaultValue: "Hintergründe im Überblick" }),
	color: choiceAttribute<ThumbScrollTone>({ choices: ["dark", "light", "auto"], defaultValue: "auto" }),
	"image-width": cssSizeAttribute({ defaultValue: "", numericUnit: "px" }),
	"image-height": cssSizeAttribute({ defaultValue: "", numericUnit: "px" }),
	overlay: textAttribute({ defaultValue: "none" }),
	style: inlineStyleAttribute(),
})

let thumbScrollInstance = 0
const OVERLAY_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const isParagraph = (node: DirectiveContentNode): node is Paragraph => node.type === "paragraph"
const isImageNode = (node: DirectiveContentNode): node is Image => node.type === "image"
const isWhitespaceText = (node: DirectiveContentNode): node is Text => node.type === "text" && node.value.trim().length === 0
const isClosingHtmlNode = (node: DirectiveContentNode): node is HTML => node.type === "html" && node.value.trim().startsWith("</")

const isLinkParagraph = (node: DirectiveContentNode): node is Paragraph => {
	if (!isParagraph(node)) {
		return false
	}
	const relevantChildren = node.children.filter((child) => {
		if (child.type === "text") {
			return child.value.trim().length > 0
		}
		return true
	})
	if (relevantChildren.length === 0) {
		return false
	}
	return relevantChildren.every((child) => child.type === "link" || child.type === "linkReference")
}

const cloneNode = <T extends DirectiveContentNode>(node: T): T => {
	return JSON.parse(JSON.stringify(node)) as T
}

const separateContentAndActions = (nodes: DirectiveContentNode[]): { content: DirectiveContentNode[]; actions: Paragraph[] } => {
	const actionIndexes: number[] = []
	let cursor = nodes.length - 1
	while (cursor >= 0) {
		const candidate = nodes[cursor]
		if (!candidate) {
			cursor -= 1
			continue
		}
		if (isWhitespaceText(candidate) || isClosingHtmlNode(candidate)) {
			cursor -= 1
			continue
		}
		if (!isLinkParagraph(candidate)) {
			break
		}
		actionIndexes.unshift(cursor)
		cursor -= 1
	}
	const actionNodes = actionIndexes.map((index) => cloneNode(nodes[index] as Paragraph))
	const content = nodes.filter((_, index) => !actionIndexes.includes(index))
	return { content, actions: actionNodes }
}

const extractTrailingHtmlNodes = (nodes: DirectiveContentNode[]): DirectiveContentNode[] => {
	const trailing: DirectiveContentNode[] = []
	let cursor = nodes.length - 1
	while (cursor >= 0) {
		const candidate = nodes[cursor]
		if (!candidate) {
			cursor -= 1
			continue
		}
		if (isWhitespaceText(candidate) || isClosingHtmlNode(candidate)) {
			trailing.unshift(candidate)
			nodes.splice(cursor, 1)
			cursor -= 1
			continue
		}
		break
	}
	return trailing
}

const extractMedia = (
	sectionNodes: DirectiveContentNode[],
	file: VFile,
	slideIndex: number,
): { media: SlideMedia | null; remainder: DirectiveContentNode[] } => {
	const nodes = [...sectionNodes]
	for (let index = 0; index < nodes.length; index += 1) {
		const candidate = nodes[index]
		if (!isParagraph(candidate) || candidate.children.length !== 1) {
			continue
		}
		const [child] = candidate.children
		if (!isImageNode(child)) {
			continue
		}
		const url = child.url?.trim() ?? ""
		if (url.length === 0) {
			file.fail(`Bitte gib eine Bild-URL für Element ${slideIndex + 1} an.`, candidate)
		}
		const alt = child.alt?.trim() ?? ""
		if (alt.length === 0) {
			file.fail(`Bitte ergänze einen Alternativtext für das Bild in Element ${slideIndex + 1}.`, candidate)
		}
		nodes.splice(index, 1)
		return { media: { url, alt }, remainder: nodes }
	}
	return { media: null, remainder: nodes }
}

const hasRenderableContent = (nodes: DirectiveContentNode[]): boolean => {
	return nodes.some((node) => {
		if (isParagraph(node)) {
			return node.children.some((child) => child.type !== "text" || child.value.trim().length > 0)
		}
		return true
	})
}

const compileSlides = (
	sections: DirectiveContentNode[][],
	file: VFile,
	rootNode: ContainerDirectiveNode,
): CompiledSlides => {
	const trailingNodes: DirectiveContentNode[] = []
	const slides = sections.map((section, index) => {
		const anchorNode = section[0] ?? rootNode
		const { media, remainder } = extractMedia(section, file, index)
		const hasContent = hasRenderableContent(remainder)
		const { content, actions } = separateContentAndActions(remainder)
		const slideContent = [...content]
		if (index === sections.length - 1) {
			const trailing = extractTrailingHtmlNodes(slideContent)
			trailingNodes.push(...trailing)
		}
		if (!media && !hasContent) {
			file.fail(`Element ${index + 1} benötigt mindestens ein Bild oder Textinhalte.`, anchorNode)
		}
		return { media, content: slideContent, actions }
	})
	return { slides, trailingNodes }
}

const thumbScrollProcessor: ContentProcessor = (attributes, context) => {
	const { node, file } = context
	const layerPlan = resolveBackgroundImageLayerPlan(node.children, "thumb-scroll", ["auto"], file)
	const sections = partitionByThematicBreak(layerPlan.contentNodes)
	if (sections.length === 0 || sections.every((section) => section.length === 0)) {
		file.fail("Lege mindestens ein Element für thumb-scroll an.", node)
	}
	const { slides, trailingNodes } = compileSlides(sections, file, node)
	if (slides.length === 0) {
		file.fail("thumb-scroll hat keine verwertbaren Elemente.", node)
	}
	const label = attributes["label"] as string
	const color = attributes["color"] as ThumbScrollTone
	const overlay = attributes["overlay"] as string
	const inlineStyle = attributes["style"] as string
	const styleDeclarations: string[] = []
	const hasOverlay = overlay !== "none"
	if (hasOverlay && !OVERLAY_NAME_PATTERN.test(overlay)) {
		file.fail(`Das Attribut "overlay" muss ein slug sein (z. B. "gradient-accent-down") oder "none".`, node)
	}
	if (hasOverlay) {
		styleDeclarations.push(`--thumb-scroll-media-overlay: var(--overlay-${overlay})`)
	}
	const styleAttribute = buildStyleAttribute(styleDeclarations, inlineStyle)
	const mediaWidth = (attributes["image-width"] as string) ?? ""
	const mediaHeight = (attributes["image-height"] as string) ?? ""
	const sectionClasses = ["thumb-scroll", `thumb-scroll--${color}`]
	if (slides.length === 1) {
		sectionClasses.push("thumb-scroll--solo")
	}
	const sectionId = `thumb-scroll-${thumbScrollInstance + 1}`
	thumbScrollInstance += 1
	const slideNodes: DirectiveContentNode[] = []
	const renderNavigation = slides.length > 1

	slides.forEach((slide, index) => {
		const slideClasses = ["thumb-scroll__slide"]
		if (index === 0) {
			slideClasses.push("thumb-scroll__slide--active")
		}
		if (!slide.media) {
			slideClasses.push("thumb-scroll__slide--text-only")
		}
		const ariaHidden = index === 0 ? "false" : "true"
		slideNodes.push(
			createHtmlNode(
				`<article class="${slideClasses.join(" ")}" data-thumb-index="${index}" aria-hidden="${ariaHidden}">`,
			),
		)
		if (slide.media) {
			const mediaStyles: string[] = []
			if (mediaWidth.length > 0) {
				mediaStyles.push("flex:0 0 auto")
				mediaStyles.push(`width:${mediaWidth}`)
				mediaStyles.push(`max-width:${mediaWidth}`)
			}
			if (mediaHeight.length > 0) {
				mediaStyles.push(`height:${mediaHeight}`)
				mediaStyles.push(`max-height:${mediaHeight}`)
			}
			const mediaStyleAttr = mediaStyles.length > 0 ? ` style="${mediaStyles.join("; ")}"` : ""
			const imageStyleAttr = mediaHeight.length > 0 ? ` style="width: 100%; height: 100%; object-position: center;"` : ""
			slideNodes.push(
				createHtmlNode(
					`<figure class="thumb-scroll__media border-radius-left"${mediaStyleAttr}>` +
						`<img src="${escapeHtml(slide.media.url)}" alt="${escapeHtml(slide.media.alt)}" loading="lazy" decoding="async"${imageStyleAttr} />` +
					`</figure>`,
				),
			)
		} else {
			slideNodes.push(createHtmlNode(`<div class="thumb-scroll__media thumb-scroll__media--empty" aria-hidden="true"></div>`))
		}
		slideNodes.push(createHtmlNode(`<div class="thumb-scroll__text">`))
		slideNodes.push(createHtmlNode(`<div class="thumb-scroll__content" aria-live="polite">`))
		if (slide.content.length > 0) {
			slideNodes.push(...slide.content)
		}
		slideNodes.push(createHtmlNode(`</div>`))
		if (slide.actions.length > 0) {
			slideNodes.push(createHtmlNode(`<div class="thumb-scroll__cta">`))
			slideNodes.push(...slide.actions)
			slideNodes.push(createHtmlNode(`</div>`))
		}
		slideNodes.push(createHtmlNode(`</div>`))
		slideNodes.push(createHtmlNode(`</article>`))
	})

	const navMarkup = renderNavigation
		? `<div class="thumb-scroll__actions ui-arrow-group" role="group" aria-label="Elemente durchblättern">` +
			`<button type="button" class="thumb-scroll__arrow thumb-scroll__arrow--prev ui-arrow-button" data-thumb-scroll-prev aria-controls="${sectionId}" aria-label="Vorheriges Element">` +
				`<span aria-hidden="true">&#8592;</span>` +
			`</button>` +
			`<button type="button" class="thumb-scroll__arrow thumb-scroll__arrow--next ui-arrow-button" data-thumb-scroll-next aria-controls="${sectionId}" aria-label="Nächstes Element">` +
				`<span aria-hidden="true">&#8594;</span>` +
			`</button>` +
		`</div>`
		: ""

	return [
		createHtmlNode(
			`<section class="${sectionClasses.join(" ")}" data-bg-image-layer="auto" data-thumb-scroll aria-label="${escapeHtml(label)}" data-thumb-scroll-size="${slides.length}" tabindex="0"${styleAttribute}>`,
		),
		...layerPlan.renderLayerNodes("auto"),
		createHtmlNode(`<div class="thumb-scroll__slides" id="${sectionId}">`),
		...slideNodes,
		...(navMarkup.length > 0 ? [createHtmlNode(navMarkup)] : []),
		createHtmlNode(`</div>`),
		createHtmlNode(`</section>`),
		...trailingNodes,
	]
}

/**
 * thumb-scroll zeigt mehrere Bild-Text-Kombinationen, die über Pfeile oder Wischgesten gewechselt werden.
 */
export const thumbScrollModule = ContentModule("thumb-scroll", thumbScrollValidators, thumbScrollProcessor)
