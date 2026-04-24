import { spawnSync } from "node:child_process"
import { createServer } from "node:http"
import { createReadStream, existsSync, rmSync, statSync, writeFileSync } from "node:fs"
import { extname, join, normalize, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const toolsDirectory = resolve(fileURLToPath(new URL(".", import.meta.url)))
const projectRoot = resolve(toolsDirectory, "..")
const testPagePath = join(projectRoot, "src/pages/qa-color-override-smoke.md")
const testRoutePath = "/qa-color-override-smoke/"
const distDirectory = join(projectRoot, "dist")

const MIME_TYPES = {
	".css": "text/css; charset=utf-8",
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".svg": "image/svg+xml",
	".woff2": "font/woff2",
}

const positiveTestPageContent = `---
title: QA Color Override Smoke
description: QA validation page for frontmatter color override.
updated: 2026-04-03
layout: ~/layouts/primary.astro
color-highlight: "#ff0000"
---
# QA Color Override Smoke

:::accent-rule
`

const negativeTestPageContent = `---
title: QA Color Override Smoke
description: QA validation page for frontmatter color override.
updated: 2026-04-03
layout: ~/layouts/primary.astro
color-highlight: #ff0000
---
# QA Color Override Smoke

:::accent-rule
`

const runCommand = (command, args, expectSuccess) => {
	const result = spawnSync(command, args, {
		cwd: projectRoot,
		encoding: "utf8",
	})

	const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
	if (expectSuccess && result.status !== 0) {
		throw new Error(`Command failed: ${command} ${args.join(" ")}\n${output}`)
	}
	if (!expectSuccess && result.status === 0) {
		throw new Error(`Command unexpectedly succeeded: ${command} ${args.join(" ")}\n${output}`)
	}

	return {
		status: result.status ?? 1,
		output,
	}
}

const startStaticServer = async (directory) => {
	const rootDirectory = resolve(directory)
	const server = createServer((request, response) => {
		const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1")
		let pathname = decodeURIComponent(requestUrl.pathname)
		if (pathname.endsWith("/")) {
			pathname += "index.html"
		}

		const normalizedPath = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "")
		const absolutePath = resolve(rootDirectory, `.${normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`}`)
		if (!absolutePath.startsWith(rootDirectory)) {
			response.statusCode = 403
			response.end("Forbidden")
			return
		}
		if (!existsSync(absolutePath)) {
			response.statusCode = 404
			response.end("Not found")
			return
		}

		const stat = statSync(absolutePath)
		if (!stat.isFile()) {
			response.statusCode = 404
			response.end("Not found")
			return
		}

		const extension = extname(absolutePath).toLowerCase()
		const mimeType = MIME_TYPES[extension] ?? "application/octet-stream"
		response.setHeader("Content-Type", mimeType)
		createReadStream(absolutePath).pipe(response)
	})

	const port = await new Promise((resolvePort, rejectPort) => {
		server.once("error", rejectPort)
		server.listen(0, "127.0.0.1", () => {
			const address = server.address()
			if (!address || typeof address === "string") {
				rejectPort(new Error("Failed to resolve static server address."))
				return
			}
			resolvePort(address.port)
		})
	})

	return {
		url: `http://127.0.0.1:${port}`,
		close: async () => {
			await new Promise((resolveClose) => {
				server.close(() => resolveClose(undefined))
			})
		},
	}
}

const verifyPositivePath = async () => {
	writeFileSync(testPagePath, positiveTestPageContent, "utf8")
	runCommand("npm", ["run", "build"], true)

	const server = await startStaticServer(distDirectory)
	let browser
	try {
		browser = await chromium.launch({ headless: true })
		const page = await browser.newPage()
		await page.goto(`${server.url}${testRoutePath}`, { waitUntil: "networkidle" })

		const result = await page.evaluate(() => {
			const accentRule = document.querySelector(".accent-rule-module.accent-rule-module--underline")
			if (!accentRule) {
				return { missingAccentRule: true }
			}
			return {
				missingAccentRule: false,
				bodyHighlight: getComputedStyle(document.body).getPropertyValue("--color-highlight").trim(),
				accentRuleBackground: getComputedStyle(accentRule, "::before").backgroundColor,
			}
		})

		if (result.missingAccentRule) {
			throw new Error("Accent rule module not found on smoke-test page.")
		}
		if (result.bodyHighlight !== "#ff0000") {
			throw new Error(`Expected body --color-highlight to be #ff0000, got "${result.bodyHighlight}".`)
		}
		if (result.accentRuleBackground !== "rgb(255, 0, 0)") {
			throw new Error(`Expected accent rule color rgb(255, 0, 0), got "${result.accentRuleBackground}".`)
		}
	} finally {
		if (browser) {
			await browser.close()
		}
		await server.close()
	}
}

const verifyNegativePath = () => {
	writeFileSync(testPagePath, negativeTestPageContent, "utf8")
	const result = runCommand("npm", ["run", "build"], false)
	const hasFieldReference = result.output.includes('Frontmatter-Feld "color-highlight"')
	const hasQuotedHexHint = result.output.includes("Anführungszeichen Pflicht")

	if (!hasFieldReference || !hasQuotedHexHint) {
		throw new Error(
			`Negative-path error message mismatch.\nExpected field + quote hint, got:\n${result.output}`,
		)
	}
}

const run = async () => {
	try {
		await verifyPositivePath()
		verifyNegativePath()
		console.log("Frontmatter color override tests passed.")
	} finally {
		if (existsSync(testPagePath)) {
			rmSync(testPagePath)
		}
	}
}

run().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error))
	process.exitCode = 1
})
