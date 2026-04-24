import { existsSync } from "node:fs"
import path from "node:path"
import { fromMarkdown } from "mdast-util-from-markdown"
import type { Heading, Link, List, ListItem, Paragraph, PhrasingContent, Root, RootContent } from "mdast"
import type {
	LoadManualMenuOptions,
	ManualMenuEntry,
	ManualMenuNode,
	MenuLink,
	MenuTextTone,
} from "~/components/manual-menu/manual-menu.types"
import { isExternalHref, normalizeSitePath, splitPathSuffix } from "~/utils/path-utils"

interface MutableMenuAdvertiseContent {
	line: number
	markdown: string
}

interface MutableMenuSectionContent {
	line: number
	markdown: string
}

interface MutableMenuNode {
	type: "item"
	label: string
	href?: string
	tone: MenuTextTone
	depth: number
	line: number
	sections: MutableMenuNode[]
	links: MenuLink[]
	button?: MenuLink
	content?: MutableMenuSectionContent
	advertise?: MutableMenuAdvertiseContent
}

interface MutableMenuSeparator {
	type: "separator"
	line: number
}

interface MutableAdvertiseFrame {
	type: "advertise"
	depth: number
	line: number
	parent: MutableMenuNode
	chunks: string[]
}

type MutableMenuEntry = MutableMenuNode | MutableMenuSeparator
type MutableStackEntry = MutableMenuNode | MutableAdvertiseFrame

const ADVERTISE_SECTION_LABEL = "advertise"
const LINK_DIRECTIVE_PATTERN = /^:::link(?:\s+(.*))?$/u

const lineOf = (node: { position?: { start?: { line?: number } } }): number => {
	return typeof node.position?.start?.line === "number" ? node.position.start.line : 0
}

const endLineOf = (node: { position?: { end?: { line?: number } } }): number => {
	return typeof node.position?.end?.line === "number" ? node.position.end.line : 0
}

const columnOf = (node: { position?: { start?: { column?: number } } }): number => {
	return typeof node.position?.start?.column === "number" ? node.position.start.column : 1
}

const menuError = (sourceRelativePath: string, message: string, line?: number): never => {
	const lineSuffix = typeof line === "number" && line > 0 ? ` (Zeile ${line})` : ""
	throw new Error(`[Menüvorlage ${sourceRelativePath}${lineSuffix}] ${message}`)
}

const isWhitespaceText = (node: PhrasingContent): boolean => {
	return node.type === "text" && node.value.trim().length === 0
}

const collectText = (nodes: readonly PhrasingContent[]): string => {
	const segments: string[] = []
	for (const node of nodes) {
		if (node.type === "text" || node.type === "inlineCode") {
			segments.push(node.value)
			continue
		}
		if ("children" in node && Array.isArray(node.children)) {
			segments.push(collectText(node.children as PhrasingContent[]))
		}
	}
	return segments.join(" ").replace(/\s+/g, " ").trim()
}

const extractLabelAndTone = (nodes: readonly PhrasingContent[], fallbackLabel: string): { label: string; tone: MenuTextTone } => {
	const meaningfulNodes = nodes.filter((node) => !isWhitespaceText(node))
	if (meaningfulNodes.length === 1) {
		const candidate = meaningfulNodes[0]
		if (candidate.type === "strong") {
			const strongLabel = collectText(candidate.children as PhrasingContent[])
			return { label: strongLabel.length > 0 ? strongLabel : fallbackLabel, tone: "emphasized" }
		}
		if (candidate.type === "emphasis") {
			const emphasisLabel = collectText(candidate.children as PhrasingContent[])
			return { label: emphasisLabel.length > 0 ? emphasisLabel : fallbackLabel, tone: "muted" }
		}
	}
	return { label: fallbackLabel, tone: "default" }
}

