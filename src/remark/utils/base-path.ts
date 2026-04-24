/**
 * resolveInternalUrl normalisiert interne Root-URLs anhand der Build-Base.
 *
 * Motivation: Inhalte dürfen root-relative Links (z. B. "/kontakt") nutzen, sollen aber bei Deployments unter Subpfaden
 * (z. B. "/example-site/") automatisch korrekt aufgelöst werden.
 */
export const resolveInternalUrl = (rawUrl: string): string => {
	const url = rawUrl.trim()
	if (url.length === 0) {
		return url
	}
	if (url.startsWith("//")) {
		return url
	}
	if (url.startsWith("#") || url.startsWith("./") || url.startsWith("../")) {
		return url
	}
	if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
		return url
	}
	if (!url.startsWith("/")) {
		return url
	}

	const baseEnv = process.env.ASTRO_BASE
	const normalizedBase = normalizeBase(baseEnv)
	const basePrefix = normalizedBase === "/" ? "" : normalizedBase.replace(/\/+$/, "")

	if (url === "/") {
		return basePrefix.length > 0 ? `${basePrefix}/` : "/"
	}
	return basePrefix.length > 0 ? `${basePrefix}${url}` : url
}

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
