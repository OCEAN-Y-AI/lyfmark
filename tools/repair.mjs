import { spawn } from "node:child_process"
import { lstat, mkdir, readlink, realpath, rm, symlink } from "node:fs/promises"
import path from "node:path"

const PROJECT_ROOT = process.cwd()
const SOURCE_ROOT = path.join(PROJECT_ROOT, "src")
const ROOT_DIRECTORIES = [
	path.join(PROJECT_ROOT, "pages"),
	path.join(PROJECT_ROOT, "content-blocks"),
	path.join(PROJECT_ROOT, "navigation"),
	path.join(PROJECT_ROOT, "forms"),
	path.join(PROJECT_ROOT, "public"),
	path.join(PROJECT_ROOT, "docs", "public"),
]
const LINK_TARGETS = [
	{ linkPath: path.join(SOURCE_ROOT, "pages"), targetPath: path.join(PROJECT_ROOT, "pages") },
	{ linkPath: path.join(SOURCE_ROOT, "content-blocks"), targetPath: path.join(PROJECT_ROOT, "content-blocks") },
	{ linkPath: path.join(SOURCE_ROOT, "navigation"), targetPath: path.join(PROJECT_ROOT, "navigation") },
	{ linkPath: path.join(SOURCE_ROOT, "forms"), targetPath: path.join(PROJECT_ROOT, "forms") },
]

const toComparablePath = (value) => {
	const normalized = path.resolve(value)
	return process.platform === "win32" ? normalized.toLowerCase() : normalized
}

const readExistingLinkTarget = async (linkPath) => {
	const rawTarget = await readlink(linkPath)
	const resolvedTarget = path.resolve(path.dirname(linkPath), rawTarget)
	try {
		return await realpath(resolvedTarget)
	} catch {
		return resolvedTarget
	}
}

const createDirectoryLink = async (linkPath, targetPath) => {
	if (process.platform === "win32") {
		await symlink(targetPath, linkPath, "junction")
		return
	}
	const relativeTarget = path.relative(path.dirname(linkPath), targetPath) || "."
	await symlink(relativeTarget, linkPath, "dir")
}

const ensurePathIsMissingOrLink = async (linkPath, targetPath) => {
	let stats
	try {
		stats = await lstat(linkPath)
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
			return "missing"
		}
		throw error
	}

	if (!stats.isSymbolicLink()) {
		throw new Error(
			`Conflict at ${path.relative(PROJECT_ROOT, linkPath)}: expected a link, found a real file/directory. ` +
				`Move its content to ${path.relative(PROJECT_ROOT, targetPath)} and run "npm run repair" again.`,
		)
	}

	const existingTarget = await readExistingLinkTarget(linkPath)
	const expectedTarget = await realpath(targetPath)
	if (toComparablePath(existingTarget) === toComparablePath(expectedTarget)) {
		return "ok"
	}

	await rm(linkPath, { force: true, recursive: true })
	return "recreate"
}

const ensureDirectoryExists = async (directoryPath) => {
	let stats
	try {
		stats = await lstat(directoryPath)
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
			await mkdir(directoryPath, { recursive: true })
			return "created"
		}
		throw error
	}

	if (!stats.isDirectory()) {
		throw new Error(
			`Conflict at ${path.relative(PROJECT_ROOT, directoryPath)}: expected a folder, found a file/link. ` +
				`Rename or remove it and run "npm run repair" again.`,
		)
	}

	return "ok"
}

const runLyfmarkSync = async () =>
	await new Promise((resolve, reject) => {
		const syncScriptPath = path.join(PROJECT_ROOT, "tools", "lyfmark-sync.mjs")
		const child = spawn(process.execPath, [syncScriptPath], {
			cwd: PROJECT_ROOT,
			stdio: ["ignore", "pipe", "pipe"],
		})

		let stdout = ""
		let stderr = ""
		child.stdout.on("data", (chunk) => {
			stdout += String(chunk)
		})
		child.stderr.on("data", (chunk) => {
			stderr += String(chunk)
		})
		child.on("error", (error) => {
			reject(error)
		})
		child.on("close", (code) => {
			resolve({ code: code ?? 1, stdout, stderr })
		})
	})