const parseSingleLink = (nodes: readonly PhrasingContent[], sourceRelativePath: string, contextLabel: string, fallbackLine: number): MenuLink => {
	const meaningfulNodes = nodes.filter((node) => !isWhitespaceText(node))
	if (meaningfulNodes.length !== 1 || meaningfulNodes[0].type !== "link") {
		menuError(sourceRelativePath, `${contextLabel} muss genau einen Markdown-Link enthalten: [Text](/ziel).`, fallbackLine)
	}
	const link = meaningfulNodes[0] as Link
	const href = link.url.trim()
	if (href.length === 0) {
		menuError(sourceRelativePath, `Im ${contextLabel} fehlt die Zieladresse des Links.`, lineOf(link) || fallbackLine)
	}
	const rawLabel = collectText(link.children as PhrasingContent[])
	if (rawLabel.length === 0) {
		menuError(sourceRelativePath, `Im ${contextLabel} fehlt der sichtbare Linktext. Bitte nutzen Sie [Text](Link).`, lineOf(link) || fallbackLine)
	}
	const { label, tone } = extractLabelAndTone(link.children as PhrasingContent[], rawLabel)
	return { label, href, line: lineOf(link) || fallbackLine, tone }
}

const collectParagraphRawText = (paragraph: Paragraph): string | null => {
	let rawText = ""
	for (const child of paragraph.children as PhrasingContent[]) {
		if (child.type === "text" || child.type === "inlineCode") {
			rawText += child.value
			continue
		}
		if (child.type === "break") {
			rawText += "\n"
			continue
		}
		return null
	}
	return rawText
}

const parseDirectiveAttributes = (raw: string, sourceRelativePath: string, line: number): Record<string, string> => {
	const attributes: Record<string, string> = {}
	let index = 0

	while (index < raw.length) {
		while (index < raw.length && /\s/u.test(raw[index] ?? "")) {
			index += 1
		}
		if (index >= raw.length) {
			break
		}

		const keyMatch = /^[a-zA-Z][a-zA-Z0-9-]*/u.exec(raw.slice(index))
		const key = keyMatch?.[0]
		if (!key) {
			menuError(sourceRelativePath, `Ungültiges Attribut in :::link. Erwartet ist key="value".`, line)
		}
		const attributeName = key ?? ""
		index += attributeName.length

		while (index < raw.length && /\s/u.test(raw[index] ?? "")) {
			index += 1
		}
		if (raw[index] !== "=") {
			menuError(sourceRelativePath, `Nach Attribut "${attributeName}" in :::link fehlt "=".`, line)
		}
		index += 1

		while (index < raw.length && /\s/u.test(raw[index] ?? "")) {
			index += 1
		}
		const quote = raw[index]
		if (quote !== "\"" && quote !== "'") {
			menuError(sourceRelativePath, `Attribute in :::link müssen in Anführungszeichen stehen (Fehler bei "${attributeName}").`, line)
		}
		index += 1

		let value = ""
		while (index < raw.length && raw[index] !== quote) {
			value += raw[index]
			index += 1
		}
		if (raw[index] !== quote) {
			menuError(sourceRelativePath, `Unvollständiger Attributwert in :::link bei "${attributeName}".`, line)
		}
		index += 1
		attributes[attributeName] = value
	}

	return attributes
}

const parseMenuButtonDirective = (paragraph: Paragraph, sourceRelativePath: string, fallbackLine: number): MenuLink | null => {
	const rawParagraph = collectParagraphRawText(paragraph)
	if (rawParagraph === null) {
		return null
	}
	const lines = rawParagraph
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
	if (lines.length === 0) {
		return null
	}
	if (lines.length > 1) {
		return null
	}
	const directiveLine = lines[0] ?? ""
	const directiveMatch = LINK_DIRECTIVE_PATTERN.exec(directiveLine)
	if (!directiveMatch) {
		return null
	}

	const attributesSource = (directiveMatch[1] ?? "").trim()
	const attributes = attributesSource.length > 0 ? parseDirectiveAttributes(attributesSource, sourceRelativePath, fallbackLine) : {}
	const to = (attributes.to ?? "").trim()
	const text = (attributes.text ?? "").trim()

	if (to.length === 0) {
		menuError(sourceRelativePath, `:::link im Menü benötigt das Attribut "to".`, fallbackLine)
	}
	if (text.length === 0) {
		menuError(sourceRelativePath, `:::link im Menü benötigt das Attribut "text".`, fallbackLine)
	}

	return {
		label: text,
		href: to,
		line: fallbackLine,
		tone: "default",
	}
}

