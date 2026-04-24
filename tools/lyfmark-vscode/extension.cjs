const fs = require("node:fs")
const path = require("node:path")
const { createRequire } = require("node:module")
const vscode = require("vscode")
const { URL_COMPLETION_RULES, FRONTMATTER_URL_COMPLETION_RULES } = require("./rules.cjs")
const { FALLBACK_LUCIDE_ICON_NAMES } = require("./lucide-icons.cjs")

const IMAGE_EXTENSIONS = new Set([".avif", ".gif", ".jpg", ".jpeg", ".png", ".svg", ".webp"])
const CACHE_TTL_MS = 2000
const CONTENT_BLOCKS_ROOT_DIRS = ["content-blocks", "src/content-blocks"]

const suggestionCache = new Map()

const toPosixPath = (value) => value.split(path.sep).join("/")

const toLower = (value) => value.toLowerCase()

const toKebabCase = (value) =>
	value
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/[^a-zA-Z0-9-]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.toLowerCase()

const asRootDirList = (source) => {
	if (Array.isArray(source?.rootDirs)) {
		return source.rootDirs.filter((rootDir) => typeof rootDir === "string" && rootDir.trim().length > 0)
	}
	if (typeof source?.rootDir === "string" && source.rootDir.trim().length > 0) {
		return [source.rootDir]
	}
	return []
}

const findRule = (moduleName, attributeName) => {
	const normalizedModule = toLower(moduleName)
	const normalizedAttribute = toLower(attributeName)
	return (
		URL_COMPLETION_RULES.find(
			(rule) => toLower(rule.module) === normalizedModule && toLower(rule.attribute) === normalizedAttribute,
		) ?? null
	)
}

const findFrontmatterRule = (fieldName) => {
	const normalizedFieldName = toLower(fieldName)
	return FRONTMATTER_URL_COMPLETION_RULES.find((rule) => toLower(rule.field) === normalizedFieldName) ?? null
}

const normalizeFrontmatterFence = (value) => value.replace(/^\uFEFF/, "").trim()

const resolveFrontmatterContext = (document, position) => {
	if (document.lineCount < 3) {
		return null
	}
	const firstLine = normalizeFrontmatterFence(document.lineAt(0).text)
	if (firstLine !== "---") {
		return null
	}
	let frontmatterEndLine = -1
	for (let lineIndex = 1; lineIndex < document.lineCount; lineIndex += 1) {
		const lineText = document.lineAt(lineIndex).text.trim()
		if (lineText === "---" || lineText === "...") {
			frontmatterEndLine = lineIndex
			break
		}
	}
	if (frontmatterEndLine <= 0 || position.line <= 0 || position.line >= frontmatterEndLine) {
		return null
	}

	const linePrefix = document.lineAt(position.line).text.slice(0, position.character)
	const separatorIndex = linePrefix.indexOf(":")
	if (separatorIndex <= 0) {
		return null
	}
	const fieldName = linePrefix.slice(0, separatorIndex).trim()
	if (!/^[a-z0-9_-]+$/iu.test(fieldName)) {
		return null
	}
	const rule = findFrontmatterRule(fieldName)
	if (!rule) {
		return null
	}

	const rawValuePrefix = linePrefix.slice(separatorIndex + 1)
	const trimmedValuePrefix = rawValuePrefix.trimStart()
	if (trimmedValuePrefix.startsWith("#")) {
		return null
	}
	let valuePrefix = trimmedValuePrefix
	if (valuePrefix.startsWith("\"") || valuePrefix.startsWith("'")) {
		valuePrefix = valuePrefix.slice(1)
	}
	if (valuePrefix.endsWith("\"") || valuePrefix.endsWith("'")) {
		valuePrefix = valuePrefix.slice(0, -1)
	}

	return {
		rule,
		valuePrefix,
	}
}

