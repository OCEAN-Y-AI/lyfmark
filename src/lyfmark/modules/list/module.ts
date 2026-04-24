import type { List, ListItem } from "mdast"
import type { VFile } from "vfile"
import { ContentModule } from "../../../remark/content-module"
import type { ContainerDirectiveNode, ContentProcessor, DirectiveContentNode } from "../../../remark/types"
import { choiceAttribute, defineAttributes, inlineStyleAttribute, textAttribute } from "../../../remark/utils/attributes"
import { decorateLucideSvg, lookupLucideIcon } from "../../../remark/utils/lucide"
import { createHtmlNode } from "../../../remark/utils/nodes"
import { buildStyleAttribute } from "../../../remark/utils/style"
import { escapeHtml } from "../../../remark/utils/text"

type ListTone = "light" | "dark" | "auto"
type ListDisplay = "auto"

interface ListRenderOptions {
	readonly bullet: BulletDefinition
	readonly moduleClassNames: string[]
	readonly bulletClassNames: string[]
	readonly hasCustomBullet: boolean
	readonly tone: ListTone
	readonly display: ListDisplay
}

type BulletDefinition =
	| { readonly kind: "none" }
	| { readonly kind: "text"; readonly value: string }
	| { readonly kind: "icon"; readonly svg: string }

const listValidators = defineAttributes({
	bullet: textAttribute({ defaultValue: "", trim: false }),
	color: choiceAttribute<ListTone>({ choices: ["light", "dark", "auto"], defaultValue: "auto" }),
	display: choiceAttribute<ListDisplay>({ choices: ["auto"], defaultValue: "auto" }),
	class: textAttribute({ defaultValue: "" }),
	"bullet-class": textAttribute({ defaultValue: "" }),
	style: inlineStyleAttribute(),
})

const CSS_CLASS_TOKEN = /^[A-Za-z_][A-Za-z0-9_-]*$/
const LUCIDE_BULLET_PATTERN = /^\[lucide:\s*([^\]\n]+?)\s*\]$/i

const isListNode = (node: DirectiveContentNode): node is List => node.type === "list"
const isListItemNode = (node: DirectiveContentNode): node is ListItem => node.type === "listItem"

const hasChildren = (node: DirectiveContentNode): node is DirectiveContentNode & { children: DirectiveContentNode[] } => {
	return Array.isArray((node as { children?: unknown }).children)
}

const isSkippableNode = (node: DirectiveContentNode): boolean => {
	if (node.type === "text") {
		return node.value.trim().length === 0
	}
	if (node.type === "html") {
		const value = node.value.trim()
		return value.length === 0 || value.startsWith("<!--")
	}
	return false
}

const normalizeClassNames = (
	rawClassNames: string,
	attributeName: string,
	file: VFile,
	node: ContainerDirectiveNode,
): string[] => {
	const tokens = rawClassNames
		.split(/\s+/u)
		.map((token) => token.trim())
		.filter((token) => token.length > 0)

	for (const token of tokens) {
		if (!CSS_CLASS_TOKEN.test(token)) {
			file.fail(
				`Ungültige CSS-Klasse "${token}" im Attribut "${attributeName}". Erlaubt sind Buchstaben, Zahlen, "-" und "_".`,
				node,
			)
		}
	}

	return [...new Set(tokens)]
}

const resolveBulletDefinition = (rawBullet: string, file: VFile, node: ContainerDirectiveNode): BulletDefinition => {
	const trimmedBullet = rawBullet.trim()
	if (trimmedBullet.length === 0) {
		return { kind: "none" }
	}

	const lucideMatch = LUCIDE_BULLET_PATTERN.exec(trimmedBullet)
	if (!lucideMatch || !lucideMatch[1]) {
		return { kind: "text", value: trimmedBullet }
	}

	const iconName = lucideMatch[1].trim()
	const iconLookup = lookupLucideIcon(iconName)
	if (iconLookup.normalizedIconName.length === 0) {
		file.fail(`list: Der Lucide-Name im Attribut "bullet" ist leer.`, node)
	}
	if (!iconLookup.svg) {
		file.fail(
			`list: Unbekanntes Lucide-Icon "${iconName}" im Attribut "bullet". Beispiel: [lucide:circle-check].`,
			node,
		)
	}

	return {
		kind: "icon",
		svg: decorateLucideSvg(iconLookup.svg, {
			className: "list-module__bullet-icon",
			ariaHidden: true,
			focusable: false,
			width: "1em",
			height: "1em",
		}),
	}
}

