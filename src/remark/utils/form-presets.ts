import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { VFile } from "vfile"
import { resolveCustomerSourceDirectory } from "../../lyfmark/config/customer-source-paths"
import type { ContainerDirectiveNode } from "../types"
import { applyTemplateVariables, extractTemplateVariables, validateTemplateVariables } from "./template-variables"

const getFormsDirectory = (): string => resolveCustomerSourceDirectory("forms")
const FORBIDDEN_PRESET_CHARACTERS = /[\\/]/u
const FORM_OPEN_TAG_PATTERN = /<form\b([^>]*)>/iu
const METHOD_ATTRIBUTE_PATTERN = /\bmethod\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/iu
const ACTION_ATTRIBUTE_PATTERN = /\baction\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/iu

const readPresetTemplate = (preset: string, file: VFile, node: ContainerDirectiveNode): { path: string; template: string } => {
	const normalizedPreset = preset.trim()
	if (normalizedPreset.length === 0) {
		file.fail(`form: Bitte gib für "preset" einen Wert an.`, node)
	}
	if (FORBIDDEN_PRESET_CHARACTERS.test(normalizedPreset)) {
		file.fail(`form: Preset-Namen dürfen keine "/" oder "\\" enthalten.`, node)
	}

	const path = resolve(getFormsDirectory(), `${normalizedPreset}.html`)
	if (!existsSync(path)) {
		file.fail(`form: Preset "${normalizedPreset}" wurde nicht gefunden (${path}).`, node)
	}

	const template = readFileSync(path, "utf8")
	if (template.trim().length === 0) {
		file.fail(`form: Preset "${normalizedPreset}" ist leer (${path}).`, node)
	}

	return { path, template }
}

const pickAttributeValue = (match: RegExpExecArray): string => {
	return (match[2] ?? match[3] ?? match[4] ?? "").trim()
}

const validateResolvedFormMarkup = (markup: string, preset: string, file: VFile, node: ContainerDirectiveNode): void => {
	const formBlocks = Array.from(markup.matchAll(/<form\b[\s\S]*?<\/form>/giu))
	if (formBlocks.length !== 1) {
		file.fail(`form: Preset "${preset}" muss genau ein <form>...</form> enthalten.`, node)
	}

	const formMarkup = formBlocks[0]?.[0] ?? ""
	const openTagMatch = FORM_OPEN_TAG_PATTERN.exec(formMarkup)
	if (!openTagMatch || !openTagMatch[1]) {
		file.fail(`form: Preset "${preset}" enthält kein gültiges öffnendes <form>-Tag.`, node)
	}

	const formTagAttributes = openTagMatch[1]
	const methodMatch = METHOD_ATTRIBUTE_PATTERN.exec(formTagAttributes)
	const methodValue = methodMatch ? pickAttributeValue(methodMatch).toLowerCase() : ""
	if (methodValue !== "post") {
		file.fail(`form: Preset "${preset}" muss method="post" verwenden.`, node)
	}

	const actionMatch = ACTION_ATTRIBUTE_PATTERN.exec(formTagAttributes)
	const actionValue = actionMatch ? pickAttributeValue(actionMatch) : ""
	if (actionValue.length === 0) {
		file.fail(`form: Preset "${preset}" muss ein nicht-leeres action-Attribut setzen.`, node)
	}
}

/**
 * Loads a form preset, applies `$variable` replacements, and validates the minimum form contract.
 */
export const renderFormPresetMarkup = (
	preset: string,
	variables: Record<string, string>,
	file: VFile,
	node: ContainerDirectiveNode,
): string => {
	const { template } = readPresetTemplate(preset, file, node)
	const templateVariables = extractTemplateVariables(template)
	validateTemplateVariables(`Form-Preset "${preset}"`, templateVariables, variables, file)
	const resolvedMarkup = applyTemplateVariables(template, variables)
	validateResolvedFormMarkup(resolvedMarkup, preset, file, node)
	return resolvedMarkup
}
