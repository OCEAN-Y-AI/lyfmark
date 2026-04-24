import fs from "node:fs"
import path from "node:path"

const EMPTY_SET = new Set()
const EMPTY_MAP = new Map()
const FRONTMATTER_BOUNDARY_PATTERN = /^---\s*$/u
const FRONTMATTER_LINE_PATTERN = /^([a-z][a-z0-9-]*)\s*:\s*(.+)$/u
const CONTENT_BLOCK_CHILDREN_VARIABLE = "children"
const CONTENT_BLOCK_CACHE = new Map()

/**
 * Resolves the project root by walking upward until `package.json` is found.
 *
 * @param {string | undefined} filepath
 * @returns {string | null}
 */
export const findProjectRootFromPath = (filepath) => {
	if (typeof filepath !== "string" || filepath.trim().length === 0) {
		return null
	}

	const absolutePath = path.isAbsolute(filepath) ? filepath : path.resolve(process.cwd(), filepath)
	let current = absolutePath
	try {
		const stats = fs.statSync(absolutePath)
		if (!stats.isDirectory()) {
			current = path.dirname(absolutePath)
		}
	} catch {
		current = path.dirname(absolutePath)
	}

	while (true) {
		const packageJsonPath = path.join(current, "package.json")
		if (fs.existsSync(packageJsonPath)) {
			return current
		}
		const parent = path.dirname(current)
		if (parent === current) {
			return null
		}
		current = parent
	}
}

/**
 * Reads all markdown files below the resolved content-block root recursively.
 *
 * @param {string} directory
 * @param {Array<{name: string, absolutePath: string}>} files
 * @param {string} prefix
 */
const collectContentBlockFiles = (directory, files, prefix = "") => {
	const entries = fs.readdirSync(directory, { withFileTypes: true })
	for (const entry of entries) {
		const absolutePath = path.join(directory, entry.name)
		if (entry.isDirectory()) {
			collectContentBlockFiles(absolutePath, files, `${prefix}${entry.name}/`)
			continue
		}
		if (!entry.isFile() || !entry.name.endsWith(".md")) {
			continue
		}
		files.push({
			name: `${prefix}${entry.name.slice(0, -3)}`,
			absolutePath,
		})
	}
}

/**
 * Resolves customer-facing content-block source directory.
 * Root `content-blocks/` is canonical; `src/content-blocks/` is fallback mirror.
 *
 * @param {string} projectRoot
 * @returns {string}
 */
const resolveContentBlocksDirectory = (projectRoot) => {
	const rootDirectory = path.join(projectRoot, "content-blocks")
	try {
		if (fs.statSync(rootDirectory).isDirectory()) {
			return rootDirectory
		}
	} catch {}

	const mirrorDirectory = path.join(projectRoot, "src", "content-blocks")
	try {
		if (fs.statSync(mirrorDirectory).isDirectory()) {
			return mirrorDirectory
		}
	} catch {}

	return rootDirectory
}

/**
 * Returns `true` if the content-block frontmatter contains a valid `children` declaration.
 *
 * @param {string} markdown
 * @returns {boolean}
 */
const parseFrontmatterChildrenSupportLenient = (markdown) => {
	const lines = markdown.replace(/\r\n?/gu, "\n").split("\n")
	if (!FRONTMATTER_BOUNDARY_PATTERN.test(lines[0] ?? "")) {
		return false
	}

	for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
		const line = lines[lineIndex] ?? ""
		if (FRONTMATTER_BOUNDARY_PATTERN.test(line)) {
			return false
		}
		const trimmed = line.trim()
		if (trimmed.length === 0 || trimmed.startsWith("#")) {
			continue
		}
		const match = FRONTMATTER_LINE_PATTERN.exec(line)
		if (!match) {
			return false
		}
		const variableName = match[1] ?? ""
		const description = (match[2] ?? "").trim()
		if (description.length === 0) {
			return false
		}
		if (variableName === CONTENT_BLOCK_CHILDREN_VARIABLE) {
			return true
		}
	}
	return false
}

/**
 * Creates a deterministic signature for cache invalidation.
 *
 * @param {Array<{name: string, absolutePath: string}>} files
 * @returns {string}
 */
const buildFilesSignature = (files) => {
	const segments = []
	for (const file of files) {
		let mtimeMs = 0
		let size = 0
		try {
			const stats = fs.statSync(file.absolutePath)
			mtimeMs = stats.mtimeMs
			size = stats.size
		} catch {
			mtimeMs = 0
			size = 0
		}
		segments.push(`${file.name}:${mtimeMs}:${size}`)
	}
	return segments.join("|")
}

/**
 * Returns content-block definitions with per-file children support.
 * Cache is invalidated on create/change/delete using a file signature.
 *
 * @param {string | undefined} filepath
 * @returns {Map<string, {hasChildren: boolean}>}
 */
export const getContentBlockDefinitions = (filepath) => {
	const projectRoot = findProjectRootFromPath(filepath)
	if (!projectRoot) {
		return EMPTY_MAP
	}

	const contentBlocksDirectory = resolveContentBlocksDirectory(projectRoot)
	const files = []
	try {
		collectContentBlockFiles(contentBlocksDirectory, files)
	} catch {
		CONTENT_BLOCK_CACHE.set(projectRoot, { signature: "", definitions: EMPTY_MAP })
		return EMPTY_MAP
	}
	files.sort((left, right) => left.name.localeCompare(right.name))
	const signature = buildFilesSignature(files)
	const cached = CONTENT_BLOCK_CACHE.get(projectRoot)
	if (cached && cached.signature === signature) {
		return cached.definitions
	}

	const definitions = new Map()
	for (const file of files) {
		let hasChildren = false
		try {
			const markdown = fs.readFileSync(file.absolutePath, "utf8")
			hasChildren = parseFrontmatterChildrenSupportLenient(markdown)
		} catch {
			hasChildren = false
		}
		definitions.set(file.name.toLowerCase(), { hasChildren })
	}

	CONTENT_BLOCK_CACHE.set(projectRoot, { signature, definitions })
	return definitions
}

/**
 * Returns all known content-block names for formatter short-cut detection.
 *
 * @param {string | undefined} filepath
 * @returns {Set<string>}
 */
export const getContentBlockNames = (filepath) => {
	const definitions = getContentBlockDefinitions(filepath)
	if (definitions.size === 0) {
		return EMPTY_SET
	}
	return new Set(definitions.keys())
}
