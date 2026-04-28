import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import {
	collectWindowsPathSegments,
	createSpawnEnv,
	resolveCommandInvocation,
} from "./installer/command-resolution.mjs"

const PROJECT_ROOT = process.cwd()
const WIZARD_PATH = path.join(PROJECT_ROOT, "tools", "installer", "wizard.mjs")
const INSTALLER_E2E_TEST_PATH = path.join(PROJECT_ROOT, "tools", "test-installer-e2e.mjs")
const LINUX_WRAPPER_PATH = path.join(PROJECT_ROOT, "installer", "linux", "install.sh")
const MACOS_WRAPPER_PATH = path.join(PROJECT_ROOT, "installer", "macos", "install.command")
const WINDOWS_WRAPPER_PATH = path.join(PROJECT_ROOT, "installer", "windows", "install.cmd")
const WINDOWS_INSTALL_SCRIPT_PATH = path.join(PROJECT_ROOT, "installer", "windows", "install.ps1")
const VSCODE_TASKS_PATH = path.join(PROJECT_ROOT, ".vscode", "tasks.json")
const VSCODE_EXTENSION_INSTALLER_PATH = path.join(PROJECT_ROOT, "tools", "lyfmark-vscode", "install-local-extension.mjs")
const REPAIR_PATH = path.join(PROJECT_ROOT, "tools", "repair.mjs")
const PACKAGE_CORE_PATH = path.join(PROJECT_ROOT, "tools", "package-core.mjs")
const BUILD_RELEASE_PATH = path.join(PROJECT_ROOT, "tools", "build-release.mjs")
const RELEASE_PATH = path.join(PROJECT_ROOT, "tools", "release.mjs")
const HMR_LINK_TEST_PATH = path.join(PROJECT_ROOT, "tools", "test-hmr-links.mjs")

const BASE_NON_INTERACTIVE_ARGS = ["--yes", "--skip-git-identity", "--skip-ssh", "--skip-dependencies"]
const BASE_TEST_ENV = {
	...process.env,
	LYFMARK_REPAIR_SKIP_VSCODE_EXTENSIONS: "1",
}

const runProcess = async (command, args, options = {}) =>
	await new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: options.cwd ?? PROJECT_ROOT,
			env: options.env ?? process.env,
			shell: options.shell ?? false,
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
			resolve({
				code: code ?? 1,
				stdout,
				stderr,
			})
		})
	})

const outputOf = (result) => `${result.stdout}\n${result.stderr}`

test("installer wizard fails fast for unknown option", async () => {
	const result = await runProcess(process.execPath, [WIZARD_PATH, "--unknown-option"])
	assert.notEqual(result.code, 0)
	assert.match(outputOf(result), /Unknown installer option/u)
})

test("installer wizard fails outside project root", async () => {
	const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "lyfmark-installer-test-"))
	const result = await runProcess(process.execPath, [WIZARD_PATH, "--yes", "--skip-git-identity", "--skip-ssh"], {
		cwd: temporaryDirectory,
	})
	assert.notEqual(result.code, 0)
	assert.match(outputOf(result), /Installer must run in the project root/u)
})

