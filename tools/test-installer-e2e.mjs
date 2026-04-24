import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { access, constants, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const PROJECT_ROOT = process.cwd()
const GITHUB_SSH_SETTINGS_URL = "https://github.com/settings/keys"
const WINDOWS_WRAPPER_PATH = path.join(PROJECT_ROOT, "installer", "windows", "install.cmd")
const MACOS_WRAPPER_PATH = path.join(PROJECT_ROOT, "installer", "macos", "install.command")
const LINUX_WRAPPER_PATH = path.join(PROJECT_ROOT, "installer", "linux", "install.sh")

const parseMode = (argv) => {
	let mode = "auto"
	let mockGithub = true
	let keepHome = false

	for (const argument of argv) {
		if (argument.startsWith("--mode=")) {
			mode = argument.slice("--mode=".length).trim()
			continue
		}
		if (argument === "--no-mock-github") {
			mockGithub = false
			continue
		}
		if (argument === "--keep-home") {
			keepHome = true
			continue
		}
		throw new Error(`Unknown argument "${argument}".`)
	}

	if (mode !== "auto" && mode !== "manual") {
		throw new Error(`Unsupported mode "${mode}". Use --mode=auto or --mode=manual.`)
	}

	return { mode, mockGithub, keepHome }
}

const runProcess = async (command, args, options = {}) =>
	await new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: options.cwd ?? PROJECT_ROOT,
			env: options.env ?? process.env,
			stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
			shell: options.shell ?? false,
		})

		let stdout = ""
		let stderr = ""
		if (child.stdout) {
			child.stdout.on("data", (chunk) => {
				stdout += String(chunk)
			})
		}
		if (child.stderr) {
			child.stderr.on("data", (chunk) => {
				stderr += String(chunk)
			})
		}

		if (typeof options.stdinData === "string" && child.stdin) {
			child.stdin.write(options.stdinData)
			child.stdin.end()
		}

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

const commandExists = async (command, env) => {
	if (process.platform === "win32") {
		const result = await runProcess("where", [command], { env })
		return result.code === 0
	}
	const result = await runProcess("which", [command], { env })
	return result.code === 0
}

const ensureMockSshKeygenIfMissing = async (env, homeDirectory) => {
	if (await commandExists("ssh-keygen", env)) {
		return env
	}

	const binDirectory = path.join(homeDirectory, "mock-bin")
	await mkdir(binDirectory, { recursive: true })

	if (process.platform === "win32") {
		const mockScriptPath = path.join(binDirectory, "ssh-keygen.cmd")
		await writeFile(
			mockScriptPath,
			[
				"@echo off",
				"setlocal",
				"set KEY_PATH=",
				"set COMMENT=mock@example.com",
				":next",
				'if "%~1"=="" goto done',
				'if "%~1"=="-f" (',
				"\tset KEY_PATH=%~2",
				"\tshift",
				"\tshift",
				"\tgoto next",
				")",
				'if "%~1"=="-C" (',
				"\tset COMMENT=%~2",
				"\tshift",
				"\tshift",
				"\tgoto next",
				")",
				"shift",
				"goto next",
				":done",
				'if "%KEY_PATH%"=="" exit /b 1',
				"powershell -NoProfile -Command \"$key=[Environment]::GetEnvironmentVariable('KEY_PATH'); New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($key)) | Out-Null; Set-Content -Path $key -Value 'MOCK-PRIVATE-KEY'; Set-Content -Path ($key + '.pub') -Value ('ssh-ed25519 ' + [Environment]::GetEnvironmentVariable('COMMENT'))\"",
				"exit /b 0",
				"",
			].join("\r\n"),
			"utf8",
		)
	} else {
		const mockScriptPath = path.join(binDirectory, "ssh-keygen")
		await writeFile(
			mockScriptPath,
			[
				"#!/usr/bin/env bash",
				"set -euo pipefail",
				'if [[ \"${1:-}\" == \"--version\" ]]; then',
				'\techo \"mock ssh-keygen\"',
				"\texit 0",
				"fi",
				'KEY_PATH=\"\"',
				'COMMENT=\"mock@example.com\"',
				"while [[ $# -gt 0 ]]; do",
				'\tcase "$1" in',
				"\t\t-f)",
				'\t\t\tKEY_PATH="$2"',
				"\t\t\tshift 2",
				"\t\t\t;;",
				"\t\t-C)",
				'\t\t\tCOMMENT="$2"',
				"\t\t\tshift 2",
				"\t\t\t;;",
				"\t\t*)",
				"\t\t\tshift",
				"\t\t\t;;",
				"\tesac",
				"done",
				'if [[ -z \"${KEY_PATH}\" ]]; then',
				"\texit 1",
				"fi",
				'mkdir -p "$(dirname "${KEY_PATH}")"',
				"printf 'MOCK-PRIVATE-KEY\\n' > \"${KEY_PATH}\"",
				'printf \'ssh-ed25519 %s\\n\' "${COMMENT}" > "${KEY_PATH}.pub"',
				"",
			].join("\n"),
			"utf8",
		)
		await runProcess("chmod", ["+x", mockScriptPath], { env })
	}

	return {
		...env,
		PATH: `${binDirectory}${path.delimiter}${env.PATH ?? ""}`,
	}
}

const selectWrapperInvocation = () => {
	if (process.platform === "win32") {
		return {
			command: WINDOWS_WRAPPER_PATH,
			buildArgs: (wrapperArgs) => wrapperArgs,
			shell: true,
		}
	}
	if (process.platform === "darwin") {
		return {
			command: "bash",
			buildArgs: (wrapperArgs) => [MACOS_WRAPPER_PATH, ...wrapperArgs],
		}
	}
	return {
		command: "bash",
		buildArgs: (wrapperArgs) => [LINUX_WRAPPER_PATH, ...wrapperArgs],
	}
}

