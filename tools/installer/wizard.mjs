import { spawn } from "node:child_process"
import { access, appendFile, constants, mkdir, readFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import readline from "node:readline/promises"

const PROJECT_ROOT = process.cwd()
const SSH_PRIVATE_KEY_PATH = path.join(os.homedir(), ".ssh", "id_ed25519")
const SSH_PUBLIC_KEY_PATH = `${SSH_PRIVATE_KEY_PATH}.pub`
const GITHUB_SSH_SETTINGS_URL = "https://github.com/settings/keys"
const NODE_DOWNLOAD_URL = "https://nodejs.org/en/download"
const GIT_DOWNLOAD_URL = "https://git-scm.com/downloads"
const DEFAULT_GIT_NAME_ENV = "LYFMARK_INSTALLER_DEFAULT_GIT_NAME"
const DEFAULT_GIT_EMAIL_ENV = "LYFMARK_INSTALLER_DEFAULT_GIT_EMAIL"
const DEFAULT_SSH_COMMENT_ENV = "LYFMARK_INSTALLER_DEFAULT_SSH_COMMENT"

const OPTION_DEFINITIONS = new Set(["--yes", "--skip-git-identity", "--skip-ssh", "--skip-dependencies", "--skip-repair"])

const parseOptions = (argv) => {
	const options = {
		yes: false,
		skipGitIdentity: false,
		skipSsh: false,
		skipDependencies: false,
		skipRepair: false,
	}

	for (const argument of argv) {
		if (!OPTION_DEFINITIONS.has(argument)) {
			throw new Error(`Unknown installer option "${argument}".`)
		}
		if (argument === "--yes") {
			options.yes = true
		} else if (argument === "--skip-git-identity") {
			options.skipGitIdentity = true
		} else if (argument === "--skip-ssh") {
			options.skipSsh = true
		} else if (argument === "--skip-dependencies") {
			options.skipDependencies = true
		} else if (argument === "--skip-repair") {
			options.skipRepair = true
		}
	}

	return options
}

const runCommandCapture = async (command, args, contextLabel) =>
	await new Promise((resolve, reject) => {
		const child = spawn(command, args, {
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
			resolve({
				ok: code === 0,
				code: code ?? 1,
				stdout: stdout.trim(),
				stderr: stderr.trim(),
				contextLabel,
			})
		})
	})

const runCommandInteractive = async (command, args, contextLabel) =>
	await new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: PROJECT_ROOT,
			stdio: "inherit",
		})
		child.on("error", (error) => {
			reject(error)
		})
		child.on("close", (code) => {
			resolve({
				ok: code === 0,
				code: code ?? 1,
				contextLabel,
			})
		})
	})

const commandExists = async (command) => {
	if (process.platform === "win32") {
		const result = await runCommandCapture("where", [command], `where ${command}`)
		return result.ok
	}
	const result = await runCommandCapture("which", [command], `which ${command}`)
	return result.ok
}

const openUrl = async (url) => {
	if (process.env.LYFMARK_INSTALLER_SKIP_OPEN_URLS === "1") {
		console.log(`[installer] URL-Öffnung übersprungen: ${url}`)
		return
	}

	const mockUrlLogPath = process.env.LYFMARK_INSTALLER_MOCK_OPEN_URL_LOG
	if (typeof mockUrlLogPath === "string" && mockUrlLogPath.trim().length > 0) {
		await appendFile(mockUrlLogPath, `${url}\n`, "utf8")
		console.log(`[installer] (mock) URL geöffnet: ${url}`)
		return
	}

	if (process.platform === "win32") {
		await runCommandCapture("cmd", ["/c", "start", "", url], `open ${url}`)
		return
	}
	if (process.platform === "darwin") {
		await runCommandCapture("open", [url], `open ${url}`)
		return
	}
	await runCommandCapture("xdg-open", [url], `open ${url}`)
}

const formatStep = (label) => `\n[installer] ${label}`

const promptYesNo = async (rl, question, options) => {
	if (options.yes) {
		return true
	}
	for (;;) {
		const answer = (await rl.question(`${question} (j/n): `)).trim().toLowerCase()
		if (answer === "j" || answer === "ja" || answer === "y" || answer === "yes") {
			return true
		}
		if (answer === "n" || answer === "nein" || answer === "no") {
			return false
		}
		console.log("[installer] Bitte antworte mit j oder n.")
	}
}

