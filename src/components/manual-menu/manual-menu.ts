import { loadManualMenuTemplate } from "~/components/manual-menu/manual-menu.source"
import type { ManualMenuTemplate } from "~/components/manual-menu/manual-menu.types"
import { normalizeSitePath, stripBasePath } from "~/utils/path-utils"

type MarkdownPageModule = {
	url: string
}

const collectKnownInternalPaths = (basePath: string): ReadonlySet<string> => {
	const pageModules = Object.values(import.meta.glob("~/pages/**/*.md", { eager: true })) as MarkdownPageModule[]
	const knownInternalPaths = new Set<string>(["/"])

	for (const module of pageModules) {
		if (!module.url) {
			continue
		}
		knownInternalPaths.add(normalizeSitePath(stripBasePath(module.url, basePath)))
	}

	return knownInternalPaths
}

/**
 * High-level menu loader for request path + project basePath.
 * Contract: resolves language-specific source and validates all menu links.
 */
export const loadManualMenuTemplateForPath = async (pathnameWithoutBase: string, basePath: string): Promise<ManualMenuTemplate> => {
	const knownInternalPaths = collectKnownInternalPaths(basePath)
	return loadManualMenuTemplate({ pathnameWithoutBase, knownInternalPaths })
}

/**
 * Normalizes internal paths for menu-related checks.
 */
export const normalizeMenuPath = (urlPath: string): string => {
	return normalizeSitePath(urlPath)
}

export type {
	LoadManualMenuOptions,
	ManualMenuEntry,
	ManualMenuNode,
	ManualMenuSeparator,
	ManualMenuTemplate,
	MenuLink,
	MenuTextTone,
} from "~/components/manual-menu/manual-menu.types"
