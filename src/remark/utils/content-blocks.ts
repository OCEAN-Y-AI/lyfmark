import { existsSync, readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"
import type { Root } from "mdast"
import { fromMarkdown } from "mdast-util-from-markdown"
import { VFile } from "vfile"
import { resolveCustomerSourceDirectory } from "../../lyfmark/config/customer-source-paths"
import type { DirectiveContentNode } from "../types"
import { applyDirectivesToTree } from "../directives-to-blocks"
import { applyTemplateVariables, extractTemplateVariables, validateTemplateVariables } from "./template-variables"

const getContentBlocksDirectory = (): string => resolveCustomerSourceDirectory("content-blocks")
const BLOCK_NAME_PATTERN = /^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/u
const VARIABLE_NAME_PATTERN = /^[a-z][a-z0-9-]*$/u
const FRONTMATTER_BOUNDARY_PATTERN = /^---\s*$/u
const FRONTMATTER_LINE_PATTERN = /^([a-z][a-z0-9-]*)\s*:\s*(.+)$/u
const CONTENT_BLOCK_CHILDREN_VARIABLE = "children"
const activeContentBlocks = new Set<string>()

interface ContentBlockDefinition {
	readonly path: string
	readonly templateMarkdown: string
	readonly declarations: Record<string, string>
	readonly hasChildren: boolean
}

interface RenderContentBlockOptions {
	readonly childrenMarkdown?: string
}

interface SupportsChildrenCacheEntry {
	readonly mtimeMs: number
	readonly hasChildren: boolean
}

const supportsChildrenCache = new Map<string, SupportsChildrenCacheEntry>()

const resolveContentBlockPath = (name: string, file: VFile): string => {
	if (!BLOCK_NAME_PATTERN.test(name)) {
		file.fail(`Content-Block "${name}" ist ungültig. Erlaubt sind nur Kleinbuchstaben, Zahlen, Bindestriche und "/" für Unterordner.`)
	}
	return resolve(getContentBlocksDirectory(), `${name}.md`)
}

const parseFrontmatterContract = (
	markdown: string,
	name: string,
	path: string,
	file: VFile,
): { hasFrontmatter: boolean; declarations: Record<string, string>; templateMarkdown: string } => {
	const lines = markdown.replace(/\r\n?/gu, "\n").split("\n")
	if (!FRONTMATTER_BOUNDARY_PATTERN.test(lines[0] ?? "")) {
		if (markdown.trim().length === 0) {
			file.fail(`Die Content-Block-Datei ist leer: ${path}. Bitte füge Inhalte hinzu.`)
		}
		return {
			hasFrontmatter: false,
			declarations: {},
			templateMarkdown: markdown,
		}
	}

	const declarations: Record<string, string> = {}
	let lineIndex = 1
	for (; lineIndex < lines.length; lineIndex += 1) {
		const line = lines[lineIndex] ?? ""
		if (FRONTMATTER_BOUNDARY_PATTERN.test(line)) {
			break
		}
		const trimmed = line.trim()
		if (trimmed.length === 0 || trimmed.startsWith("#")) {
			continue
		}
		const match = FRONTMATTER_LINE_PATTERN.exec(line)
		if (!match) {
			file.fail(
				`Content-Block "${name}" enthält eine ungültige Frontmatter-Zeile "${line}". ` +
					`Bitte nutze das Format "variable: beschreibung" mit nicht-leerer Beschreibung.`,
			)
		}
		const variableName = match[1] ?? ""
		const description = (match[2] ?? "").trim()
		if (!VARIABLE_NAME_PATTERN.test(variableName)) {
			file.fail(
				`Content-Block "${name}": Variablenname "${variableName}" ist ungültig. ` +
					`Erlaubt sind Kleinbuchstaben, Zahlen und Bindestriche (Start mit Buchstabe).`,
			)
		}
		if (description.length === 0) {
			file.fail(`Content-Block "${name}": Beschreibung für Variable "${variableName}" darf nicht leer sein.`)
		}
		if (Object.prototype.hasOwnProperty.call(declarations, variableName)) {
			file.fail(`Content-Block "${name}": Variable "${variableName}" ist im Frontmatter doppelt definiert.`)
		}
		declarations[variableName] = description
	}

	if (lineIndex >= lines.length) {
		file.fail(`Content-Block "${name}": Frontmatter in ${path} wurde nicht mit "---" geschlossen.`)
	}

	const templateMarkdown = lines.slice(lineIndex + 1).join("\n")
	if (templateMarkdown.trim().length === 0) {
		file.fail(`Die Content-Block-Datei ist leer: ${path}. Bitte füge Inhalte hinzu.`)
	}

	return { hasFrontmatter: true, declarations, templateMarkdown }
}

const parseFrontmatterChildrenSupportLenient = (markdown: string): boolean => {
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
		if (!VARIABLE_NAME_PATTERN.test(variableName) || description.length === 0) {
			return false
		}
		if (variableName === CONTENT_BLOCK_CHILDREN_VARIABLE) {
			return true
		}
	}
	return false
}