const resolveDirectiveContext = (document, position) => {
	const line = document.lineAt(position.line).text
	const linePrefix = line.slice(0, position.character)
	const directiveMatch = /^\s*:::\s*([a-z0-9-]+(?:\/[a-z0-9-]+)*)/iu.exec(linePrefix)
	if (!directiveMatch || !directiveMatch[1]) {
		return null
	}

	const attributeMatch = /([a-z0-9-]+)\s*=\s*(["'])([^"']*)$/iu.exec(linePrefix)
	if (!attributeMatch || !attributeMatch[1]) {
		return null
	}

	const moduleName = directiveMatch[1]
	const attributeName = attributeMatch[1]
	const valuePrefix = attributeMatch[3] ?? ""
	const rule = findRule(moduleName, attributeName)
	if (!rule) {
		return null
	}

	return {
		rule,
		valuePrefix,
	}
}

const resolveDirectiveNameContext = (document, position) => {
	const line = document.lineAt(position.line).text
	const linePrefix = line.slice(0, position.character)
	const nameMatch = /^(\s*:::\s*)([a-z0-9-\/]*)$/iu.exec(linePrefix)
	if (!nameMatch) {
		return null
	}
	const directivePrefix = nameMatch[1] ?? ""
	const lineIndentMatch = /^(\s*)/u.exec(directivePrefix)
	return {
		valuePrefix: nameMatch[2] ?? "",
		lineIndent: lineIndentMatch?.[1] ?? "",
	}
}

const hasOpenSquareBracketContext = (linePrefix) => {
	const lastOpenBracketIndex = linePrefix.lastIndexOf("[")
	const lastCloseBracketIndex = linePrefix.lastIndexOf("]")
	return lastOpenBracketIndex > lastCloseBracketIndex
}

const resolveLucideContext = (document, position) => {
	const line = document.lineAt(position.line).text
	const linePrefix = line.slice(0, position.character)
	if (!hasOpenSquareBracketContext(linePrefix)) {
		return null
	}
	const lastOpenBracketIndex = linePrefix.lastIndexOf("[")
	const bracketContent = linePrefix.slice(lastOpenBracketIndex + 1)
	if (bracketContent.includes("]")) {
		return null
	}
	const lucideMatch = /^lucide:\s*([^\]\n]*)$/iu.exec(bracketContent)
	if (!lucideMatch) {
		return null
	}
	return {
		valuePrefix: lucideMatch[1] ?? "",
	}
}

const normalizeLucideCandidates = (values) => {
	const normalizedValues = values
		.filter((value) => typeof value === "string")
		.map((value) => toKebabCase(value))
		.filter((value) => value.length > 0)
	return [...new Set(normalizedValues)]
}

const tryLoadWorkspaceLucideIcons = (workspaceFolder) => {
	const workspacePackageJsonPath = path.join(workspaceFolder.uri.fsPath, "package.json")
	try {
		const workspaceRequire = createRequire(workspacePackageJsonPath)
		const lucideIcons = workspaceRequire("lucide-static")
		if (lucideIcons && typeof lucideIcons === "object") {
			return normalizeLucideCandidates(Object.keys(lucideIcons))
		}
	} catch {
		return []
	}
	return []
}

const tryLoadBundledLucideIcons = () => {
	try {
		const extensionRequire = createRequire(__filename)
		const lucideIcons = extensionRequire("lucide-static")
		if (lucideIcons && typeof lucideIcons === "object") {
			return normalizeLucideCandidates(Object.keys(lucideIcons))
		}
	} catch {
		return []
	}
	return []
}

const collectImageCandidates = async (workspaceFolder, rootDir) => {
	const pattern = new vscode.RelativePattern(workspaceFolder, `${rootDir}/**/*`)
	const files = await vscode.workspace.findFiles(pattern)
	const publicRoot = path.join(workspaceFolder.uri.fsPath, "public")
	const values = []

	for (const fileUri of files) {
		const extension = toLower(path.extname(fileUri.fsPath))
		if (!IMAGE_EXTENSIONS.has(extension)) {
			continue
		}
		const relativeFromPublic = path.relative(publicRoot, fileUri.fsPath)
		if (relativeFromPublic.startsWith("..")) {
			continue
		}
		values.push(`/${toPosixPath(relativeFromPublic)}`)
	}

	return values
}

const toRoutePath = (pagesRoot, filePath) => {
	const relativeFilePath = toPosixPath(path.relative(pagesRoot, filePath))
	if (relativeFilePath.startsWith("../")) {
		return null
	}
	if (!/\.(md|mdx|astro)$/iu.test(relativeFilePath)) {
		return null
	}

	const routeWithoutExtension = relativeFilePath.replace(/\.(md|mdx|astro)$/iu, "")
	const segments = routeWithoutExtension.split("/").filter((segment) => segment.length > 0)
	if (segments.some((segment) => segment.startsWith("_") || segment.includes("["))) {
		return null
	}
	if (segments.length > 0 && segments[segments.length - 1] === "index") {
		segments.pop()
	}
	return segments.length === 0 ? "/" : `/${segments.join("/")}`
}

const collectPageRouteCandidates = async (workspaceFolder, rootDirs) => {
	const routes = new Set()

	for (const rootDir of rootDirs) {
		const patterns = [
			new vscode.RelativePattern(workspaceFolder, `${rootDir}/**/*.md`),
			new vscode.RelativePattern(workspaceFolder, `${rootDir}/**/*.mdx`),
			new vscode.RelativePattern(workspaceFolder, `${rootDir}/**/*.astro`),
		]
		const pagesRoot = path.join(workspaceFolder.uri.fsPath, rootDir)

		for (const pattern of patterns) {
			const files = await vscode.workspace.findFiles(pattern)
			for (const fileUri of files) {
				const route = toRoutePath(pagesRoot, fileUri.fsPath)
				if (route) {
					routes.add(route)
				}
			}
		}
	}

	return [...routes]
}

const collectContentBlockCandidates = async (workspaceFolder, rootDirs) => {
	const names = new Set()

	for (const rootDir of rootDirs) {
		const pattern = new vscode.RelativePattern(workspaceFolder, `${rootDir}/**/*.md`)
		const files = await vscode.workspace.findFiles(pattern)
		const contentBlocksRoot = path.join(workspaceFolder.uri.fsPath, rootDir)

		for (const fileUri of files) {
			const relativePath = toPosixPath(path.relative(contentBlocksRoot, fileUri.fsPath))
			if (relativePath.startsWith("../")) {
				continue
			}
			if (!relativePath.toLowerCase().endsWith(".md")) {
				continue
			}
			names.add(relativePath.slice(0, -3))
		}
	}

	return [...names]
}

const collectBuiltinDirectiveCandidates = async (workspaceFolder) => {
	const pattern = new vscode.RelativePattern(workspaceFolder, "src/lyfmark/modules/**/module.ts")
	const files = await vscode.workspace.findFiles(pattern)
	const directiveNames = new Set()
	for (const fileUri of files) {
		let source = ""
		try {
			source = await fs.promises.readFile(fileUri.fsPath, "utf8")
		} catch {
			continue
		}
		const moduleRegex = /ContentModule\(\s*"([a-z0-9-]+)"/giu
		let match = moduleRegex.exec(source)
		while (match) {
			const directiveName = (match[1] ?? "").trim().toLowerCase()
			if (directiveName.length > 0) {
				directiveNames.add(directiveName)
			}
			match = moduleRegex.exec(source)
		}
	}

	return [...directiveNames]
}

const collectLucideIconCandidates = async (workspaceFolder) => {
	const cacheKey = `${workspaceFolder.uri.fsPath}::lucide-icons`
	const now = Date.now()
	const cached = suggestionCache.get(cacheKey)
	if (cached && cached.expiresAt > now) {
		return cached.values
	}

	const workspaceValues = tryLoadWorkspaceLucideIcons(workspaceFolder)
	const bundledValues = workspaceValues.length > 0 ? [] : tryLoadBundledLucideIcons()
	const fallbackValues = workspaceValues.length > 0 || bundledValues.length > 0 ? [] : FALLBACK_LUCIDE_ICON_NAMES
	const values = normalizeLucideCandidates([...workspaceValues, ...bundledValues, ...fallbackValues])

	values.sort((left, right) => left.localeCompare(right))
	suggestionCache.set(cacheKey, {
		expiresAt: now + CACHE_TTL_MS,
		values,
	})
	return values
}

const normalizeSnippetBodyLines = (body) => {
	if (Array.isArray(body)) {
		return body.filter((line) => typeof line === "string")
	}
	if (typeof body === "string") {
		return [body]
	}
	return []
}

const readWorkspaceMarkdownSnippets = async (workspaceFolder) => {
	const snippetsPath = path.join(workspaceFolder.uri.fsPath, ".vscode", "markdown.code-snippets")
	let raw = ""
	try {
		raw = await fs.promises.readFile(snippetsPath, "utf8")
	} catch {
		return new Map()
	}

	let parsed = null
	try {
		parsed = JSON.parse(raw)
	} catch {
		return new Map()
	}

	if (!parsed || typeof parsed !== "object") {
		return new Map()
	}

	const snippetTemplates = new Map()
	for (const value of Object.values(parsed)) {
		if (!value || typeof value !== "object") {
			continue
		}
		const prefixesRaw = value.prefix
		const prefixes = Array.isArray(prefixesRaw)
			? prefixesRaw.filter((prefix) => typeof prefix === "string")
			: typeof prefixesRaw === "string"
				? [prefixesRaw]
				: []
		const bodyLines = normalizeSnippetBodyLines(value.body)
		if (bodyLines.length === 0) {
			continue
		}
		const description = typeof value.description === "string" ? value.description : "Snippet"
		for (const prefix of prefixes) {
			const normalizedPrefix = prefix.trim().toLowerCase()
			if (!/^[a-z0-9-\/]+$/iu.test(normalizedPrefix)) {
				continue
			}
			if (snippetTemplates.has(normalizedPrefix)) {
				continue
			}
			snippetTemplates.set(normalizedPrefix, {
				bodyLines,
				description,
			})
		}
	}

	return snippetTemplates
}

const getDirectiveSnippetTemplates = async (workspaceFolder) => {
	const cacheKey = `${workspaceFolder.uri.fsPath}::directive-snippets`
	const now = Date.now()
	const cached = suggestionCache.get(cacheKey)
	if (cached && cached.expiresAt > now) {
		return cached.values
	}
	const values = await readWorkspaceMarkdownSnippets(workspaceFolder)
	suggestionCache.set(cacheKey, {
		expiresAt: now + CACHE_TTL_MS,
		values,
	})
	return values
}

const loadRuleCandidates = async (workspaceFolder, rule) => {
	const sourceRootDirs = asRootDirList(rule.source)
	if (rule.source.type === "public-images") {
		return collectImageCandidates(workspaceFolder, sourceRootDirs[0] ?? "public")
	}
	if (rule.source.type === "page-routes") {
		return collectPageRouteCandidates(workspaceFolder, sourceRootDirs)
	}
	return []
}

const getDirectiveNameCandidates = async (workspaceFolder) => {
	const cacheKey = `${workspaceFolder.uri.fsPath}::directive-names`
	const now = Date.now()
	const cached = suggestionCache.get(cacheKey)
	if (cached && cached.expiresAt > now) {
		return cached.values
	}

	const [builtinDirectiveNames, contentBlockDirectiveNames] = await Promise.all([
		collectBuiltinDirectiveCandidates(workspaceFolder),
		collectContentBlockCandidates(workspaceFolder, CONTENT_BLOCKS_ROOT_DIRS),
	])
	const candidatesByName = new Map()
	for (const directiveName of builtinDirectiveNames) {
		candidatesByName.set(directiveName, {
			value: directiveName,
			detail: "Modul aus src/lyfmark/modules",
		})
	}
	for (const directiveName of contentBlockDirectiveNames) {
		if (candidatesByName.has(directiveName)) {
			continue
		}
		candidatesByName.set(directiveName, {
			value: directiveName,
			detail: "Content-Block aus content-blocks",
		})
	}
	const values = [...candidatesByName.values()].sort((left, right) => left.value.localeCompare(right.value))
	suggestionCache.set(cacheKey, {
		expiresAt: now + CACHE_TTL_MS,
		values,
	})
	return values
}

const getRuleCandidates = async (workspaceFolder, rule) => {
	const cacheRuleKey = [rule.module, rule.attribute].filter((value) => typeof value === "string" && value.length > 0).join("::")
	const fallbackKey = rule.field ?? rule.label ?? "rule"
	const cacheKey = `${workspaceFolder.uri.fsPath}::${cacheRuleKey || fallbackKey}`
	const now = Date.now()
	const cached = suggestionCache.get(cacheKey)
	if (cached && cached.expiresAt > now) {
		return cached.values
	}

	const values = await loadRuleCandidates(workspaceFolder, rule)
	values.sort((left, right) => left.localeCompare(right))
	suggestionCache.set(cacheKey, {
		expiresAt: now + CACHE_TTL_MS,
		values,
	})
	return values
}

const filterCandidates = (values, prefix) => {
	const normalizedPrefix = toLower(prefix.trim())
	if (normalizedPrefix.length === 0) {
		return values
	}
	const normalizedPrefixWithoutSlash = normalizedPrefix.startsWith("/") ? normalizedPrefix.slice(1) : normalizedPrefix
	return values.filter((value) => {
		const normalizedValue = toLower(value)
		const normalizedValueWithoutSlash = normalizedValue.startsWith("/") ? normalizedValue.slice(1) : normalizedValue
		return (
			normalizedValue.includes(normalizedPrefix) ||
			(normalizedPrefixWithoutSlash.length > 0 && normalizedValueWithoutSlash.includes(normalizedPrefixWithoutSlash))
		)
	})
}

const filterDirectiveNameCandidates = (values, prefix) => {
	const normalizedPrefix = toLower(prefix.trim())
	if (normalizedPrefix.length === 0) {
		return values
	}
	return values.filter((value) => {
		const normalizedValue = toLower(value.value)
		return normalizedValue.startsWith(normalizedPrefix) || normalizedValue.includes(normalizedPrefix)
	})
}

const filterLucideCandidates = (values, prefix) => {
	const normalizedPrefix = toLower(prefix.trim())
	if (normalizedPrefix.length === 0) {
		return values
	}
	return values.filter((value) => {
		const normalizedValue = toLower(value)
		return normalizedValue.startsWith(normalizedPrefix) || normalizedValue.includes(normalizedPrefix)
	})
}

const buildCompletionItems = (values, position, valuePrefix, detailLabel) => {
	const startCharacter = Math.max(0, position.character - valuePrefix.length)
	const replacementRange = new vscode.Range(position.line, startCharacter, position.line, position.character)

	return values.map((value) => {
		const item = new vscode.CompletionItem(value, vscode.CompletionItemKind.File)
		item.insertText = value
		item.range = replacementRange
		item.filterText = value
		item.sortText = value
		item.detail = `${detailLabel} · Freitext weiterhin möglich`
		return item
	})
}

const stripDirectiveOpener = (line) => {
	return line.replace(/^\s*:::\s*/u, "")
}

const indentSnippetLines = (lines, indent) => {
	return lines.map((line) => (line.length > 0 ? `${indent}${line}` : line))
}

const composeDirectiveSnippetText = (bodyLines, lineIndent) => {
	if (bodyLines.length === 0) {
		return ""
	}
	const transformedLines = [stripDirectiveOpener(bodyLines[0]), ...bodyLines.slice(1)]
	const indentedLines = indentSnippetLines(transformedLines, lineIndent)
	return indentedLines.join("\n")
}

const buildDirectiveContextCompletionItems = (
	values,
	position,
	directiveNameContext,
	snippetTemplates,
) => {
	const startCharacter = Math.max(0, position.character - directiveNameContext.valuePrefix.length)
	const replacementRange = new vscode.Range(position.line, startCharacter, position.line, position.character)
	const items = []

	for (const value of values) {
		const snippetTemplate = snippetTemplates.get(value.value.toLowerCase()) ?? null
		if (snippetTemplate) {
			const snippetText = composeDirectiveSnippetText(snippetTemplate.bodyLines, directiveNameContext.lineIndent)
			if (snippetText.length > 0) {
				const item = new vscode.CompletionItem(value.value, vscode.CompletionItemKind.Snippet)
				item.insertText = new vscode.SnippetString(snippetText)
				item.range = replacementRange
				item.filterText = value.value
				item.sortText = `0000-${value.value}`
				item.detail = `${snippetTemplate.description} · Snippet`
				items.push(item)
				continue
			}
		}

		const item = new vscode.CompletionItem(value.value, vscode.CompletionItemKind.Module)
		item.insertText = value.value
		item.range = replacementRange
		item.filterText = value.value
		item.sortText = `9000-${value.value}`
		item.detail = `${value.detail} · Freitext weiterhin möglich`
		items.push(item)
	}

	return items
}

const buildLucideCompletionItems = (values, position, valuePrefix) => {
	const startCharacter = Math.max(0, position.character - valuePrefix.length)
	const replacementRange = new vscode.Range(position.line, startCharacter, position.line, position.character)

	return values.map((value, index) => {
		const item = new vscode.CompletionItem(value, vscode.CompletionItemKind.EnumMember)
		item.insertText = value
		item.range = replacementRange
		item.filterText = value
		item.sortText = `0000-${value}`
		item.preselect = index === 0
		item.detail = "Lucide-Icon · Freitext weiterhin möglich"
		return item
	})
}

const createProvider = () => ({
	provideCompletionItems: async (document, position) => {
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri)
		if (!workspaceFolder) {
			return undefined
		}

		const linePrefix = document.lineAt(position.line).text.slice(0, position.character)
		const directiveContext = resolveDirectiveContext(document, position)
		const lucideContext = resolveLucideContext(document, position)
		if (lucideContext) {
			const lucideCandidates = await collectLucideIconCandidates(workspaceFolder)
			const filteredLucideCandidates = filterLucideCandidates(lucideCandidates, lucideContext.valuePrefix)
			return buildLucideCompletionItems(filteredLucideCandidates, position, lucideContext.valuePrefix)
		}

		// In offenen []-Kontexten keine Modul-/Direktiven-Suggestions anbieten.
		if (hasOpenSquareBracketContext(linePrefix)) {
			return undefined
		}

		if (directiveContext) {
			const candidates = await getRuleCandidates(workspaceFolder, directiveContext.rule)
			const filteredCandidates = filterCandidates(candidates, directiveContext.valuePrefix)
			return buildCompletionItems(
				filteredCandidates,
				position,
				directiveContext.valuePrefix,
				directiveContext.rule.label,
			)
		}

		const frontmatterContext = resolveFrontmatterContext(document, position)
		if (frontmatterContext) {
			const candidates = await getRuleCandidates(workspaceFolder, frontmatterContext.rule)
			const filteredCandidates = filterCandidates(candidates, frontmatterContext.valuePrefix)
			return buildCompletionItems(
				filteredCandidates,
				position,
				frontmatterContext.valuePrefix,
				frontmatterContext.rule.label,
			)
		}

		const directiveNameContext = resolveDirectiveNameContext(document, position)
		if (!directiveNameContext) {
			return undefined
		}
		const [directiveCandidates, directiveSnippetTemplates] = await Promise.all([
			getDirectiveNameCandidates(workspaceFolder),
			getDirectiveSnippetTemplates(workspaceFolder),
		])
		const filteredDirectiveNames = filterDirectiveNameCandidates(directiveCandidates, directiveNameContext.valuePrefix)
		return buildDirectiveContextCompletionItems(
			filteredDirectiveNames,
			position,
			directiveNameContext,
			directiveSnippetTemplates,
		)
	},
})

const activate = (context) => {
	const clearSuggestionCache = () => {
		suggestionCache.clear()
	}

	const cacheInvalidationPatterns = [
		"**/content-blocks/**/*.md",
		"**/src/content-blocks/**/*.md",
		"**/pages/**/*.md",
		"**/pages/**/*.mdx",
		"**/pages/**/*.astro",
		"**/src/pages/**/*.md",
		"**/src/pages/**/*.mdx",
		"**/src/pages/**/*.astro",
		"**/src/lyfmark/modules/**/module.ts",
		"**/.vscode/markdown.code-snippets",
	]
	const cacheInvalidationWatchers = cacheInvalidationPatterns.map((pattern) => {
		const watcher = vscode.workspace.createFileSystemWatcher(pattern)
		watcher.onDidCreate(clearSuggestionCache)
		watcher.onDidChange(clearSuggestionCache)
		watcher.onDidDelete(clearSuggestionCache)
		return watcher
	})

	const completionProvider = vscode.languages.registerCompletionItemProvider(
		[
			{ language: "markdown", scheme: "file" },
			{ language: "markdown", scheme: "untitled" },
			{ language: "markdown", scheme: "vscode-remote" },
		],
		createProvider(),
		":",
		"/",
		"-",
		"\"",
		"'",
	)
	context.subscriptions.push(...cacheInvalidationWatchers)
	context.subscriptions.push(completionProvider)
	context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(clearSuggestionCache))
}

const deactivate = () => {}

module.exports = {
	activate,
	deactivate,
}
