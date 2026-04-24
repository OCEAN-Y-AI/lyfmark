import type { Html, Link, List, ListItem, Paragraph, Text } from "mdast"
import type { VFile } from "vfile"
import { ContentModule } from "../../../remark/content-module"
import type { ContainerDirectiveNode, ContentProcessor, DirectiveContentNode } from "../../../remark/types"
import { choiceAttribute, cssSizeAttribute, defineAttributes, inlineStyleAttribute, textAttribute } from "../../../remark/utils/attributes"
import { resolveInternalUrl } from "../../../remark/utils/base-path"
import { collectPlainText } from "../../../remark/utils/content"
import { decorateLucideSvg, lookupLucideIcon } from "../../../remark/utils/lucide"
import { createHtmlNode } from "../../../remark/utils/nodes"
import { buildStyleAttribute } from "../../../remark/utils/style"
import { escapeHtml } from "../../../remark/utils/text"

type QuickNavColor = "dark" | "light"
type QuickNavViewport = "desktop" | "mobile"
type QuickNavItemKind = "icon" | "image"

interface QuickNavItem {
	readonly href: string
	readonly kind: QuickNavItemKind
	readonly ariaLabel: string
	readonly iconSvg?: string
	readonly imageSrc?: string
	readonly imageAlt?: string
}

