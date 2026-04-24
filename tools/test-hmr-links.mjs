import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { access, readFile, rm, writeFile } from "node:fs/promises"
import net from "node:net"
import path from "node:path"

const PROJECT_ROOT = process.cwd()
const PAGE_PATH = path.join(PROJECT_ROOT, "pages", "tmp-hmr-link-check.md")
const CONTENT_BLOCK_PATH = path.join(PROJECT_ROOT, "content-blocks", "tmp-hmr-link-check.md")
const FORM_PRESET_PATH = path.join(PROJECT_ROOT, "forms", "tmp-hmr-link-check.html")
const NAVIGATION_PATH = path.join(PROJECT_ROOT, "navigation", "menu.md")
const TEST_ROUTE = "/tmp-hmr-link-check/"
const REQUEST_TIMEOUT_MS = 3_000
const READY_TIMEOUT_MS = 90_000
const UPDATE_TIMEOUT_MS = 60_000
const POLL_INTERVAL_MS = 500

const sleep = async (durationMs) => await new Promise((resolve) => setTimeout(resolve, durationMs))

const pathExists = async (targetPath) => {
	try {
		await access(targetPath)
		return true
	} catch {
		return false
	}
}

const getFreePort = async () =>
	await new Promise((resolve, reject) => {
		const server = net.createServer()
		server.on("error", (error) => {
			reject(error)
		})
		server.listen(0, "127.0.0.1", () => {
			const address = server.address()
			if (!address || typeof address === "string") {
				server.close(() => reject(new Error("Unable to allocate test port.")))
				return
			}
			const { port } = address
			server.close((error) => {
				if (error) {
					reject(error)
					return
				}
				resolve(port)
			})
		})
	})

const fetchText = async (url) => {
	const response = await fetch(url, {
		cache: "no-store",
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	})
	if (!response.ok) {
		throw new Error(`Request failed: ${url} -> ${response.status}`)
	}
	return await response.text()
}

const waitForCondition = async (label, timeoutMs, checkFn) => {
	const deadline = Date.now() + timeoutMs
	let lastError = null
	while (Date.now() < deadline) {
		try {
			await checkFn()
			return
		} catch (error) {
			lastError = error
			await sleep(POLL_INTERVAL_MS)
		}
	}
	throw new Error(`${label} timed out after ${timeoutMs}ms. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
}

const createTestPage = () =>
	[
		"---",
		"title: HMR Link Check",
		"description: Temporary HMR validation page.",
		"layout: ~/layouts/primary.astro",
		"updated: 2026-04-23",
		"---",
		"## PAGE-V1",
		"",
		":::tmp-hmr-link-check message=\"BLOCK-PAYLOAD\"",
		"",
		":::form preset=\"tmp-hmr-link-check\" target-url=\"/test-submit\" submit-label=\"Submit\"",
		":::",
		"",
	].join("\n")

const createContentBlock = (marker) =>
	[
		"---",
		"message: Message payload for HMR link test",
		"---",
		`BLOCK-${marker}: $message`,
		"",
	].join("\n")

const createFormPreset = (marker) =>
	[
		"<form method=\"post\" action=\"$target-url\">",
		`\t<p>FORM-${marker}</p>`,
		"\t<button type=\"submit\">$submit-label</button>",
		"</form>",
		"",
	].join("\n")

const updateFirstMenuEntry = (menuSource, label) => {
	const updated = menuSource.replace("# [**Start**](/)", `# [**${label}**](/)`)
	if (updated === menuSource) {
		throw new Error('Unable to update first menu entry. Expected "# [**Start**](/)".')
	}
	return updated
}

const startDevServer = (port) => {
	const child = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port)], {
		cwd: PROJECT_ROOT,
		env: {
			...process.env,
			FORCE_COLOR: "0",
		},
		detached: process.platform !== "win32",
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

	return {
		child,
		getLogs: () => `${stdout}\n${stderr}`,
	}
}

