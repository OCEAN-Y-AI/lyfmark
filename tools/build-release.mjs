/**
 * Builds and verifies LyfMark Core release artifacts without publishing them.
 * Publishing is intentionally handled by tools/release.mjs as a separate step.
 */
import { createHash } from "node:crypto"
import { spawn } from "node:child_process"
import { access, mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const PROJECT_ROOT = process.cwd()
const DEFAULT_CORE_VERSION = "1.0"
const RELEASE_DIRECTORY = path.join(PROJECT_ROOT, "dist-release")
const REQUIRED_RELEASE_FILES = [
	"AGENTS.md",
	".gitattributes",
	"README.md",
	"package.json",
	"package-lock.json",
	"astro.config.ts",
	"tsconfig.json",
	"site.config.yml",
	"pages/index.md",
	"navigation/menu.md",
	"content-blocks/hero.md",
	"forms/basic-contact.html",
	"public/favicon.svg",
	"public/robots.txt",
	"installer/windows/install.ps1",
	"installer/windows/install.cmd",
	"installer/macos/install.command",
	"installer/linux/install.sh",
	"tools/installer/wizard.mjs",
	"tools/build-release.mjs",
	"tools/package-core.mjs",
	"tools/release.mjs",
	"tools/repair.mjs",
	"tools/lyfmark-sync.mjs",
	"tools/test-installer.mjs",
	"tools/test-installer-e2e.mjs",
	"tools/test-lyfmark-prettier.mjs",
	"tools/lyfmark-vscode/install-local-extension.mjs",
	"tools/lyfmark-vscode/package.json",
	"docs/internal/release-flow.md",
	"docs/internal/release-packaging-security.md",
	"docs/public/installation.md",
	"docs/public/onboarding.md",
]
const REQUIRED_ARCHIVE_ENTRIES = [
	".gitattributes",
	"package.json",
	"package-lock.json",
	"installer/windows/install.ps1",
	"tools/installer/wizard.mjs",
	"tools/package-core.mjs",
	"tools/build-release.mjs",
	"tools/release.mjs",
	"docs/internal/release-flow.md",
]

const parseOptions = (argv) => {
	const options = {
		version: DEFAULT_CORE_VERSION,
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

		if (optionName !== "--version") {
			throw new Error(`Unknown release option "${argument}".`)
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
		options.version = value.trim()
	}

	if (!/^\d+\.\d+$/u.test(options.version)) {
		throw new Error("Release version must use major.minor format, for example 1.0.")
	}

	return options
}

const npmCommand = () => (process.platform === "win32" ? "npm.cmd" : "npm")

const runCommand = async (command, args, label, options = {}) => {
	console.log("")
	console.log(`[release] ${label}`)
	await new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: options.cwd ?? PROJECT_ROOT,
			env: options.env ?? process.env,
			stdio: options.stdio ?? "inherit",
		})

		child.on("error", reject)
		child.on("close", (code) => {
			if (code === 0) {
				resolve()
				return
			}
			reject(new Error(`${label} failed with exit code ${code ?? 1}.`))
		})
	})
}

const captureCommand = async (command, args, label, options = {}) =>
	await new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: options.cwd ?? PROJECT_ROOT,
			env: options.env ?? process.env,
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
				resolve(stdout)
				return
			}
			reject(new Error(`${label} failed with exit code ${code ?? 1}: ${stderr.trim() || stdout.trim()}`))
		})
	})

const readProjectFile = async (relativePath) => await readFile(path.join(PROJECT_ROOT, relativePath), "utf8")

const readProjectJson = async (relativePath) => JSON.parse(await readProjectFile(relativePath))

const assertProjectFileExists = async (relativePath) => {
	try {
		await access(path.join(PROJECT_ROOT, relativePath))
	} catch {
		throw new Error(`Required release file is missing: ${relativePath}`)
	}
}

const assertTextMatches = (text, pattern, message) => {
	if (!pattern.test(text)) {
		throw new Error(message)
	}
}

const sha256File = async (filePath) => {
	const hash = createHash("sha256")
	hash.update(await readFile(filePath))
	return hash.digest("hex")
}

const assertCleanWorkingTree = async (contextLabel) => {
	const status = (await captureCommand("git", ["status", "--porcelain"], `Check working tree ${contextLabel}`)).trim()
	if (status.length > 0) {
		throw new Error(
			`Working tree is not clean ${contextLabel}. Commit or stash changes before building a release package.`,
		)
	}
}