const assertExists = async (targetPath, label) => {
	try {
		await access(targetPath, constants.F_OK)
	} catch {
		throw new Error(`${label} is missing: ${targetPath}`)
	}
}

const verifyOutcome = async ({
	homeDirectory,
	env,
	expectedName,
	expectedEmail,
	mockUrlLogPath,
	requireGithubMockLog,
}) => {
	await assertExists(path.join(homeDirectory, ".ssh", "id_ed25519"), "SSH private key")
	await assertExists(path.join(homeDirectory, ".ssh", "id_ed25519.pub"), "SSH public key")

	const gitName = await runProcess("git", ["config", "--global", "user.name"], {
		env,
	})
	const gitEmail = await runProcess("git", ["config", "--global", "user.email"], { env })
	assert.equal(gitName.code, 0, `git user.name could not be read: ${gitName.stderr}`)
	assert.equal(gitEmail.code, 0, `git user.email could not be read: ${gitEmail.stderr}`)

	const actualName = gitName.stdout.trim()
	const actualEmail = gitEmail.stdout.trim()

	if (typeof expectedName === "string") {
		assert.equal(actualName, expectedName, "Unexpected git user.name")
	} else {
		assert.notEqual(actualName.length, 0, "git user.name is empty")
	}
	if (typeof expectedEmail === "string") {
		assert.equal(actualEmail, expectedEmail, "Unexpected git user.email")
	} else {
		assert.notEqual(actualEmail.length, 0, "git user.email is empty")
	}

	if (requireGithubMockLog) {
		const urlLog = await readFile(mockUrlLogPath, "utf8")
		assert.match(urlLog, new RegExp(GITHUB_SSH_SETTINGS_URL.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"))
	}
}

const runAutoMode = async (homeDirectory, env, mockUrlLogPath) => {
	const expectedName = "Installer E2E User"
	const expectedEmail = "installer-e2e@example.com"
	const wrapperInvocation = selectWrapperInvocation()
	const installInfoPath = path.join(homeDirectory, "lyfmark-install-info.json")
	await writeFile(
		installInfoPath,
		JSON.stringify(
			{
				yes: true,
				gitName: expectedName,
				gitEmail: expectedEmail,
				sshComment: expectedEmail,
			},
			null,
			2,
		),
		"utf8",
	)
	const wrapperArgs = wrapperInvocation.buildArgs([`--install-info=${installInfoPath}`])
	const testEnv = {
		...env,
	}

	const result = await runProcess(wrapperInvocation.command, wrapperArgs, {
		env: testEnv,
		shell: wrapperInvocation.shell ?? false,
	})
	const mergedOutput = `${result.stdout}\n${result.stderr}`
	assert.equal(result.code, 0, mergedOutput)
	assert.match(mergedOutput, /\[repair\] Health summary:/u)
	assert.match(mergedOutput, /\[installer\] Installation finished\./u)

	await verifyOutcome({
		homeDirectory,
		env: testEnv,
		expectedName,
		expectedEmail,
		mockUrlLogPath,
		requireGithubMockLog: true,
	})

	console.log("[installer-e2e] Auto mode passed.")
}

const runManualMode = async (homeDirectory, env, mockGithub) => {
	const wrapperInvocation = selectWrapperInvocation()
	const wrapperArgs = wrapperInvocation.buildArgs([])

	console.log("[installer-e2e] Manual mode started.")
	console.log(`[installer-e2e] Temporary HOME: ${homeDirectory}`)
	if (mockGithub) {
		console.log("[installer-e2e] GitHub URL opening is mocked. Press Enter or answer 'y' for the URL opening prompt.")
	}
	console.log("[installer-e2e] Please complete installer prompts manually now.")

	const result = await runProcess(wrapperInvocation.command, wrapperArgs, {
		env,
		shell: wrapperInvocation.shell ?? false,
		stdio: "inherit",
	})
	if (result.code !== 0) {
		throw new Error(`Manual mode failed with exit code ${result.code}.`)
	}

	console.log("[installer-e2e] Manual run finished. Running artifact checks...")
	await verifyOutcome({
		homeDirectory,
		env,
		expectedName: undefined,
		expectedEmail: undefined,
		mockUrlLogPath: env.LYFMARK_INSTALLER_MOCK_OPEN_URL_LOG ?? "",
		requireGithubMockLog: mockGithub,
	})

	console.log("[installer-e2e] Manual mode checks passed.")
	console.log(`[installer-e2e] HOME retained for inspection: ${homeDirectory}`)
}

const main = async () => {
	const options = parseMode(process.argv.slice(2))
	const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "lyfmark-installer-e2e-home-"))
	const mockUrlLogPath = path.join(homeDirectory, "mock-open-url.log")

	let env = {
		...process.env,
		HOME: homeDirectory,
		USERPROFILE: homeDirectory,
		LYFMARK_INSTALLER_NO_PAUSE: "1",
	}
	if (options.mockGithub) {
		env.LYFMARK_INSTALLER_MOCK_OPEN_URL_LOG = mockUrlLogPath
	}

	try {
		env = await ensureMockSshKeygenIfMissing(env, homeDirectory)
		if (options.mode === "manual") {
			await runManualMode(homeDirectory, env, options.mockGithub)
			return
		}
		await runAutoMode(homeDirectory, env, mockUrlLogPath)
	} finally {
		if (options.mode === "auto" && !options.keepHome) {
			await rm(homeDirectory, { recursive: true, force: true })
		}
	}
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error)
	console.error(`[installer-e2e] Error: ${message}`)
	process.exitCode = 1
})
