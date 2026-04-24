import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdtemp, readFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"

const PROJECT_ROOT = process.cwd()
const WIZARD_PATH = path.join(PROJECT_ROOT, "tools", "installer", "wizard.mjs")
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

	assert.match(source, /\$RepositoryUrl = "https:\/\/github\.com\/OCEAN-Y-AI\/lyfmark\.git"/u)
	assert.match(source, /\[string\]\$ProjectName = ""/u)
	assert.match(source, /Project \/ website name \(used as folder name\)/u)
	assert.match(source, /Install-WingetPackage "Git\.Git" "Git" "git"/u)
	assert.match(source, /Install-WingetPackage "OpenJS\.NodeJS\.LTS" "Node\.js LTS" "node"/u)
	assert.match(source, /Install-WingetPackage "Microsoft\.VisualStudioCode" "Visual Studio Code" "code"/u)
	assert.match(source, /git".*@\("clone", "--depth", "1", \$RepositoryUrl, \$projectDirectory\)/us)
	assert.match(source, /git".*@\("-C", \$projectDirectory, "pull", "--ff-only"\)/us)
	assert.match(source, /function Install-LyfMarkVsCodeExtension[\s\S]*if \(\$SkipVSCode\)/u)
	assert.match(source, /function New-DesktopWorkspaceShortcut[\s\S]*if \(\$SkipVSCode\)/u)
	assert.match(source, /function Open-CustomerWorkspace[\s\S]*if \(\$SkipVSCode -or \$SkipOpenWorkspace\)/u)
	assert.match(source, /Install-LyfMarkVsCodeExtension \$projectDirectory/u)
	assert.match(source, /New-DesktopWorkspaceShortcut \$projectDirectory/u)
	assert.match(source, /node".*\$wizardArguments.*"Run LyfMark installer"/us)
})

test("VS Code workspace does not auto-run extension installer on folder open", async () => {
	const source = await readFile(VSCODE_TASKS_PATH, "utf8")
	const tasks = JSON.parse(source)

	assert.deepEqual(tasks.tasks, [])
	assert.doesNotMatch(source, /runOn/u)
	assert.doesNotMatch(source, /install-local-extension/u)
})

test(
	"installer wizard non-interactive flow runs through repair",
	{ timeout: 180000 },
	async () => {
		const result = await runProcess(process.execPath, [WIZARD_PATH, ...BASE_NON_INTERACTIVE_ARGS], {
			env: {
				...process.env,
				LYFMARK_INSTALLER_NO_PAUSE: "1",
			},
		})

		assert.equal(result.code, 0, outputOf(result))
		assert.match(result.stdout, /\[repair\] Health summary:/u)
		assert.match(result.stdout, /\[installer\] Installation finished\./u)
	},
)

test(
	"platform wrapper runs non-interactive installer flow",
	{ timeout: 180000 },
	async () => {
		const env = {
			...process.env,
			LYFMARK_INSTALLER_NO_PAUSE: "1",
		}

		if (process.platform === "win32") {
			const commandLine = `\"${WINDOWS_WRAPPER_PATH}\" ${BASE_NON_INTERACTIVE_ARGS.join(" ")}`
			const result = await runProcess("cmd.exe", ["/d", "/s", "/c", commandLine], { env })
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
	},
)
