import { access, mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises"
import path from "node:path"
import { load as parseYaml } from "js-yaml"

const PROJECT_ROOT = process.cwd()
const SITE_CONFIG_PATH = path.join(PROJECT_ROOT, "site.config.yml")
const MODULES_ROOT = path.join(PROJECT_ROOT, "src", "lyfmark", "modules")
const TEMPLATES_ROOT = path.join(PROJECT_ROOT, "src", "lyfmark", "templates")
const SCRIPTS_ROOT = path.join(PROJECT_ROOT, "src", "scripts")
const GENERATED_ROOT = path.join(PROJECT_ROOT, "src", "lyfmark", "generated")
const GENERATED_STYLES_ROOT = path.join(GENERATED_ROOT, "styles")
const GENERATED_TEMPLATE_STYLES_ROOT = path.join(GENERATED_STYLES_ROOT, "templates")
const GENERATED_MANIFEST_PATH = path.join(GENERATED_ROOT, "template-manifest.ts")
const GENERATED_TEMPLATE_STYLE_URLS_PATH = path.join(GENERATED_ROOT, "template-style-urls.ts")
const GENERATED_RUNTIME_SCRIPTS_COMPONENT_PATH = path.join(GENERATED_ROOT, "module-runtime-scripts.astro")
const GENERATED_RUNTIME_SCRIPTS_MANIFEST_PATH = path.join(GENERATED_ROOT, "runtime-scripts.ts")
const LOGS_ROOT = path.join(PROJECT_ROOT, ".cache", "logs")
const SYNC_LOG_PATH = path.join(LOGS_ROOT, "lyfmark-sync.log")

const SHARED_RUNTIME_SCRIPT_BASENAMES = new Set(["manual-menu"])

const FILE_ENCODING = "utf8"

const toSorted = (values) => [...values].sort((left, right) => left.localeCompare(right))

const pathExists = async (targetPath) => {
	try {
		await access(targetPath)
		return true
	} catch {
		return false
	}
}

const writeFileIfChanged = async (targetPath, content) => {
	let currentContent = null
	try {
		currentContent = await readFile(targetPath, FILE_ENCODING)
	} catch (error) {
		if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
			throw error
		}
	}

	if (currentContent === content) {
		return false
	}

	await mkdir(path.dirname(targetPath), { recursive: true })
	await writeFile(targetPath, content, FILE_ENCODING)
	return true
}

const parseCliOptions = (argv) => {
	const verboseByFlag = argv.includes("--verbose") || argv.includes("-v")
	const verboseByEnv = process.env.LYFMARK_SYNC_VERBOSE === "1" || process.env.LYFMARK_SYNC_VERBOSE === "true"

	return {
		verbose: verboseByFlag || verboseByEnv,
	}
}

const CLI_OPTIONS = parseCliOptions(process.argv.slice(2))

const buildDiagnosticsLogSource = (data) => {
	const lines = [
		`Timestamp: ${new Date().toISOString()}`,
		`Project root: ${PROJECT_ROOT}`,
		`Active template: ${data.activeTemplateId}`,
		`Templates: ${data.templateIds.join(", ")}`,
		`Modules: ${data.moduleDescriptors.length}`,
		`Runtime scripts: ${data.runtimeScripts.length}`,
		"",
		"Missing template overrides by template:",
	]

	for (const templateId of data.templateIds) {
		const missingModules = data.missingOverridesByTemplate[templateId] ?? []
		lines.push(`- ${templateId}: ${missingModules.length}`)
		if (missingModules.length > 0) {
			lines.push(`  ${missingModules.join(", ")}`)
		}
	}

	lines.push("", "Unknown module override files:")
	const descriptorsWithUnknownOverrides = data.moduleDescriptors.filter(
		(descriptor) => descriptor.unknownTemplateOverrides.length > 0,
	)
	if (descriptorsWithUnknownOverrides.length === 0) {
		lines.push("- none")
	} else {
		for (const descriptor of descriptorsWithUnknownOverrides) {
			lines.push(`- ${descriptor.moduleId}: ${descriptor.unknownTemplateOverrides.join(", ")}`)
		}
	}

	lines.push("", "Orphan runtime scripts:")
	if (data.orphanScriptBasenames.length === 0) {
		lines.push("- none")
	} else {
		lines.push(`- ${data.orphanScriptBasenames.join(", ")}`)
	}

	return `${lines.join("\n")}\n`
}

