import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import type { VFile } from "vfile"
import { ContentModule } from "../../../remark/content-module"
import type { ContainerDirectiveNode, ContentProcessor, DirectiveContentNode } from "../../../remark/types"
import { choiceAttribute, cssSizeAttribute, defineAttributes, inlineStyleAttribute, numberAttribute, textAttribute } from "../../../remark/utils/attributes"
import { resolveInternalUrl } from "../../../remark/utils/base-path"
import { parseFrontmatter } from "../../../remark/utils/frontmatter"
import { createHtmlNode } from "../../../remark/utils/nodes"
import { buildStyleAttribute } from "../../../remark/utils/style"
import { escapeHtml } from "../../../remark/utils/text"
import { applyTemplateVariables, extractTemplateVariables, validateTemplateVariables } from "../../../remark/utils/template-variables"
import { collectPlainText } from "../../../remark/utils/content"
import { resolveBackgroundImageLayerPlan } from "../../../remark/utils/background-image-layers"

const PAGES_ROOT = resolve(process.cwd(), "src", "pages")
const MARKDOWN_EXTENSION = ".md"
/**
 * Customer feature toggle:
 * Set to false to disable the special cards-only author-image layout for non-featured entries.
 * This does not change any other page-teaser card behavior.
 */
const ENABLE_PAGE_TEASER_AUTHOR_IMAGE_CARDS = true

const pageTeaserValidators = defineAttributes({
	from: textAttribute({ required: true }),
	display: choiceAttribute<PageTeaserDisplay>({ choices: ["cards", "template", "stacked-cards", "revolver-caroussel"], defaultValue: "cards" }),
	color: choiceAttribute<PageTeaserTone>({ choices: ["light", "dark"], defaultValue: "light" }),
	order: choiceAttribute<PageTeaserOrder>({
		choices: ["recent", "random", "ascending", "descending"],
		defaultValue: "recent",
	}),
	limit: numberAttribute({ defaultValue: 0, min: 1 }),
	label: textAttribute({ defaultValue: "Teaser" }),
	button: textAttribute({ defaultValue: "Artikel öffnen" }),
	"height-focus": cssSizeAttribute(),
	"height-caroussel": cssSizeAttribute(),
	style: inlineStyleAttribute(),
})

type PageTeaserDisplay = "cards" | "template" | "stacked-cards" | "revolver-caroussel"
type PageTeaserTone = "light" | "dark"
type PageTeaserOrder = "recent" | "random" | "ascending" | "descending"
type TeaserImageSource = "thumbnail" | "author-image" | "none"

interface TeaserEntry {
	readonly sourcePath: string
	readonly url: string
	readonly title: string
	readonly summary: string | null
	readonly thumbnail: string | null
	readonly thumbnailAlt: string
	readonly featureThumbnail: string | null
	readonly featureThumbnailAlt: string
	readonly authorImage: string | null
	readonly authorImageAlt: string
	readonly imageSource: TeaserImageSource
	readonly updated: string | null
	readonly variables: Record<string, string>
	readonly frontmatter: Record<string, string>
}

/**
 * FeaturedItem describes one fixed slot assignment for a teaser entry.
 */
interface FeaturedItem {
	readonly position: number
	readonly target: string
	readonly raw: string
}

/**
 * FilterRule describes one content filter with optional exact matching.
 */
interface FilterRule {
	readonly field: string
	readonly exact: boolean
	readonly values: string[]
	readonly raw: string
}

interface ParsedFilterRule {
	readonly field: string
	readonly exact: boolean
	readonly values: string[]
}

interface TeaserWarningIssue {
	readonly sourcePath: string
	readonly reason: string
}

const toPosixPath = (value: string): string => value.replace(/\\/g, "/")
const PAGE_TEASER_WARNING_HINT_KEY = "__pageTeaserWarningHintShown"
const pageTeaserConsoleWarningSignatures = new Map<string, string>()

const ensureWithinPagesRoot = (resolvedPath: string, file: VFile, node: ContainerDirectiveNode): void => {
	const relativePath = toPosixPath(relative(PAGES_ROOT, resolvedPath))
	if (relativePath.startsWith("..") || relativePath.includes("../")) {
		file.fail("page-teaser darf nur Inhalte aus src/pages/ einbinden.", node)
	}
}

const resolveSourceDirectory = (raw: string, file: VFile, node: ContainerDirectiveNode): string => {
	const trimmed = raw.trim()
	if (trimmed.length === 0) {
		file.fail("page-teaser benötigt ein nicht-leeres Attribut \"from\".", node)
	}
	const isRelativeToFile = trimmed.startsWith("./") || trimmed.startsWith("../")
	const basePath = isRelativeToFile
		? (() => {
			const currentPath = file.path
			if (!currentPath) {
				file.fail("page-teaser benötigt einen Dateipfad, um relative Pfade aufzulösen.", node)
			}
			return dirname(currentPath)
		})()
		: PAGES_ROOT
	const normalized = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed
	const resolved = resolve(basePath, normalized)
	ensureWithinPagesRoot(resolved, file, node)
	if (!statSync(resolved, { throwIfNoEntry: false })?.isDirectory()) {
		file.fail(`page-teaser: Verzeichnis nicht gefunden: ${resolved}.`, node)
	}
	return resolved
}

const listMarkdownFiles = (directory: string, rootDirectory: string = directory): string[] => {
	const entries = readdirSync(directory, { withFileTypes: true })
	const files: string[] = []
	for (const entry of entries) {
		const fullPath = resolve(directory, entry.name)
		if (entry.isDirectory()) {
			files.push(...listMarkdownFiles(fullPath, rootDirectory))
			continue
		}
		if (!entry.isFile() || !entry.name.endsWith(MARKDOWN_EXTENSION)) {
			continue
		}
		if (entry.name === "index.md" && fullPath === resolve(rootDirectory, "index.md")) {
			continue
		}
		files.push(fullPath)
	}
	return files
}

const readFrontmatterValue = (data: Record<string, string>, key: string): string | null => {
	const raw = data[key]
	if (raw === undefined || raw === null) {
		return null
	}
	const value = String(raw).trim()
	return value.length > 0 ? value : null
}

