import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDirectory, "../..")
const extensionPackagePath = join(scriptDirectory, "package.json")
const extensionPackage = JSON.parse(readFileSync(extensionPackagePath, "utf8"))
const extensionVsixPath = join(
	scriptDirectory,
	`${extensionPackage.name}-${extensionPackage.version}.vsix`,
)
const markerDirectory = join(repositoryRoot, ".vscode")
const extensionRecommendationsPath = join(markerDirectory, "extensions.json")
const markerPath = join(markerDirectory, ".lyfmark-vscode-installed")
const extensionId = `${extensionPackage.publisher}.${extensionPackage.name}`
const extensionVersion = extensionPackage.version
const extensionRef = `${extensionId}@${extensionVersion}`
const codeProbeFailures = []

const fail = (message, detail = "") => {
	console.error(`[LyfMark VS Code] ${message}`)
	if (detail.trim().length > 0) {
		console.error(detail.trim())
	}
	process.exit(1)
}

const resolveExecutable = (command) => {
	if (process.platform === "win32" && (command === "npx" || command === "code" || command === "code-insiders")) {
		return `${command}.cmd`
	}
	return command
}

const isWindowsCommandScript = (command) =>
	process.platform === "win32" && command.trim().toLowerCase().endsWith(".cmd")

const quoteWindowsCmdArgument = (value) => {
	const text = String(value)
	if (/^[A-Za-z0-9_./:=+\-]+$/u.test(text)) {
		return text
	}
	return `"${text.replace(/"/gu, '""')}"`
}

const runCodeCli = (codeCli, args) => {
	if (isWindowsCommandScript(codeCli)) {
		const commandLine = [quoteWindowsCmdArgument(codeCli), ...args.map(quoteWindowsCmdArgument)].join(" ")
		return spawnSync("cmd.exe", ["/d", "/s", "/c", commandLine], { encoding: "utf8" })
	}
	return spawnSync(codeCli, args, { encoding: "utf8" })
}

const readMarker = () => {
	if (!existsSync(markerPath)) {
		return {
			ref: null,
			hash: null,
		}
	}
	const lines = readFileSync(markerPath, "utf8")
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
	const ref = lines[1] ?? null
	const hashLine = lines.find((line) => line.startsWith("sha256:")) ?? null
	return {
		ref,
		hash: hashLine ? hashLine.slice("sha256:".length) : null,
	}
}

const computeFileHash = (filePath) =>
	createHash("sha256").update(readFileSync(filePath)).digest("hex")

const readVsixHash = () => {
	if (!existsSync(extensionVsixPath)) {
		return null
	}
	return computeFileHash(extensionVsixPath)
}

const listExtensionDirectoryFiles = () => {
	try {
		return readdirSync(scriptDirectory)
			.sort()
			.join("\n")
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error)
		return `Directory listing failed: ${detail}`
	}
}

const findAvailableVsix = () => {
	try {
		return readdirSync(scriptDirectory)
			.filter((fileName) => fileName.toLowerCase().endsWith(".vsix"))
			.sort()
	} catch {
		return []
	}
}

const restoreBundledVsixFromGitIfMissing = () => {
	if (existsSync(extensionVsixPath)) {
		return
	}
	const relativeVsixPath = `tools/lyfmark-vscode/${extensionPackage.name}-${extensionPackage.version}.vsix`
	const restoreResult = spawnSync("git", ["restore", "--worktree", "--source", "HEAD", "--", relativeVsixPath], {
		cwd: repositoryRoot,
		encoding: "utf8",
	})
	if (restoreResult.status === 0 && existsSync(extensionVsixPath)) {
		console.log(`[LyfMark VS Code] Restored bundled VSIX from Git: ${relativeVsixPath}`)
		return
	}
	fail(
		`VSIX not found: ${extensionVsixPath}`,
		[
			"The LyfMark extension package is missing from this project folder.",
			"If this is an existing test project, delete the project folder and run the installer again, or run: git restore --worktree --source HEAD -- tools/lyfmark-vscode/*.vsix",
			`Extension directory: ${scriptDirectory}`,
			`Available files:\n${listExtensionDirectoryFiles()}`,
			`Available VSIX files:\n${findAvailableVsix().join("\n") || "(none)"}`,
			formatSpawnResult("git", ["restore", "--worktree", "--source", "HEAD", "--", relativeVsixPath], restoreResult),
		].join("\n"),
	)
}