test("windows install script exposes remote bootstrap contract", async () => {
	const source = await readFile(WINDOWS_INSTALL_SCRIPT_PATH, "utf8")

	assert.match(source, /\[string\]\$InstallInfoPath = ""/u)
	assert.match(source, /\[string\]\$CoreVersion = "1\.0"/u)
	assert.match(source, /\[string\]\$CorePackageUrl = ""/u)
	assert.match(source, /\[string\]\$GithubRepositoryUrl = ""/u)
	assert.match(source, /\[string\]\$ProjectName = ""/u)
	assert.match(source, /\[switch\]\$SkipSsh/u)
	assert.match(source, /Project \/ website name \(used as folder name\)/u)
	assert.match(source, /Import-InstallInfo/u)
	assert.match(source, /Invoke-ElevatedToolInstallIfNeeded/u)
	assert.match(source, /\[switch\]\$AdminToolInstallOnly/u)
	assert.match(source, /Install-WingetPackage "Git\.Git" "Git" "git"/u)
	assert.match(source, /Install-WingetPackage "OpenJS\.NodeJS\.LTS" "Node\.js LTS" "node"/u)
	assert.match(source, /Install-WingetPackage "Microsoft\.VisualStudioCode" "Visual Studio Code" "code"/u)
	assert.match(source, /"--disable-interactivity"/u)
	assert.doesNotMatch(source, /"--allow-reboot"/u)
	assert.match(source, /function Get-ReentryScriptPath/u)
	assert.match(source, /TemporaryBootstrapScriptPath/u)
	assert.match(source, /install-"\s*\+\s*\[guid\]::NewGuid\(\)\.ToString\("N"\)\s*\+\s*"\.ps1"/u)
	assert.match(source, /"-File", "`"\$\(Get-ReentryScriptPath\)`""/u)
	assert.match(source, /function Get-CorePackageUrl/u)
	assert.match(source, /releases\/download\/core-v\$CoreVersion\/lyfmark-core-\$CoreVersion\.zip/u)
	assert.match(source, /function Copy-CorePackage/u)
	assert.match(source, /Invoke-WebRequest -Uri \$ResolvedPackageUrl -OutFile \$TargetPackagePath/u)
	assert.match(source, /function Expand-CorePackage/u)
	assert.match(source, /Expand-Archive -LiteralPath \$PackagePath -DestinationPath \$ProjectDirectory -Force/u)
	assert.match(source, /function Initialize-CustomerGitRepository/u)
	assert.match(source, /git".*@\("-C", \$ProjectDirectory, "init"\)/su)
	assert.match(source, /git".*@\("config", "--global", "--add", "safe\.directory", \$ProjectDirectory\)/su)
	assert.match(source, /git".*@\("-C", \$ProjectDirectory, "branch", "-M", "main"\)/su)
	assert.match(source, /function Publish-CustomerRepository/u)
	assert.match(source, /git".*@\("-C", \$ProjectDirectory, "commit", "-m", "Initial LyfMark website"\)/su)
	assert.match(source, /git".*@\("-C", \$ProjectDirectory, "push", "-u", "origin", "main"\)/su)
	assert.doesNotMatch(source, /git".*@\("clone"/su)
	assert.doesNotMatch(source, /pull", "--ff-only"/u)
	assert.doesNotMatch(source, /-RepositoryUrl/u)
	assert.match(source, /function ConvertTo-NativeArgument/u)
	assert.match(source, /System\.Diagnostics\.ProcessStartInfo/u)
	assert.match(source, /RedirectStandardOutput = \$false/u)
	assert.match(source, /RedirectStandardError = \$false/u)
	assert.match(source, /RedirectStandardInput = \$false/u)
	assert.match(source, /while \(-not \$process\.WaitForExit\(250\)\)/u)
	assert.doesNotMatch(source, /ReadToEndAsync/u)
	assert.doesNotMatch(source, /Write-NativeOutput/u)
	assert.doesNotMatch(source, /DataReceivedEventHandler/u)
	assert.doesNotMatch(source, /2>&1 \| ForEach-Object/u)
	assert.match(source, /\$projectDirectoryOutput = @\(Install-ProjectSources\)/u)
	assert.match(source, /project source setup returned unexpected output/u)
	assert.match(source, /function Install-LyfMarkVsCodeExtension[\s\S]*if \(\$SkipVSCode\)/u)
	assert.match(source, /LYFMARK_VSCODE_CLI_PATH/u)
	assert.match(source, /function New-DesktopWorkspaceShortcut[\s\S]*if \(\$SkipVSCode\)/u)
	assert.match(source, /function Open-CustomerWorkspace[\s\S]*if \(\$SkipVSCode -or \$SkipOpenWorkspace\)/u)
	assert.match(source, /Install-LyfMarkVsCodeExtension \$projectDirectory/u)
	assert.match(source, /New-DesktopWorkspaceShortcut \$projectDirectory/u)
	assert.match(source, /node".*\$wizardArguments.*"Run LyfMark installer"/su)
	assert.match(source, /Publish-CustomerRepository \$projectDirectory/u)
	assert.match(source, /LYFMARK_INSTALLER_BOOTSTRAP_FINALIZES/u)
	assert.match(source, /Set-SwitchParameterFromInstallInfo \$installInfo "SkipSsh" @\("skipSsh"\)/u)
})

test(
	"windows install script native runner keeps native stderr non-terminating",
	{ skip: process.platform !== "win32" ? "Windows PowerShell bootstrap behavior only runs on Windows." : false },
	async () => {
		const source = await readFile(WINDOWS_INSTALL_SCRIPT_PATH, "utf8")
		const functionStart = source.indexOf("function New-BackslashString")
		const functionEnd = source.indexOf("\nfunction Get-InstallInfoValue")
		assert.notEqual(functionStart, -1)
		assert.notEqual(functionEnd, -1)

		const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "lyfmark-powershell-runner-"))
		const probePath = path.join(temporaryDirectory, "native-runner-probe.ps1")
		await writeFile(
			probePath,
			`${source.slice(functionStart, functionEnd)}

$ErrorActionPreference = "Stop"
$runnerOutput = @(Invoke-NativeCommand "cmd.exe" @("/d", "/s", "/c", "echo stdout probe & echo stderr probe 1>&2 & exit /b 0") "Run native stderr probe")
if ($runnerOutput.Count -ne 0) {
	throw "Invoke-NativeCommand leaked native output into the PowerShell pipeline."
}
`,
			"utf8",
		)

		const result = await runProcess("powershell.exe", [
			"-NoProfile",
			"-ExecutionPolicy",
			"Bypass",
			"-File",
			probePath,
		])
		assert.equal(result.code, 0, outputOf(result))
		assert.match(result.stdout, /stdout probe/u)
		assert.match(result.stdout, /stderr probe/u)
	},
)

test(
	"windows install script materializes remote scriptblock source for elevated re-entry",
	{ skip: process.platform !== "win32" ? "Windows PowerShell bootstrap behavior only runs on Windows." : false },
	async () => {
		const source = await readFile(WINDOWS_INSTALL_SCRIPT_PATH, "utf8")
		const functionStart = source.indexOf("function Get-ReentryScriptPath")
		const functionEnd = source.indexOf("\n# Runs native commands")
		assert.notEqual(functionStart, -1)
		assert.notEqual(functionEnd, -1)

		const probeSource = `$ErrorActionPreference = "Stop"
$script:BootstrapSource = "Write-Host remote-probe"
$script:TemporaryBootstrapScriptPath = ""
${source.slice(functionStart, functionEnd)}

$path = Get-ReentryScriptPath
if (-not (Test-Path -LiteralPath $path)) {
	throw "Re-entry script was not created."
}
$content = Get-Content -LiteralPath $path -Raw
if ($content -notmatch "remote-probe") {
	throw "Re-entry script does not contain the remote source."
}
$samePath = Get-ReentryScriptPath
if ($samePath -ne $path) {
	throw "Re-entry script path was not reused."
}
Remove-TemporaryBootstrapScript
if (Test-Path -LiteralPath $path) {
	throw "Temporary re-entry script was not removed."
}
`

		const result = await runProcess("powershell.exe", [
			"-NoProfile",
			"-ExecutionPolicy",
			"Bypass",
			"-Command",
			probeSource,
		])
		assert.equal(result.code, 0, outputOf(result))
	},
)

test("installer wizard accepts install info file for wrapper-provided data", async () => {
	const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "lyfmark-install-info-test-"))
	const installInfoPath = path.join(temporaryDirectory, "install-info.json")
	await writeFile(
		installInfoPath,
		JSON.stringify(
			{
				yes: true,
				skipGitIdentity: true,
				skipSsh: true,
				skipDependencies: true,
				skipRepair: true,
				gitName: "Install Info User",
				gitEmail: "install-info@example.com",
				sshComment: "install-info@example.com",
			},
			null,
			2,
		),
		"utf8",
	)

	const result = await runProcess(process.execPath, [WIZARD_PATH, `--install-info=${installInfoPath}`], {
		env: {
			...BASE_TEST_ENV,
			LYFMARK_INSTALLER_NO_PAUSE: "1",
		},
	})

	assert.equal(result.code, 0, outputOf(result))
	assert.match(result.stdout, /\[installer\] Git identity skipped/u)
	assert.match(result.stdout, /\[installer\] SSH setup skipped/u)
	assert.match(result.stdout, /\[installer\] Dependencies skipped/u)
	assert.match(result.stdout, /\[installer\] Repair skipped/u)
})

test("installer command resolution handles Windows PATH variants and npm reliably", () => {
	const env = {
		PATH: "C:\\stale-bin;C:\\shared-bin",
		Path: "C:\\Program Files\\nodejs;C:\\shared-bin",
	}
	const nodePath = "C:\\Program Files\\nodejs\\node.exe"
	const npmCliPath = "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js"
	const fileExists = (candidate) => candidate === npmCliPath

	assert.deepEqual(collectWindowsPathSegments(env), [
		"C:\\Program Files\\nodejs",
		"C:\\shared-bin",
		"C:\\stale-bin",
	])

	assert.deepEqual(createSpawnEnv({ platform: "win32", env }), {
		PATH: "C:\\Program Files\\nodejs;C:\\shared-bin;C:\\stale-bin",
	})

	assert.deepEqual(
		resolveCommandInvocation("npm", ["ci"], {
			platform: "win32",
			env,
			execPath: nodePath,
			fileExists,
		}),
		{
			executable: nodePath,
			args: [npmCliPath, "ci"],
		},
	)
})

test("installer command resolution falls back to absolute npm.cmd when npm CLI is unavailable", () => {
	const env = {
		Path: "C:\\Program Files\\nodejs",
	}
	const nodePath = "C:\\Program Files\\nodejs\\node.exe"
	const npmCmdPath = "C:\\Program Files\\nodejs\\npm.cmd"
	const fileExists = (candidate) => candidate === npmCmdPath

	assert.deepEqual(
		resolveCommandInvocation("npm", ["run", "repair"], {
			platform: "win32",
			env,
			execPath: nodePath,
			fileExists,
		}),
		{
			executable: "cmd.exe",
			args: ["/d", "/c", `"${npmCmdPath}" run repair`],
		},
	)
})

test("installer wizard uses robust child-process handling", async () => {
	const source = await readFile(WIZARD_PATH, "utf8")
	const e2eSource = await readFile(INSTALLER_E2E_TEST_PATH, "utf8")

	assert.doesNotMatch(source, /stdio:\s*"inherit"/u)
	assert.match(source, /stdio: \["ignore", "pipe", "pipe"\]/u)
	assert.match(source, /formatCommandFailure/u)
	assert.match(source, /createSpawnEnv/u)
	assert.match(source, /resolveCommandInvocation/u)
	assert.match(source, /npm --version/u)
	assert.match(source, /\["ci", "--no-audit", "--no-fund"\]/u)
	assert.doesNotMatch(source, /No input is required/u)
	assert.match(source, /npm ci is still running\. Please wait\./u)
	assert.match(source, /LYFMARK_INSTALLER_BOOTSTRAP_FINALIZES/u)
	assert.match(source, /LyfMark will now finish the setup and open Visual Studio Code\./u)
	assert.doesNotMatch(source, /args: \["\/d", "\/s", "\/c", `\$\{command\}\.cmd`, \.\.\.args\]/u)
	assert.match(e2eSource, /command: WINDOWS_WRAPPER_PATH/u)
	assert.match(e2eSource, /buildArgs: \(wrapperArgs\) => wrapperArgs/u)
	assert.match(e2eSource, /shell: true/u)
	assert.doesNotMatch(e2eSource, /cmd\.exe[\s\S]*WINDOWS_WRAPPER_PATH[\s\S]*wrapperArgs\.join/u)
})

test("VS Code extension installer uses bundled VSIX and CLI wrapper fallback", async () => {
	const source = await readFile(VSCODE_EXTENSION_INSTALLER_PATH, "utf8")

	assert.match(source, /LYFMARK_VSCODE_CLI_PATH/u)
	assert.match(source, /getWindowsCodeCliCandidates/u)
	assert.match(source, /Microsoft VS Code", "bin", "code\.cmd"/u)
	assert.match(source, /runCodeCli/u)
	assert.match(source, /shell: true/u)
	assert.match(source, /windowsHide: true/u)
	assert.match(source, /cwd: scriptDirectory/u)
	assert.match(source, /basename\(extensionVsixPath\)/u)
	assert.match(source, /vsixExists/u)
	assert.match(source, /Using VS Code CLI/u)
	assert.match(source, /Installing recommended extension/u)
	assert.match(source, /Using bundled VSIX/u)
	assert.match(source, /restoreBundledVsixFromGitIfMissing/u)
	assert.match(source, /Available VSIX files/u)
	assert.match(source, /listExtensionDirectoryFiles/u)
	assert.match(source, /git", \["restore", "--worktree", "--source", "HEAD"/u)
	assert.match(source, /VS Code accepted the install command/u)
	assert.match(source, /formatSpawnResult/u)
	assert.match(source, /process\.exit\(1\)/u)
	assert.doesNotMatch(source, /didInstallCommandFail/u)
	assert.doesNotMatch(source, /@vscode\/vsce/u)
	assert.doesNotMatch(source, /isVsixStale/u)
	assert.doesNotMatch(source, /buildVsix/u)
	assert.doesNotMatch(source, /Code\.exe/u)
})

test("VS Code workspace does not auto-run extension installer on folder open", async () => {
	const source = await readFile(VSCODE_TASKS_PATH, "utf8")
	const tasks = JSON.parse(source)

	assert.deepEqual(tasks.tasks, [])
	assert.doesNotMatch(source, /runOn/u)
	assert.doesNotMatch(source, /install-local-extension/u)
})

test("repair command installs VS Code extensions without folder-open tasks", async () => {
	const source = await readFile(REPAIR_PATH, "utf8")

	assert.match(source, /runVsCodeExtensionInstaller/u)
	assert.match(source, /LYFMARK_REPAIR_SKIP_VSCODE_EXTENSIONS/u)
	assert.match(source, /install-local-extension\.mjs/u)
	assert.match(source, /VS Code extensions: ready/u)
})

test("HMR link test repairs mirrors and starts dev server with safe npm resolution", async () => {
	const source = await readFile(HMR_LINK_TEST_PATH, "utf8")

	assert.match(source, /runRepair/u)
	assert.match(source, /tools\/repair\.mjs/u)
	assert.match(source, /LYFMARK_REPAIR_SKIP_VSCODE_EXTENSIONS/u)
	assert.match(source, /resolveCommandInvocation\("npm"/u)
	assert.match(source, /createSpawnEnv/u)
	assert.doesNotMatch(source, /spawn\("npm"/u)
})

test("core release package builder creates explicit package artifact and manifest", async () => {
	const source = await readFile(PACKAGE_CORE_PATH, "utf8")

	assert.match(source, /DEFAULT_PACKAGE_NAME = "lyfmark-core"/u)
	assert.match(source, /Core package version must use major\.minor format/u)
	assert.match(source, /runGit\(\["archive", "--format=zip"/u)
	assert.match(source, /sha256File/u)
	assert.match(source, /manifest\.json/u)
	assert.match(source, /signatureStatus: "unsigned-pragmatic-1\.0"/u)
	assert.match(source, /Working tree is not clean/u)
})

test("release build orchestrator runs gates, package build, signing placeholder, and artifact checks", async () => {
	const source = await readFile(BUILD_RELEASE_PATH, "utf8")
	const packageSource = await readFile(path.join(PROJECT_ROOT, "package.json"), "utf8")

	assert.match(packageSource, /"build:release": "node tools\/build-release\.mjs"/u)
	assert.match(packageSource, /"package:core": "node tools\/package-core\.mjs --version 1\.0"/u)
	assert.match(packageSource, /"release:core": "node tools\/release\.mjs core"/u)
	assert.match(packageSource, /"release:template": "node tools\/release\.mjs template"/u)
	assert.match(packageSource, /"release:modules": "node tools\/release\.mjs modules"/u)
	assert.match(packageSource, /"release": "node tools\/release\.mjs auto"/u)
	assert.match(source, /DEFAULT_CORE_VERSION = "1\.0"/u)
	assert.match(source, /REQUIRED_RELEASE_FILES/u)
	assert.match(source, /tools\/release\.mjs/u)
	assert.match(source, /runReleaseSanityCheck/u)
	assert.match(source, /Check releasable repository state/u)
	assert.match(source, /assertGitRoot/u)
	assert.match(source, /\["ci"\]/u)
	assert.match(source, /\["run", "typecheck"\]/u)
	assert.match(source, /\["run", "test:lyfmark-prettier"\]/u)
	assert.match(source, /\["run", "test:installer"\]/u)
	assert.match(source, /\["run", "test:installer:e2e:auto"\]/u)
	assert.match(source, /\["run", "build"\]/u)
	assert.match(source, /tools\/package-core\.mjs/u)
	assert.match(source, /runSigningPlaceholder/u)
	assert.match(source, /Signing is not implemented yet/u)
	assert.match(source, /assertCleanWorkingTree/u)
	assert.match(source, /before release gates/u)
	assert.match(source, /after release gates/u)
	assert.match(source, /assertReleaseVersionConsistency/u)
	assert.match(source, /assertBundledVsixExists/u)
	assert.match(source, /assertSigningStateIsExplicit/u)
	assert.match(source, /verifyReleaseArtifacts/u)
	assert.match(source, /testExtractedReleaseArtifact/u)
	assert.match(source, /LYFMARK_REPAIR_SKIP_VSCODE_EXTENSIONS/u)
	assert.match(source, /Release archive must not contain \.git data/u)
	assert.match(source, /--allow-dirty is for local release-flow testing only/u)
})

test("release publisher uploads existing artifacts without building", async () => {
	const source = await readFile(RELEASE_PATH, "utf8")
	const packageJson = JSON.parse(await readFile(path.join(PROJECT_ROOT, "package.json"), "utf8"))

	assert.equal(packageJson.scripts["package:core"], "node tools/package-core.mjs --version 1.0")
	assert.equal(packageJson.scripts["release:core"], "node tools/release.mjs core")
	assert.equal(packageJson.scripts["release:template"], "node tools/release.mjs template")
	assert.equal(packageJson.scripts["release:modules"], "node tools/release.mjs modules")
	assert.equal(packageJson.scripts.release, "node tools/release.mjs auto")
	assert.match(source, /This script must never build release artifacts/u)
	assert.match(source, /Release publishing never builds artifacts; run npm run build:release first/u)
	assert.match(source, /Run npm run build:release before publishing/u)
	assert.match(source, /assertReleaseArtifacts/u)
	assert.match(source, /assertHeadMatchesOriginMain/u)
	assert.match(source, /assertTagState/u)
	assert.match(source, /assertNoAssetCollision/u)
	assert.match(source, /\["release", "upload"/u)
	assert.match(source, /"release",\s+"create"/u)
	assert.match(source, /runCoreRelease/u)
	assert.match(source, /runAutoRelease/u)
	assert.match(source, /runUnsupportedPackageRelease/u)
	assert.match(source, /Template auto-detection: skipped/u)
	assert.doesNotMatch(source, /buildCoreRelease/u)
	assert.doesNotMatch(source, /npmCommand/u)
	assert.doesNotMatch(source, /runCommand\(npm/u)
})

test("installer wizard non-interactive flow runs through repair", { timeout: 180000 }, async () => {
	const result = await runProcess(process.execPath, [WIZARD_PATH, ...BASE_NON_INTERACTIVE_ARGS], {
		env: {
			...BASE_TEST_ENV,
			LYFMARK_INSTALLER_NO_PAUSE: "1",
		},
	})

	assert.equal(result.code, 0, outputOf(result))
	assert.match(result.stdout, /\[repair\] Health summary:/u)
	assert.match(result.stdout, /\[installer\] Installation finished\./u)
})

test("platform wrapper runs non-interactive installer flow", { timeout: 180000 }, async () => {
	const env = {
		...BASE_TEST_ENV,
		LYFMARK_INSTALLER_NO_PAUSE: "1",
	}

	if (process.platform === "win32") {
		const result = await runProcess(WINDOWS_WRAPPER_PATH, BASE_NON_INTERACTIVE_ARGS, { env, shell: true })
		assert.equal(result.code, 0, outputOf(result))
		assert.match(result.stdout, /\[installer\] Installation finished\./u)
		return
	}

	if (process.platform === "darwin") {
		const result = await runProcess("bash", [MACOS_WRAPPER_PATH, ...BASE_NON_INTERACTIVE_ARGS], { env })
		assert.equal(result.code, 0, outputOf(result))
		assert.match(result.stdout, /\[installer\] Installation finished\./u)
		return
	}

	const result = await runProcess("bash", [LINUX_WRAPPER_PATH, ...BASE_NON_INTERACTIVE_ARGS], { env })
	assert.equal(result.code, 0, outputOf(result))
	assert.match(result.stdout, /\[installer\] Installation finished\./u)
})