const formatSourcePath = (sourcePath: string): string => {
	const relativePath = toPosixPath(relative(PAGES_ROOT, sourcePath))
	if (relativePath.startsWith("..")) {
		return sourcePath
	}
	return `src/pages/${relativePath}`
}

const GERMAN_MONTH_NAMES = [
	"Januar",
	"Februar",
	"März",
	"April",
	"Mai",
	"Juni",
	"Juli",
	"August",
	"September",
	"Oktober",
	"November",
	"Dezember",
] as const

const formatCardDate = (value: string | null): string | null => {
	if (!value) {
		return null
	}
	const trimmed = value.trim()
	if (trimmed.length === 0) {
		return null
	}
	const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(trimmed)
	if (isoDateMatch) {
		const year = Number.parseInt(isoDateMatch[1] ?? "", 10)
		const month = Number.parseInt(isoDateMatch[2] ?? "", 10)
		const day = Number.parseInt(isoDateMatch[3] ?? "", 10)
		if (Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day) && month >= 1 && month <= 12) {
			return `${day}. ${GERMAN_MONTH_NAMES[month - 1]} ${year}`
		}
		return null
	}
	const timestamp = Date.parse(trimmed)
	if (!Number.isFinite(timestamp)) {
		return null
	}
	return new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric" }).format(new Date(timestamp))
}

const resolvePageUrl = (sourcePath: string, file: VFile): string => {
	const relativePath = relative(PAGES_ROOT, sourcePath)
	if (relativePath.startsWith("..")) {
		file.fail(`page-teaser: Datei liegt nicht unter src/pages/: ${sourcePath}.`)
	}
	const normalized = toPosixPath(relativePath)
	if (!normalized.endsWith(MARKDOWN_EXTENSION)) {
		file.fail(`page-teaser: Datei ist kein Markdown: ${sourcePath}.`)
	}
	const withoutExtension = normalized.slice(0, -MARKDOWN_EXTENSION.length)
	if (withoutExtension === "index") {
		return resolveInternalUrl("/")
	}
	if (withoutExtension.endsWith("/index")) {
		const base = withoutExtension.slice(0, -"/index".length)
		return resolveInternalUrl(`/${base}/`)
	}
	return resolveInternalUrl(`/${withoutExtension}/`)
}

const isSkippableTemplateNode = (node: DirectiveContentNode): boolean => {
	if (node.type === "text") {
		return node.value.trim().length === 0
	}
	if (node.type === "paragraph") {
		return node.children.every((child) => child.type === "text" && child.value.trim().length === 0)
	}
	if (node.type === "html") {
		const value = node.value.trim()
		return value.length === 0 || value.startsWith("<!--")
	}
	return false
}

const hasTemplateContent = (nodes: DirectiveContentNode[]): boolean => {
	return nodes.some((node) => !isSkippableTemplateNode(node))
}

const collectTemplateVariables = (nodes: DirectiveContentNode[]): Set<string> => {
	const variables = new Set<string>()
	const walk = (value: unknown): void => {
		if (typeof value === "string") {
			const found = extractTemplateVariables(value)
			for (const entry of found) {
				variables.add(entry)
			}
			return
		}
		if (Array.isArray(value)) {
			value.forEach(walk)
			return
		}
		if (value && typeof value === "object") {
			for (const [key, entry] of Object.entries(value)) {
				if (key === "type" || key === "name" || key === "position") {
					continue
				}
				walk(entry)
			}
		}
	}
	nodes.forEach(walk)
	return variables
}

const applyTemplateToNodes = (nodes: DirectiveContentNode[], variables: Record<string, string>): DirectiveContentNode[] => {
	const replaceValue = (value: unknown): unknown => {
		if (typeof value === "string") {
			return applyTemplateVariables(value, variables)
		}
		if (Array.isArray(value)) {
			return value.map(replaceValue)
		}
		if (value && typeof value === "object") {
			const output: Record<string, unknown> = {}
			for (const [key, entry] of Object.entries(value)) {
				if (key === "type" || key === "name" || key === "position") {
					output[key] = entry
					continue
				}
				output[key] = replaceValue(entry)
			}
			return output
		}
		return value
	}
	return nodes.map((node) => replaceValue(node) as DirectiveContentNode)
}

const buildVariablesMap = (data: Record<string, string>): Record<string, string> => {
	const variables: Record<string, string> = {}
	for (const [key, value] of Object.entries(data)) {
		variables[key] = String(value)
	}
	return variables
}

const addTeaserWarningIssue = (issues: TeaserWarningIssue[], sourcePath: string, reason: string): void => {
	issues.push({ sourcePath, reason })
}

const emitTeaserWarnings = (issues: TeaserWarningIssue[], file: VFile, node: ContainerDirectiveNode, from: string): void => {
	const nodeStartLine = ((node as { position?: { start?: { line?: number } } }).position?.start?.line) ?? 0
	const contextKey = `${file.path ?? "<unknown-file>"}:${nodeStartLine}:${from}`
	if (issues.length === 0) {
		pageTeaserConsoleWarningSignatures.delete(contextKey)
		return
	}
	const uniqueByKey = new Map<string, TeaserWarningIssue>()
	issues.forEach((issue) => {
		const key = `${issue.sourcePath}::${issue.reason}`
		if (!uniqueByKey.has(key)) {
			uniqueByKey.set(key, issue)
		}
	})
	const uniqueIssues = [...uniqueByKey.values()].sort((left, right) => left.sourcePath.localeCompare(right.sourcePath, "de"))
	const data = file.data as Record<string, unknown>
	const hintAlreadyShown = data[PAGE_TEASER_WARNING_HINT_KEY] === true
	if (!hintAlreadyShown) {
		data[PAGE_TEASER_WARNING_HINT_KEY] = true
	}
	const messageLines = [
		"page-teaser Warnung: Einige Seiten wurden für den Teaser übersprungen.",
		...(!hintAlreadyShown
			? [
				"Hinweis: Entweder teaser-relevante Frontmatter-Felder ergänzen (title und mindestens summary/thumbnail/author-image; bei order=\"recent\" auch updated) oder teaser-ignore: true setzen.",
			]
			: []),
		"Betroffene Seiten:",
		...uniqueIssues.map((issue) => `- ${formatSourcePath(issue.sourcePath)}: ${issue.reason}`),
	]
	const message = messageLines.join("\n")
	file.message(message, node, "page-teaser:warning")
	const signature = uniqueIssues.map((issue) => `${issue.sourcePath}:${issue.reason}`).join("|")
	if (pageTeaserConsoleWarningSignatures.get(contextKey) === signature) {
		return
	}
	pageTeaserConsoleWarningSignatures.set(contextKey, signature)
	const consoleLines = [
		"[LyfMark][page-teaser] Warnung",
		`Datei: ${file.path ?? "<unknown-file>"}`,
		`from: ${from}`,
		...messageLines,
	]
	console.warn(consoleLines.join("\n"))
}

