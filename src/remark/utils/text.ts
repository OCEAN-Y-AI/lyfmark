const HTML_ESCAPE_PATTERN = /[&<>"']/g
const SLUG_SEPARATOR_PATTERN = /[^a-z0-9]+/g

const HTML_ESCAPE_MAP: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	"\"": "&quot;",
	"'": "&#39;"
}

export const escapeHtml = (value: string): string => {
	return value.replace(HTML_ESCAPE_PATTERN, (character) => HTML_ESCAPE_MAP[character])
}

export const slugify = (value: string, fallback = "content-block"): string => {
	const normalized = value
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(SLUG_SEPARATOR_PATTERN, "-")
		.replace(/^-+|-+$/g, "")

	return normalized.length > 0 ? normalized : fallback
}
