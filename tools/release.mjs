/**
 * Publishes already-built LyfMark release artifacts after validating repository,
 * tag, and manifest state. This script must never build release artifacts.
 */
import { createHash } from "node:crypto"
import { access, readFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import path from "node:path"

const PROJECT_ROOT = process.cwd()
const GITHUB_REPOSITORY = "OCEAN-Y-AI/lyfmark"
const DEFAULT_CORE_VERSION = "1.0"

const packageDefinitions = {
	core: {
		type: "core",
		version: DEFAULT_CORE_VERSION,
		tagPrefix: "core-v",
		titlePrefix: "LyfMark Core",
		assetPrefix: "lyfmark-core",
	},
}

const parseOptions = (argv) => {
	const options = {
		mode: "",
		version: "",
		dryRun: false,
		clobber: false,
	}

	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index]
		if (!argument.startsWith("--") && options.mode.length === 0) {
			options.mode = argument
			continue
		}

		const equalsIndex = argument.indexOf("=")
		const optionName = equalsIndex >= 0 ? argument.slice(0, equalsIndex) : argument
		const inlineValue = equalsIndex >= 0 ? argument.slice(equalsIndex + 1) : undefined

		if (optionName === "--dry-run") {
			if (typeof inlineValue !== "undefined") {
				throw new Error("--dry-run does not accept a value.")
			}
			options.dryRun = true
			continue
		}
		if (optionName === "--clobber") {
			if (typeof inlineValue !== "undefined") {
				throw new Error("--clobber does not accept a value.")
			}
			options.clobber = true
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

	if (options.mode.length === 0) {
		options.mode = "auto"
	}
	if (!["auto", "core", "template", "modules"].includes(options.mode)) {
		throw new Error(`Unknown release mode "${options.mode}". Use auto, core, template, or modules.`)
	}
	if (options.version.length > 0 && !/^\d+\.\d+$/u.test(options.version)) {
		throw new Error("Release version must use major.minor format, for example 1.0.")
	}

	return options
}

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

const captureOptionalCommand = async (command, args, options = {}) =>
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
			resolve({ code: code ?? 1, stdout, stderr })
		})
	})

const readProjectFile = async (relativePath) => await readFile(path.join(PROJECT_ROOT, relativePath), "utf8")

const readProjectJson = async (relativePath) => JSON.parse(await readProjectFile(relativePath))

const assertFileExists = async (filePath) => {
	try {
		await access(filePath)
	} catch {
		throw new Error(`Required release artifact is missing: ${filePath}. Run npm run build:release before publishing.`)
	}
}

const sha256File = async (filePath) => {
	const hash = createHash("sha256")
	hash.update(await readFile(filePath))
	return hash.digest("hex")
}

const assertCleanWorkingTree = async () => {
	const status = (await captureCommand("git", ["status", "--porcelain"], "Check working tree")).trim()
	if (status.length > 0) {
		throw new Error("Working tree is not clean. Commit or stash changes before publishing a release.")
	}
}

const assertGitRoot = async () => {
	const gitRoot = (await captureCommand("git", ["rev-parse", "--show-toplevel"], "Find Git repository root")).trim()
	if (path.resolve(gitRoot) !== PROJECT_ROOT) {
		throw new Error(`Release must run from the repository root. Git root: ${gitRoot}`)
	}
}

const assertMainBranch = async () => {
	const branch = (await captureCommand("git", ["branch", "--show-current"], "Read current Git branch")).trim()
	if (branch !== "main") {
		throw new Error(`Release publishing must run from main. Current branch: ${branch || "(detached)"}`)
	}
}