const toTeaserEntry = (sourcePath: string, file: VFile, issues: TeaserWarningIssue[]): TeaserEntry | null => {
	const markdown = readFileSync(sourcePath, "utf8")
	const frontmatter = parseFrontmatter(markdown, file, sourcePath)
	if ("teaser-ignore" in frontmatter) {
		return null
	}
	const title = readFrontmatterValue(frontmatter, "title")
	if (!title) {
		addTeaserWarningIssue(issues, sourcePath, "Frontmatter-Feld \"title\" fehlt.")
		return null
	}
	const summary = readFrontmatterValue(frontmatter, "summary")
	const thumbnail = readFrontmatterValue(frontmatter, "thumbnail")
	const thumbnailAlt = readFrontmatterValue(frontmatter, "thumbnail-alt")
	const authorImage = readFrontmatterValue(frontmatter, "author-image")
	const authorImageAlt = readFrontmatterValue(frontmatter, "author-image-alt")
	const resolvedThumbnail = thumbnail ? resolveInternalUrl(thumbnail) : null
	const resolvedAuthorImage = authorImage ? resolveInternalUrl(authorImage) : null
	const resolvedImage = resolvedThumbnail ?? resolvedAuthorImage
	const imageSource: TeaserImageSource = thumbnail ? "thumbnail" : authorImage ? "author-image" : "none"
	if (!summary && !resolvedImage) {
		addTeaserWarningIssue(issues, sourcePath, "Mindestens eines der Felder \"summary\", \"thumbnail\" oder \"author-image\" fehlt.")
		return null
	}
	const updated = readFrontmatterValue(frontmatter, "updated")
	const resolvedImageAlt = thumbnail
		? (thumbnailAlt ?? title)
		: authorImage
			? (authorImageAlt ?? thumbnailAlt ?? title)
			: title
	const url = resolvePageUrl(sourcePath, file)
	return {
		sourcePath,
		url,
		title,
		summary,
		thumbnail: resolvedImage,
		thumbnailAlt: resolvedImageAlt,
		featureThumbnail: resolvedThumbnail,
		featureThumbnailAlt: thumbnailAlt ?? title,
		authorImage: resolvedAuthorImage,
		authorImageAlt: authorImageAlt ?? thumbnailAlt ?? title,
		imageSource,
		updated,
		variables: buildVariablesMap(frontmatter),
		frontmatter,
	}
}

const sortEntries = (
	entries: TeaserEntry[],
	order: PageTeaserOrder,
	issues: TeaserWarningIssue[],
): TeaserEntry[] => {
	if (order === "recent") {
		const datedEntries: Array<{ entry: TeaserEntry; timestamp: number }> = []
		entries.forEach((entry) => {
			if (!entry.updated) {
				addTeaserWarningIssue(issues, entry.sourcePath, "Feld \"updated\" fehlt (erforderlich für order=\"recent\").")
				return
			}
			const timestamp = Date.parse(entry.updated)
			if (!Number.isFinite(timestamp)) {
				addTeaserWarningIssue(issues, entry.sourcePath, "Feld \"updated\" ist kein gültiges Datum (erforderlich für order=\"recent\").")
				return
			}
			datedEntries.push({ entry, timestamp })
		})
		if (datedEntries.length <= 1) {
			return datedEntries.map((entry) => entry.entry)
		}
		return [...datedEntries]
			.sort((left, right) => right.timestamp - left.timestamp)
			.map((entry) => entry.entry)
	}

	if (entries.length <= 1) {
		return entries
	}
	if (order === "random") {
		return entries
	}

	const sorted = [...entries].sort((left, right) => left.title.localeCompare(right.title, "de"))
	if (order === "descending") {
		return sorted.reverse()
	}
	return sorted
}

const renderTemplatePrimary = (
	entry: TeaserEntry,
	templateNodes: DirectiveContentNode[],
	templateVariables: Set<string>,
	file: VFile,
	buttonLabel: string,
): DirectiveContentNode[] => {
	validateTemplateVariables(`page-teaser-Template (${entry.sourcePath})`, templateVariables, entry.variables, file, { allowUnused: true })
	const renderedNodes = applyTemplateToNodes(templateNodes, entry.variables)
	return [
		createHtmlNode(`<li class=\"page-teaser__item\" data-page-teaser-item>`),
		createHtmlNode(`<article class=\"page-teaser__template\">`),
		createHtmlNode(`<div class=\"page-teaser__template-body\">`),
		...renderedNodes,
		createHtmlNode(`</div>`),
		createHtmlNode(`<a class=\"page-teaser__card-link\" href=\"${escapeHtml(entry.url)}\">${escapeHtml(buttonLabel)}</a>`),
		createHtmlNode(`</article>`),
		createHtmlNode(`</li>`),
	]
}

const readDirectiveContent = (node: ContainerDirectiveNode, file: VFile): string => {
	const raw = file.value
	if (typeof raw !== "string") {
		return ""
	}
	const position = (node as { position?: { start?: { offset?: number }; end?: { offset?: number } } }).position
	const start = position?.start?.offset
	const end = position?.end?.offset
	if (typeof start !== "number" || typeof end !== "number") {
		return ""
	}
	const block = raw.slice(start, end)
	const firstLineBreak = block.indexOf("\n")
	const withoutHeader = firstLineBreak === -1 ? "" : block.slice(firstLineBreak + 1)
	return withoutHeader.replace(/\n:::[^\n]*\s*$/s, "")
}

