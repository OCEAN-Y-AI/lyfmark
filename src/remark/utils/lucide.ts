import lucideIcons from "lucide-static"

interface DecorateLucideSvgOptions {
	readonly className?: string
	readonly ariaHidden?: boolean
	readonly focusable?: boolean
	readonly width?: string
	readonly height?: string
	readonly style?: string
}

interface LucideLookupResult {
	readonly normalizedIconName: string
	readonly svg?: string
}

const lucideIconMap = lucideIcons as Record<string, string>

const withClassName = (attributes: string, className: string): string => {
	if (/class="/.test(attributes)) {
		return attributes.replace(/class="([^"]*)"/, (_full, existingClassNames: string) => {
			const classNames = `${existingClassNames} ${className}`.trim()
			return `class="${classNames}"`
		})
	}
	return `${attributes} class="${className}"`
}

const withAttribute = (attributes: string, name: string, value: string): string => {
	const pattern = new RegExp(`\\b${name}="[^"]*"`)
	if (pattern.test(attributes)) {
		return attributes.replace(pattern, `${name}="${value}"`)
	}
	return `${attributes} ${name}="${value}"`
}

export const normalizeLucideIconName = (rawIconName: string): string => {
	const parts = rawIconName
		.trim()
		.split(/[^a-zA-Z0-9]+/)
		.map((part) => part.trim())
		.filter((part) => part.length > 0)

	if (parts.length === 0) {
		return ""
	}

	return parts
		.map((part) => {
			const lower = part.toLowerCase()
			return `${lower.slice(0, 1).toUpperCase()}${lower.slice(1)}`
		})
		.join("")
}

export const lookupLucideIcon = (rawIconName: string): LucideLookupResult => {
	const normalizedIconName = normalizeLucideIconName(rawIconName)
	if (normalizedIconName.length === 0) {
		return { normalizedIconName }
	}
	return {
		normalizedIconName,
		svg: lucideIconMap[normalizedIconName],
	}
}

export const decorateLucideSvg = (rawSvg: string, options: DecorateLucideSvgOptions = {}): string => {
	const openTagPattern = /<svg\b([^>]*)>/
	const match = openTagPattern.exec(rawSvg)
	if (!match || !match[1]) {
		return rawSvg
	}

	let attributes = match[1]
	if (options.className && options.className.trim().length > 0) {
		attributes = withClassName(attributes, options.className.trim())
	}
	if (options.ariaHidden === true) {
		attributes = withAttribute(attributes, "aria-hidden", "true")
	}
	if (options.focusable === false) {
		attributes = withAttribute(attributes, "focusable", "false")
	}
	if (options.width && options.width.trim().length > 0) {
		attributes = withAttribute(attributes, "width", options.width.trim())
	}
	if (options.height && options.height.trim().length > 0) {
		attributes = withAttribute(attributes, "height", options.height.trim())
	}
	if (options.style && options.style.trim().length > 0) {
		attributes = withAttribute(attributes, "style", options.style.trim())
	}

	return rawSvg.replace(openTagPattern, `<svg${attributes}>`)
}
