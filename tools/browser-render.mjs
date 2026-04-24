import fs from "node:fs"
import fsp from "node:fs/promises"
import http from "node:http"
import path from "node:path"
import process from "node:process"
import { spawn } from "node:child_process"

const PROJECT_ROOT = process.cwd()
const DIST_ROOT = path.resolve(PROJECT_ROOT, "dist")
const OUTPUT_ROOT = path.resolve(PROJECT_ROOT, "tmp/browser-shots")
const DEFAULT_WAIT_MS = 600

const PRESETS = {
	desktop: { width: 1920, height: 1080, dpr: 1 },
	surface: { width: 828, height: 1133, dpr: 2.25 },
	mobile: { width: 390, height: 844, dpr: 3 },
}

const MIME_TYPES = {
	".css": "text/css; charset=utf-8",
	".gif": "image/gif",
	".html": "text/html; charset=utf-8",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".js": "application/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".svg": "image/svg+xml",
	".txt": "text/plain; charset=utf-8",
	".webp": "image/webp",
	".woff": "font/woff",
	".woff2": "font/woff2",
}

const parseArgs = (argv) => {
	const options = {
		route: "/",
		outDir: OUTPUT_ROOT,
		name: "",
		build: true,
		compare: false,
		preset: "desktop",
		width: PRESETS.desktop.width,
		height: PRESETS.desktop.height,
		dpr: PRESETS.desktop.dpr,
		waitMs: DEFAULT_WAIT_MS,
		fullPage: true,
		selector: "",
		selectorPad: 64,
		freeze: false,
		suppressSplash: true,
		help: false,
	}

	for (let index = 2; index < argv.length; index += 1) {
		const token = argv[index]
		if (!token.startsWith("--")) {
			continue
		}

		const [rawKey, inlineValue] = token.slice(2).split("=", 2)
		const key = rawKey.trim()
		const nextValue = inlineValue ?? argv[index + 1]
		const consumeNext = inlineValue === undefined

		switch (key) {
			case "route":
				if (nextValue) {
					options.route = nextValue
					if (consumeNext) {
						index += 1
					}
				}
				break
			case "out-dir":
				if (nextValue) {
					options.outDir = path.resolve(PROJECT_ROOT, nextValue)
					if (consumeNext) {
						index += 1
					}
				}
				break
			case "name":
				if (nextValue) {
					options.name = nextValue
					if (consumeNext) {
						index += 1
					}
				}
				break
			case "preset":
				if (nextValue && PRESETS[nextValue]) {
					options.preset = nextValue
					options.width = PRESETS[nextValue].width
					options.height = PRESETS[nextValue].height
					options.dpr = PRESETS[nextValue].dpr
					if (consumeNext) {
						index += 1
					}
				}
				break
			case "width":
				if (nextValue) {
					options.width = Number.parseInt(nextValue, 10)
					if (consumeNext) {
						index += 1
					}
				}
				break
			case "height":
				if (nextValue) {
					options.height = Number.parseInt(nextValue, 10)
					if (consumeNext) {
						index += 1
					}
				}
				break
			case "dpr":
				if (nextValue) {
					options.dpr = Number.parseFloat(nextValue)
					if (consumeNext) {
						index += 1
					}
				}
				break
			case "wait-ms":
				if (nextValue) {
					options.waitMs = Number.parseInt(nextValue, 10)
					if (consumeNext) {
						index += 1
					}
				}
				break
			case "selector":
				if (nextValue) {
					options.selector = nextValue
					if (consumeNext) {
						index += 1
					}
				}
				break
			case "selector-pad":
				if (nextValue) {
					const parsedPad = Number.parseInt(nextValue, 10)
					options.selectorPad = Number.isFinite(parsedPad) ? Math.max(0, parsedPad) : options.selectorPad
					if (consumeNext) {
						index += 1
					}
				}
				break
			case "no-build":
				options.build = false
				break
			case "build":
				options.build = true
				break
			case "compare":
				options.compare = true
				break
			case "no-full-page":
				options.fullPage = false
				break
			case "freeze":
				options.freeze = true
				break
			case "show-splash":
				options.suppressSplash = false
				break
			case "hide-splash":
				options.suppressSplash = true
				break
			case "help":
			case "h":
				options.help = true
				break
			default:
				break
		}
	}

	return options
}

