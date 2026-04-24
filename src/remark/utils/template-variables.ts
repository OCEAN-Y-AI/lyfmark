import type { VFile } from "vfile"

const VARIABLE_PATTERN = /\$([a-z][a-z0-9-]*)(?![a-z0-9-])/g

/**
 * extractTemplateVariables sammelt alle $variablen aus einem Template-Text.
 */
export const extractTemplateVariables = (template: string): Set<string> => {
	const variables = new Set<string>()
	let match: RegExpExecArray | null = null
	while ((match = VARIABLE_PATTERN.exec(template)) !== null) {
		variables.add(match[1])
	}
	return variables
}

/**
 * applyTemplateVariables ersetzt $variablen durch die bereitgestellten Werte.
 */
export const applyTemplateVariables = (template: string, variables: Record<string, string>): string => {
	return template.replace(VARIABLE_PATTERN, (_match, key: string) => variables[key] ?? "")
}

interface TemplateVariableOptions {
	readonly allowUnused?: boolean
}

/**
 * validateTemplateVariables prüft, ob alle benötigten Variablen vorhanden sind (und optional ob keine unbekannten übergeben wurden).
 */
export const validateTemplateVariables = (
	contextLabel: string,
	templateVariables: Set<string>,
	provided: Record<string, string>,
	file: VFile,
	options: TemplateVariableOptions = {},
): void => {
	const missing = Array.from(templateVariables).filter((key) => !(key in provided))
	if (missing.length > 0) {
		file.fail(`${contextLabel}: Fehlende Variablen: ${missing.join(", ")}.`)
	}
	if (options.allowUnused) {
		return
	}
	const unused = Object.keys(provided).filter((key) => !templateVariables.has(key))
	if (unused.length > 0) {
		file.fail(`${contextLabel}: Unbekannte Variablen: ${unused.join(", ")}.`)
	}
}