const readRecommendedExtensions = () => {
	if (!existsSync(extensionRecommendationsPath)) {
		return []
	}
	try {
		const parsed = JSON.parse(readFileSync(extensionRecommendationsPath, "utf8"))
		if (!Array.isArray(parsed.recommendations)) {
			return []
		}
		return parsed.recommendations
			.filter((recommendation) => typeof recommendation === "string")
			.map((recommendation) => recommendation.trim())
			.filter((recommendation) => recommendation.length > 0 && recommendation !== extensionId)
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error)
		fail(`VS Code extension recommendations could not be read: ${extensionRecommendationsPath}`, detail)
	}
}

const findUsableCodeCli = () => {
	const candidates = [
		process.env.LYFMARK_VSCODE_CLI_PATH ?? "",
		...(process.platform === "win32" ? getWindowsCodeCliCandidates() : []),
		"code",
		"code-insiders",
	].filter((candidate) => candidate.trim().length > 0)
	for (const candidate of candidates) {
		const resolvedCandidate = resolveExecutable(candidate)
		const probe = runCodeCli(resolvedCandidate, ["--version"])
		if (probe.status === 0) {
			return resolvedCandidate
		}
		codeProbeFailures.push(formatSpawnResult(resolvedCandidate, ["--version"], probe))
	}
	return null
}

const getWindowsCodeCliCandidates = () => {
	const candidates = []
	if (process.env.LOCALAPPDATA) {
		candidates.push(join(process.env.LOCALAPPDATA, "Programs", "Microsoft VS Code", "bin", "code.cmd"))
	}
	if (process.env.ProgramFiles) {
		candidates.push(join(process.env.ProgramFiles, "Microsoft VS Code", "bin", "code.cmd"))
	}
	if (process.env["ProgramFiles(x86)"]) {
		candidates.push(join(process.env["ProgramFiles(x86)"], "Microsoft VS Code", "bin", "code.cmd"))
	}
	return candidates
}

const getExtensionInstallState = (codeBinary) => {
	const installedExtensions = readInstalledExtensions(codeBinary)
	if (!installedExtensions) {
		return "unknown"
	}
	return installedExtensions.includes(extensionRef.toLowerCase()) ? "installed" : "not-installed"
}

const readInstalledExtensions = (codeBinary) => {
	const listResult = listInstalledExtensions(codeBinary)
	if (listResult.status !== 0) {
		return null
	}
	return listResult.stdout
		.split(/\r?\n/u)
		.map((line) => line.trim().toLowerCase())
		.filter((line) => line.length > 0)
}

const isWslContext = () =>
	typeof process.env.WSL_DISTRO_NAME === "string" && process.env.WSL_DISTRO_NAME.trim().length > 0

const getCodeRemoteTarget = () => {
	if (!isWslContext()) {
		return null
	}
	const distroName = process.env.WSL_DISTRO_NAME.trim()
	return distroName.length > 0 ? `wsl+${distroName}` : null
}

const buildCodeArguments = (argumentsWithoutTarget) => {
	const remoteTarget = getCodeRemoteTarget()
	if (!remoteTarget) {
		return argumentsWithoutTarget
	}
	return ["--remote", remoteTarget, ...argumentsWithoutTarget]
}

const markerMatchesCurrentVsix = (marker, currentHash) =>
	marker.ref === extensionRef && marker.hash === currentHash

const listInstalledExtensions = (codeBinary) =>
	runCodeCli(codeBinary, buildCodeArguments(["--list-extensions", "--show-versions"]))

const installVsix = (codeBinary, forceInstall) => {
	const installArguments = buildCodeArguments(["--install-extension", extensionVsixPath])
	if (forceInstall) {
		installArguments.push("--force")
	}
	return runCodeCli(codeBinary, installArguments)
}

const installMarketplaceExtension = (codeBinary, extensionIdentifier) => {
	const installArguments = buildCodeArguments(["--install-extension", extensionIdentifier])
	return runCodeCli(codeBinary, installArguments)
}