const writeDiagnosticsLog = async (data) => {
	const source = buildDiagnosticsLogSource(data)
	await mkdir(LOGS_ROOT, { recursive: true })
	await writeFile(SYNC_LOG_PATH, source, FILE_ENCODING)
	return path.relative(PROJECT_ROOT, SYNC_LOG_PATH)
}

/**
 * Reads the customer-facing root config and returns the configured default template id.
 * Contract: defaultTemplate must be a non-empty string.
 */
const readActiveTemplate = async () => {
	const configContent = await readFile(SITE_CONFIG_PATH, FILE_ENCODING)
	const parsedConfig = parseYaml(configContent)

	if (typeof parsedConfig !== "object" || parsedConfig === null || Array.isArray(parsedConfig)) {
		throw new Error("site.config.yml must contain an object at root level.")
	}

	const activeTemplate = parsedConfig.defaultTemplate
	if (typeof activeTemplate !== "string" || activeTemplate.trim().length === 0) {
		throw new Error("site.config.yml must define a non-empty string for \"defaultTemplate\".")
	}

	return activeTemplate.trim()
}

/**
 * Discovers all installed templates and enforces the required foundation.scss contract.
 */
const collectTemplateIds = async () => {
	const entries = await readdir(TEMPLATES_ROOT, { withFileTypes: true })
	const templateIds = []

	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue
		}

		const templateId = entry.name
		const foundationPath = path.join(TEMPLATES_ROOT, templateId, "foundation.scss")
		if (!(await pathExists(foundationPath))) {
			throw new Error(`Template "${templateId}" is missing foundation.scss.`)
		}

		templateIds.push(templateId)
	}

	const sortedTemplateIds = toSorted(templateIds)
	if (sortedTemplateIds.length === 0) {
		throw new Error("No templates found in src/lyfmark/templates.")
	}

	return sortedTemplateIds
}

/**
 * Discovers installed modules and resolves optional template-specific style overrides.
 */
const collectModuleDescriptors = async (templateIds) => {
	const entries = await readdir(MODULES_ROOT, { withFileTypes: true })
	const descriptors = []

	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue
		}

		const moduleId = entry.name
		const moduleRoot = path.join(MODULES_ROOT, moduleId)
		const moduleEntryPath = path.join(moduleRoot, "module.ts")
		const moduleBaseStylePath = path.join(moduleRoot, "styles", "base.scss")

		if (!(await pathExists(moduleEntryPath))) {
			throw new Error(`Module "${moduleId}" is missing module.ts.`)
		}

		if (!(await pathExists(moduleBaseStylePath))) {
			throw new Error(`Module "${moduleId}" is missing styles/base.scss.`)
		}

		const overrideByTemplate = new Map()
		const unknownTemplateOverrides = []
		const moduleTemplateStylesRoot = path.join(moduleRoot, "styles", "templates")
		if (await pathExists(moduleTemplateStylesRoot)) {
			const templateStyleEntries = await readdir(moduleTemplateStylesRoot, { withFileTypes: true })
			for (const templateStyleEntry of templateStyleEntries) {
				if (!templateStyleEntry.isFile() || !templateStyleEntry.name.endsWith(".scss")) {
					continue
				}

				const overrideTemplateId = templateStyleEntry.name.slice(0, -5)
				if (!templateIds.includes(overrideTemplateId)) {
					unknownTemplateOverrides.push(overrideTemplateId)
					continue
				}

				overrideByTemplate.set(overrideTemplateId, templateStyleEntry.name)
			}
		}

		descriptors.push({
			moduleId,
			overrideByTemplate,
			unknownTemplateOverrides: toSorted(unknownTemplateOverrides),
		})
	}

	return descriptors.sort((left, right) => left.moduleId.localeCompare(right.moduleId))
}

/**
 * Builds one SCSS bundle per template:
 * 1) template foundation, 2) module base styles, 3) module template override (optional).
 */