const paragraphContainsNestedLinkDirective = (paragraph: Paragraph): boolean => {
	for (const child of paragraph.children as PhrasingContent[]) {
		if (child.type !== "text" && child.type !== "inlineCode") {
			continue
		}
		if (/\n\s*:::link\b/iu.test(child.value)) {
			return true
		}
	}
	return false
}

const isLinkDirectiveParagraph = (paragraph: Paragraph): boolean => {
	const rawParagraph = collectParagraphRawText(paragraph)
	if (rawParagraph === null) {
		return false
	}
	return /^\s*:::link\b/iu.test(rawParagraph.trim())
}

const extractNodeSourceSnippet = (node: RootContent, rawLines: readonly string[]): string => {
	const startLine = lineOf(node)
	const endLine = endLineOf(node)
	if (startLine <= 0 || endLine <= 0 || endLine < startLine) {
		return ""
	}
	return rawLines.slice(startLine - 1, endLine).join("\n").trimEnd()
}

const appendSectionContentChunk = (
	node: MutableMenuNode,
	chunk: string,
	line: number,
): void => {
	const trimmedChunk = chunk.trim()
	if (trimmedChunk.length === 0) {
		return
	}
	if (!node.content) {
		node.content = { line, markdown: trimmedChunk }
		return
	}
	node.content = {
		...node.content,
		markdown: `${node.content.markdown}\n\n${trimmedChunk}`,
	}
}

const parseHeadingLabel = (heading: Heading, sourceRelativePath: string): { label: string; href?: string; tone: MenuTextTone } => {
	const line = lineOf(heading)
	const meaningfulNodes = (heading.children as PhrasingContent[]).filter((node) => !isWhitespaceText(node))
	if (meaningfulNodes.length === 0) {
		menuError(sourceRelativePath, "Eine Überschrift im Menü ist leer. Bitte ergänzen Sie einen Titel.", line)
	}

	const hasLink = meaningfulNodes.some((node) => node.type === "link")
	if (!hasLink) {
		const rawLabel = collectText(heading.children as PhrasingContent[])
		if (rawLabel.length === 0) {
			menuError(sourceRelativePath, "Eine Überschrift im Menü hat keinen lesbaren Titel.", line)
		}
		return extractLabelAndTone(heading.children as PhrasingContent[], rawLabel)
	}

	if (meaningfulNodes.length !== 1 || meaningfulNodes[0].type !== "link") {
		menuError(sourceRelativePath, "Eine verlinkte Überschrift darf nur aus einem einzelnen Markdown-Link bestehen.", line)
	}

	const parsed = parseSingleLink(heading.children as PhrasingContent[], sourceRelativePath, "Überschrift", line)
	return { label: parsed.label, href: parsed.href, tone: parsed.tone }
}

