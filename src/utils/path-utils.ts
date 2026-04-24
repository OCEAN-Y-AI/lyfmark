/**
 * Canonical path normalization for internal routing and link checks.
 * Contract: returns a leading-slash path without query/hash/trailing slash.
 */
export const normalizeSitePath = (rawPath: string): string => {
	const trimmed = rawPath.trim()
	if (trimmed.length === 0 || trimmed === "/") {
		return "/"
	}
	const withoutQuery = trimmed.split("?")[0] ?? trimmed
	const withoutHash = withoutQuery.split("#")[0] ?? withoutQuery
	const withLeadingSlash = withoutHash.startsWith("/") ? withoutHash : `/${withoutHash}`
	const collapsedSlashes = withLeadingSlash.replace(/\/{2,}/g, "/")
	const withoutTrailingSlash = collapsedSlashes.replace(/\/+$/, "")
	return withoutTrailingSlash.length > 0 ? withoutTrailingSlash : "/"
}

/**
 * Removes a configured base path from a pathname.
 * Contract: if pathname is outside basePath, it is returned unchanged.
 */
export const stripBasePath = (pathname: string, basePath: string): string => {
	if (basePath.length === 0) {
		return pathname
	}
	if (pathname === basePath) {
		return "/"
	}
	return pathname.startsWith(`${basePath}/`) ? pathname.slice(basePath.length) : pathname
}

/**
 * Adds base path to internal absolute hrefs.
 * Contract: external/relative hrefs are returned unchanged.
 */
export const withBasePath = (pathname: string, basePath: string, baseUrl: string): string => {
	if (!pathname.startsWith("/")) {
		return pathname
	}
	if (basePath.length === 0) {
		return pathname
	}
	return pathname === "/" ? baseUrl : `${basePath}${pathname}`
}

/**
 * Splits an href into clean path and suffix (?query / #hash).
 */
export const splitPathSuffix = (href: string): { pathPart: string; suffix: string } => {
	const queryIndex = href.indexOf("?")
	const hashIndex = href.indexOf("#")
	const cutIndex = queryIndex === -1 ? hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex)
	if (cutIndex === -1) {
		return { pathPart: href, suffix: "" }
	}
	return { pathPart: href.slice(0, cutIndex), suffix: href.slice(cutIndex) }
}

/**
 * Checks if href points to an external protocol target.
 */
export const isExternalHref = (href: string): boolean => {
	const lower = href.toLowerCase()
	return lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("mailto:") || lower.startsWith("tel:")
}
