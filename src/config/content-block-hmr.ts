import { realpathSync } from "node:fs"
import path from "node:path"
import type { AstroIntegration } from "astro"
import { normalizePath } from "vite"

const PROJECT_ROOT = process.cwd()
const RELOAD_DEBOUNCE_MS = 40
const EVENT_DEDUP_WINDOW_MS = 120
const PAGE_MODULE_EXTENSIONS = new Set([".md", ".mdx", ".astro"])

type SourceDefinition = {
	key: "content-blocks" | "navigation" | "forms" | "pages"
	label: string
	extensions: ReadonlySet<string>
	directories: readonly string[]
}

type ResolvedSourceDefinition = SourceDefinition & {
	compareDirectories: string[]
}

const WATCHED_SOURCES: readonly SourceDefinition[] = [
	{
		key: "content-blocks",
		label: "Content blocks",
		extensions: new Set([".md"]),
		directories: ["content-blocks", "src/content-blocks"],
	},
	{
		key: "navigation",
		label: "Navigation menus",
		extensions: new Set([".md"]),
		directories: ["navigation", "src/navigation"],
	},
	{
		key: "forms",
		label: "Form presets",
		extensions: new Set([".html"]),
		directories: ["forms", "src/forms"],
	},
	{
		key: "pages",
		label: "Pages",
		extensions: new Set([".md", ".mdx", ".astro"]),
		directories: ["pages", "src/pages"],
	},
]

const normalizeComparison = (value: string): string => {
	const normalized = normalizePath(value)
	return process.platform === "win32" ? normalized.toLowerCase() : normalized
}

const normalizeAbsolutePath = (targetPath: string): string => {
	const absolutePath = path.isAbsolute(targetPath) ? targetPath : path.resolve(PROJECT_ROOT, targetPath)
	return normalizePath(absolutePath)
}

const tryResolveRealPath = (targetPath: string): string | null => {
	try {
		return normalizePath(realpathSync.native(targetPath))
	} catch {
		return null
	}
}

const deduplicatePaths = (paths: string[]): string[] => {
	const seen = new Set<string>()
	const uniquePaths: string[] = []
	for (const candidatePath of paths) {
		const key = normalizeComparison(candidatePath)
		if (seen.has(key)) {
			continue
		}
		seen.add(key)
		uniquePaths.push(candidatePath)
	}
	return uniquePaths
}

const resolveDirectoryAliases = (relativeDirectories: readonly string[]): string[] => {
	const absoluteDirectories = relativeDirectories.map((relativeDirectory) =>
		normalizePath(path.resolve(PROJECT_ROOT, relativeDirectory)),
	)
	const realDirectories = absoluteDirectories
		.map((absoluteDirectory) => tryResolveRealPath(absoluteDirectory))
		.filter((value): value is string => Boolean(value))
	return deduplicatePaths([...absoluteDirectories, ...realDirectories])
}

const isPathInsideDirectory = (targetPath: string, directoryPath: string): boolean => {
	const normalizedTarget = normalizeComparison(targetPath)
	const normalizedDirectory = normalizeComparison(directoryPath)
	const withTrailingSlash = normalizedDirectory.endsWith("/") ? normalizedDirectory : `${normalizedDirectory}/`
	return normalizedTarget === normalizedDirectory || normalizedTarget.startsWith(withTrailingSlash)
}

const normalizeModuleIdToFilePath = (moduleId: string): string => {
	const withoutQuery = normalizePath(moduleId).split("?", 1)[0]
	return withoutQuery.startsWith("/@fs/") ? withoutQuery.slice(4) : withoutQuery
}

const resolveSourceDefinitions = (): ResolvedSourceDefinition[] =>
	WATCHED_SOURCES.map((source) => ({
		...source,
		compareDirectories: resolveDirectoryAliases(source.directories),
	}))

type MatchedChange = {
	source: ResolvedSourceDefinition
	relativePath: string
	dedupeKey: string
}