const parseListLinks = (listNode: List, sourceRelativePath: string): readonly MenuLink[] => {
	if (listNode.ordered) {
		menuError(sourceRelativePath, "Bitte verwenden Sie im Menü nur ungeordnete Listen mit '-' für Unterpunkte.", lineOf(listNode))
	}

	return listNode.children.map((listItem: ListItem, index): MenuLink => {
		const line = lineOf(listItem)
		const hasMisplacedLinkDirective = listItem.children.some((child) => {
			if (child.type !== "paragraph") {
				return false
			}
			const paragraph = child as Paragraph
			return paragraphContainsNestedLinkDirective(paragraph) || isLinkDirectiveParagraph(paragraph)
		})
		if (hasMisplacedLinkDirective) {
			menuError(
				sourceRelativePath,
				`:::link darf nicht eingerückt innerhalb der Linkliste stehen. Setzen Sie den Abschlussbutton als eigene Zeile nach der Liste auf derselben Ebene.`,
				line,
			)
		}
		if (listItem.children.length !== 1 || listItem.children[0]?.type !== "paragraph") {
			menuError(sourceRelativePath, `Listeneintrag ${index + 1} muss genau einen Link enthalten: - [Text](/ziel).`, line)
		}
		const paragraph = listItem.children[0] as Paragraph
		if (paragraphContainsNestedLinkDirective(paragraph)) {
			menuError(
				sourceRelativePath,
				`:::link darf nicht eingerückt innerhalb der Linkliste stehen. Setzen Sie den Abschlussbutton als eigene Zeile nach der Liste auf derselben Ebene.`,
				line,
			)
		}
		return parseSingleLink(paragraph.children as PhrasingContent[], sourceRelativePath, `Listeneintrag ${index + 1}`, line)
	})
}

const cloneNode = (node: MutableMenuNode): ManualMenuNode => {
	return {
		type: "item",
		label: node.label,
		href: node.href,
		tone: node.tone,
		depth: node.depth,
		line: node.line,
		sections: node.sections.map(cloneNode),
		links: [...node.links],
		button: node.button,
		content: node.content
			? {
					line: node.content.line,
					markdown: node.content.markdown,
					html: "",
				}
			: undefined,
		advertise: node.advertise
			? {
					line: node.advertise.line,
					markdown: node.advertise.markdown,
					html: "",
				}
			: undefined,
	}
}

const validateLinks = (node: ManualMenuNode, sourceRelativePath: string, knownInternalPaths: ReadonlySet<string>): void => {
	const validateLink = (link: MenuLink, contextLabel: string): void => {
		const rawHref = link.href.trim()
		if (rawHref.length === 0) {
			menuError(sourceRelativePath, `${contextLabel} enthält einen leeren Link.`, link.line)
		}
		if (isExternalHref(rawHref) || rawHref.startsWith("#")) {
			return
		}
		if (rawHref.startsWith("./") || rawHref.startsWith("../")) {
			menuError(sourceRelativePath, `${contextLabel} nutzt einen relativen Link (${rawHref}). Bitte verwenden Sie eine absolute interne URL wie "/kontakt".`, link.line)
		}
		if (!rawHref.startsWith("/")) {
			menuError(sourceRelativePath, `${contextLabel} hat kein gültiges Ziel (${rawHref}). Nutzen Sie bitte "/ziel", "https://...", "mailto:" oder "tel:".`, link.line)
		}

		const { pathPart } = splitPathSuffix(rawHref)
		const normalized = normalizeSitePath(pathPart)
		const lastSegment = normalized.split("/").pop() ?? ""
		if (lastSegment.includes(".")) {
			const publicPath = path.resolve("public", normalized.slice(1))
			if (!existsSync(publicPath)) {
				menuError(sourceRelativePath, `${contextLabel} verweist auf "${rawHref}", die Datei wurde im Ordner "public" nicht gefunden.`, link.line)
			}
			return
		}

		if (!knownInternalPaths.has(normalized)) {
			menuError(sourceRelativePath, `${contextLabel} verweist auf "${rawHref}", aber diese Seite existiert nicht. Bitte Link prüfen.`, link.line)
		}
	}

	if (node.href) {
		validateLink({ label: node.label, href: node.href, line: node.line, tone: node.tone }, `Überschrift "${node.label}"`)
	}
	for (const link of node.links) {
		validateLink(link, `Listeneintrag "${link.label}"`)
	}
	if (node.button) {
		validateLink(node.button, `Zusatzbutton "${node.button.label}"`)
	}
	for (const child of node.sections) {
		validateLinks(child, sourceRelativePath, knownInternalPaths)
	}
}