const printHelp = () => {
	console.log("Browser rendering snapshot utility")
	console.log("")
	console.log("Usage:")
	console.log("\tnpm run render:shot -- [options]")
	console.log("\tnpm run render:compare -- [options]")
	console.log("")
	console.log("Options:")
	console.log("\t--route <path>\t\tRoute to render, default '/'")
	console.log("\t--preset <name>\t\tdesktop | surface | mobile")
	console.log("\t--width <px>\t\tOverride viewport width")
	console.log("\t--height <px>\t\tOverride viewport height")
	console.log("\t--dpr <number>\t\tOverride device scale factor")
	console.log("\t--wait-ms <ms>\t\tWait after page load (default 600)")
	console.log("\t--out-dir <path>\tOutput directory (default tmp/browser-shots)")
	console.log("\t--name <slug>\t\tCustom output file name")
	console.log('\t--selector "<css>"\tScreenshot clipped around first matching element')
	console.log("\t--selector-pad <px>\tPadding around selector clip (default 64)")
	console.log("\t--compare\t\tCapture desktop + surface in one run")
	console.log("\t--no-build\t\tSkip npm run build")
	console.log("\t--no-full-page\t\tCapture only current viewport")
	console.log("\t--freeze\t\tPause CSS animations/transitions before capture")
	console.log("\t--show-splash\t\tDo not suppress splash overlays")
	console.log("\t--help\t\t\tShow this message")
}

const runBuild = async () => {
	await new Promise((resolve, reject) => {
		const child = spawn("npm", ["run", "build"], {
			cwd: PROJECT_ROOT,
			stdio: "inherit",
			shell: true,
		})
		child.on("exit", (code) => {
			if (code === 0) {
				resolve(undefined)
				return
			}
			reject(new Error(`Build failed with exit code ${code ?? "unknown"}`))
		})
		child.on("error", reject)
	})
}

