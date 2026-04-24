import { defineConfig } from "astro/config"
import type { RemarkPlugin } from "@astrojs/markdown-remark"
import remarkSmartypants from "remark-smartypants"
import { directivesToBlocks } from "./src/remark/directives-to-blocks"
import { inlineLucideIcons } from "./src/remark/inline-lucide-icons"
import { contentBlockHmrIntegration } from "./src/config/content-block-hmr"

const remarkPlugins: RemarkPlugin[] = [directivesToBlocks, inlineLucideIcons, remarkSmartypants as RemarkPlugin]

/**
 * Normalizes configurable base paths to Astro-compatible leading/trailing slash format.
 */
const normalizeBase = (base: string | undefined): string => {
	if (!base || base.trim().length === 0) {
		return "/"
	}
	const trimmed = base.trim()
	if (trimmed === "/") {
		return "/"
	}
	const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
	return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`
}

export default defineConfig({
	base: normalizeBase(process.env.ASTRO_BASE),
	integrations: [contentBlockHmrIntegration()],
	vite: {
		server: {
			strictPort: true,
		},
	},
	markdown: {
		smartypants: false,
		remarkPlugins,
	},
})