const assertGitRoot = async () => {
	const gitRoot = (await captureCommand("git", ["rev-parse", "--show-toplevel"], "Find Git repository root")).trim()
	if (path.resolve(gitRoot) !== PROJECT_ROOT) {
		throw new Error(`Release must run from the repository root. Git root: ${gitRoot}`)
	}
}

const assertReleaseVersionConsistency = async (version) => {
	const packageJson = await readProjectJson("package.json")
	if (packageJson.scripts?.["build:release"] !== "node tools/build-release.mjs") {
		throw new Error('package.json script "build:release" must be "node tools/build-release.mjs".')
	}
	if (packageJson.scripts?.["package:core"] !== `node tools/package-core.mjs --version ${version}`) {
		throw new Error(`package.json script "package:core" must use Core version ${version}.`)
	}
	if (packageJson.scripts?.["release:core"] !== "node tools/release.mjs core") {
		throw new Error('package.json script "release:core" must be "node tools/release.mjs core".')
	}
	if (packageJson.scripts?.["release:template"] !== "node tools/release.mjs template") {
		throw new Error('package.json script "release:template" must be "node tools/release.mjs template".')
	}
	if (packageJson.scripts?.["release:modules"] !== "node tools/release.mjs modules") {
		throw new Error('package.json script "release:modules" must be "node tools/release.mjs modules".')
	}
	if (packageJson.scripts?.release !== "node tools/release.mjs auto") {
		throw new Error('package.json script "release" must be "node tools/release.mjs auto".')
	}

	const installerSource = await readProjectFile("installer/windows/install.ps1")
	assertTextMatches(
		installerSource,
		new RegExp(`\\[string\\]\\$CoreVersion = "${version.replace(".", "\\.")}"`, "u"),
		`Windows installer default CoreVersion must be ${version}.`,
	)

	const releaseFlowSource = await readProjectFile("docs/internal/release-flow.md")
	assertTextMatches(
		releaseFlowSource,
		new RegExp(`Aktuelle Core-Version: \`${version.replace(".", "\\.")}\``, "u"),
		`Release flow documentation must state Core version ${version}.`,
	)
	assertTextMatches(
		releaseFlowSource,
		/npm run build:release/u,
		"Release flow documentation must document npm run build:release.",
	)
}

const assertBundledVsixExists = async () => {
	const extensionPackage = await readProjectJson("tools/lyfmark-vscode/package.json")
	const expectedVsix = `tools/lyfmark-vscode/${extensionPackage.name}-${extensionPackage.version}.vsix`
	await assertProjectFileExists(expectedVsix)
}

const assertSigningStateIsExplicit = async () => {
	const packageCoreSource = await readProjectFile("tools/package-core.mjs")
	const buildReleaseSource = await readProjectFile("tools/build-release.mjs")
	assertTextMatches(
		packageCoreSource,
		/signatureStatus: "unsigned-pragmatic-1\.0"/u,
		"Package manifest must explicitly mark the current unsigned pragmatic signing state.",
	)
	assertTextMatches(
		buildReleaseSource,
		/Signing is not implemented yet/u,
		"Release build must keep the signing placeholder explicit until real signing is implemented.",
	)
}

const runReleaseSanityCheck = async ({ version, allowDirty }) => {
	console.log("")
	console.log("[release] Check releasable repository state")

	await assertGitRoot()
	if (allowDirty) {
		console.log("[release] Working tree cleanliness check skipped because --allow-dirty is active.")
	} else {
		await assertCleanWorkingTree("before release gates")
	}
	for (const relativePath of REQUIRED_RELEASE_FILES) {
		await assertProjectFileExists(relativePath)
	}
	await assertReleaseVersionConsistency(version)
	await assertBundledVsixExists()
	await assertSigningStateIsExplicit()

	console.log("[release] Repository sanity check passed.")
}