const sanitizeRoute = (route) => {
	const normalized = route.trim().replace(/^\/+/u, "").replace(/\/+$/u, "")
	if (normalized.length === 0) {
		return "home"
	}
	return normalized.replace(/[^a-zA-Z0-9/_-]+/gu, "-").replace(/\//gu, "__")
}

const resolveFilePath = (pathname) => {
	const normalizedPath = pathname.length > 0 ? pathname : "/"
	const candidates = []
	if (normalizedPath.endsWith("/")) {
		candidates.push(path.join(DIST_ROOT, normalizedPath, "index.html"))
	} else {
		candidates.push(path.join(DIST_ROOT, normalizedPath))
		candidates.push(path.join(DIST_ROOT, normalizedPath, "index.html"))
		candidates.push(path.join(DIST_ROOT, `${normalizedPath}.html`))
	}
	for (const candidate of candidates) {
		const normalized = path.normalize(candidate)
		if (!normalized.startsWith(DIST_ROOT)) {
			continue
		}
		if (fs.existsSync(normalized) && fs.statSync(normalized).isFile()) {
			return normalized
		}
	}
	return null
}

const createDistServer = async () => {
	const server = http.createServer(async (request, response) => {
		const requestUrl = request.url ?? "/"
		const pathname = decodeURIComponent(new URL(requestUrl, "http://127.0.0.1").pathname)
		const filePath = resolveFilePath(pathname)
		if (!filePath) {
			response.writeHead(404, { "content-type": "text/plain; charset=utf-8" })
			response.end("Not Found")
			return
		}
		const ext = path.extname(filePath).toLowerCase()
		const contentType = MIME_TYPES[ext] ?? "application/octet-stream"
		try {
			const buffer = await fsp.readFile(filePath)
			response.writeHead(200, { "content-type": contentType, "cache-control": "no-cache" })
			response.end(buffer)
		} catch {
			response.writeHead(500, { "content-type": "text/plain; charset=utf-8" })
			response.end("Failed to read file")
		}
	})

	await new Promise((resolve, reject) => {
		server.listen(0, "127.0.0.1", () => resolve(undefined))
		server.on("error", reject)
	})

	const address = server.address()
	if (!address || typeof address === "string") {
		throw new Error("Cannot resolve static server address.")
	}
	return {
		server,
		port: address.port,
	}
}

const resolveSelectorClip = async (page, selector, selectorPad) => {
	const locator = page.locator(selector).first()
	await locator.waitFor({ state: "visible", timeout: 5000 })
	await locator.scrollIntoViewIfNeeded()
	const box = await locator.boundingBox()
	if (!box) {
		throw new Error(`Selector "${selector}" ist nicht sichtbar oder hat keine Bounding-Box.`)
	}

	const viewportSize = page.viewportSize()
	if (!viewportSize) {
		throw new Error("Viewport konnte nicht bestimmt werden.")
	}

	const x = Math.min(
		Math.max(0, Math.floor(box.x - selectorPad)),
		Math.max(0, viewportSize.width - 1),
	)
	const y = Math.min(
		Math.max(0, Math.floor(box.y - selectorPad)),
		Math.max(0, viewportSize.height - 1),
	)
	const width = Math.max(1, Math.min(viewportSize.width - x, Math.ceil(box.width + selectorPad * 2)))
	const height = Math.max(1, Math.min(viewportSize.height - y, Math.ceil(box.height + selectorPad * 2)))

	return { x, y, width, height }
}

const takeScreenshot = async (browserType, baseUrl, route, options, presetName) => {
	const browser = await browserType.launch({ headless: true })
	try {
		const context = await browser.newContext({
			viewport: {
				width: options.width,
				height: options.height,
			},
			deviceScaleFactor: options.dpr,
		})
		const page = await context.newPage()
		if (options.suppressSplash) {
			await page.addInitScript(() => {
				const HIDE_STYLE_ID = "browser-render-hide-splash"
				const STORAGE_KEY_PREFIX = "splash-screen:"
				const HIDDEN_ATTR = "hidden"

				const ensureHideStyle = () => {
					if (document.getElementById(HIDE_STYLE_ID)) {
						return
					}
					const styleNode = document.createElement("style")
					styleNode.id = HIDE_STYLE_ID
					styleNode.textContent = `
[data-splash-screen] {
	display: none !important;
	opacity: 0 !important;
	visibility: hidden !important;
	pointer-events: none !important;
}

body.splash-screen-visible,
body.splash-screen-content-entering {
	overflow: auto !important;
}

body.splash-screen-visible .page-top-chrome,
body.splash-screen-visible #page,
body.splash-screen-content-entering .page-top-chrome,
body.splash-screen-content-entering #page {
	opacity: 1 !important;
	pointer-events: auto !important;
}
`
					const head = document.head || document.documentElement
					head.appendChild(styleNode)
				}

				const clearSplashBodyState = () => {
					if (!document.body) {
						return
					}
					document.body.classList.remove("splash-screen-visible", "splash-screen-content-entering")
					document.body.style.removeProperty("--splash-screen-enter-duration")
				}

				const markSplashAsSeen = () => {
					const splashNodes = document.querySelectorAll("[data-splash-screen]")
					const shownAt = Date.now()
					splashNodes.forEach((node, index) => {
						if (!(node instanceof HTMLElement)) {
							return
						}
						node.setAttribute(HIDDEN_ATTR, "")
						node.setAttribute("aria-hidden", "true")
						const repeatMinutes = node.getAttribute("data-splash-repeat-minutes")
						const signature = repeatMinutes === null ? "once" : `minutes:${Number.parseFloat(repeatMinutes)}`
						const label = node.getAttribute("aria-label") || ""
						const storageKey = `${STORAGE_KEY_PREFIX}${window.location.pathname}:${index}:${label}`
						try {
							window.localStorage.setItem(storageKey, JSON.stringify({ shownAt, signature }))
						} catch (_) {
							// Ignore storage failures.
						}
					})
					clearSplashBodyState()
				}

				ensureHideStyle()
				const observer = new MutationObserver(() => {
					ensureHideStyle()
					markSplashAsSeen()
				})
				observer.observe(document.documentElement, {
					subtree: true,
					childList: true,
					attributes: true,
					attributeFilter: [HIDDEN_ATTR],
				})

				if (document.readyState === "loading") {
					document.addEventListener("DOMContentLoaded", () => {
						ensureHideStyle()
						markSplashAsSeen()
					})
				} else {
					markSplashAsSeen()
				}
			})
		}
		await page.goto(new URL(route, baseUrl).toString(), { waitUntil: "networkidle" })
		if (options.freeze) {
			await page.addStyleTag({
				content:
					"*,:before,:after{animation-play-state:paused!important;animation-delay:0ms!important;transition:none!important}",
			})
		}
		if (options.waitMs > 0) {
			await page.waitForTimeout(options.waitMs)
		}

		await fsp.mkdir(options.outDir, { recursive: true })
		const routePart = sanitizeRoute(route)
		const namedPart =
			options.name.trim().length > 0
				? options.name.trim().replace(/[^a-zA-Z0-9_-]+/gu, "-")
				: `${routePart}__${presetName}__${options.width}x${options.height}@${String(options.dpr).replace(".", "_")}`
		const filePath = path.join(options.outDir, `${namedPart}.png`)
		const selector = options.selector.trim()
		const screenshotOptions = {
			path: filePath,
			fullPage: options.fullPage,
		}
		if (selector.length > 0) {
			screenshotOptions.fullPage = false
			screenshotOptions.clip = await resolveSelectorClip(page, selector, options.selectorPad)
		}
		await page.screenshot(screenshotOptions)
		await context.close()
		return filePath
	} finally {
		await browser.close()
	}
}

const run = async () => {
	const options = parseArgs(process.argv)
	if (options.help) {
		printHelp()
		return
	}
	process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || path.resolve(PROJECT_ROOT, ".cache/ms-playwright")

	if (options.build) {
		await runBuild()
	}

	if (!fs.existsSync(DIST_ROOT)) {
		throw new Error(`Missing dist folder: ${DIST_ROOT}. Run with --build or execute npm run build first.`)
	}

	const { server, port } = await createDistServer()
	const baseUrl = `http://127.0.0.1:${port}`
	const outputs = []
	const { chromium } = await import("playwright")

	try {
		if (options.compare) {
			const desktop = { ...options, ...PRESETS.desktop, name: "", preset: "desktop" }
			const surface = { ...options, ...PRESETS.surface, name: "", preset: "surface" }
			outputs.push(await takeScreenshot(chromium, baseUrl, options.route, desktop, "desktop"))
			outputs.push(await takeScreenshot(chromium, baseUrl, options.route, surface, "surface"))
		} else {
			outputs.push(await takeScreenshot(chromium, baseUrl, options.route, options, options.preset))
		}
	} finally {
		await new Promise((resolve) => {
			server.close(() => resolve(undefined))
		})
	}

	for (const output of outputs) {
		console.log(output)
	}
}

run().catch((error) => {
	const message = error instanceof Error ? error.message : String(error)
	console.error(`[browser-render] ${message}`)
	if (message.includes("error while loading shared libraries")) {
		console.error("[browser-render] Missing Linux browser dependencies.")
		console.error("[browser-render] Run: PLAYWRIGHT_BROWSERS_PATH=.cache/ms-playwright npx playwright install --with-deps chromium")
	}
	process.exitCode = 1
})
