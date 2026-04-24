import type { Html } from "mdast"

export const createHtmlNode = (value: string): Html => ({
	type: "html",
	value
})
