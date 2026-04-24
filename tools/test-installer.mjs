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

const BASE_NON_INTERACTIVE_ARGS = ["--yes", "--skip-git-identity", "--skip-ssh", "--skip-dependencies"]

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
	assert.match(source, /\$RepositoryUrl = "https:\/\/github\.com\/OCEAN-Y-AI\/lyfmark\.git"/u)
	assert.match(source, /\[string\]\$ProjectName = ""/u)
	assert.match(source, /Project \/ website name \(used as folder name\)/u)
	assert.match(source, /Import-InstallInfo/u)
	assert.match(source, /Invoke-ElevatedToolInstallIfNeeded/u)
	assert.match(source, /\[switch\]\$AdminToolInstallOnly/u)
	assert.match(source, /Install-WingetPackage "Git\.Git" "Git" "git"/u)
	assert.match(source, /Install-WingetPackage "OpenJS\.NodeJS\.LTS" "Node\.js LTS" "node"/u)
	assert.match(source, /Install-WingetPackage "Microsoft\.VisualStudioCode" "Visual Studio Code" "code"/u)
	assert.match(source, /"--disable-interactivity"/u)
	assert.doesNotMatch(source, /"--allow-reboot"/u)
	assert.match(source, /git".*@\("clone", "--depth", "1", \$RepositoryUrl, \$projectDirectory\)/su)
	assert.match(source, /git".*@\("-C", \$projectDirectory, "pull", "--ff-only"\)/su)
	assert.match(source, /& \$Command @Arguments 2>&1 \| ForEach-Object \{ Write-Host \$_ \}/u)
	assert.match(source, /\$projectDirectoryOutput = @\(Install-ProjectSources\)/u)
	assert.match(source, /project source setup returned unexpected output/u)
	assert.match(source, /function Install-LyfMarkVsCodeExtension[\s\S]*if \(\$SkipVSCode\)/u)
	assert.match(source, /function New-DesktopWorkspaceShortcut[\s\S]*if \(\$SkipVSCode\)/u)
	assert.match(source, /function Open-CustomerWorkspace[\s\S]*if \(\$SkipVSCode -or \$SkipOpenWorkspace\)/u)
	assert.match(source, /Install-LyfMarkVsCodeExtension \$projectDirectory/u)
	assert.match(source, /New-DesktopWorkspaceShortcut \$projectDirectory/u)
	assert.match(source, /node".*\$wizardArguments.*"Run LyfMark installer"/su)
})

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
			...process.env,
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
		resolveCommandInvocation("npm", ["install"], {
			platform: "win32",
			env,
			execPath: nodePath,
			fileExists,
		}),
		{
			executable: nodePath,
			args: [npmCliPath, "install"],
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
	assert.doesNotMatch(source, /args: \["\/d", "\/s", "\/c", `\$\{command\}\.cmd`, \.\.\.args\]/u)
	assert.match(e2eSource, /command: WINDOWS_WRAPPER_PATH/u)
	assert.match(e2eSource, /buildArgs: \(wrapperArgs\) => wrapperArgs/u)
	assert.match(e2eSource, /shell: true/u)
	assert.doesNotMatch(e2eSource, /cmd\.exe[\s\S]*WINDOWS_WRAPPER_PATH[\s\S]*wrapperArgs\.join/u)
})

test("VS Code workspace does not auto-run extension installer on folder open", async () => {
	const source = await readFile(VSCODE_TASKS_PATH, "utf8")
	const tasks = JSON.parse(source)

	assert.deepEqual(tasks.tasks, [])
	assert.doesNotMatch(source, /runOn/u)
	assert.doesNotMatch(source, /install-local-extension/u)
})

test("installer wizard non-interactive flow runs through repair", { timeout: 180000 }, async () => {
	const result = await runProcess(process.execPath, [WIZARD_PATH, ...BASE_NON_INTERACTIVE_ARGS], {
		env: {
			...process.env,
			LYFMARK_INSTALLER_NO_PAUSE: "1",
		},
	})

	assert.equal(result.code, 0, outputOf(result))
	assert.match(result.stdout, /\[repair\] Health summary:/u)
	assert.match(result.stdout, /\[installer\] Installation finished\./u)
})

test("platform wrapper runs non-interactive installer flow", { timeout: 180000 }, async () => {
	const env = {
		...process.env,
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