const mergeListContinuationNodes = (
	children: DirectiveContentNode[],
	file: VFile,
	node: ContainerDirectiveNode,
): DirectiveContentNode[] => {
	const normalized: DirectiveContentNode[] = []
	let activeList: List | null = null

	const appendToLastListItem = (continuationNode: DirectiveContentNode): void => {
		if (!activeList || activeList.children.length === 0) {
			file.fail(`list erlaubt als ersten Inhalt nur Markdown-Listen ("-" oder "1.").`, continuationNode)
		}
		const lastIndex = activeList.children.length - 1
		const lastItem = activeList.children[lastIndex]
		if (!lastItem || !isListItemNode(lastItem as unknown as DirectiveContentNode)) {
			file.fail(`list: Ungültiger Listeneintrag gefunden.`, continuationNode)
		}

		const updatedLastItem: ListItem = {
			...lastItem,
			children: [...lastItem.children, continuationNode as unknown as ListItem["children"][number]],
		}
		const updatedListChildren = [...activeList.children]
		updatedListChildren[lastIndex] = updatedLastItem
		const updatedList: List = {
			...activeList,
			children: updatedListChildren,
		}
		activeList = updatedList
		normalized[normalized.length - 1] = updatedList as unknown as DirectiveContentNode
	}

	for (const child of children) {
		if (isSkippableNode(child)) {
			continue
		}
		if (isListNode(child)) {
			const listClone: List = {
				...child,
				children: [...child.children],
			}
			normalized.push(listClone as unknown as DirectiveContentNode)
			activeList = listClone
			continue
		}

		appendToLastListItem(child)
	}

	if (normalized.length === 0) {
		file.fail(`Bitte füge im list Modul mindestens eine Markdown-Liste hinzu.`, node)
	}
	return normalized
}

type ListKind = "ordered" | "unordered"

const collectListKinds = (nodes: DirectiveContentNode[], kinds: Set<ListKind>): Set<ListKind> => {
	for (const node of nodes) {
		if (isListNode(node)) {
			kinds.add(node.ordered ? "ordered" : "unordered")
		}
		if (hasChildren(node)) {
			collectListKinds(node.children as DirectiveContentNode[], kinds)
		}
	}
	return kinds
}

const hasOrderedLists = (sourceNodes: DirectiveContentNode[]): boolean => {
	const listKinds = collectListKinds(sourceNodes, new Set<ListKind>())
	return listKinds.has("ordered")
}

const hasCustomRendering = (options: ListRenderOptions, inlineStyle: string, sourceNodes: DirectiveContentNode[]): boolean => {
	if (options.hasCustomBullet) {
		return true
	}
	if (options.tone !== "auto") {
		return true
	}
	if (options.moduleClassNames.length > 0 || options.bulletClassNames.length > 0) {
		return true
	}
	if (hasOrderedLists(sourceNodes)) {
		return true
	}
	return inlineStyle.trim().length > 0
}

const hasTransformedChildren = (before: DirectiveContentNode[], after: DirectiveContentNode[]): boolean => {
	if (before.length !== after.length) {
		return true
	}
	for (let index = 0; index < before.length; index += 1) {
		if (before[index] !== after[index]) {
			return true
		}
	}
	return false
}

const isRenderableParagraphNode = (node: DirectiveContentNode): node is ListItem["children"][number] & { type: "paragraph" } => {
	if (node.type !== "paragraph") {
		return false
	}
	return node.children.some((child) => child.type !== "text" || child.value.trim().length > 0)
}

const promoteFirstOrderedParagraphToHeading = (nodes: DirectiveContentNode[]): DirectiveContentNode[] => {
	const transformed = [...nodes]
	for (let index = 0; index < transformed.length; index += 1) {
		const candidate = transformed[index]
		if (!candidate || !isRenderableParagraphNode(candidate)) {
			continue
		}
		transformed[index] = {
			...candidate,
			type: "heading",
			depth: 4,
		} as DirectiveContentNode
		break
	}
	return transformed
}

const renderBulletMarkup = (bullet: BulletDefinition): string => {
	if (bullet.kind === "none") {
		return ""
	}
	if (bullet.kind === "icon") {
		return bullet.svg
	}
	return escapeHtml(bullet.value)
}

const renderListItemNode = (
	listItem: ListItem,
	isOrderedList: boolean,
	orderedIndex: number | null,
	options: ListRenderOptions,
	file: VFile,
): DirectiveContentNode[] => {
	const itemClasses = ["list-module__item", isOrderedList ? "list-module__item--ordered" : "list-module__item--unordered"]
	const nestedChildren = transformNodeList(listItem.children as unknown as DirectiveContentNode[], options, file)

	if (isOrderedList) {
		const resolvedOrderedIndex =
			typeof orderedIndex === "number" && Number.isInteger(orderedIndex) && orderedIndex > 0 ? orderedIndex : 1
		const orderedContentNodes = promoteFirstOrderedParagraphToHeading(nestedChildren)
		return [
			createHtmlNode(`<li class="${itemClasses.join(" ")}">`),
			createHtmlNode(`<span class="list-module__index" aria-hidden="true"><span class="list-module__index-value">${resolvedOrderedIndex}.</span></span>`),
			createHtmlNode(`<div class="list-module__item-content">`),
			...orderedContentNodes,
			createHtmlNode(`</div>`),
			createHtmlNode(`</li>`),
		]
	}

	const bulletClasses = ["list-module__bullet", ...options.bulletClassNames]
	if (options.bullet.kind === "icon") {
		bulletClasses.push("list-module__bullet--icon")
	}
	if (options.bullet.kind === "text") {
		bulletClasses.push("list-module__bullet--text")
	}
	if (options.bullet.kind === "none") {
		bulletClasses.push("list-module__bullet--empty")
	}

	return [
		createHtmlNode(`<li class="${itemClasses.join(" ")}">`),
		createHtmlNode(`<span class="${bulletClasses.join(" ")}" aria-hidden="true">${renderBulletMarkup(options.bullet)}</span>`),
		createHtmlNode(`<div class="list-module__item-content">`),
		...nestedChildren,
		createHtmlNode(`</div>`),
		createHtmlNode(`</li>`),
	]
}