const validateStructure = (node: ManualMenuNode, sourceRelativePath: string, trail: readonly string[] = []): void => {
	const contextTrail = [...trail, node.label]
	const contextLabel = contextTrail.join(" > ")
	const hasChildren = node.sections.length > 0 || node.links.length > 0 || Boolean(node.content) || Boolean(node.advertise)

	if (node.sections.length > 0 && node.links.length > 0) {
		menuError(sourceRelativePath, `Im Abschnitt "${contextLabel}" dürfen Unterüberschriften und Liste nicht gleichzeitig verwendet werden.`, node.line)
	}
	if (node.content && node.sections.length > 0) {
		menuError(sourceRelativePath, `Im Abschnitt "${contextLabel}" dürfen freie Inhalte und Unterüberschriften nicht gemischt werden.`, node.content.line)
	}
	if (node.content && node.links.length > 0) {
		menuError(sourceRelativePath, `Im Abschnitt "${contextLabel}" dürfen freie Inhalte und Linkliste nicht gemischt werden.`, node.content.line)
	}
	if (node.content && node.button) {
		menuError(sourceRelativePath, `Im Abschnitt "${contextLabel}" darf ein Abschlussbutton nicht mit freien Inhalten kombiniert werden.`, node.button.line)
	}
	if (hasChildren && node.href) {
		menuError(sourceRelativePath, `Im Abschnitt "${contextLabel}" darf die Überschrift kein Link sein, weil darunter Unterpunkte vorhanden sind.`, node.line)
	}
	if (!hasChildren && !node.href) {
		menuError(sourceRelativePath, `Im Abschnitt "${contextLabel}" fehlt der Link in der Überschrift. Ohne Unterpunkte muss die Überschrift verlinkt sein.`, node.line)
	}
	if (node.button && node.links.length === 0) {
		menuError(sourceRelativePath, `Im Abschnitt "${contextLabel}" ist ein Zusatzbutton nur nach einer Liste erlaubt.`, node.button.line)
	}
	if (node.button && node.sections.length > 0) {
		menuError(sourceRelativePath, `Im Abschnitt "${contextLabel}" ist ein Zusatzbutton nur bei Listen-Abschnitten erlaubt.`, node.button.line)
	}
	if (node.advertise && node.depth !== 1) {
		menuError(sourceRelativePath, `Der advertise-Abschnitt ist nur direkt unter einem Top-Level-Menüpunkt erlaubt.`, node.advertise.line)
	}

	for (const section of node.sections) {
		validateStructure(section, sourceRelativePath, contextTrail)
	}
}

const isAdvertiseFrame = (entry: MutableStackEntry | undefined): entry is MutableAdvertiseFrame => {
	return Boolean(entry && entry.type === "advertise")
}

const stackDepth = (entry: MutableStackEntry): number => {
	return entry.depth
}

const isAdvertiseSectionLabel = (label: string): boolean => {
	return label.trim().toLowerCase() === ADVERTISE_SECTION_LABEL
}

const appendAdvertiseChunk = (
	frame: MutableAdvertiseFrame,
	node: RootContent,
	rawLines: readonly string[],
): void => {
	const startLine = lineOf(node)
	const endLine = endLineOf(node)
	if (startLine <= 0 || endLine <= 0 || endLine < startLine) {
		return
	}
	const snippet = rawLines.slice(startLine - 1, endLine).join("\n").trimEnd()
	if (snippet.trim().length === 0) {
		return
	}
	frame.chunks.push(snippet)
}

const finalizeAdvertiseFrame = (frame: MutableAdvertiseFrame, sourceRelativePath: string): void => {
	const markdown = frame.chunks.join("\n\n").trim()
	if (markdown.length === 0) {
		menuError(sourceRelativePath, `Im advertise-Abschnitt von "${frame.parent.label}" fehlt Inhalt.`, frame.line)
	}
	frame.parent.advertise = {
		line: frame.line,
		markdown,
	}
}