const loadContentBlockDefinition = (name: string, file: VFile): ContentBlockDefinition => {
	const path = resolveContentBlockPath(name, file)
	let markdown = ""
	try {
		markdown = readFileSync(path, "utf8")
	} catch {
		file.fail(`Content-Block-Datei nicht gefunden: ${path}. Bitte lege sie an.`)
	}

	const parsed = parseFrontmatterContract(markdown, name, path, file)
	const templateVariables = extractTemplateVariables(parsed.templateMarkdown)
	const declaredVariables = Object.keys(parsed.declarations)
	if (!parsed.hasFrontmatter && templateVariables.size > 0) {
		file.fail(
			`Content-Block "${name}" nutzt Platzhalter (${[...templateVariables].join(", ")}), hat aber kein Frontmatter. ` +
				`Bitte ergänze Frontmatter mit Variablen-Deklarationen oder entferne die Platzhalter.`,
		)
	}
	if (parsed.hasFrontmatter) {
		const missingDeclarations = [...templateVariables].filter((variableName) => !declaredVariables.includes(variableName))
		if (missingDeclarations.length > 0) {
			file.fail(
				`Content-Block "${name}": Für folgende Platzhalter fehlt die Frontmatter-Deklaration: ${missingDeclarations.join(", ")}.`,
			)
		}
		const unusedDeclarations = declaredVariables.filter((variableName) => !templateVariables.has(variableName))
		if (unusedDeclarations.length > 0) {
			file.fail(
				`Content-Block "${name}": Folgende Frontmatter-Variablen werden im Inhalt nicht verwendet: ${unusedDeclarations.join(", ")}.`,
			)
		}
	}

	return {
		path,
		templateMarkdown: parsed.templateMarkdown,
		declarations: parsed.declarations,
		hasChildren: declaredVariables.includes(CONTENT_BLOCK_CHILDREN_VARIABLE),
	}
}

const validateProvidedVariablesByDefinition = (
	name: string,
	definition: ContentBlockDefinition,
	variables: Record<string, string>,
	file: VFile,
): void => {
	const declaredVariables = new Set(Object.keys(definition.declarations))
	const unknownVariables = Object.keys(variables).filter((variableName) => !declaredVariables.has(variableName))
	if (unknownVariables.length > 0) {
		file.fail(
			`Content-Block "${name}": Unbekannte Variablen: ${unknownVariables.join(", ")}. ` +
				`Erlaubt sind: ${[...declaredVariables].join(", ") || "(keine)"}.`,
		)
	}
}

export const contentBlockExists = (name: string): boolean => {
	if (!BLOCK_NAME_PATTERN.test(name)) {
		return false
	}
	return existsSync(resolve(getContentBlocksDirectory(), `${name}.md`))
}

export const contentBlockAllowsChildren = (name: string): boolean => {
	if (!BLOCK_NAME_PATTERN.test(name)) {
		return false
	}
	const path = resolve(getContentBlocksDirectory(), `${name}.md`)
	const stats = statSync(path, { throwIfNoEntry: false })
	if (!stats?.isFile()) {
		supportsChildrenCache.delete(path)
		return false
	}
	const cached = supportsChildrenCache.get(path)
	if (cached && cached.mtimeMs === stats.mtimeMs) {
		return cached.hasChildren
	}
	let hasChildren = false
	try {
		const markdown = readFileSync(path, "utf8")
		hasChildren = parseFrontmatterChildrenSupportLenient(markdown)
	} catch {
		hasChildren = false
	}
	supportsChildrenCache.set(path, { mtimeMs: stats.mtimeMs, hasChildren })
	return hasChildren
}