const ensureRequiredCommand = async (rl, options, commandName, downloadUrl) => {
	if (await commandExists(commandName)) {
		console.log(`[installer] ${commandName} ist verfügbar.`)
		return
	}

	console.log(`[installer] ${commandName} wurde nicht gefunden.`)
	console.log(`[installer] Download: ${downloadUrl}`)
	const shouldOpen = await promptYesNo(rl, "Soll die Download-Seite im Browser geöffnet werden?", options)
	if (shouldOpen) {
		await openUrl(downloadUrl)
	}
	throw new Error(`${commandName} fehlt. Bitte installieren und den Installer erneut starten.`)
}

const readGitConfig = async (key) => {
	const result = await runCommandCapture("git", ["config", "--global", key], `git config --global ${key}`)
	if (!result.ok) {
		return ""
	}
	return result.stdout.trim()
}

const ensureGitIdentity = async (rl, options) => {
	console.log(formatStep("Git-Konto prüfen"))
	const existingName = await readGitConfig("user.name")
	const existingEmail = await readGitConfig("user.email")
	if (existingName.length > 0 && existingEmail.length > 0) {
		console.log(`[installer] Git-Name: ${existingName}`)
		console.log(`[installer] Git-E-Mail: ${existingEmail}`)
		return
	}

	if (options.yes) {
		const defaultName = (process.env[DEFAULT_GIT_NAME_ENV] ?? "").trim()
		const defaultEmail = (process.env[DEFAULT_GIT_EMAIL_ENV] ?? "").trim()
		if (defaultName.length === 0 || defaultEmail.length === 0) {
			throw new Error(
				`Git-Name/E-Mail fehlen. Für "--yes" müssen ${DEFAULT_GIT_NAME_ENV} und ${DEFAULT_GIT_EMAIL_ENV} gesetzt sein.`,
			)
		}

		const setName = await runCommandCapture("git", ["config", "--global", "user.name", defaultName], "git config user.name")
		if (!setName.ok) {
			throw new Error(`Git-Name konnte nicht gesetzt werden: ${setName.stderr || setName.stdout}`)
		}
		const setEmail = await runCommandCapture("git", ["config", "--global", "user.email", defaultEmail], "git config user.email")
		if (!setEmail.ok) {
			throw new Error(`Git-E-Mail konnte nicht gesetzt werden: ${setEmail.stderr || setEmail.stdout}`)
		}
		console.log("[installer] Git-Name und Git-E-Mail wurden aus Umgebungswerten gesetzt.")
		return
	}

	const name = (await rl.question("Bitte Git-Namen eingeben (z. B. Max Mustermann): ")).trim()
	const email = (await rl.question("Bitte Git-E-Mail eingeben: ")).trim()
	if (name.length === 0 || email.length === 0) {
		throw new Error("Git-Name und Git-E-Mail dürfen nicht leer sein.")
	}

	const setName = await runCommandCapture("git", ["config", "--global", "user.name", name], "git config user.name")
	if (!setName.ok) {
		throw new Error(`Git-Name konnte nicht gesetzt werden: ${setName.stderr || setName.stdout}`)
	}
	const setEmail = await runCommandCapture("git", ["config", "--global", "user.email", email], "git config user.email")
	if (!setEmail.ok) {
		throw new Error(`Git-E-Mail konnte nicht gesetzt werden: ${setEmail.stderr || setEmail.stdout}`)
	}
	console.log("[installer] Git-Name und Git-E-Mail wurden gesetzt.")
}

const fileExists = async (filePath) => {
	try {
		await access(filePath, constants.F_OK)
		return true
	} catch {
		return false
	}
}