const popUntilDepth = (stack: MutableStackEntry[], depth: number, sourceRelativePath: string): void => {
	while (stack.length > 0 && stackDepth(stack[stack.length - 1] as MutableStackEntry) >= depth) {
		const popped = stack.pop()
		if (isAdvertiseFrame(popped)) {
			finalizeAdvertiseFrame(popped, sourceRelativePath)
		}
	}
}

const popAllStackEntries = (stack: MutableStackEntry[], sourceRelativePath: string): void => {
	while (stack.length > 0) {
		const popped = stack.pop()
		if (isAdvertiseFrame(popped)) {
			finalizeAdvertiseFrame(popped, sourceRelativePath)
		}
	}
}

const topMenuNodeFromStack = (stack: MutableStackEntry[]): MutableMenuNode | undefined => {
	const current = stack[stack.length - 1]
	return current && current.type === "item" ? current : undefined
}

const requireCurrentMenuNode = (
	stack: MutableStackEntry[],
	sourceRelativePath: string,
	errorMessage: string,
	line: number,
): MutableMenuNode => {
	const current = topMenuNodeFromStack(stack)
	if (!current) {
		menuError(sourceRelativePath, errorMessage, line)
	}
	return current as MutableMenuNode
}

/**
 * Parses and validates manual menu markdown.
 * Contract: throws a descriptive error on malformed structure or broken links.
 */
