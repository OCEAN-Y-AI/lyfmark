import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
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
const markerPath = join(markerDirectory, ".lyfmark-vscode-installed")
const extensionId = `${extensionPackage.publisher}.${extensionPackage.name}`
const extensionVersion = extensionPackage.version
const extensionRef = `${extensionId}@${extensionVersion}`

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

const findUsableCodeBinary = () => {
	const candidates = [
		process.env.LYFMARK_VSCODE_CODE_PATH ?? "",
		...(process.platform === "win32" ? getWindowsCodeExecutableCandidates() : []),
		"code",
		"code-insiders",
	].filter((candidate) => candidate.trim().length > 0)
	for (const candidate of candidates) {
		const probe = spawnSync(resolveExecutable(candidate), ["--version"], { encoding: "utf8" })
		if (probe.status === 0) {
			return resolveExecutable(candidate)
		}
	}
	return null
}

const getWindowsCodeExecutableCandidates = () => {
	const candidates = []
	if (process.env.LOCALAPPDATA) {
		candidates.push(join(process.env.LOCALAPPDATA, "Programs", "Microsoft VS Code", "Code.exe"))
	}
	if (process.env.ProgramFiles) {
		candidates.push(join(process.env.ProgramFiles, "Microsoft VS Code", "Code.exe"))
	}
	if (process.env["ProgramFiles(x86)"]) {
		candidates.push(join(process.env["ProgramFiles(x86)"], "Microsoft VS Code", "Code.exe"))
	}
	return candidates
}

const getExtensionInstallState = (codeBinary) => {
	const listResult = listInstalledExtensions(codeBinary)
	if (listResult.status !== 0) {
		return "unknown"
	}
	const installedExtensions = listResult.stdout
		.split(/\r?\n/u)
		.map((line) => line.trim().toLowerCase())
		.filter((line) => line.length > 0)
	return installedExtensions.includes(extensionRef.toLowerCase()) ? "installed" : "not-installed"
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
	spawnSync(codeBinary, buildCodeArguments(["--list-extensions", "--show-versions"]), { encoding: "utf8" })

const installVsix = (codeBinary, forceInstall) => {
	const installArguments = buildCodeArguments(["--install-extension", extensionVsixPath])
	if (forceInstall) {
		installArguments.push("--force")
	}
	return spawnSync(codeBinary, installArguments, { encoding: "utf8" })
}

const didInstallCommandFail = (installResult) => {
	const combinedOutput = `${installResult.stdout ?? ""}\n${installResult.stderr ?? ""}`.toLowerCase()
	return (
		combinedOutput.includes("failed installing extensions") ||
		combinedOutput.includes("unable to write file") ||
		combinedOutput.includes(" eacces") ||
		combinedOutput.includes(" erofs")
	)
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

if (!existsSync(extensionVsixPath)) {
	fail(`VSIX not found: ${extensionVsixPath}`)
}

const currentVsixHash = readVsixHash()
if (!currentVsixHash) {
	fail(`VSIX could not be verified: ${extensionVsixPath}`)
}

const codeBinary = findUsableCodeBinary()
if (!codeBinary) {
	fail(`VS Code was not found. Install the VSIX manually after opening VS Code: ${extensionVsixPath}`)
}

console.log(`[LyfMark VS Code] Using VS Code executable: ${codeBinary}`)

const marker = readMarker()
const markerIsCurrent = markerMatchesCurrentVsix(marker, currentVsixHash)
const extensionInstallState = getExtensionInstallState(codeBinary)

if (markerIsCurrent && extensionInstallState === "installed") {
	writeMarker(currentVsixHash)
	console.log(`[LyfMark VS Code] Already installed (${extensionRef}).`)
	process.exit(0)
}

if (markerIsCurrent && extensionInstallState === "unknown") {
	console.log(`[LyfMark VS Code] Installed extension list could not be read. Reinstalling ${extensionRef}.`)
}

const shouldForceInstall = extensionInstallState === "installed" || !markerIsCurrent
const installResult = installVsix(codeBinary, shouldForceInstall)
const installStateAfter = getExtensionInstallState(codeBinary)
const installReportedSuccess = `${installResult.stdout ?? ""}\n${installResult.stderr ?? ""}`
	.toLowerCase()
	.includes("successfully installed")

if (
	installResult.status !== 0 ||
	didInstallCommandFail(installResult) ||
	(installStateAfter !== "installed" && !installReportedSuccess)
) {
	fail(`Automatic installation failed. Install manually: ${extensionVsixPath}`, `${installResult.stdout ?? ""}\n${installResult.stderr ?? ""}`)
}

writeMarker(currentVsixHash)
console.log(`[LyfMark VS Code] Installation successful (${extensionRef}).`)