const listArchiveEntries = async (archivePath) => {
	try {
		return (await captureCommand("unzip", ["-Z1", archivePath], "List release archive with unzip"))
			.split(/\r?\n/u)
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0)
	} catch (unzipError) {
		try {
			return (await captureCommand("tar", ["-tf", archivePath], "List release archive with tar"))
				.split(/\r?\n/u)
				.map((entry) => entry.trim().replace(/^\.\//u, ""))
				.filter((entry) => entry.length > 0)
		} catch {
			throw unzipError
		}
	}
}

const extractArchive = async (archivePath, targetDirectory) => {
	try {
		await runCommand("unzip", ["-q", archivePath, "-d", targetDirectory], "Extract release archive with unzip", {
			stdio: "ignore",
		})
		return
	} catch (unzipError) {
		try {
			await runCommand("tar", ["-xf", archivePath, "-C", targetDirectory], "Extract release archive with tar", {
				stdio: "ignore",
			})
			return
		} catch {
			throw unzipError
		}
	}
}

const runReleaseGates = async () => {
	const npm = npmCommand()
	await runCommand(npm, ["ci"], "Install dependencies (npm ci)")
	await runCommand(npm, ["run", "typecheck"], "Run TypeScript typecheck")
	await runCommand(npm, ["run", "test:lyfmark-prettier"], "Run LyfMark formatter tests")
	await runCommand(npm, ["run", "test:installer"], "Run installer tests")
	await runCommand(npm, ["run", "test:installer:e2e:auto"], "Run installer E2E auto test")
	await runCommand(npm, ["run", "build"], "Build website")
}

const buildCorePackage = async ({ version, allowDirty }) => {
	const args = ["tools/package-core.mjs", "--version", version]
	if (allowDirty) {
		args.push("--allow-dirty")
	}
	await runCommand(process.execPath, args, "Build Core release package")
}

const runSigningPlaceholder = async () => {
	console.log("")
	console.log("[release] Sign release artifacts")
	console.log("[release] Signing is not implemented yet. Placeholder only; no .sig files are generated.")
}

const verifyReleaseArtifacts = async ({ version }) => {
	console.log("")
	console.log("[release] Verify release artifacts")

	const archivePath = path.join(RELEASE_DIRECTORY, `lyfmark-core-${version}.zip`)
	const manifestPath = path.join(RELEASE_DIRECTORY, `lyfmark-core-${version}.manifest.json`)
	const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
	const sha256 = await sha256File(archivePath)

	if (manifest.packageType !== "core") {
		throw new Error(`Manifest packageType must be "core", got "${manifest.packageType}".`)
	}
	if (manifest.packageName !== "lyfmark-core") {
		throw new Error(`Manifest packageName must be "lyfmark-core", got "${manifest.packageName}".`)
	}
	if (manifest.version !== version) {
		throw new Error(`Manifest version must be "${version}", got "${manifest.version}".`)
	}
	if (manifest.asset !== `lyfmark-core-${version}.zip`) {
		throw new Error(`Manifest asset does not match the release archive name.`)
	}
	if (manifest.sha256 !== sha256) {
		throw new Error("Manifest sha256 does not match the release archive.")
	}

	const entries = await listArchiveEntries(archivePath)
	for (const requiredEntry of REQUIRED_ARCHIVE_ENTRIES) {
		if (!entries.includes(requiredEntry)) {
			throw new Error(`Release archive is missing required entry: ${requiredEntry}`)
		}
	}
	if (entries.some((entry) => entry === ".git" || entry.startsWith(".git/"))) {
		throw new Error("Release archive must not contain .git data.")
	}

	console.log(`[release] Artifact verification passed: ${archivePath}`)
	console.log(`[release] SHA-256: ${sha256}`)
}

const testExtractedReleaseArtifact = async ({ version }) => {
	console.log("")
	console.log("[release] Test extracted release artifact")

	const archivePath = path.join(RELEASE_DIRECTORY, `lyfmark-core-${version}.zip`)
	const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "lyfmark-release-check-"))
	try {
		await extractArchive(archivePath, temporaryDirectory)
		const testEnv = {
			...process.env,
			LYFMARK_REPAIR_SKIP_VSCODE_EXTENSIONS: "1",
		}
		await runCommand(npmCommand(), ["ci", "--no-audit", "--no-fund"], "Install extracted package dependencies", {
			cwd: temporaryDirectory,
			env: testEnv,
		})
		await runCommand(npmCommand(), ["run", "repair"], "Repair extracted release package", {
			cwd: temporaryDirectory,
			env: testEnv,
		})
	} finally {
		await rm(temporaryDirectory, { force: true, recursive: true })
	}
}

const main = async () => {
	const options = parseOptions(process.argv.slice(2))
	if (options.allowDirty) {
		console.log("[release] WARNING: --allow-dirty is for local release-flow testing only. Do not upload this package.")
	}

	await runReleaseSanityCheck(options)
	await runReleaseGates()
	if (!options.allowDirty) {
		await assertCleanWorkingTree("after release gates")
	}
	await buildCorePackage(options)
	await runSigningPlaceholder()
	await verifyReleaseArtifacts(options)
	await testExtractedReleaseArtifact(options)

	console.log("")
	console.log("[release] Release build finished. Publish existing artifacts with npm run release:core.")
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error)
	console.error(`[release] Error: ${message}`)
	process.exitCode = 1
})