const ensureSshKey = async (rl, options) => {
	console.log(formatStep("SSH-Schlüssel prüfen"))
	const hasPublicKey = await fileExists(SSH_PUBLIC_KEY_PATH)
	if (hasPublicKey) {
		console.log(`[installer] SSH-Schlüssel gefunden: ${SSH_PUBLIC_KEY_PATH}`)
	} else {
		await mkdir(path.dirname(SSH_PRIVATE_KEY_PATH), { recursive: true })
		if (options.yes) {
			const fallbackEmail = await readGitConfig("user.email")
			const envComment = (process.env[DEFAULT_SSH_COMMENT_ENV] ?? "").trim()
			const keyComment = envComment || fallbackEmail || "you@example.com"
			const keygenResult = await runCommandInteractive(
				"ssh-keygen",
				["-t", "ed25519", "-C", keyComment, "-f", SSH_PRIVATE_KEY_PATH, "-N", ""],
				"ssh-keygen",
			)
			if (!keygenResult.ok) {
				throw new Error("SSH-Schlüssel konnte nicht erzeugt werden.")
			}
			console.log("[installer] SSH-Schlüssel wurde aus Umgebungswerten erzeugt.")
		} else {
			const createKey = await promptYesNo(rl, "Es wurde kein SSH-Schlüssel gefunden. Jetzt erstellen?", options)
			if (!createKey) {
				throw new Error("Installation abgebrochen: SSH-Schlüssel ist für GitHub-Uploads erforderlich.")
			}
			const fallbackEmail = await readGitConfig("user.email")
			const comment = (await rl.question(`Kommentar für den SSH-Key [${fallbackEmail || "you@example.com"}]: `)).trim()
			const keyComment = comment.length > 0 ? comment : fallbackEmail || "you@example.com"
			const keygenResult = await runCommandInteractive(
				"ssh-keygen",
				["-t", "ed25519", "-C", keyComment, "-f", SSH_PRIVATE_KEY_PATH, "-N", ""],
				"ssh-keygen",
			)
			if (!keygenResult.ok) {
				throw new Error("SSH-Schlüssel konnte nicht erzeugt werden.")
			}
		}
	}

	const publicKey = (await readFile(SSH_PUBLIC_KEY_PATH, "utf8")).trim()
	console.log("[installer] Bitte den folgenden Public Key in GitHub eintragen:")
	console.log("----------------------------------------------------------------")
	console.log(publicKey)
	console.log("----------------------------------------------------------------")
	console.log(`[installer] GitHub SSH Keys: ${GITHUB_SSH_SETTINGS_URL}`)

	const openGithub = await promptYesNo(rl, "Soll die GitHub-SSH-Seite jetzt geöffnet werden?", options)
	if (openGithub) {
		await openUrl(GITHUB_SSH_SETTINGS_URL)
	}
}

const ensureProjectRoot = async () => {
	const packageJsonPath = path.join(PROJECT_ROOT, "package.json")
	const hasPackageJson = await fileExists(packageJsonPath)
	if (!hasPackageJson) {
		throw new Error('Installer muss im Projekt-Root ausgeführt werden (package.json fehlt im aktuellen Ordner).')
	}
}

const runSetupCommands = async (options) => {
	if (!options.skipDependencies) {
		console.log(formatStep("Abhängigkeiten installieren (npm install)"))
		const installResult = await runCommandInteractive("npm", ["install"], "npm install")
		if (!installResult.ok) {
			throw new Error("npm install ist fehlgeschlagen.")
		}
	} else {
		console.log("[installer] Abhängigkeiten übersprungen (--skip-dependencies).")
	}

	if (!options.skipRepair) {
		console.log(formatStep("Projektstruktur reparieren/validieren (npm run repair)"))
		const repairResult = await runCommandInteractive("npm", ["run", "repair"], "npm run repair")
		if (!repairResult.ok) {
			throw new Error("npm run repair ist fehlgeschlagen.")
		}
	} else {
		console.log("[installer] Repair übersprungen (--skip-repair).")
	}
}

const printFinalSummary = () => {
	console.log("\n[installer] Installation abgeschlossen.")
	console.log("[installer] Nächste Schritte:")
	console.log("- Projekt in VS Code öffnen (Kundensicht: .vscode/lyfmark.customer.code-workspace).")
	console.log("- Entwicklungsserver starten: npm run dev")
	console.log("- Inhalte unter pages/, navigation/, content-blocks/ und forms/ bearbeiten.")
}

const main = async () => {
	const options = parseOptions(process.argv.slice(2))
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	})

	try {
		console.log("[installer] LyfMark Installer gestartet.")
		await ensureProjectRoot()

		console.log(formatStep("Pflicht-Tools prüfen"))
		await ensureRequiredCommand(rl, options, "node", NODE_DOWNLOAD_URL)
		await ensureRequiredCommand(rl, options, "npm", NODE_DOWNLOAD_URL)
		await ensureRequiredCommand(rl, options, "git", GIT_DOWNLOAD_URL)
		if (!options.skipSsh) {
			await ensureRequiredCommand(rl, options, "ssh-keygen", GIT_DOWNLOAD_URL)
		} else {
			console.log("[installer] ssh-keygen-Prüfung übersprungen (--skip-ssh).")
		}

		if (!options.skipGitIdentity) {
			await ensureGitIdentity(rl, options)
		} else {
			console.log("[installer] Git-Identität übersprungen (--skip-git-identity).")
		}

		if (!options.skipSsh) {
			await ensureSshKey(rl, options)
		} else {
			console.log("[installer] SSH-Setup übersprungen (--skip-ssh).")
		}

		await runSetupCommands(options)
		printFinalSummary()
	} finally {
		rl.close()
	}
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error)
	console.error(`\n[installer] Fehler: ${message}`)
	process.exitCode = 1
})