const extractDirectiveLines = (nodes: readonly DirectiveContentNode[], node: ContainerDirectiveNode, file: VFile): string[] => {
	const children = nodes
	if (children.length === 0) {
		return []
	}
	const lines: string[] = []
	const pushLine = (value: string): void => {
		const trimmed = value.trim()
		if (trimmed.length > 0) {
			lines.push(trimmed)
		}
	}
	const walk = (entry: DirectiveContentNode): void => {
		if (entry.type === "text" && "value" in entry) {
			pushLine(String(entry.value))
			return
		}
		if (entry.type === "paragraph" && Array.isArray((entry as { children?: DirectiveContentNode[] }).children)) {
			const text = collectPlainText((entry as { children: DirectiveContentNode[] }).children)
			pushLine(text)
			return
		}
		if (entry.type === "list" && Array.isArray((entry as { children?: DirectiveContentNode[] }).children)) {
			const list = entry as { ordered?: boolean; start?: number; children: DirectiveContentNode[] }
			const start = Number.isFinite(list.start) ? (list.start as number) : 1
			list.children.forEach((item, index) => {
				const text = collectPlainText((item as { children?: DirectiveContentNode[] }).children ?? [])
				if (text.trim().length === 0) {
					return
				}
				if (list.ordered) {
					pushLine(`${start + index}. ${text}`)
				} else {
					pushLine(`- ${text}`)
				}
			})
			return
		}
		if (Array.isArray((entry as { children?: DirectiveContentNode[] }).children)) {
			(entry as { children: DirectiveContentNode[] }).children.forEach(walk)
		}
	}
	children.forEach(walk)
	if (lines.length > 0) {
		return lines
	}
	const fallback = readDirectiveContent(node, file)
	if (fallback.trim().length === 0) {
		return []
	}
	return fallback.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0)
}

const parseFeaturedAndFilters = (
	node: ContainerDirectiveNode,
	nodes: readonly DirectiveContentNode[],
	file: VFile,
): { featured: FeaturedItem[]; filters: FilterRule[] } => {
	/**
	 * In non-template modes, page-teaser content is config-only. Any non-empty line
	 * must be either a featured position or a filter rule, otherwise parsing fails.
	 */
	const parseFilterBody = (body: string, line: string): ParsedFilterRule => {
		const ruleMatch = /^(.+?)(\s+exact)?\s*:\s*(.+)$/.exec(body)
		if (!ruleMatch) {
			file.fail(
				`page-teaser: Ungültige Konfigurationszeile "${line}". Erlaubt sind "1. /pfad" oder "- feld: wert".`,
				node,
			)
		}
		const field = ruleMatch[1]?.trim() ?? ""
		const exact = Boolean(ruleMatch[2])
		const valuesRaw = ruleMatch[3]?.trim() ?? ""
		const values = valuesRaw
			.split(",")
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0)
		if (field.length === 0 || values.length === 0) {
			file.fail(
				`page-teaser: Ungültige Konfigurationszeile "${line}". Erlaubt sind "1. /pfad" oder "- feld: wert".`,
				node,
			)
		}
		return { field, exact, values }
	}

	const lines = extractDirectiveLines(nodes, node, file)
	if (lines.length === 0) {
		return { featured: [], filters: [] }
	}
	const featured: FeaturedItem[] = []
	const filters: FilterRule[] = []
	for (const rawLine of lines) {
		const line = rawLine.trim()
		if (line.length === 0) {
			continue
		}
		const featureMatch = /^(\d+)[.)]\s+(.+)$/.exec(line)
		if (featureMatch) {
			const position = Number.parseInt(featureMatch[1] ?? "", 10)
			if (!Number.isFinite(position) || position <= 0) {
				file.fail(`page-teaser: Ungültige Feature-Position in "${line}".`)
			}
			const value = featureMatch[2]?.trim() ?? ""
			if (value.length === 0) {
				file.fail(`page-teaser: Feature-Eintrag ist leer: "${line}".`)
			}
			const target = value
			featured.push({ position, target, raw: line })
			continue
		}
		const filterMatch = /^-\s+(.+)$/.exec(line)
		if (!filterMatch) {
			if (/^\d/.test(line)) {
				file.fail(`page-teaser: Feature-Zeile ist ungültig: "${line}".`)
			}
			if (line.startsWith("<!--") && line.endsWith("-->")) {
				continue
			}
			if (/^.+:.+$/u.test(line)) {
				file.fail(
					`page-teaser: Filter-Zeilen müssen mit "-" beginnen. Ungültig: "${line}".`,
					node,
				)
			}
			file.fail(
				`page-teaser: Ungültige Konfigurationszeile "${line}". Erlaubt sind "1. /pfad" oder "- feld: wert".`,
				node,
			)
		}
		const body = filterMatch[1]?.trim() ?? ""
		if (body.length === 0) {
			file.fail(`page-teaser: Filter-Zeile ist leer: "${line}".`)
		}
		const parsedFilter = parseFilterBody(body, line)
		filters.push({ ...parsedFilter, raw: line })
	}
	return { featured, filters }
}

const normalizeFilterText = (value: string): string => value.trim().toLowerCase()

const resolveFrontmatterField = (frontmatter: Record<string, string>, field: string): string | null => {
	const target = field.trim().toLowerCase()
	for (const [key, value] of Object.entries(frontmatter)) {
		if (key.toLowerCase() === target) {
			return value
		}
	}
	return null
}

const matchesFilterRule = (entry: TeaserEntry, filter: FilterRule): boolean => {
	const rawValue = resolveFrontmatterField(entry.frontmatter, filter.field)
	if (!rawValue) {
		return false
	}
	const candidate = normalizeFilterText(rawValue)
	if (candidate.length === 0) {
		return false
	}
	if (filter.exact) {
		return filter.values.some((value) => candidate === normalizeFilterText(value))
	}
	return filter.values.some((value) => candidate.includes(normalizeFilterText(value)))
}

const collectAvailableFilterFields = (entries: TeaserEntry[]): string[] => {
	const fields = new Map<string, string>()
	entries.forEach((entry) => {
		Object.keys(entry.frontmatter).forEach((field) => {
			const normalized = field.trim().toLowerCase()
			if (normalized.length === 0 || fields.has(normalized)) {
				return
			}
			fields.set(normalized, field)
		})
	})
	return [...fields.values()].sort((left, right) => left.localeCompare(right, "de"))
}

