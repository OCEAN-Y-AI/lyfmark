import { createHash } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { spawn } from "node:child_process"

const PROJECT_ROOT = process.cwd()
const DEFAULT_PACKAGE_TYPE = "core"
const DEFAULT_PACKAGE_NAME = "lyfmark-core"

const parseOptions = (argv) => {
	const options = {
		version: "",
		output: "",
		allowDirty: false,
	}

	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index]
		const equalsIndex = argument.indexOf("=")
		const optionName = equalsIndex >= 0 ? argument.slice(0, equalsIndex) : argument
		const inlineValue = equalsIndex >= 0 ? argument.slice(equalsIndex + 1) : undefined

		if (optionName === "--allow-dirty") {
			if (typeof inlineValue !== "undefined") {
				throw new Error("--allow-dirty does not accept a value.")
			}
			options.allowDirty = true
			continue
		}

		if (optionName !== "--version" && optionName !== "--output") {
			throw new Error(`Unknown package option "${argument}".`)
		}

		const value =
			typeof inlineValue === "string"
				? inlineValue
				: typeof argv[index + 1] === "string" && !argv[index + 1].startsWith("--")
					? argv[++index]
					: ""
		if (value.trim().length === 0) {
			throw new Error(`${optionName} requires a value.`)
		}
		if (optionName === "--version") {
			options.version = value.trim()
		} else {
			options.output = value.trim()
		}
	}

	if (!/^\d+\.\d+$/u.test(options.version)) {
		throw new Error("Core package version must use major.minor format, for example 1.0.")
	}

	return options
}

const runGit = async (args, contextLabel) =>
	await new Promise((resolve, reject) => {
		const child = spawn("git", args, {
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
		child.on("error", reject)
		child.on("close", (code) => {
			if (code === 0) {
				resolve(stdout.trim())
				return
			}
			reject(new Error(`${contextLabel} failed with exit code ${code ?? 1}: ${stderr.trim() || stdout.trim()}`))
		})
	})

const runCommand = async (command, args, options, contextLabel) =>
	await new Promise((resolve, reject) => {
		const stdio = options.stdio ?? (typeof options.stdin === "string" ? ["pipe", "pipe", "pipe"] : ["ignore", "pipe", "pipe"])
		const child = spawn(command, args, {
			cwd: options.cwd ?? PROJECT_ROOT,
			stdio,
		})

		let stdout = ""
		let stderr = ""
		child.stdout?.on("data", (chunk) => {
			stdout += String(chunk)
		})
		child.stderr?.on("data", (chunk) => {
			stderr += String(chunk)
		})
		if (typeof options.stdin === "string" && child.stdin) {
			child.stdin.write(options.stdin)
			child.stdin.end()
		}
		child.on("error", reject)
		child.on("close", (code) => {
			if (code === 0) {
				resolve(stdout.trim())
				return
			}
			reject(new Error(`${contextLabel} failed with exit code ${code ?? 1}: ${stderr.trim() || stdout.trim()}`))
		})
	})

const assertCleanWorkingTree = async () => {
	const status = await runGit(["status", "--porcelain"], "git status")
	if (status.length > 0) {
		throw new Error("Working tree is not clean. Commit or stash changes before building a release package.")
	}
}

const sha256File = async (filePath) => {
	const hash = createHash("sha256")
	hash.update(await readFile(filePath))
	return hash.digest("hex")
}

const createCleanArchive = async (archivePath) => {
	await runGit(["archive", "--format=zip", "--output", archivePath, "HEAD"], "git archive")
}

const createWorkingTreeArchive = async (archivePath) => {
	const fileList = await runGit(["ls-files", "--cached", "--others", "--exclude-standard"], "git ls-files")
	if (fileList.length === 0) {
		throw new Error("No package files were found.")
	}
	await runCommand(
		"zip",
		["-q", "-X", archivePath, "-@"],
		{
			cwd: PROJECT_ROOT,
			stdin: `${fileList}\n`,
		},
		"zip working tree archive",
	)
}

const buildManifest = ({ version, asset, sha256, sourceCommit, workingTree }) => ({
	packageType: DEFAULT_PACKAGE_TYPE,
	packageName: DEFAULT_PACKAGE_NAME,
	version,
	asset,
	sha256,
	sourceRepository: "OCEAN-Y-AI/lyfmark",
	sourceCommit,
	workingTree,
	createdAt: new Date().toISOString(),
	signatureStatus: "unsigned-pragmatic-1.0",
})

const main = async () => {
	const options = parseOptions(process.argv.slice(2))
	if (!options.allowDirty) {
		await assertCleanWorkingTree()
	}

	const sourceCommit = await runGit(["rev-parse", "HEAD"], "git rev-parse HEAD")
	const outputDirectory = path.resolve(options.output || path.join(PROJECT_ROOT, "dist-release"))
	const assetName = `${DEFAULT_PACKAGE_NAME}-${options.version}.zip`
	const archivePath = path.join(outputDirectory, assetName)
	const manifestPath = path.join(outputDirectory, `${DEFAULT_PACKAGE_NAME}-${options.version}.manifest.json`)

	await mkdir(outputDirectory, { recursive: true })
	await rm(archivePath, { force: true })
	if (options.allowDirty) {
		await createWorkingTreeArchive(archivePath)
	} else {
		await createCleanArchive(archivePath)
	}
	const sha256 = await sha256File(archivePath)
	const manifest = buildManifest({
		version: options.version,
		asset: assetName,
		sha256,
		sourceCommit,
		workingTree: options.allowDirty ? "dirty-package-for-local-testing" : "clean-release",
	})
	await writeFile(manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`, "utf8")

	console.log(`[release] Core package created: ${archivePath}`)
	console.log(`[release] Manifest created: ${manifestPath}`)
	console.log(`[release] SHA-256: ${sha256}`)
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error)
	console.error(`[release] Error: ${message}`)
	process.exitCode = 1
})