export const parseVarsAttribute = (raw: string | undefined, file: VFile, name: string): Record<string, string> => {
	if (!raw) {
		return {}
	}
	const trimmed = raw.trim()
	if (trimmed.length === 0) {
		return {}
	}
	const entries = trimmed
		.split(/[;,]/)
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0)

	const vars: Record<string, string> = {}
	for (const entry of entries) {
		const separatorIndex = entry.indexOf("=")
		if (separatorIndex === -1) {
			file.fail(`Content-Block "${name}": "vars" erwartet Paare im Format "schluessel=wert" (getrennt durch "," oder ";").`)
		}
		const key = entry.slice(0, separatorIndex).trim()
		const value = entry.slice(separatorIndex + 1).trim()
		if (!VARIABLE_NAME_PATTERN.test(key)) {
			file.fail(`Content-Block "${name}": Variablenname "${key}" ist ungültig (Kleinbuchstaben, Zahlen, Bindestriche; Start mit Buchstabe).`)
		}
		if (key === CONTENT_BLOCK_CHILDREN_VARIABLE) {
			file.fail(`Content-Block "${name}": Variable "children" darf nicht über "vars" gesetzt werden. Nutze stattdessen Modul-Inhalt zwischen ::: und :::.`)
		}
		if (value.length === 0) {
			file.fail(`Content-Block "${name}": Variablenwert für "${key}" darf nicht leer sein.`)
		}
		vars[key] = value
	}
	return vars
}

const ensureVariableMap = (attributes: Record<string, unknown>, file: VFile, name: string): Record<string, string> => {
	const vars: Record<string, string> = {}
	for (const [key, value] of Object.entries(attributes)) {
		if (!VARIABLE_NAME_PATTERN.test(key)) {
			file.fail(`Content-Block "${name}": Variablenname "${key}" ist ungültig (Kleinbuchstaben, Zahlen, Bindestriche; Start mit Buchstabe).`)
		}
		if (key === CONTENT_BLOCK_CHILDREN_VARIABLE) {
			file.fail(`Content-Block "${name}": Variable "children" darf nicht als Attribut gesetzt werden. Nutze stattdessen Modul-Inhalt zwischen ::: und :::.`)
		}
		if (typeof value !== "string") {
			file.fail(`Content-Block "${name}": Variablenwert für "${key}" muss Text sein.`)
		}
		if (value.trim().length === 0) {
			file.fail(`Content-Block "${name}": Variablenwert für "${key}" darf nicht leer sein.`)
		}
		vars[key] = value
	}
	return vars
}

export const renderContentBlockNodes = (
	name: string,
	variables: Record<string, string>,
	file: VFile,
	options: RenderContentBlockOptions = {},
): DirectiveContentNode[] => {
	if (activeContentBlocks.has(name)) {
		file.fail(`Content-Block "${name}" darf sich nicht selbst (direkt oder indirekt) einbinden.`)
	}
	activeContentBlocks.add(name)
	try {
		const definition = loadContentBlockDefinition(name, file)
		const resolvedVariables: Record<string, string> = { ...variables }
		const childrenMarkdown = options.childrenMarkdown
		const hasChildrenInput = typeof childrenMarkdown === "string"
		if (definition.hasChildren) {
			if (!hasChildrenInput) {
				file.fail(`Content-Block "${name}" erwartet Inhalte zwischen ::: und :::, weil "$children" deklariert ist.`)
			}
			resolvedVariables[CONTENT_BLOCK_CHILDREN_VARIABLE] = childrenMarkdown ?? ""
		} else if (hasChildrenInput && (childrenMarkdown ?? "").trim().length > 0) {
			file.fail(`Content-Block "${name}" ist selbstschließend und unterstützt kein "$children". Entferne den Inhalt oder deklariere "children" im Block-Frontmatter.`)
		}

		validateProvidedVariablesByDefinition(name, definition, resolvedVariables, file)
		const templateVariables = extractTemplateVariables(definition.templateMarkdown)
		validateTemplateVariables(`Content-Block "${name}"`, templateVariables, resolvedVariables, file)

		const resolvedMarkdown = applyTemplateVariables(definition.templateMarkdown, resolvedVariables)
		const templateFile = new VFile({ path: definition.path, value: resolvedMarkdown })
		const root = fromMarkdown(resolvedMarkdown) as Root
		applyDirectivesToTree(root, templateFile)
		return root.children as DirectiveContentNode[]
	} finally {
		activeContentBlocks.delete(name)
	}
}

export const renderContentBlockNodesFromAttributes = (
	name: string,
	attributes: Record<string, unknown>,
	file: VFile,
	options: RenderContentBlockOptions = {},
): DirectiveContentNode[] => {
	const variables = ensureVariableMap(attributes, file, name)
	return renderContentBlockNodes(name, variables, file, options)
}