const parseSyncSummary = (stdout, stderr) => {
	const combinedLines = `${stdout}\n${stderr}`
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.filter((line) => line.length > 0)

	const warningLines = combinedLines.filter((line) => line.includes("[lyfmark:sync] WARNING:"))
	const changedLine = combinedLines.find((line) => line.includes("[lyfmark:sync] Updated generated files:"))
	const unchangedLine = combinedLines.find((line) => line.includes("[lyfmark:sync] No generated files changed."))

	return {
		warningCount: warningLines.length,
		firstWarning: warningLines[0] ?? "",
		changed: Boolean(changedLine),
		unchanged: Boolean(unchangedLine),
	}
}

const main = async () => {
	const sourceRootState = await ensureDirectoryExists(SOURCE_ROOT)
	let createdRootDirectories = 0
	for (const directoryPath of ROOT_DIRECTORIES) {
		const state = await ensureDirectoryExists(directoryPath)
		if (state === "created") {
			createdRootDirectories += 1
		}
	}

	const report = []
	for (const { linkPath, targetPath } of LINK_TARGETS) {
		const state = await ensurePathIsMissingOrLink(linkPath, targetPath)
		if (state === "ok") {
			report.push({ linkPath, targetPath, status: "ok" })
			continue
		}

		await createDirectoryLink(linkPath, targetPath)
		report.push({ linkPath, targetPath, status: state === "missing" ? "created" : "recreated" })
	}

	const linkSummary = report.reduce(
		(summary, entry) => {
			if (entry.status === "ok") {
				summary.ok += 1
			} else if (entry.status === "created") {
				summary.created += 1
			} else if (entry.status === "recreated") {
				summary.recreated += 1
			}
			return summary
		},
		{ ok: 0, created: 0, recreated: 0 },
	)

	console.log("[repair] Root/mirror links:")
	for (const entry of report) {
		const shortLink = path.relative(PROJECT_ROOT, entry.linkPath)
		const shortTarget = path.relative(PROJECT_ROOT, entry.targetPath)
		console.log(`- ${entry.status.toUpperCase()}: ${shortLink} -> ${shortTarget}`)
	}

	const syncResult = await runLyfmarkSync()
	if (syncResult.code !== 0) {
		throw new Error(
			`LyfMark sync failed. Run "npm run lyfmark:sync:verbose" for detailed diagnostics.\n` +
				`${(syncResult.stdout + syncResult.stderr).trim()}`,
		)
	}
	const syncSummary = parseSyncSummary(syncResult.stdout, syncResult.stderr)

	console.log("[repair] Health summary:")
	console.log(
		`- Root folders: ${ROOT_DIRECTORIES.length - createdRootDirectories} present, ${createdRootDirectories} created.`,
	)
	console.log(`- Source root: ${sourceRootState === "created" ? "created" : "present"}.`)
	console.log(
		`- Mirror links: ${linkSummary.ok} ok, ${linkSummary.created} created, ${linkSummary.recreated} repaired.`,
	)
	if (syncSummary.warningCount > 0) {
		console.log(
			`- Sync: completed with ${syncSummary.warningCount} warning(s). Build remains usable. ` +
				`Run "npm run lyfmark:sync:verbose" for details.`,
		)
		if (syncSummary.firstWarning.length > 0) {
			console.log(`  First warning: ${syncSummary.firstWarning}`)
		}
	} else if (syncSummary.changed) {
		console.log("- Sync: completed and updated generated files.")
	} else if (syncSummary.unchanged) {
		console.log("- Sync: completed, no generated file changes.")
	} else {
		console.log("- Sync: completed.")
	}

	console.log('[repair] Finished. Project structure is ready. If "Sync" shows warnings, you can still continue.')
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error)
	console.error(`[repair] Error: ${message}`)
	process.exitCode = 1
})