const renderListNode = (listNode: List, options: ListRenderOptions, file: VFile): DirectiveContentNode[] => {
	const isOrdered = listNode.ordered === true
	const listTagName = isOrdered ? "ol" : "ul"
	const listClasses = ["list-module__list", isOrdered ? "list-module__list--ordered" : "list-module__list--unordered"]
	if (!isOrdered && options.hasCustomBullet) {
		listClasses.push("list-module__list--custom-bullet")
	}

	const orderedStartValue =
		isOrdered && typeof listNode.start === "number" && Number.isInteger(listNode.start) && listNode.start > 0
			? listNode.start
			: 1
	const startAttribute =
		isOrdered && orderedStartValue > 1
			? ` start="${orderedStartValue}"`
			: ""

	const renderedNodes: DirectiveContentNode[] = [createHtmlNode(`<${listTagName} class="${listClasses.join(" ")}"${startAttribute}>`)]
	let orderedIndex = orderedStartValue
	for (const child of listNode.children as unknown as DirectiveContentNode[]) {
		if (!isListItemNode(child)) {
			file.fail(`list: Ungültiger Listeneintrag gefunden.`, listNode)
		}
		renderedNodes.push(...renderListItemNode(child, isOrdered, isOrdered ? orderedIndex : null, options, file))
		if (isOrdered) {
			orderedIndex += 1
		}
	}
	renderedNodes.push(createHtmlNode(`</${listTagName}>`))
	return renderedNodes
}

const transformNodeList = (nodes: DirectiveContentNode[], options: ListRenderOptions, file: VFile): DirectiveContentNode[] => {
	const transformed: DirectiveContentNode[] = []
	for (const node of nodes) {
		if (isListNode(node)) {
			transformed.push(...renderListNode(node, options, file))
			continue
		}
		if (hasChildren(node)) {
			const nestedSource = node.children as DirectiveContentNode[]
			const nestedTransformed = transformNodeList(nestedSource, options, file)
			if (hasTransformedChildren(nestedSource, nestedTransformed)) {
				transformed.push({
					...node,
					children: nestedTransformed,
				} as DirectiveContentNode)
				continue
			}
		}
		transformed.push(node)
	}
	return transformed
}

const listProcessor: ContentProcessor = (attributes, context) => {
	const { node, file } = context
	const normalizedChildren = mergeListContinuationNodes(node.children, file, node)
	const listKinds = collectListKinds(normalizedChildren, new Set<ListKind>())
	if (listKinds.size > 1) {
		file.fail(
			`list: Gemischte Listenarten in einem Modul sind nicht erlaubt. Verwende entweder nur "1." oder nur "-".`,
			node,
		)
	}

	const inlineStyle = attributes["style"] as string
	const display = attributes["display"] as ListDisplay
	const bulletDefinition = resolveBulletDefinition(attributes["bullet"] as string, file, node)
	const bulletClassNames = normalizeClassNames(attributes["bullet-class"] as string, "bullet-class", file, node)
	const isUnorderedList = listKinds.has("unordered")
	if (isUnorderedList && bulletDefinition.kind === "none") {
		file.fail(
			`list: Für ungeordnete Listen ("-") ist das Attribut "bullet" erforderlich (z. B. bullet="[lucide:circle-check]").`,
			node,
		)
	}
	const options: ListRenderOptions = {
		bullet: bulletDefinition,
		tone: attributes["color"] as ListTone,
		display,
		moduleClassNames: normalizeClassNames(attributes["class"] as string, "class", file, node),
		bulletClassNames,
		hasCustomBullet: bulletDefinition.kind !== "none" || bulletClassNames.length > 0,
	}

	if (!hasCustomRendering(options, inlineStyle, normalizedChildren)) {
		return normalizedChildren
	}

	const wrapperClassNames = [
		"list-module",
		`list-module--tone-${options.tone}`,
		`list-module--display-${options.display}`,
		...options.moduleClassNames,
	]
	const styleAttribute = buildStyleAttribute([], inlineStyle)
	const transformedChildren = transformNodeList(normalizedChildren, options, file)

	return [
		createHtmlNode(`<section class="${wrapperClassNames.join(" ")}" data-list-module${styleAttribute}>`),
		...transformedChildren,
		createHtmlNode(`</section>`),
	]
}

/**
 * list formatiert Markdown-Listen optional mit frei definierbaren Bullet-Markern
 * und rendert nummerierte Listen standardmäßig als hervorgehobene Kartenliste.
 */
export const listModule = ContentModule("list", listValidators, listProcessor)
