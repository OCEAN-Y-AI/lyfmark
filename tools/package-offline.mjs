import { spawn } from "node:child_process"
import { promises as filesystem } from "node:fs"
import path from "node:path"

/**
 * package-offline erstellt eine Chef-taugliche Offline-Vorschau als ZIP.
 *
 * Motivation:
 * - Astro rendert im SSG standardmäßig root-relative URLs ("/…").
 * - Beim Öffnen per Doppelklick (file://) funktionieren root-relative Pfade und "pretty" Routen ("/ueberuns") nicht.
 *
 * Vorgehen:
 * 1) `npm run build` (mit leerem ASTRO_BASE) erzeugt `dist/`.
 * 2) `dist/` wird nach `dist-offline/` kopiert.
 * 3) In `dist-offline/` werden alle root-relativen `href`/`src`/`srcset` und CSS-`url(/…)` auf relative Pfade umgeschrieben.
 *    Zusätzlich werden interne Routen auf `.../index.html` normalisiert.
 * 4) Es wird `<package-name>-offline.zip` erstellt (ZIP enthält die Dateien direkt, nicht den dist-offline-Ordner als Wrapper).
 */

const DIST_DIRECTORY = path.resolve("dist")
const OFFLINE_DIRECTORY = path.resolve("dist-offline")

const getOutputZipPath = async () => {
	const packageJsonPath = path.resolve("package.json")
	const packageJsonRaw = await filesystem.readFile(packageJsonPath, "utf8")
	const packageJson = JSON.parse(packageJsonRaw)
	const rawName = typeof packageJson.name === "string" ? packageJson.name.trim() : ""
	const packageName = rawName.length > 0 ? rawName : "lyfmark-base-template"
	const normalizedName = packageName.replace(/[^a-z0-9._-]+/gi, "-")
	return path.resolve(`${normalizedName}-offline.zip`)
}

const runCommand = async (command, args, options = {}) => {
	await new Promise((resolve, reject) => {
		const child = spawn(command, args, { stdio: "inherit", shell: false, ...options })
		child.on("error", reject)
		child.on("exit", (code) => {
			if (code === 0) {
				resolve()
				return
			}
			reject(new Error(`${command} exited with code ${code}`))
		})
	})
}

const ensureCleanDirectory = async (directory) => {
	await filesystem.rm(directory, { recursive: true, force: true })
	await filesystem.mkdir(directory, { recursive: true })
}

const copyDirectory = async (from, to) => {
	await filesystem.cp(from, to, { recursive: true })
}

const listFiles = async (root) => {
	/** @type {string[]} */
	const files = []

	/** @type {(directory: string) => Promise<void>} */
	const walk = async (directory) => {
		const entries = await filesystem.readdir(directory, { withFileTypes: true })
		for (const entry of entries) {
			const absolute = path.join(directory, entry.name)
			if (entry.isDirectory()) {
				await walk(absolute)
				continue
			}
			if (entry.isFile()) {
				files.push(absolute)
			}
		}
	}

	await walk(root)
	return files
}

const splitUrlSuffix = (url) => {
	const queryIndex = url.indexOf("?")
	const hashIndex = url.indexOf("#")
	const cutIndex = queryIndex === -1 ? hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex)
	if (cutIndex === -1) {
		return { main: url, suffix: "" }
	}
	return { main: url.slice(0, cutIndex), suffix: url.slice(cutIndex) }
}

const isLikelyRoute = (pathname) => {
	const clean = pathname.replace(/\/+$/, "")
	if (clean.length === 0 || clean === "/") {
		return true
	}
	const lastSegment = clean.split("/").pop() ?? ""
	return !lastSegment.includes(".")
}