const failOnUnknownFilterFields = (
	entries: TeaserEntry[],
	filters: FilterRule[],
	file: VFile,
	node: ContainerDirectiveNode,
): void => {
	if (filters.length === 0) {
		return
	}
	const availableFields = collectAvailableFilterFields(entries)
	const availableLookup = new Set(availableFields.map((field) => field.toLowerCase()))
	const unknownFields = [...new Set(
		filters
			.map((filter) => filter.field.trim())
			.filter((field) => field.length > 0)
			.filter((field) => !availableLookup.has(field.toLowerCase())),
	)]

	if (unknownFields.length === 0) {
		return
	}

	const preview = availableFields.slice(0, 8)
	const suffix = availableFields.length > preview.length ? ", ..." : ""
	file.fail(
		`page-teaser: Unbekannte Filter-Felder: ${unknownFields.join(", ")}. Verfügbare Felder: ${preview.join(", ")}${suffix}.`,
		node,
	)
}

const applyFilters = (
	entries: TeaserEntry[],
	filters: FilterRule[],
	file: VFile,
	node: ContainerDirectiveNode,
): TeaserEntry[] => {
	if (filters.length === 0) {
		return entries
	}
	failOnUnknownFilterFields(entries, filters, file, node)
	const filtered = entries.filter((entry) => filters.every((filter) => matchesFilterRule(entry, filter)))
	if (filtered.length === 0) {
		const configuredFilters = filters.map((filter) => filter.raw).join("; ")
		file.fail(
			`page-teaser: Die Filter-Einstellungen liefern keine Treffer (${configuredFilters}). Prüfe Werte und exact-Verwendung.`,
			node,
		)
	}
	return filtered
}

