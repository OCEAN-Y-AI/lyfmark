/**
 * Central URL completion rules for LyfMark directives.
 * Add new module rules here to extend field-specific suggestions.
 */
const URL_COMPLETION_RULES = [
	{
		module: "background-image",
		attribute: "url",
		source: {
			type: "public-images",
			rootDir: "public",
		},
		label: "Bild aus public",
	},
	{
		module: "background-wave",
		attribute: "url",
		source: {
			type: "public-images",
			rootDir: "public",
		},
		label: "Bild aus public",
	},
	{
		module: "picture-and-text",
		attribute: "image",
		source: {
			type: "public-images",
			rootDir: "public",
		},
		label: "Bild aus public",
	},
	{
		module: "text-over-picture",
		attribute: "image",
		source: {
			type: "public-images",
			rootDir: "public",
		},
		label: "Bild aus public",
	},
	{
		module: "link",
		attribute: "to",
		source: {
			type: "page-routes",
			rootDirs: ["pages", "src/pages"],
		},
		label: "Interner Seitenpfad aus pages",
	},
]

/**
 * Frontmatter URL completion rules for Markdown pages/content.
 * Field names are matched case-insensitive.
 */
const FRONTMATTER_URL_COMPLETION_RULES = [
	{
		field: "thumbnail",
		source: {
			type: "public-images",
			rootDir: "public",
		},
		label: "Bild aus public",
	},
	{
		field: "author-image",
		source: {
			type: "public-images",
			rootDir: "public",
		},
		label: "Bild aus public",
	},
]

module.exports = {
	URL_COMPLETION_RULES,
	FRONTMATTER_URL_COMPLETION_RULES,
}