const buildTemplateBundle = (templateId, moduleDescriptors) => {
	const lines = [
		"// Auto-generated by tools/lyfmark-sync.mjs. Do not edit manually.",
		`@use "../../../templates/${templateId}/foundation.scss" as *;`,
	]

	const missingModuleOverrides = []
	for (const descriptor of moduleDescriptors) {
		lines.push(`@use "../../../modules/${descriptor.moduleId}/styles/base.scss" as *;`)

		if (!descriptor.overrideByTemplate.has(templateId)) {
			missingModuleOverrides.push(descriptor.moduleId)
			continue
		}

		lines.push(`@use "../../../modules/${descriptor.moduleId}/styles/templates/${templateId}.scss" as *;`)
	}

	return {
		content: `${lines.join("\n")}\n`,
		missingModuleOverrides,
	}
}

const removeStaleGeneratedTemplateBundles = async (templateIds) => {
	if (!(await pathExists(GENERATED_TEMPLATE_STYLES_ROOT))) {
		return []
	}

	const expectedBundleNames = new Set(templateIds.map((templateId) => `${templateId}.scss`))
	const entries = await readdir(GENERATED_TEMPLATE_STYLES_ROOT, { withFileTypes: true })
	const removedFiles = []

	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith(".scss")) {
			continue
		}
		if (expectedBundleNames.has(entry.name)) {
			continue
		}

		const staleBundlePath = path.join(GENERATED_TEMPLATE_STYLES_ROOT, entry.name)
		await unlink(staleBundlePath)
		removedFiles.push(path.relative(PROJECT_ROOT, staleBundlePath))
	}

	return toSorted(removedFiles)
}

const buildManifestSource = (activeTemplateId, templateIds, moduleDescriptors, missingOverridesByTemplate) => {
	const manifest = {
		activeTemplate: activeTemplateId,
		templates: templateIds,
		modules: moduleDescriptors.map((descriptor) => descriptor.moduleId),
		missingTemplateOverrides: missingOverridesByTemplate,
	}

	const serialized = JSON.stringify(manifest, null, "\t")
	return `// Auto-generated by tools/lyfmark-sync.mjs. Do not edit manually.\nexport const templateManifest = ${serialized} as const\n\nexport type TemplateManifest = typeof templateManifest\n`
}

const buildTemplateStyleUrlsSource = (templateIds) => {
	const importLines = []
	const mapEntries = []

	templateIds.forEach((templateId, index) => {
		const variableName = `templateStyleUrl${index}`
		importLines.push(`import ${variableName} from "./styles/templates/${templateId}.scss?url"`)
		mapEntries.push(`\t"${templateId}": ${variableName},`)
	})

	return `// Auto-generated by tools/lyfmark-sync.mjs. Do not edit manually.\n${importLines.join("\n")}\n\nexport const templateStyleUrls = {\n${mapEntries.join("\n")}\n} as const\n\nexport type TemplateStyleId = keyof typeof templateStyleUrls\n`
}

/**
 * Discovers available module runtime scripts under src/scripts.
 * Only files matching <module-id>.js are considered module runtime scripts.
 */
const collectModuleRuntimeScripts = async (moduleDescriptors) => {
	const moduleIds = new Set(moduleDescriptors.map((descriptor) => descriptor.moduleId))
	const runtimeScripts = []
	const orphanScriptBasenames = []

	if (!(await pathExists(SCRIPTS_ROOT))) {
		return { runtimeScripts, orphanScriptBasenames }
	}

	const scriptEntries = await readdir(SCRIPTS_ROOT, { withFileTypes: true })
	const scriptBasenames = scriptEntries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
		.map((entry) => entry.name.slice(0, -3))

	for (const descriptor of moduleDescriptors) {
		const scriptPath = path.join(SCRIPTS_ROOT, `${descriptor.moduleId}.js`)
		if (await pathExists(scriptPath)) {
			runtimeScripts.push(descriptor.moduleId)
		}
	}

	for (const scriptBasename of toSorted(scriptBasenames)) {
		if (moduleIds.has(scriptBasename) || SHARED_RUNTIME_SCRIPT_BASENAMES.has(scriptBasename)) {
			continue
		}
		orphanScriptBasenames.push(scriptBasename)
	}

	return { runtimeScripts, orphanScriptBasenames }
}