export const parseManualMenuMarkdown = (
	rawMarkdown: string,
	sourceRelativePath: string,
	knownInternalPaths: LoadManualMenuOptions["knownInternalPaths"],
): readonly ManualMenuEntry[] => {
	const root = fromMarkdown(rawMarkdown) as Root
	const rawLines = rawMarkdown.split(/\r?\n/u)
	const topLevelEntries: MutableMenuEntry[] = []
	const stack: MutableStackEntry[] = []

	for (const node of root.children) {
		const activeAdvertiseFrame = stack[stack.length - 1]
		if (isAdvertiseFrame(activeAdvertiseFrame)) {
			if (node.type === "heading") {
				const advertiseHeading = node as Heading
				if (advertiseHeading.depth > activeAdvertiseFrame.depth) {
					appendAdvertiseChunk(activeAdvertiseFrame, node, rawLines)
					continue
				}
				popUntilDepth(stack, advertiseHeading.depth, sourceRelativePath)
			} else {
				appendAdvertiseChunk(activeAdvertiseFrame, node, rawLines)
				continue
			}
		}

		if (node.type === "heading") {
			const heading = node as Heading
			if (heading.depth > 3) {
				menuError(sourceRelativePath, "Bitte nutzen Sie im Menü maximal #, ## und ###.", lineOf(heading))
			}
			const activeNode = topMenuNodeFromStack(stack)
			if (activeNode?.content) {
				const isStructuralBoundary = heading.depth <= activeNode.depth && columnOf(heading) <= 1
				if (!isStructuralBoundary) {
					const snippet = extractNodeSourceSnippet(node, rawLines)
					appendSectionContentChunk(activeNode, snippet, lineOf(heading))
					continue
				}
			}
			const parsedHeading = parseHeadingLabel(heading, sourceRelativePath)
			popUntilDepth(stack, heading.depth, sourceRelativePath)

			if (heading.depth === 1) {
				const topLevelNode: MutableMenuNode = {
					type: "item",
					label: parsedHeading.label,
					href: parsedHeading.href,
					tone: parsedHeading.tone,
					depth: heading.depth,
					line: lineOf(heading),
					sections: [],
					links: [],
				}
				topLevelEntries.push(topLevelNode)
				stack.push(topLevelNode)
				continue
			}

			const parent = requireCurrentMenuNode(
				stack,
				sourceRelativePath,
				"Bitte beginnen Sie das Menü mit einer Überschrift der Ebene #.",
				lineOf(heading),
			)
			if (heading.depth - parent.depth > 1) {
				menuError(sourceRelativePath, `Bitte überspringen Sie keine Überschriftenebene vor "${parsedHeading.label}".`, lineOf(heading))
			}

			if (isAdvertiseSectionLabel(parsedHeading.label)) {
				if (parsedHeading.href) {
					menuError(sourceRelativePath, `Der advertise-Abschnitt darf nicht als Link formatiert sein.`, lineOf(heading))
				}
				if (heading.depth !== 2 || parent.depth !== 1) {
					menuError(sourceRelativePath, `Der advertise-Abschnitt ist nur als "## advertise" unter einem Top-Level-Menüpunkt erlaubt.`, lineOf(heading))
				}
				if (parent.advertise) {
					menuError(sourceRelativePath, `Im Abschnitt "${parent.label}" ist nur ein advertise-Abschnitt erlaubt.`, lineOf(heading))
				}
				const advertiseFrame: MutableAdvertiseFrame = {
					type: "advertise",
					depth: heading.depth,
					line: lineOf(heading),
					parent,
					chunks: [],
				}
				stack.push(advertiseFrame)
				continue
			}

			const menuNode: MutableMenuNode = {
				type: "item",
				label: parsedHeading.label,
				href: parsedHeading.href,
				tone: parsedHeading.tone,
				depth: heading.depth,
				line: lineOf(heading),
				sections: [],
				links: [],
			}
			if (parent.links.length > 0 || parent.button || parent.content) {
				menuError(sourceRelativePath, `Im Abschnitt "${parent.label}" können nach Liste, Abschlussbutton oder freien Inhalten keine weiteren Unterüberschriften folgen.`, lineOf(heading))
			}
			parent.sections.push(menuNode)
			stack.push(menuNode)
			continue
		}

		if (node.type === "thematicBreak") {
			const current = topMenuNodeFromStack(stack)
			if (current?.content) {
				const snippet = extractNodeSourceSnippet(node, rawLines)
				appendSectionContentChunk(current, snippet, lineOf(node))
				continue
			}
			topLevelEntries.push({ type: "separator", line: lineOf(node) })
			popAllStackEntries(stack, sourceRelativePath)
			continue
		}

		if (node.type === "list") {
			const current = requireCurrentMenuNode(stack, sourceRelativePath, "Eine Liste im Menü braucht eine Überschrift direkt darüber.", lineOf(node))
			if (current.sections.length > 0) {
				menuError(sourceRelativePath, `Im Abschnitt "${current.label}" ist statt der Liste bereits eine Unterüberschrift angelegt. Bitte Struktur vereinheitlichen.`, lineOf(node))
			}
			if (current.content) {
				menuError(sourceRelativePath, `Im Abschnitt "${current.label}" kann eine Linkliste nicht zusätzlich zu freien Inhalten verwendet werden.`, lineOf(node))
			}
			if (current.links.length > 0) {
				menuError(sourceRelativePath, `Im Abschnitt "${current.label}" ist nur eine ungeordnete Liste erlaubt.`, lineOf(node))
			}
			if (current.button) {
				menuError(sourceRelativePath, `Im Abschnitt "${current.label}" muss der Abschlussbutton nach der finalen Linkliste stehen.`, lineOf(node))
			}
			current.links = [...parseListLinks(node as List, sourceRelativePath)]
			continue
		}

		if (node.type === "paragraph") {
			const current = requireCurrentMenuNode(
				stack,
				sourceRelativePath,
				"Ein Absatz im Menü braucht eine Überschrift direkt darüber.",
				lineOf(node),
			)
			const paragraph = node as Paragraph
			const parsedButtonDirective = parseMenuButtonDirective(paragraph, sourceRelativePath, lineOf(node))
			if (parsedButtonDirective) {
				if (current.sections.length > 0) {
					menuError(sourceRelativePath, `Im Abschnitt "${current.label}" ist :::link als Abschlussbutton nicht erlaubt, solange Unterüberschriften verwendet werden.`, lineOf(node))
				}
				if (current.links.length === 0) {
					const snippet = extractNodeSourceSnippet(node, rawLines)
					appendSectionContentChunk(current, snippet, lineOf(node))
					continue
				}
				if (current.content) {
					menuError(sourceRelativePath, `Im Abschnitt "${current.label}" darf :::link als Abschlussbutton nicht mit freien Inhalten kombiniert werden.`, lineOf(node))
				}
				if (current.button) {
					menuError(sourceRelativePath, `Im Abschnitt "${current.label}" ist nur ein Abschlussbutton (:::link) erlaubt.`, lineOf(node))
				}
				const buttonSnippet = extractNodeSourceSnippet(node, rawLines)
				if (/^\s+:::link\b/iu.test(buttonSnippet)) {
					menuError(sourceRelativePath, `Der Abschlussbutton (:::link) darf nicht eingerückt sein. Setzen Sie ihn auf derselben Ebene wie die Linkliste.`, lineOf(node))
				}
				current.button = parsedButtonDirective
				continue
			}

			if (current.sections.length > 0) {
				menuError(sourceRelativePath, `Im Abschnitt "${current.label}" sind freie Inhalte nicht erlaubt, solange Unterüberschriften verwendet werden.`, lineOf(node))
			}
			if (current.links.length > 0) {
				menuError(sourceRelativePath, `Im Abschnitt "${current.label}" muss der Abschlussbutton als :::link nach der Liste stehen.`, lineOf(node))
			}

			const snippet = extractNodeSourceSnippet(node, rawLines)
			appendSectionContentChunk(current, snippet, lineOf(node))
			continue
		}

		if (node.type === "html") {
			const htmlNode = node as RootContent & { value?: string }
			if (/^\s*<!--[\s\S]*-->\s*$/.test(htmlNode.value ?? "")) {
				continue
			}
		}

		menuError(sourceRelativePath, "Dieser Inhalt wird im Menü nicht unterstützt. Bitte nur Überschriften, Listen, freie Inhalte, Trenner und :::link als Abschlussbutton verwenden.", lineOf(node))
	}

	popAllStackEntries(stack, sourceRelativePath)

	if (topLevelEntries.length === 0) {
		menuError(sourceRelativePath, "Die Menüvorlage enthält keinen Menüpunkt der Ebene #.", 1)
	}

	const topLevelItems = topLevelEntries.filter((entry): entry is MutableMenuNode => entry.type === "item")
	if (topLevelItems.length === 0) {
		menuError(sourceRelativePath, "Die Menüvorlage enthält keinen Menüpunkt der Ebene #.", 1)
	}

	const immutableEntries = topLevelEntries.map((entry): ManualMenuEntry => {
		if (entry.type === "separator") {
			return { type: "separator", line: entry.line }
		}
		return cloneNode(entry)
	})

	for (let index = 0; index < immutableEntries.length; index += 1) {
		const entry = immutableEntries[index]
		if (entry.type !== "separator") {
			continue
		}
		if (index === 0 || index === immutableEntries.length - 1) {
			menuError(sourceRelativePath, "Ein Menü-Trenner (---) darf nicht am Anfang oder Ende stehen.", entry.line)
		}
		const previousEntry = immutableEntries[index - 1]
		const nextEntry = immutableEntries[index + 1]
		if (!previousEntry || !nextEntry || previousEntry.type === "separator" || nextEntry.type === "separator") {
			menuError(sourceRelativePath, "Mehrere Menü-Trenner hintereinander sind nicht erlaubt.", entry.line)
		}
	}

	for (const item of immutableEntries) {
		if (item.type === "separator") {
			continue
		}
		validateStructure(item, sourceRelativePath)
		validateLinks(item, sourceRelativePath, knownInternalPaths)
	}
	return immutableEntries
}