const resolveMatchedChange = (changedPath: string, resolvedSources: readonly ResolvedSourceDefinition[]): MatchedChange | null => {
	const absoluteChangedPath = normalizeAbsolutePath(changedPath)
	const canonicalChangedPath = tryResolveRealPath(absoluteChangedPath) ?? absoluteChangedPath
	const extension = path.extname(canonicalChangedPath).toLowerCase()

	for (const source of resolvedSources) {
		if (!source.extensions.has(extension)) {
			continue
		}

		for (const directoryAlias of source.compareDirectories) {
			const referencePath = isPathInsideDirectory(canonicalChangedPath, directoryAlias)
				? canonicalChangedPath
				: isPathInsideDirectory(absoluteChangedPath, directoryAlias)
					? absoluteChangedPath
					: null
			if (!referencePath) {
				continue
			}

			const relativePath = normalizePath(path.relative(directoryAlias, referencePath))
			if (relativePath.startsWith("../")) {
				continue
			}
			return {
				source,
				relativePath,
				dedupeKey: `${source.key}:${normalizeComparison(relativePath)}`,
			}
		}
	}

	return null
}

/**
 * Creates a dev-only integration that keeps page output in sync when linked root/source
 * content files change. Contract:
 * - Watches both root folders and mirrored src link paths.
 * - Canonicalizes paths and deduplicates duplicate watcher events.
 * - Invalidates page modules and triggers one full reload per change burst.
 */
export const contentBlockHmrIntegration = (): AstroIntegration => {
	return {
		name: "lyfmark-content-block-hmr",
		hooks: {
			"astro:server:setup": ({ server, logger }) => {
				const resolvedSources = resolveSourceDefinitions()
				const pageSources = resolvedSources.filter((source) => source.key === "pages")
				const watchDirectories = deduplicatePaths(
					WATCHED_SOURCES.flatMap((source) =>
						source.directories.map((relativeDirectory) => normalizePath(path.resolve(PROJECT_ROOT, relativeDirectory))),
					),
				)
				server.watcher.add(watchDirectories)

				let pendingReloadTimer: ReturnType<typeof setTimeout> | null = null
				const recentChangeKeys = new Map<string, number>()

				const scheduleReload = (): void => {
					if (pendingReloadTimer) {
						clearTimeout(pendingReloadTimer)
					}
					pendingReloadTimer = setTimeout(() => {
						server.ws.send({ type: "full-reload" })
						pendingReloadTimer = null
					}, RELOAD_DEBOUNCE_MS)
				}

				const isDuplicateEvent = (dedupeKey: string): boolean => {
					const now = Date.now()
					for (const [key, timestamp] of recentChangeKeys) {
						if (now - timestamp > EVENT_DEDUP_WINDOW_MS) {
							recentChangeKeys.delete(key)
						}
					}
					const previousTimestamp = recentChangeKeys.get(dedupeKey)
					if (previousTimestamp && now - previousTimestamp < EVENT_DEDUP_WINDOW_MS) {
						return true
					}
					recentChangeKeys.set(dedupeKey, now)
					return false
				}

				const invalidatePageModules = (): number => {
					let invalidatedCount = 0
					for (const moduleNode of server.moduleGraph.idToModuleMap.values()) {
						const moduleId = moduleNode.id
						if (!moduleId) {
							continue
						}
						const moduleFilePath = normalizeModuleIdToFilePath(moduleId)
						const moduleExtension = path.extname(moduleFilePath).toLowerCase()
						if (!PAGE_MODULE_EXTENSIONS.has(moduleExtension)) {
							continue
						}
						const belongsToPages = pageSources.some((pageSource) =>
							pageSource.compareDirectories.some((directoryAlias) => isPathInsideDirectory(moduleFilePath, directoryAlias)),
						)
						if (!belongsToPages) {
							continue
						}

						server.moduleGraph.invalidateModule(moduleNode)
						invalidatedCount += 1
					}
					return invalidatedCount
				}

				const maybeHandleContentSourceChange = (changedPath: string): void => {
					const matchedChange = resolveMatchedChange(changedPath, resolvedSources)
					if (!matchedChange || isDuplicateEvent(matchedChange.dedupeKey)) {
						return
					}

					const invalidatedCount = invalidatePageModules()
					logger.info(
						`${matchedChange.source.label} changed (${matchedChange.relativePath}) -> invalidated ${invalidatedCount} page modules.`,
					)
					scheduleReload()
				}

				server.watcher.on("change", maybeHandleContentSourceChange)
				server.watcher.on("add", maybeHandleContentSourceChange)
				server.watcher.on("unlink", maybeHandleContentSourceChange)
			},
		},
	}
}