const VISIBLE_VIEWPORTS: readonly QuickNavViewport[] = ["desktop", "mobile"]
const IMAGE_FILE_PATTERN = /\.(avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i
const LUCIDE_PREFIX_PATTERN = /^lucide:\s*(.+)$/i

const quickNavValidators = defineAttributes({
	color: choiceAttribute<QuickNavColor>({
		choices: ["dark", "light"],
		defaultValue: "dark",
	}),
	size: cssSizeAttribute({ defaultValue: "2.8rem", numericUnit: "rem" }),
	visible: textAttribute({ defaultValue: "desktop,mobile" }),
	label: textAttribute({ defaultValue: "Schnellnavigation" }),
	style: inlineStyleAttribute(),
})

const isListNode = (node: DirectiveContentNode): node is List => node.type === "list"
const isListItemNode = (node: DirectiveContentNode): node is ListItem => node.type === "listItem"
const isParagraphNode = (node: DirectiveContentNode): node is Paragraph => node.type === "paragraph"
const isTextNode = (node: DirectiveContentNode): node is Text => node.type === "text"
const isHtmlNode = (node: DirectiveContentNode): node is Html => node.type === "html"
const isLinkNode = (node: Paragraph["children"][number]): node is Link => node.type === "link"

const isSkippableContainerChild = (node: DirectiveContentNode): boolean => {
	if (isTextNode(node)) {
		return node.value.trim().length === 0
	}
	if (isHtmlNode(node)) {
		return node.value.trim().length === 0
	}
	return false
}

const isWhitespaceText = (node: Paragraph["children"][number]): node is Text => {
	return node.type === "text" && node.value.trim().length === 0
}

const toHumanLabel = (rawValue: string, fallback: string): string => {
	const withoutQuery = rawValue.split(/[?#]/, 1)[0] ?? ""
	const baseName = withoutQuery.split("/").filter((segment) => segment.length > 0).pop() ?? withoutQuery
	const withoutExtension = baseName.replace(/\.[a-z0-9]+$/i, "")
	const normalized = withoutExtension
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[_-]+/g, " ")
		.trim()
	if (normalized.length === 0) {
		return fallback
	}
	return normalized
		.split(/\s+/)
		.map((segment) => `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`)
		.join(" ")
}

const resolveIconSvg = (rawIconName: string, file: VFile, node: ListItem): string => {
	const iconLookup = lookupLucideIcon(rawIconName)
	if (iconLookup.normalizedIconName.length === 0) {
		file.fail(`quick-nav: Der Lucide-Name ist leer. Nutze z. B. "lucide:phone".`, node)
	}
	if (!iconLookup.svg) {
		file.fail(
			`quick-nav: Unbekanntes Lucide-Icon "${rawIconName}". Beispiel für gültige Namen: phone, mail, map-pin, external-link.`,
			node,
		)
	}
	return decorateLucideSvg(iconLookup.svg, {
		className: "quick-nav__icon-svg",
		ariaHidden: true,
		focusable: false,
	})
}

const resolveVisibility = (rawVisibility: string, file: VFile, node: ContainerDirectiveNode): QuickNavViewport[] => {
	const entries = rawVisibility
		.split(",")
		.map((entry) => entry.trim().toLowerCase())
		.filter((entry) => entry.length > 0)

	if (entries.length === 0) {
		file.fail(`quick-nav: "visible" darf nicht leer sein. Erlaubte Werte: desktop, mobile.`, node)
	}

	const deduplicated: QuickNavViewport[] = []
	for (const entry of entries) {
		if (!VISIBLE_VIEWPORTS.includes(entry as QuickNavViewport)) {
			file.fail(`quick-nav: Ungültiger "visible"-Wert "${entry}". Erlaubte Werte: desktop, mobile.`, node)
		}
		const viewport = entry as QuickNavViewport
		if (!deduplicated.includes(viewport)) {
			deduplicated.push(viewport)
		}
	}

	if (deduplicated.length === 0) {
		file.fail(`quick-nav: "visible" benötigt mindestens einen Wert (desktop oder mobile).`, node)
	}

	return deduplicated
}

const hasUnsafeProtocol = (rawHref: string): boolean => {
	return /^(?:\s*)(javascript|data|vbscript):/i.test(rawHref)
}

const isImageToken = (token: string): boolean => {
	if (!IMAGE_FILE_PATTERN.test(token)) {
		return false
	}
	return token.startsWith("/") || token.startsWith("./") || token.startsWith("../")
}

const readSingleLink = (item: ListItem, file: VFile, itemNumber: number): Link => {
	if (item.children.length !== 1) {
		file.fail(`quick-nav: Listeneintrag ${itemNumber} muss genau einen Link enthalten.`, item)
	}
	const [child] = item.children as unknown as DirectiveContentNode[]
	if (!child || !isParagraphNode(child)) {
		file.fail(`quick-nav: Listeneintrag ${itemNumber} muss als "- [text](ziel)" geschrieben sein.`, item)
	}

	const relevantChildren = child.children.filter((paragraphChild) => !isWhitespaceText(paragraphChild))
	if (relevantChildren.length !== 1 || !isLinkNode(relevantChildren[0])) {
		file.fail(`quick-nav: Listeneintrag ${itemNumber} muss genau einen Link enthalten.`, item)
	}

	return relevantChildren[0]
}

const resolveItem = (item: ListItem, file: VFile, itemNumber: number): QuickNavItem => {
	const link = readSingleLink(item, file, itemNumber)
	const rawHref = (link.url ?? "").trim()
	if (rawHref.length === 0) {
		file.fail(`quick-nav: Listeneintrag ${itemNumber} enthält ein leeres Link-Ziel.`, item)
	}
	if (hasUnsafeProtocol(rawHref)) {
		file.fail(
			`quick-nav: Listeneintrag ${itemNumber} nutzt ein unsicheres Ziel "${rawHref}".`,
			item,
		)
	}

	const rawToken = collectPlainText(link.children as unknown as DirectiveContentNode[]).trim()
	if (rawToken.length === 0) {
		file.fail(`quick-nav: Listeneintrag ${itemNumber} enthält keinen Icon- oder Bildwert.`, item)
	}

	const iconMatch = LUCIDE_PREFIX_PATTERN.exec(rawToken)
	if (iconMatch && iconMatch[1]) {
		const rawIconName = iconMatch[1].trim()
		const iconSvg = resolveIconSvg(rawIconName, file, item)
		const ariaLabel = rawHref.toLowerCase().startsWith("tel:")
			? "Telefon"
			: rawHref.toLowerCase().startsWith("mailto:")
				? "E-Mail"
				: toHumanLabel(rawIconName, "Navigation")
		return {
			href: resolveInternalUrl(rawHref),
			kind: "icon",
			ariaLabel,
			iconSvg,
		}
	}

	if (!isImageToken(rawToken)) {
		file.fail(
			`quick-nav: Listeneintrag ${itemNumber} benötigt "lucide:<icon>" oder einen Bildpfad wie "/img/beispiel.jpg".`,
			item,
		)
	}

	return {
		href: resolveInternalUrl(rawHref),
		kind: "image",
		ariaLabel: toHumanLabel(rawToken, "Bildlink"),
		imageSrc: resolveInternalUrl(rawToken),
		imageAlt: typeof link.title === "string" ? link.title.trim() : "",
	}
}

const renderItemNodes = (item: QuickNavItem): DirectiveContentNode[] => {
	const linkClasses = ["quick-nav__link", item.kind === "icon" ? "quick-nav__link--icon" : "quick-nav__link--image"]
	const visualMarkup =
		item.kind === "icon"
			? `<span class="quick-nav__visual quick-nav__visual--icon">${item.iconSvg ?? ""}</span>`
			: `<span class="quick-nav__visual quick-nav__visual--image"><img src="${escapeHtml(item.imageSrc ?? "")}" alt="${escapeHtml(item.imageAlt ?? "")}" loading="eager" fetchpriority="high" decoding="async" /></span>`

	return [
		createHtmlNode(`<li class="quick-nav__item">`),
		createHtmlNode(`<a class="${linkClasses.join(" ")}" href="${escapeHtml(item.href)}" aria-label="${escapeHtml(item.ariaLabel)}">`),
		createHtmlNode(visualMarkup),
		createHtmlNode(`</a>`),
		createHtmlNode(`</li>`),
	]
}

const collectItemsFromContent = (children: DirectiveContentNode[], file: VFile, node: ContainerDirectiveNode): QuickNavItem[] => {
	const listNodes: List[] = []
	for (const child of children) {
		if (isSkippableContainerChild(child)) {
			continue
		}
		if (!isListNode(child)) {
			file.fail(`quick-nav: Erlaubt ist nur eine Markdown-Liste mit "- [icon-oder-bild](ziel)".`, child)
		}
		if (child.ordered) {
			file.fail(`quick-nav: Nutze bitte eine ungeordnete Liste mit "-" statt nummerierter Liste.`, child)
		}
		listNodes.push(child)
	}

	if (listNodes.length === 0) {
		file.fail(`quick-nav: Bitte füge mindestens einen Listeneintrag hinzu.`, node)
	}

	const items: QuickNavItem[] = []
	for (const listNode of listNodes) {
		for (let index = 0; index < listNode.children.length; index += 1) {
			const listEntry = listNode.children[index] as unknown as DirectiveContentNode
			if (!isListItemNode(listEntry)) {
				file.fail(`quick-nav: Ungültiger Listeneintrag.`, listNode)
			}
			items.push(resolveItem(listEntry, file, items.length + 1))
		}
	}

	if (items.length === 0) {
		file.fail(`quick-nav: Bitte füge mindestens einen gültigen Listeneintrag hinzu.`, node)
	}
	return items
}

const quickNavProcessor: ContentProcessor = (attributes, context) => {
	const { node, file } = context
	const color = attributes["color"] as QuickNavColor
	const size = attributes["size"] as string
	const visible = resolveVisibility(attributes["visible"] as string, file, node)
	const label = attributes["label"] as string
	const inlineStyle = attributes["style"] as string
	const styleAttribute = buildStyleAttribute([`--quick-nav-width:${size}`], inlineStyle)
	const classes = ["quick-nav", `quick-nav--${color}`, ...visible.map((viewport) => `quick-nav--visible-${viewport}`)]
	const items = collectItemsFromContent(node.children, file, node)

	const nodes: DirectiveContentNode[] = [
		createHtmlNode(`<nav class="${classes.join(" ")}" aria-label="${escapeHtml(label)}"${styleAttribute}>`),
		createHtmlNode(`<ul class="quick-nav__list">`),
	]

	for (const item of items) {
		nodes.push(...renderItemNodes(item))
	}

	nodes.push(createHtmlNode(`</ul>`))
	nodes.push(createHtmlNode(`</nav>`))
	return nodes
}

/**
 * quick-nav rendert eine feste Schnellnavigation mit Icon- oder Bild-Links am rechten Seitenrand.
 */
export const quickNavModule = ContentModule("quick-nav", quickNavValidators, quickNavProcessor)