const normalizeOfflineTarget = (rawPathname) => {
	const { main, suffix } = splitUrlSuffix(rawPathname)
	if (main === "/") {
		return { targetPath: "index.html", suffix }
	}
	const withoutLeadingSlash = main.replace(/^\//, "")
	if (isLikelyRoute(main)) {
		const trimmed = withoutLeadingSlash.replace(/\/+$/, "")
		return { targetPath: path.posix.join(trimmed, "index.html"), suffix }
	}
	return { targetPath: withoutLeadingSlash, suffix }
}

const toPosixPath = (filePath) => {
	return filePath.split(path.sep).join(path.posix.sep)
}

const relativeUrlFromFile = (fileAbsolutePath, distRootAbsolutePath, targetPosixPath) => {
	const fileDirectory = path.dirname(fileAbsolutePath)
	const fromDirectory = toPosixPath(path.relative(distRootAbsolutePath, fileDirectory))
	const relative = path.posix.relative(fromDirectory.length > 0 ? fromDirectory : ".", targetPosixPath)
	return relative.length > 0 ? relative : "./"
}

const rewriteHtml = async (filePath) => {
	const original = await filesystem.readFile(filePath, "utf8")

	const rewriteValue = (value) => {
		if (!value.startsWith("/") || value.startsWith("//")) {
			return value
		}
		const { targetPath, suffix } = normalizeOfflineTarget(value)
		const relative = relativeUrlFromFile(filePath, OFFLINE_DIRECTORY, toPosixPath(targetPath))
		return `${relative}${suffix}`
	}

	let updated = original

	updated = updated.replace(/\b(href|src|poster)=("|')([^"']*)(\2)/g, (match, attr, quote, value) => {
		return `${attr}=${quote}${rewriteValue(value)}${quote}`
	})

	updated = updated.replace(/\bsrcset=("|')([^"']*)(\1)/g, (match, quote, value) => {
		const parts = value
			.split(",")
			.map((part) => part.trim())
			.filter((part) => part.length > 0)
			.map((part) => {
				const [urlPart, ...rest] = part.split(/\s+/)
				const rewritten = rewriteValue(urlPart ?? "")
				return [rewritten, ...rest].join(" ")
			})
		return `srcset=${quote}${parts.join(", ")}${quote}`
	})

	// ES-Module scripts funktionieren unter file:// oft nicht (CORS). Für Offline-Vorschau zu classic+defer downgraden.
	updated = updated.replace(/<script\s+type=("|')module\1\s+src=("|')([^"']+)(\2)\s*><\/script>/g, (match, _q1, q2, value) => {
		return `<script defer src=${q2}${value}${q2}></script>`
	})

	if (updated !== original) {
		await filesystem.writeFile(filePath, updated, "utf8")
	}
}

const rewriteCss = async (filePath) => {
	const original = await filesystem.readFile(filePath, "utf8")
	const updated = original.replace(/url\(\s*(["']?)(\/(?!\/)[^"')]+)\1\s*\)/g, (match, quote, value) => {
		const { main, suffix } = splitUrlSuffix(value)
		const targetPath = main.replace(/^\//, "")
		const relative = relativeUrlFromFile(filePath, OFFLINE_DIRECTORY, toPosixPath(targetPath))
		const finalValue = `${relative}${suffix}`
		return `url(${quote}${finalValue}${quote})`
	})
	if (updated !== original) {
		await filesystem.writeFile(filePath, updated, "utf8")
	}
}

const main = async () => {
	console.log("\n[offline] Building dist/ …")
	await runCommand("npm", ["run", "build"], {
		env: { ...process.env, ASTRO_BASE: "" },
	})

	console.log("\n[offline] Preparing dist-offline/ …")
	await ensureCleanDirectory(OFFLINE_DIRECTORY)
	await copyDirectory(DIST_DIRECTORY, OFFLINE_DIRECTORY)

	console.log("\n[offline] Rewriting paths for file:// …")
	const files = await listFiles(OFFLINE_DIRECTORY)
	const htmlFiles = files.filter((file) => file.endsWith(".html"))
	const cssFiles = files.filter((file) => file.endsWith(".css"))

	for (const file of htmlFiles) {
		await rewriteHtml(file)
	}
	for (const file of cssFiles) {
		await rewriteCss(file)
	}

	console.log("\n[offline] Creating ZIP …")
	const outputZip = await getOutputZipPath()
	await filesystem.rm(outputZip, { force: true })
	await runCommand("zip", ["-r", outputZip, "."], { cwd: OFFLINE_DIRECTORY })

	console.log(`\n[offline] Done: ${outputZip}`)
	console.log("[offline] Tipp: ZIP entpacken und index.html per Doppelklick öffnen.")
}

await main()