const buildModuleRuntimeScriptsComponentSource = (runtimeScripts) => {
	const lines = [
		"---",
		"// Auto-generated by tools/lyfmark-sync.mjs. Do not edit manually.",
		"---",
	]

	if (runtimeScripts.length === 0) {
		lines.push("<!-- No module runtime scripts detected. -->")
		return `${lines.join("\n")}\n`
	}

	for (const scriptBasename of runtimeScripts) {
		lines.push(`<script src="../../scripts/${scriptBasename}.js"></script>`)
	}

	return `${lines.join("\n")}\n`
}

const buildModuleRuntimeScriptsManifestSource = (runtimeScripts) => {
	const manifest = {
		moduleRuntimeScripts: runtimeScripts.map((scriptBasename) => `${scriptBasename}.js`),
	}
	const serialized = JSON.stringify(manifest, null, "\t")
	return `// Auto-generated by tools/lyfmark-sync.mjs. Do not edit manually.\nexport const runtimeScriptsManifest = ${serialized} as const\n\nexport type RuntimeScriptsManifest = typeof runtimeScriptsManifest\n`
}

const main = async () => {
	const activeTemplateId = await readActiveTemplate()
	const templateIds = await collectTemplateIds()

	if (!templateIds.includes(activeTemplateId)) {
		throw new Error(
			`defaultTemplate "${activeTemplateId}" from site.config.yml does not exist in src/lyfmark/templates. Available templates: ${templateIds.join(", ")}.`,
		)
	}

	const moduleDescriptors = await collectModuleDescriptors(templateIds)
	const { runtimeScripts, orphanScriptBasenames } = await collectModuleRuntimeScripts(moduleDescriptors)
	const missingOverridesByTemplate = {}
	const updatedFiles = []
	const removedFiles = []

	await mkdir(GENERATED_TEMPLATE_STYLES_ROOT, { recursive: true })

	for (const templateId of templateIds) {
		const { content, missingModuleOverrides } = buildTemplateBundle(templateId, moduleDescriptors)
		const outputPath = path.join(GENERATED_TEMPLATE_STYLES_ROOT, `${templateId}.scss`)
		const changed = await writeFileIfChanged(outputPath, content)
		if (changed) {
			updatedFiles.push(path.relative(PROJECT_ROOT, outputPath))
		}
		missingOverridesByTemplate[templateId] = missingModuleOverrides
	}

	const removedTemplateBundleFiles = await removeStaleGeneratedTemplateBundles(templateIds)
	removedFiles.push(...removedTemplateBundleFiles)

	const manifestSource = buildManifestSource(activeTemplateId, templateIds, moduleDescriptors, missingOverridesByTemplate)
	const manifestChanged = await writeFileIfChanged(GENERATED_MANIFEST_PATH, manifestSource)
	if (manifestChanged) {
		updatedFiles.push(path.relative(PROJECT_ROOT, GENERATED_MANIFEST_PATH))
	}

	const templateStyleUrlsSource = buildTemplateStyleUrlsSource(templateIds)
	const templateStyleUrlsChanged = await writeFileIfChanged(GENERATED_TEMPLATE_STYLE_URLS_PATH, templateStyleUrlsSource)
	if (templateStyleUrlsChanged) {
		updatedFiles.push(path.relative(PROJECT_ROOT, GENERATED_TEMPLATE_STYLE_URLS_PATH))
	}

	const runtimeScriptsComponentSource = buildModuleRuntimeScriptsComponentSource(runtimeScripts)
	const runtimeScriptsComponentChanged = await writeFileIfChanged(
		GENERATED_RUNTIME_SCRIPTS_COMPONENT_PATH,
		runtimeScriptsComponentSource,
	)
	if (runtimeScriptsComponentChanged) {
		updatedFiles.push(path.relative(PROJECT_ROOT, GENERATED_RUNTIME_SCRIPTS_COMPONENT_PATH))
	}

	const runtimeScriptsManifestSource = buildModuleRuntimeScriptsManifestSource(runtimeScripts)
	const runtimeScriptsManifestChanged = await writeFileIfChanged(
		GENERATED_RUNTIME_SCRIPTS_MANIFEST_PATH,
		runtimeScriptsManifestSource,
	)
	if (runtimeScriptsManifestChanged) {
		updatedFiles.push(path.relative(PROJECT_ROOT, GENERATED_RUNTIME_SCRIPTS_MANIFEST_PATH))
	}

	const diagnosticsLogRelativePath = await writeDiagnosticsLog({
		activeTemplateId,
		templateIds,
		moduleDescriptors,
		runtimeScripts,
		missingOverridesByTemplate,
		orphanScriptBasenames,
	})

	const missingOverrideTemplateCount = templateIds.filter(
		(templateId) => (missingOverridesByTemplate[templateId] ?? []).length > 0,
	).length
	const missingOverrideCount = templateIds.reduce(
		(sum, templateId) => sum + (missingOverridesByTemplate[templateId] ?? []).length,
		0,
	)
	const descriptorsWithUnknownOverrides = moduleDescriptors.filter(
		(descriptor) => descriptor.unknownTemplateOverrides.length > 0,
	)
	const unknownOverrideCount = descriptorsWithUnknownOverrides.reduce(
		(sum, descriptor) => sum + descriptor.unknownTemplateOverrides.length,
		0,
	)
	const hasWarningSignals =
		missingOverrideCount > 0 || unknownOverrideCount > 0 || orphanScriptBasenames.length > 0

	console.log(`[lyfmark:sync] Templates: ${templateIds.length}, modules: ${moduleDescriptors.length}.`)
	console.log(`[lyfmark:sync] Active template: "${activeTemplateId}".`)
	console.log(`[lyfmark:sync] Module runtime scripts: ${runtimeScripts.length}.`)

	if (!hasWarningSignals) {
		console.log("[lyfmark:sync] Optional quality checks passed.")
	} else {
		console.warn("[lyfmark:sync] WARNING: Optional quality checks reported issues. Build output remains usable.")
		if (missingOverrideCount > 0) {
			console.warn(
				`[lyfmark:sync] WARNING: ${missingOverrideCount} module template override(s) missing across ${missingOverrideTemplateCount} template(s). Fallback to module base styles is active. Action: add template overrides where visual parity is required.`,
			)
		}
		if (unknownOverrideCount > 0) {
			console.warn(
				`[lyfmark:sync] WARNING: ${unknownOverrideCount} unknown module override file(s) detected in ${descriptorsWithUnknownOverrides.length} module(s). Action: rename/remove override files so filenames match installed template ids.`,
			)
		}
		if (orphanScriptBasenames.length > 0) {
			console.warn(
				`[lyfmark:sync] WARNING: ${orphanScriptBasenames.length} runtime script file(s) do not match installed module ids. Action: rename to <module-id>.js or treat as shared script explicitly.`,
			)
		}
		if (CLI_OPTIONS.verbose) {
			for (const templateId of templateIds) {
				const missingModules = missingOverridesByTemplate[templateId] ?? []
				if (missingModules.length === 0) {
					continue
				}
				console.warn(
					`[lyfmark:sync] VERBOSE: Template "${templateId}" missing overrides for: ${missingModules.join(", ")}.`,
				)
			}
			for (const descriptor of descriptorsWithUnknownOverrides) {
				console.warn(
					`[lyfmark:sync] VERBOSE: Module "${descriptor.moduleId}" has unknown override files for: ${descriptor.unknownTemplateOverrides.join(", ")}.`,
				)
			}
			if (orphanScriptBasenames.length > 0) {
				console.warn(
					`[lyfmark:sync] VERBOSE: Orphan runtime scripts: ${orphanScriptBasenames.join(", ")}.`,
				)
			}
		} else {
			console.warn(
				`[lyfmark:sync] WARNING: Detailed diagnostics written to "${diagnosticsLogRelativePath}". Use "npm run lyfmark:sync:verbose" for inline details.`,
			)
		}
	}

	if (updatedFiles.length === 0 && removedFiles.length === 0) {
		console.log("[lyfmark:sync] No generated files changed.")
		return
	}

	if (updatedFiles.length > 0) {
		console.log("[lyfmark:sync] Updated generated files:")
		for (const updatedFile of updatedFiles) {
			console.log(`- ${updatedFile}`)
		}
	}

	if (removedFiles.length > 0) {
		console.log("[lyfmark:sync] Removed stale generated files:")
		for (const removedFile of removedFiles) {
			console.log(`- ${removedFile}`)
		}
	}
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error)
	console.error(`[lyfmark:sync] Error: ${message}`)
	process.exitCode = 1
})
