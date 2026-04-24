import path from "node:path"
import process from "node:process"
import { spawn } from "node:child_process"

const PROJECT_ROOT = process.cwd()
const RENDER_SCRIPT = path.resolve(PROJECT_ROOT, "tools/browser-render.mjs")

const DEFAULT_OPTIONS = {
	route: "/",
	selector: ".background-wave-module",
	selectorPad: "80",
	outDir: "tmp/browser-shots/wave-matrix",
	namePrefix: "wave",
	build: true,
}

const MATRIX = [
	{ id: "fhd", width: 1920, height: 1080, dpr: 1 },
	{ id: "qhd", width: 2560, height: 1440, dpr: 1 },
	{ id: "ultrawide", width: 3440, height: 1440, dpr: 1 },
	{ id: "superwide-low", width: 3784, height: 1024, dpr: 1 },
	{ id: "four-three", width: 1280, height: 1024, dpr: 1 },
	{ id: "surface", width: 828, height: 1133, dpr: 2.25 },
	{ id: "mobile", width: 390, height: 844, dpr: 3 },
]

const parseArgs = (argv) => {
	const options = { ...DEFAULT_OPTIONS }

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
					options.selectorPad = nextValue
					if (consumeNext) {
						index += 1
					}
				}
				break
			case "out-dir":
				if (nextValue) {
					options.outDir = nextValue
					if (consumeNext) {
						index += 1
					}
				}
				break
			case "name-prefix":
				if (nextValue) {
					options.namePrefix = nextValue
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
			default:
				break
		}
	}

	return options
}

const runRenderShot = async (args) => {
	await new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [RENDER_SCRIPT, ...args], {
			cwd: PROJECT_ROOT,
			stdio: "inherit",
		})
		child.on("exit", (code) => {
			if (code === 0) {
				resolve(undefined)
				return
			}
			reject(new Error(`browser-render failed with exit code ${code ?? "unknown"}`))
		})
		child.on("error", reject)
	})
}

const runRenderShotWithRetry = async (args, retries = 1) => {
	let lastError = null
	for (let attempt = 0; attempt <= retries; attempt += 1) {
		try {
			await runRenderShot(args)
			return
		} catch (error) {
			lastError = error
			if (attempt >= retries) {
				break
			}
			console.warn(`[render-wave-matrix] retrying preset (${attempt + 1}/${retries})`)
		}
	}
	throw lastError
}

const run = async () => {
	const options = parseArgs(process.argv)
	for (let index = 0; index < MATRIX.length; index += 1) {
		const preset = MATRIX[index]
		const baseArgs = [
			"--route",
			options.route,
			"--selector",
			options.selector,
			"--selector-pad",
			options.selectorPad,
			"--width",
			String(preset.width),
			"--height",
			String(preset.height),
			"--dpr",
			String(preset.dpr),
			"--out-dir",
			options.outDir,
			"--name",
			`${options.namePrefix}__${preset.id}`,
		]
		const shouldBuildThisRun = options.build && index === 0
		if (!shouldBuildThisRun) {
			baseArgs.push("--no-build")
		}
		await runRenderShotWithRetry(baseArgs, 1)
	}
}

run().catch((error) => {
	console.error("[render-wave-matrix] failed:", error instanceof Error ? error.message : error)
	process.exitCode = 1
})