const normalizeGitHubRemote = (url) =>
	url
		.trim()
		.replace(/^git@github\.com:/u, "https://github.com/")
		.replace(/\.git$/u, "")
		.replace(/^https:\/\/github\.com\//u, "")

const assertOriginRepository = async () => {
	const remoteUrl = (await captureCommand("git", ["remote", "get-url", "origin"], "Read origin remote")).trim()
	const normalized = normalizeGitHubRemote(remoteUrl)
	if (normalized !== GITHUB_REPOSITORY) {
		throw new Error(`origin must point to ${GITHUB_REPOSITORY}. Current origin: ${remoteUrl}`)
	}
}

const assertGhAvailable = async () => {
	await captureCommand("gh", ["--version"], "Check GitHub CLI")
	await captureCommand("gh", ["auth", "status", "--hostname", "github.com"], "Check GitHub CLI authentication")
}

const fetchReleaseRefs = async () => {
	await runCommand("git", ["fetch", "origin", "main", "--tags"], "Fetch origin/main and tags")
}

const resolveGitRef = async (ref) => {
	const result = await captureOptionalCommand("git", ["rev-parse", "--verify", `${ref}^{}`])
	if (result.code !== 0) {
		return ""
	}
	return result.stdout.trim()
}

const assertHeadMatchesOriginMain = async () => {
	const head = (await captureCommand("git", ["rev-parse", "HEAD"], "Read HEAD commit")).trim()
	const originMain = (await captureCommand("git", ["rev-parse", "refs/remotes/origin/main"], "Read origin/main commit")).trim()
	if (head !== originMain) {
		throw new Error("HEAD must match origin/main before publishing a release. Push or pull first.")
	}
	return head
}

const releaseTag = (definition) => `${definition.tagPrefix}${definition.version}`

const releaseTitle = (definition) => `${definition.titlePrefix} ${definition.version}`

const releaseAssets = (definition) => {
	const basePath = path.join(PROJECT_ROOT, "dist-release", `${definition.assetPrefix}-${definition.version}`)
	return [`${basePath}.zip`, `${basePath}.manifest.json`]
}

const releaseAssetNames = (definition) => releaseAssets(definition).map((assetPath) => path.basename(assetPath))

const releaseManifestPath = (definition) =>
	path.join(PROJECT_ROOT, "dist-release", `${definition.assetPrefix}-${definition.version}.manifest.json`)

const releaseArchivePath = (definition) =>
	path.join(PROJECT_ROOT, "dist-release", `${definition.assetPrefix}-${definition.version}.zip`)

const assertPackageScripts = async (definition) => {
	const packageJson = await readProjectJson("package.json")
	if (packageJson.scripts?.release !== "node tools/release.mjs auto") {
		throw new Error('package.json script "release" must be "node tools/release.mjs auto".')
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
	if (packageJson.scripts?.["package:core"] !== `node tools/package-core.mjs --version ${definition.version}`) {
		throw new Error(`package.json script "package:core" must use Core version ${definition.version}.`)
	}
}

const assertReleaseArtifacts = async (definition, expectedCommit) => {
	const archivePath = releaseArchivePath(definition)
	const manifestPath = releaseManifestPath(definition)
	await assertFileExists(archivePath)
	await assertFileExists(manifestPath)

	const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
	const sha256 = await sha256File(archivePath)
	if (manifest.packageType !== definition.type) {
		throw new Error(`Manifest packageType must be "${definition.type}", got "${manifest.packageType}".`)
	}
	if (manifest.packageName !== definition.assetPrefix) {
		throw new Error(`Manifest packageName must be "${definition.assetPrefix}", got "${manifest.packageName}".`)
	}
	if (manifest.version !== definition.version) {
		throw new Error(`Manifest version must be "${definition.version}", got "${manifest.version}".`)
	}
	if (manifest.asset !== `${definition.assetPrefix}-${definition.version}.zip`) {
		throw new Error("Manifest asset does not match the expected release archive name.")
	}
	if (manifest.sha256 !== sha256) {
		throw new Error("Manifest sha256 does not match the release archive.")
	}
	if (manifest.sourceCommit !== expectedCommit) {
		throw new Error("Manifest sourceCommit does not match HEAD. Run npm run build:release after committing the release state.")
	}
	if (manifest.workingTree !== "clean-release") {
		throw new Error(`Manifest workingTree must be "clean-release", got "${manifest.workingTree}".`)
	}
}

const assertTagState = async (definition, expectedCommit) => {
	const tag = releaseTag(definition)
	const tagCommit = await resolveGitRef(`refs/tags/${tag}`)
	if (tagCommit.length > 0 && tagCommit !== expectedCommit) {
		throw new Error(`Release tag ${tag} already exists on a different commit. Bump the version before releasing.`)
	}
}

const readRelease = async (tag) => {
	const result = await captureOptionalCommand("gh", [
		"release",
		"view",
		tag,
		"--repo",
		GITHUB_REPOSITORY,
		"--json",
		"tagName,targetCommitish,assets,url",
	])
	if (result.code !== 0) {
		return null
	}
	return JSON.parse(result.stdout)
}

const assertNoAssetCollision = (release, definition, clobber) => {
	if (!release || clobber) {
		return
	}
	const existingNames = new Set((release.assets ?? []).map((asset) => asset.name))
	const collisions = releaseAssetNames(definition).filter((name) => existingNames.has(name))
	if (collisions.length > 0) {
		throw new Error(
			`Release already contains asset(s): ${collisions.join(", ")}. Use --clobber only after confirming replacement is safe.`,
		)
	}
}

const releaseNotes = (definition, commit) =>
	[
		`${releaseTitle(definition)}.`,
		"",
		`Commit: ${commit}`,
		"",
		"Generated by npm run release:core.",
	].join("\n")

const uploadRelease = async (definition, { clobber, expectedCommit }) => {
	const tag = releaseTag(definition)
	const assets = releaseAssets(definition)
	const release = await readRelease(tag)
	assertNoAssetCollision(release, definition, clobber)

	if (release) {
		const uploadArgs = ["release", "upload", tag, ...assets, "--repo", GITHUB_REPOSITORY]
		if (clobber) {
			uploadArgs.push("--clobber")
		}
		await runCommand("gh", uploadArgs, `Upload assets to existing GitHub release ${tag}`)
		return
	}

	await runCommand(
		"gh",
		[
			"release",
			"create",
			tag,
			...assets,
			"--repo",
			GITHUB_REPOSITORY,
			"--target",
			expectedCommit,
			"--title",
			releaseTitle(definition),
			"--notes",
			releaseNotes(definition, expectedCommit),
		],
		`Create GitHub release ${tag}`,
	)
}

const resolveCoreDefinition = (versionOverride) => ({
	...packageDefinitions.core,
	version: versionOverride || packageDefinitions.core.version,
})

const runCoreRelease = async (options) => {
	const definition = resolveCoreDefinition(options.version)
	const tag = releaseTag(definition)

	console.log(`[release] Core release: ${tag}`)
	await assertGitRoot()
	await assertPackageScripts(definition)

	if (options.dryRun) {
		console.log("[release] Dry run: no upload will be executed.")
		console.log("[release] Release publishing never builds artifacts; run npm run build:release first.")
		console.log(`[release] Would validate and upload assets: ${releaseAssetNames(definition).join(", ")}`)
		return
	}

	await assertCleanWorkingTree()
	await assertMainBranch()
	await assertOriginRepository()
	await assertGhAvailable()
	await fetchReleaseRefs()
	const head = await assertHeadMatchesOriginMain()
	await assertTagState(definition, head)
	await assertReleaseArtifacts(definition, head)
	await uploadRelease(definition, { clobber: options.clobber, expectedCommit: head })

	console.log("")
	console.log(`[release] Core release published: ${tag}`)
}

const runUnsupportedPackageRelease = (packageType) => {
	throw new Error(
		`${packageType} releases are not implemented yet. Add package definitions, build artifacts, sanity checks, and upload rules before enabling this command.`,
	)
}

const detectAutoReleasePlan = async (definition) => {
	await assertGitRoot()
	await assertCleanWorkingTree()
	await assertMainBranch()
	await assertOriginRepository()
	await assertGhAvailable()
	await fetchReleaseRefs()
	const head = await assertHeadMatchesOriginMain()
	const tag = releaseTag(definition)
	const tagCommit = await resolveGitRef(`refs/tags/${tag}`)
	if (tagCommit.length === 0) {
		return { action: "release", reason: `${tag} does not exist yet.` }
	}
	if (tagCommit === head) {
		return { action: "skip", reason: `${tag} already points to HEAD.` }
	}
	return {
		action: "fail",
		reason: `${tag} already exists on a different commit. Bump the Core version before releasing current changes.`,
	}
}

const runAutoRelease = async (options) => {
	const definition = resolveCoreDefinition(options.version)
	const plan = await detectAutoReleasePlan(definition)
	console.log(`[release] Core auto-detection: ${plan.reason}`)
	console.log("[release] Template auto-detection: skipped; template package releases are not implemented yet.")
	console.log("[release] Module auto-detection: skipped; module package releases are not implemented yet.")

	if (plan.action === "fail") {
		throw new Error(plan.reason)
	}
	if (plan.action === "skip") {
		console.log("[release] Nothing to release.")
		return
	}
	await runCoreRelease(options)
}

const main = async () => {
	const options = parseOptions(process.argv.slice(2))
	if (options.mode === "core") {
		await runCoreRelease(options)
		return
	}
	if (options.mode === "template" || options.mode === "modules") {
		runUnsupportedPackageRelease(options.mode)
		return
	}
	await runAutoRelease(options)
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error)
	console.error(`[release] Error: ${message}`)
	process.exitCode = 1
})