const stopDevServer = async (child) => {
	if (child.exitCode !== null) {
		return
	}

	if (process.platform === "win32") {
		await new Promise((resolve) => {
			const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
				stdio: "ignore",
			})
			killer.once("exit", () => resolve())
			killer.once("error", () => resolve())
		})
	} else if (typeof child.pid === "number" && child.pid > 0) {
		try {
			process.kill(-child.pid, "SIGTERM")
		} catch {
			child.kill("SIGTERM")
		}
	}

	child.stdout?.destroy()
	child.stderr?.destroy()

	await new Promise((resolve) => {
		const timeout = setTimeout(() => {
			if (child.exitCode === null) {
				if (process.platform === "win32") {
					spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" })
				} else if (typeof child.pid === "number" && child.pid > 0) {
					try {
						process.kill(-child.pid, "SIGKILL")
					} catch {
						child.kill("SIGKILL")
					}
				}
			}
		}, 3_000)
		child.once("exit", () => {
			clearTimeout(timeout)
			resolve()
		})
	})
}

const main = async () => {
	const port = await getFreePort()
	const baseUrl = `http://127.0.0.1:${port}`
	const testPageUrl = `${baseUrl}${TEST_ROUTE}`

	if (await pathExists(PAGE_PATH)) {
		throw new Error(`Temporary test page already exists: ${PAGE_PATH}`)
	}
	if (await pathExists(CONTENT_BLOCK_PATH)) {
		throw new Error(`Temporary content-block already exists: ${CONTENT_BLOCK_PATH}`)
	}
	if (await pathExists(FORM_PRESET_PATH)) {
		throw new Error(`Temporary form preset already exists: ${FORM_PRESET_PATH}`)
	}

	const originalNavigation = await readFile(NAVIGATION_PATH, "utf8")
	await writeFile(PAGE_PATH, createTestPage(), "utf8")
	await writeFile(CONTENT_BLOCK_PATH, createContentBlock("V1"), "utf8")
	await writeFile(FORM_PRESET_PATH, createFormPreset("V1"), "utf8")

	const server = startDevServer(port)
	const { child, getLogs } = server

	try {
		await waitForCondition("Dev server ready", READY_TIMEOUT_MS, async () => {
			const html = await fetchText(testPageUrl)
			assert.match(html, /PAGE-V1/u)
			assert.match(html, /BLOCK-V1: BLOCK-PAYLOAD/u)
			assert.match(html, /FORM-V1/u)
		})

		await writeFile(PAGE_PATH, createTestPage().replace("PAGE-V1", "PAGE-V2"), "utf8")
		await waitForCondition("Page update reflected", UPDATE_TIMEOUT_MS, async () => {
			const html = await fetchText(testPageUrl)
			assert.match(html, /PAGE-V2/u)
		})

		await writeFile(CONTENT_BLOCK_PATH, createContentBlock("V2"), "utf8")
		await waitForCondition("Content-block update reflected", UPDATE_TIMEOUT_MS, async () => {
			const html = await fetchText(testPageUrl)
			assert.match(html, /BLOCK-V2: BLOCK-PAYLOAD/u)
		})

		await writeFile(FORM_PRESET_PATH, createFormPreset("V2"), "utf8")
		await waitForCondition("Form preset update reflected", UPDATE_TIMEOUT_MS, async () => {
			const html = await fetchText(testPageUrl)
			assert.match(html, /FORM-V2/u)
		})

		const updatedMenu = updateFirstMenuEntry(originalNavigation, "Start HMR V2")
		await writeFile(NAVIGATION_PATH, updatedMenu, "utf8")
		await waitForCondition("Navigation update reflected", UPDATE_TIMEOUT_MS, async () => {
			const html = await fetchText(testPageUrl)
			assert.match(html, /Start HMR V2/u)
		})

		console.log("[hmr-links] Cross-root HMR check passed.")
	} catch (error) {
		throw new Error(
			`HMR link test failed: ${error instanceof Error ? error.message : String(error)}\nLogs:\n${getLogs()}`,
		)
	} finally {
		await stopDevServer(child)
		await writeFile(NAVIGATION_PATH, originalNavigation, "utf8")
		await rm(PAGE_PATH, { force: true })
		await rm(CONTENT_BLOCK_PATH, { force: true })
		await rm(FORM_PRESET_PATH, { force: true })
	}
}

main()
	.then(() => {
		process.exit(0)
	})
	.catch((error) => {
		const message = error instanceof Error ? error.message : String(error)
		console.error(`[hmr-links] ${message}`)
		process.exit(1)
	})