const normalizeFeaturedUrl = (value: string): string => {
	const trimmed = value.trim()
	if (trimmed.length === 0) {
		return ""
	}
	let normalized = trimmed
	if (/^https?:\/\//.test(normalized)) {
		try {
			const parsed = new URL(normalized)
			normalized = parsed.pathname
		} catch {
			// keep as-is
		}
	}
	normalized = normalized.split(/[?#]/)[0] ?? ""
	if (!normalized.startsWith("/")) {
		normalized = `/${normalized}`
	}
	if (!normalized.endsWith("/")) {
		normalized = `${normalized}/`
	}
	return resolveInternalUrl(normalized)
}

const resolveFeaturedEntries = (
	featured: FeaturedItem[],
	entries: TeaserEntry[],
	file: VFile,
	node: ContainerDirectiveNode,
): { entry: TeaserEntry; position: number }[] => {
	if (featured.length === 0) {
		return []
	}
	const byUrl = new Map<string, TeaserEntry>()
	entries.forEach((entry) => {
		byUrl.set(entry.url, entry)
	})
	const usedPositions = new Set<number>()
	const resolved: { entry: TeaserEntry; position: number }[] = []
	featured.forEach((item) => {
		if (usedPositions.has(item.position)) {
			file.fail(`page-teaser: Feature-Position ${item.position} ist doppelt vergeben.`, node)
		}
		usedPositions.add(item.position)
		const normalized = normalizeFeaturedUrl(item.target)
		if (!normalized) {
			file.fail(`page-teaser: Feature-Eintrag ist ungültig: "${item.raw}".`, node)
		}
		const entry = byUrl.get(normalized)
		if (!entry) {
			file.message(
				`page-teaser Warnung: Feature-Link wurde übersprungen, da kein gültiger Teaser-Eintrag gefunden wurde: "${item.raw}".`,
				node,
				"page-teaser:feature-warning",
			)
			return
		}
		resolved.push({ entry, position: item.position })
	})
	return resolved
}

const applyFeaturedOrdering = (entries: TeaserEntry[], featured: { entry: TeaserEntry; position: number }[]): TeaserEntry[] => {
	if (featured.length === 0) {
		return entries
	}
	const remaining = entries.filter((entry) => !featured.some((item) => item.entry === entry))
	const sortedFeatured = [...featured].sort((left, right) => left.position - right.position)
	const ordered = [...remaining]
	sortedFeatured.forEach((item) => {
		const index = Math.max(0, Math.min(item.position - 1, ordered.length))
		ordered.splice(index, 0, item.entry)
	})
	return ordered
}

const fixedPositionClassNames = (fixedPosition: number | null): string[] => {
	if (!fixedPosition || fixedPosition < 1) {
		return []
	}
	return ["page-teaser__item--fixed", `page-teaser__item--fixed-pos-${fixedPosition}`]
}

const renderCardItem = (
	entry: TeaserEntry,
	index: number,
	buttonLabel: string,
	fixedPosition: number | null,
): DirectiveContentNode[] => {
	const isFeatured = index === 0
	const isAuthorProfileCard = ENABLE_PAGE_TEASER_AUTHOR_IMAGE_CARDS && !isFeatured && Boolean(entry.authorImage)
	const featuredImage = entry.featureThumbnail ?? entry.authorImage
	const featuredImageAlt = entry.featureThumbnail ? entry.featureThumbnailAlt : entry.authorImageAlt
	const itemClasses = ["page-teaser__item", ...fixedPositionClassNames(fixedPosition)]
	if (isFeatured) {
		itemClasses.push("page-teaser__item--featured")
	}
	const cardClasses = ["page-teaser__card"]
	const hasFeaturedMedia = isFeatured && Boolean(featuredImage)
	if (hasFeaturedMedia) {
		cardClasses.push("page-teaser__card--with-media")
	}
	if (isAuthorProfileCard) {
		cardClasses.push("page-teaser__card--author")
	}
	const itemAttributes = [
		`class=\"${itemClasses.join(" ")}\"`,
		`data-page-teaser-item`,
		entry.featureThumbnail ? `data-page-teaser-thumbnail-src=\"${escapeHtml(entry.featureThumbnail)}\"` : "",
		entry.featureThumbnail ? `data-page-teaser-thumbnail-alt=\"${escapeHtml(entry.featureThumbnailAlt)}\"` : "",
		ENABLE_PAGE_TEASER_AUTHOR_IMAGE_CARDS && entry.authorImage ? `data-page-teaser-author-src=\"${escapeHtml(entry.authorImage)}\"` : "",
		ENABLE_PAGE_TEASER_AUTHOR_IMAGE_CARDS && entry.authorImage ? `data-page-teaser-author-alt=\"${escapeHtml(entry.authorImageAlt)}\"` : "",
	].filter((value) => value.length > 0).join(" ")
	let mediaMarkup = ""
	if (hasFeaturedMedia && featuredImage) {
		mediaMarkup = `<figure class=\"page-teaser__card-media\"><img src=\"${escapeHtml(featuredImage)}\" alt=\"${escapeHtml(featuredImageAlt)}\" loading=\"lazy\" decoding=\"async\" draggable=\"false\" /></figure>`
	} else if (isAuthorProfileCard && entry.authorImage) {
		mediaMarkup = `<figure class=\"page-teaser__card-media page-teaser__card-media--author\"><img src=\"${escapeHtml(entry.authorImage)}\" alt=\"${escapeHtml(entry.authorImageAlt)}\" loading=\"lazy\" decoding=\"async\" draggable=\"false\" /></figure>`
	}
	const summaryMarkup = entry.summary
		? `<p class=\"page-teaser__card-summary\">${escapeHtml(entry.summary)}</p>`
		: ""
	const cardDate = formatCardDate(entry.updated)
	const cardDateMarkup = cardDate
		? `<time class=\"page-teaser__card-date\" datetime=\"${escapeHtml(entry.updated ?? "")}\">${escapeHtml(cardDate)}</time>`
		: ""
	return [
		createHtmlNode(`<li ${itemAttributes}>`),
		createHtmlNode(`<article class=\"${cardClasses.join(" ")}\">`),
		createHtmlNode(mediaMarkup),
		createHtmlNode(`<div class=\"page-teaser__card-body\">`),
		createHtmlNode(`<h4 class=\"page-teaser__card-title\">${escapeHtml(entry.title)}</h4>`),
		createHtmlNode(summaryMarkup),
		createHtmlNode(`<div class=\"page-teaser__card-footer\">`),
		createHtmlNode(`<a class=\"page-teaser__card-link\" href=\"${escapeHtml(entry.url)}\">${escapeHtml(buttonLabel)}</a>`),
		createHtmlNode(cardDateMarkup),
		createHtmlNode(`</div>`),
		createHtmlNode(`</div>`),
		createHtmlNode(`</article>`),
		createHtmlNode(`</li>`),
	]
}

let pageTeaserStackedCardsInstance = 0
let pageTeaserRevolverCarousselInstance = 0

const renderStackedCardsItem = (
	entry: TeaserEntry,
	index: number,
	total: number,
	buttonLabel: string,
	instanceId: string,
): DirectiveContentNode[] => {
	const cardNumber = index + 1
	const cardOffset = index
	const isActive = index === 0
	const isVisible = cardOffset <= 2
	const itemClasses = ["stacked-cards__item"]
	if (isActive) {
		itemClasses.push("stacked-cards__item--active")
	}
	if (!isVisible) {
		itemClasses.push("stacked-cards__item--hidden")
	}
	const mediaMarkup = entry.thumbnail
		? `<figure class=\"page-teaser__card-media page-teaser__stacked-media\"><img src=\"${escapeHtml(entry.thumbnail)}\" alt=\"${escapeHtml(entry.thumbnailAlt)}\" loading=\"lazy\" decoding=\"async\" draggable=\"false\" /></figure>`
		: ""
	const summaryMarkup = entry.summary
		? `<p class=\"page-teaser__card-summary\">${escapeHtml(entry.summary)}</p>`
		: ""
	const cardDate = formatCardDate(entry.updated)
	const cardDateMarkup = cardDate
		? `<time class=\"page-teaser__card-date\" datetime=\"${escapeHtml(entry.updated ?? "")}\">${escapeHtml(cardDate)}</time>`
		: ""
	return [
		createHtmlNode(
			`<li class=\"${itemClasses.join(" ")}\" data-stacked-cards-item data-page-teaser-item data-stacked-cards-index=\"${index}\" data-stacked-cards-offset=\"${cardOffset}\" aria-hidden=\"${isActive ? "false" : "true"}\"${isActive ? "" : " inert"}>`,
		),
		createHtmlNode(`<article class=\"stacked-cards__card page-teaser__stacked-card\" aria-label=\"Karte ${cardNumber} von ${total}\">`),
		createHtmlNode(mediaMarkup),
		createHtmlNode(`<div class=\"stacked-cards__card-body page-teaser__stacked-card-body\">`),
		createHtmlNode(`<h4 class=\"page-teaser__card-title\">${escapeHtml(entry.title)}</h4>`),
		createHtmlNode(summaryMarkup),
		createHtmlNode(`<div class=\"page-teaser__stacked-card-footer\">`),
		createHtmlNode(`<a class=\"page-teaser__card-link\" href=\"${escapeHtml(entry.url)}\">${escapeHtml(buttonLabel)}</a>`),
		createHtmlNode(cardDateMarkup),
		createHtmlNode(`</div>`),
		createHtmlNode(`</div>`),
		createHtmlNode(`</article>`),
		createHtmlNode(`</li>`),
	]
}

const expandEntriesForRevolver = (entries: TeaserEntry[], minimumSize: number): TeaserEntry[] => {
	if (entries.length === 0 || entries.length >= minimumSize) {
		return entries
	}
	const expanded = [...entries]
	let sourceIndex = 0
	while (expanded.length < minimumSize) {
		expanded.push(entries[sourceIndex % entries.length] as TeaserEntry)
		sourceIndex += 1
	}
	return expanded
}

const renderRevolverCarousselItem = (
	entry: TeaserEntry,
	index: number,
	buttonLabel: string,
): DirectiveContentNode[] => {
	const mediaMarkup = entry.thumbnail
		? `<figure class=\"page-teaser__card-media page-teaser__revolver-media\"><img src=\"${escapeHtml(entry.thumbnail)}\" alt=\"${escapeHtml(entry.thumbnailAlt)}\" loading=\"lazy\" decoding=\"async\" draggable=\"false\" /></figure>`
		: ""
	const summaryMarkup = entry.summary
		? `<p class=\"page-teaser__card-summary\">${escapeHtml(entry.summary)}</p>`
		: ""
	const cardDate = formatCardDate(entry.updated)
	const cardDateMarkup = cardDate
		? `<time class=\"page-teaser__card-date\" datetime=\"${escapeHtml(entry.updated ?? "")}\">${escapeHtml(cardDate)}</time>`
		: ""

	return [
		createHtmlNode(
			`<li class=\"caroussel__slide page-teaser__revolver-slide\" data-caroussel-slide data-caroussel-index=\"${index}\" data-page-teaser-item>`,
		),
		createHtmlNode(`<article class=\"caroussel__card page-teaser__revolver-card\">`),
		createHtmlNode(mediaMarkup),
		createHtmlNode(`<div class=\"caroussel__card-content page-teaser__revolver-card-content\">`),
		createHtmlNode(`<div class=\"page-teaser__revolver-card-main\">`),
		createHtmlNode(`<h4 class=\"page-teaser__card-title\">${escapeHtml(entry.title)}</h4>`),
		createHtmlNode(summaryMarkup),
		createHtmlNode(`</div>`),
		createHtmlNode(`<div class=\"page-teaser__revolver-card-footer\">`),
		createHtmlNode(`<a class=\"page-teaser__card-link\" href=\"${escapeHtml(entry.url)}\">${escapeHtml(buttonLabel)}</a>`),
		createHtmlNode(cardDateMarkup),
		createHtmlNode(`</div>`),
		createHtmlNode(`</div>`),
		createHtmlNode(`</article>`),
		createHtmlNode(`</li>`),
	]
}

const pageTeaserProcessor: ContentProcessor = (attributes, context) => {
	const { node, file } = context
	const layerPlan = resolveBackgroundImageLayerPlan(node.children, "page-teaser", ["auto"], file)
	const from = attributes["from"] as string
	const display = attributes["display"] as PageTeaserDisplay
	const color = attributes["color"] as PageTeaserTone
	const order = attributes["order"] as PageTeaserOrder
	const limit = attributes["limit"] as number
	const label = attributes["label"] as string
	const buttonLabel = attributes["button"] as string
	const heightFocus = attributes["height-focus"] as string
	const heightCaroussel = attributes["height-caroussel"] as string
	const inlineStyle = attributes["style"] as string
	const declarations: string[] = []
	if (heightFocus) {
		declarations.push(`--page-teaser-featured-height: ${heightFocus}`)
	}
	if (heightCaroussel) {
		declarations.push(`--page-teaser-card-row-height: ${heightCaroussel}`)
	}

	const sourceDir = resolveSourceDirectory(from, file, node)
	const files = listMarkdownFiles(sourceDir)
	if (files.length === 0) {
		file.fail(`page-teaser: Keine Markdown-Dateien in ${sourceDir} gefunden.`, node)
	}
	const warningIssues: TeaserWarningIssue[] = []
	const entries = files
		.map((path) => toTeaserEntry(path, file, warningIssues))
		.filter((entry): entry is TeaserEntry => Boolean(entry))
	const sortedEntries = sortEntries(entries, order, warningIssues)
	emitTeaserWarnings(warningIssues, file, node, from)
	if (sortedEntries.length === 0) {
		return []
	}

	const templateNodes = layerPlan.contentNodes
	const templateVariables = collectTemplateVariables(templateNodes)
	if (display === "template" && !hasTemplateContent(templateNodes)) {
		file.fail("page-teaser: display=\"template\" benötigt ein Template im Modul-Inhalt.", node)
	}
	/**
	 * Filters and featured positions are content-selection rules and must be independent
	 * from sort order. This keeps authoring predictable for non-technical editors.
	 */
	const teaserConfig = display !== "template"
		? parseFeaturedAndFilters(node, templateNodes, file)
		: { featured: [], filters: [] }
	const filteredEntries = applyFilters(sortedEntries, teaserConfig.filters, file, node)
	const featuredEntries = resolveFeaturedEntries(teaserConfig.featured, filteredEntries, file, node)
	const fixedPositionsByEntry = new Map<TeaserEntry, number>()
	featuredEntries.forEach((item) => {
		fixedPositionsByEntry.set(item.entry, item.position)
	})
	const orderedEntries = applyFeaturedOrdering(filteredEntries, featuredEntries)
	const visibleEntries = limit > 0 ? orderedEntries.slice(0, limit) : orderedEntries
	const isCardGrid = display === "cards"
	const hasScrollViewport = isCardGrid && limit <= 0 && visibleEntries.length > 5
	const styleAttribute = buildStyleAttribute(declarations, inlineStyle)
	const featuredFlagAttribute = featuredEntries.length > 0 ? " data-page-teaser-has-featured" : ""

	const sectionClasses = ["page-teaser", `page-teaser--tone-${color}`, `page-teaser--display-${display}`]
	if (visibleEntries.length <= 1) {
		sectionClasses.push("page-teaser--single")
	}
	if (hasScrollViewport) {
		sectionClasses.push("page-teaser--scrollable")
	}

	const teaserNodes: DirectiveContentNode[] = []

	if (display === "cards") {
		visibleEntries.forEach((entry, index) => {
			teaserNodes.push(...renderCardItem(entry, index, buttonLabel, fixedPositionsByEntry.get(entry) ?? null))
		})
	} else if (display === "template") {
		visibleEntries.forEach((entry) => {
			teaserNodes.push(...renderTemplatePrimary(entry, templateNodes, templateVariables, file, buttonLabel))
		})
	} else if (display === "stacked-cards") {
		const instanceId = `page-teaser-stacked-cards-${pageTeaserStackedCardsInstance + 1}`
		pageTeaserStackedCardsInstance += 1
		const viewportId = `${instanceId}-viewport`
		visibleEntries.forEach((entry, index) => {
			teaserNodes.push(...renderStackedCardsItem(entry, index, visibleEntries.length, buttonLabel, instanceId))
		})

		const stackedNodes: DirectiveContentNode[] = [
			createHtmlNode(`<div class=\"page-teaser__stacked\">`),
			createHtmlNode(
				`<div class=\"stacked-cards stacked-cards--tone-${color}\" data-stacked-cards aria-label=\"${escapeHtml(label)}\" data-stacked-cards-size=\"${visibleEntries.length}\">`,
			),
			createHtmlNode(`<div class=\"stacked-cards__viewport\" id=\"${viewportId}\" data-stacked-cards-viewport tabindex=\"0\">`),
			createHtmlNode(`<ol class=\"stacked-cards__list\" data-page-teaser-grid role=\"list\">`),
			...teaserNodes,
			createHtmlNode(`</ol></div>`),
		]
		if (visibleEntries.length > 1) {
			stackedNodes.push(
				createHtmlNode(`<div class=\"stacked-cards__controls ui-arrow-group\" role=\"group\" aria-label=\"Karten wechseln\">`),
				createHtmlNode(
					`<button type=\"button\" class=\"stacked-cards__arrow stacked-cards__arrow--prev ui-arrow-button ui-arrow-button--outline\" data-stacked-cards-prev aria-controls=\"${viewportId}\" aria-label=\"Vorherige Karte\">` +
						`<span aria-hidden=\"true\">&#8592;</span>` +
					`</button>`,
				),
				createHtmlNode(
					`<button type=\"button\" class=\"stacked-cards__arrow stacked-cards__arrow--next ui-arrow-button\" data-stacked-cards-next aria-controls=\"${viewportId}\" aria-label=\"Nächste Karte\">` +
						`<span aria-hidden=\"true\">&#8594;</span>` +
					`</button>`,
				),
				createHtmlNode(`</div>`),
			)
		}
		stackedNodes.push(createHtmlNode(`</div>`), createHtmlNode(`</div>`))

			return [
				createHtmlNode(
					`<section class=\"${sectionClasses.join(" ")}\" data-bg-image-layer=\"auto\" data-page-teaser${featuredFlagAttribute} data-page-teaser-display=\"${display}\" data-page-teaser-order=\"${order}\" data-page-teaser-count=\"${visibleEntries.length}\" data-page-teaser-total=\"${orderedEntries.length}\" data-page-teaser-scrollable=\"false\" aria-label=\"${escapeHtml(label)}\"${styleAttribute}>`,
				),
				...layerPlan.renderLayerNodes("auto"),
				...stackedNodes,
				createHtmlNode(`</section>`),
			]
	} else {
		const instanceId = `page-teaser-revolver-caroussel-${pageTeaserRevolverCarousselInstance + 1}`
		pageTeaserRevolverCarousselInstance += 1
		const viewportId = `${instanceId}-viewport`
		const revolverEntries = expandEntriesForRevolver(visibleEntries, 3)
		revolverEntries.forEach((entry, index) => {
			teaserNodes.push(...renderRevolverCarousselItem(entry, index, buttonLabel))
		})

		const revolverNodes: DirectiveContentNode[] = [
			createHtmlNode(`<div class=\"page-teaser__revolver\">`),
			createHtmlNode(
				`<section class=\"caroussel caroussel--tone-${color} caroussel--display-revolver\" data-caroussel data-caroussel-display=\"revolver\" data-page-teaser-revolver=\"true\" aria-label=\"${escapeHtml(label)}\">`,
			),
			createHtmlNode(`<div class=\"caroussel__viewport\" id=\"${viewportId}\" data-caroussel-viewport tabindex=\"0\">`),
			createHtmlNode(`<ul class=\"caroussel__track\" data-caroussel-track data-page-teaser-grid role=\"list\">`),
			...teaserNodes,
			createHtmlNode(`</ul></div>`),
		]
		if (visibleEntries.length > 1) {
			revolverNodes.push(
				createHtmlNode(`<div class=\"caroussel__controls ui-arrow-group\" role=\"group\" aria-label=\"Karten wechseln\">`),
				createHtmlNode(
					`<button type=\"button\" class=\"caroussel__arrow caroussel__arrow--prev ui-arrow-button\" data-caroussel-prev aria-controls=\"${viewportId}\" aria-label=\"Vorherige Karte\">` +
						`<span aria-hidden=\"true\">&#8592;</span>` +
					`</button>`,
				),
				createHtmlNode(
					`<button type=\"button\" class=\"caroussel__arrow caroussel__arrow--next ui-arrow-button\" data-caroussel-next aria-controls=\"${viewportId}\" aria-label=\"Nächste Karte\">` +
						`<span aria-hidden=\"true\">&#8594;</span>` +
					`</button>`,
				),
				createHtmlNode(`</div>`),
			)
		}
		revolverNodes.push(createHtmlNode(`</section>`), createHtmlNode(`</div>`))

			return [
				createHtmlNode(
					`<section class=\"${sectionClasses.join(" ")}\" data-bg-image-layer=\"auto\" data-page-teaser${featuredFlagAttribute} data-page-teaser-display=\"${display}\" data-page-teaser-order=\"${order}\" data-page-teaser-count=\"${visibleEntries.length}\" data-page-teaser-total=\"${orderedEntries.length}\" data-page-teaser-scrollable=\"false\" aria-label=\"${escapeHtml(label)}\"${styleAttribute}>`,
				),
				...layerPlan.renderLayerNodes("auto"),
				...revolverNodes,
				createHtmlNode(`</section>`),
			]
	}

	return [
		createHtmlNode(
			`<section class=\"${sectionClasses.join(" ")}\" data-bg-image-layer=\"auto\" data-page-teaser${featuredFlagAttribute} data-page-teaser-display=\"${display}\" data-page-teaser-order=\"${order}\" data-page-teaser-count=\"${visibleEntries.length}\" data-page-teaser-total=\"${orderedEntries.length}\" data-page-teaser-scrollable=\"${hasScrollViewport ? "true" : "false"}\" aria-label=\"${escapeHtml(label)}\"${styleAttribute}>`,
		),
		...layerPlan.renderLayerNodes("auto"),
		createHtmlNode(`<div class=\"page-teaser__viewport${hasScrollViewport ? " page-teaser__viewport--scrollable" : " page-teaser__viewport--static"}\"${hasScrollViewport ? " data-page-teaser-viewport tabindex=\"0\"" : ""}>`),
		createHtmlNode(`<ol class=\"page-teaser__grid page-teaser__grid--${display}\" data-page-teaser-grid role=\"list\">`),
		...teaserNodes,
		createHtmlNode(`</ol>`),
		createHtmlNode(`</div>`),
		createHtmlNode(`</section>`),
	]
}

/**
 * page-teaser renders entries from a pages directory as cards, stacked cards,
 * a revolver carousel, or a template-based list.
 */
export const pageTeaserModule = ContentModule("page-teaser", pageTeaserValidators, pageTeaserProcessor)