const formatSpawnResult = (command, args, result) => {
	const commandLine = [command, ...args].join(" ")
	const status = result.status === null ? "not available" : String(result.status)
	const error = result.error instanceof Error ? `\nerror: ${result.error.message}` : ""
	const stdout = (result.stdout ?? "").trim()
	const stderr = (result.stderr ?? "").trim()
	const output = [
		`command: ${commandLine}`,
		`exitCode: ${status}`,
		error.trim(),
		stdout.length > 0 ? `stdout:\n${stdout}` : "",
		stderr.length > 0 ? `stderr:\n${stderr}` : "",
	]
		.filter((line) => line.length > 0)
		.join("\n")
	return output
}

const writeMarker = (currentHash) => {
	if (!existsSync(markerDirectory)) {
		mkdirSync(markerDirectory, { recursive: true })
	}
	writeFileSync(
		markerPath,
		`${new Date().toISOString()}\n${extensionRef}\nsha256:${currentHash}\n`,
		"utf8",
	)
}

const installRecommendedExtensions = (codeCli) => {
	const recommendations = readRecommendedExtensions()
	const installedExtensions = readInstalledExtensions(codeCli)
	for (const recommendation of recommendations) {
		const normalizedRecommendation = recommendation.toLowerCase()
		const isAlreadyInstalled = installedExtensions?.some(
			(installedExtension) =>
				installedExtension === normalizedRecommendation ||
				installedExtension.startsWith(`${normalizedRecommendation}@`),
		)
		if (isAlreadyInstalled) {
			console.log(`[LyfMark VS Code] Recommended extension already installed: ${recommendation}`)
			continue
		}
		console.log(`[LyfMark VS Code] Installing recommended extension: ${recommendation}`)
		const installResult = installMarketplaceExtension(codeCli, recommendation)
		if (
			installResult.status !== 0 ||
			installResult.error instanceof Error
		) {
			fail(
				`Recommended extension installation failed: ${recommendation}`,
				formatSpawnResult(codeCli, buildCodeArguments(["--install-extension", recommendation]), installResult),
			)
		}
	}
}

restoreBundledVsixFromGitIfMissing()
console.log(`[LyfMark VS Code] Using bundled VSIX: ${extensionVsixPath}`)

const currentVsixHash = readVsixHash()
if (!currentVsixHash) {
	fail(`VSIX could not be verified: ${extensionVsixPath}`)
}

const codeCli = findUsableCodeCli()
if (!codeCli) {
	fail(
		`VS Code CLI was not found. Install the VSIX manually after opening VS Code: ${extensionVsixPath}`,
		codeProbeFailures.join("\n\n"),
	)
}

console.log(`[LyfMark VS Code] Using VS Code CLI: ${codeCli}`)

installRecommendedExtensions(codeCli)

const marker = readMarker()
const markerIsCurrent = markerMatchesCurrentVsix(marker, currentVsixHash)
const extensionInstallState = getExtensionInstallState(codeCli)

if (markerIsCurrent && extensionInstallState === "installed") {
	writeMarker(currentVsixHash)
	console.log(`[LyfMark VS Code] Already installed (${extensionRef}).`)
	process.exit(0)
}

if (markerIsCurrent && extensionInstallState === "unknown") {
	console.log(`[LyfMark VS Code] Installed extension list could not be read. Reinstalling ${extensionRef}.`)
}

const shouldForceInstall = extensionInstallState === "installed" || !markerIsCurrent
const installResult = installVsix(codeCli, shouldForceInstall)
const installStateAfter = getExtensionInstallState(codeCli)
const installCommandFailed =
	installResult.status !== 0 ||
	installResult.error instanceof Error

if (installCommandFailed) {
	fail(
		`Automatic installation failed. Install manually: ${extensionVsixPath}`,
		formatSpawnResult(codeCli, buildCodeArguments(["--install-extension", extensionVsixPath]), installResult),
	)
}

if (installStateAfter !== "installed") {
	console.log("[LyfMark VS Code] VS Code accepted the install command, but the installed extension list could not be verified.")
}

writeMarker(currentVsixHash)
console.log(`[LyfMark VS Code] Installation successful (${extensionRef}).`)
