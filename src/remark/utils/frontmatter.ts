import type { VFile } from "vfile"

const FRONTMATTER_BOUNDARY = /^---\s*$/
const FRONTMATTER_LINE = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/

export type FrontmatterValue = string
export type FrontmatterData = Record<string, FrontmatterValue>

/**
 * parseFrontmatter liest einfache YAML-Frontmatter-Keys (einzeilig, key: value) aus Markdown.
 */
export const parseFrontmatter = (markdown: string, file: VFile, sourcePath: string): FrontmatterData => {
	const lines = markdown.split(/\r?\n/)
	if (!FRONTMATTER_BOUNDARY.test(lines[0] ?? "")) {
		return {}
	}

	const data: FrontmatterData = {}
	let index = 1
	for (; index < lines.length; index += 1) {
		const line = lines[index] ?? ""
		if (FRONTMATTER_BOUNDARY.test(line)) {
			break
		}
		const trimmed = line.trim()
		if (trimmed.length === 0 || trimmed.startsWith("#")) {
			continue
		}
		const match = FRONTMATTER_LINE.exec(line)
		if (!match) {
			file.fail(
				`Frontmatter in ${sourcePath} enthält eine ungültige Zeile: "${line}". ` +
					`Bitte nutze das Format "schluessel: wert" (einzeilig).`,
			)
		}
		const key = match[1]
		const rawValue = match[2]?.trim() ?? ""
		if (rawValue.length === 0) {
			data[key] = ""
			continue
		}
		const firstChar = rawValue[0]
		const lastChar = rawValue[rawValue.length - 1]
		if ((firstChar === '"' && lastChar === '"') || (firstChar === "'" && lastChar === "'")) {
			data[key] = rawValue.slice(1, -1)
			continue
		}
		data[key] = rawValue
	}

	if (index >= lines.length) {
		file.fail(
			`Frontmatter in ${sourcePath} wird mit "---" geöffnet, aber nicht geschlossen. ` +
				`Bitte ergänze eine abschließende "---"-Zeile.`,
		)
	}

	return data
}
