import { promises as filesystem } from "node:fs"
import path from "node:path"
import { createMarkdownProcessor, type RemarkPlugin } from "@astrojs/markdown-remark"
import remarkSmartypants from "remark-smartypants"
import { directivesToBlocks } from "~/remark/directives-to-blocks"
import { normalizeSitePath } from "~/utils/path-utils"
import { parseManualMenuMarkdown } from "~/components/manual-menu/manual-menu.parser"
import type {
	LoadManualMenuOptions,
	ManualMenuEntry,
	ManualMenuNode,
	ManualMenuTemplate,
} from "~/components/manual-menu/manual-menu.types"

const MENU_ROOT = path.resolve("src/navigation")
const menuRemarkPlugins: RemarkPlugin[] = [directivesToBlocks, remarkSmartypants as RemarkPlugin]
const advertiseMarkdownProcessorPromise = createMarkdownProcessor({
	smartypants: false,
	remarkPlugins: menuRemarkPlugins,
})

const menuFileError = (message: string): never => {
	throw new Error(`[Menüvorlage src/navigation/menu.md] ${message}`)
}

const fileExists = async (filePath: string): Promise<boolean> => {
	try {
		await filesystem.access(filePath)
		return true
	} catch {
		return false
	}
}

const resolveMenuFilePath = async (pathnameWithoutBase: string): Promise<string> => {
	const normalizedPath = normalizeSitePath(pathnameWithoutBase)
	const isEnglishPath = normalizedPath === "/en" || normalizedPath.startsWith("/en/")

	const defaultPath = path.join(MENU_ROOT, "menu.md")
	if (!isEnglishPath) {
		if (await fileExists(defaultPath)) {
			return defaultPath
		}
		menuFileError('Die zentrale Menüdatei wurde nicht gefunden. Bitte legen Sie "src/navigation/menu.md" an.')
	}

	const englishPath = path.join(MENU_ROOT, "en", "menu.md")
	if (await fileExists(englishPath)) {
		return englishPath
	}
	if (await fileExists(defaultPath)) {
		return defaultPath
	}
	menuFileError('Es wurde weder "src/navigation/en/menu.md" noch "src/navigation/menu.md" gefunden.')
	throw new Error("Unreachable")
}

const renderMenuMarkdown = async (
	markdown: string,
	sourceRelativePath: string,
	line: number,
	sectionLabel: string,
): Promise<string> => {
	try {
		const processor = await advertiseMarkdownProcessorPromise
		const rendered = await processor.render(markdown, { frontmatter: {} })
		const html = rendered.code.trim()
		if (html.length === 0) {
			throw new Error(`[Menüvorlage ${sourceRelativePath} (Zeile ${line})] Der Abschnitt "${sectionLabel}" ist leer und konnte nicht gerendert werden.`)
		}
		return html
	} catch (error) {
		const reason = error instanceof Error ? error.message : "Unbekannter Render-Fehler."
		throw new Error(`[Menüvorlage ${sourceRelativePath} (Zeile ${line})] Der Abschnitt "${sectionLabel}" konnte nicht gerendert werden: ${reason}`)
	}
}

const hydrateNodeRenderedHtml = async (node: ManualMenuNode, sourceRelativePath: string): Promise<ManualMenuNode> => {
	const hydratedSections = await Promise.all(node.sections.map((section) => hydrateNodeRenderedHtml(section, sourceRelativePath)))
	const hydratedContent = node.content
		? {
				...node.content,
				html: await renderMenuMarkdown(node.content.markdown, sourceRelativePath, node.content.line, `${node.label} (Inhalt)`),
			}
		: undefined
	const hydratedAdvertise = node.advertise
		? {
				...node.advertise,
				html: await renderMenuMarkdown(node.advertise.markdown, sourceRelativePath, node.advertise.line, `${node.label} (advertise)`),
			}
		: undefined

	return {
		...node,
		sections: hydratedSections,
		content: hydratedContent,
		advertise: hydratedAdvertise,
	}
}

const hydrateMenuRenderedHtml = async (entries: readonly ManualMenuEntry[], sourceRelativePath: string): Promise<readonly ManualMenuEntry[]> => {
	const hydratedEntries = await Promise.all(
		entries.map(async (entry): Promise<ManualMenuEntry> => {
			if (entry.type === "separator") {
				return entry
			}
			return hydrateNodeRenderedHtml(entry, sourceRelativePath)
		}),
	)
	return hydratedEntries
}

/**
 * Loads and validates the central menu template for the current language path.
 * Contract: throws if source file is missing, malformed, or references invalid links.
 */
export const loadManualMenuTemplate = async (options: LoadManualMenuOptions): Promise<ManualMenuTemplate> => {
	const sourcePath = await resolveMenuFilePath(options.pathnameWithoutBase)
	const sourceRelativePath = path.relative(process.cwd(), sourcePath)
	const markdown = await filesystem.readFile(sourcePath, "utf8")
	const parsedItems = parseManualMenuMarkdown(markdown, sourceRelativePath, options.knownInternalPaths)
	const items = await hydrateMenuRenderedHtml(parsedItems, sourceRelativePath)
	return { sourcePath, sourceRelativePath, items }
}
