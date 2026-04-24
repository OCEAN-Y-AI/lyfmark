import { existsSync } from "node:fs"
import path from "node:path"

const WINDOWS_COMMAND_SCRIPT_EXECUTABLES = new Set(["npm"])

/**
 * Builds a process environment for child processes with a deterministic Windows PATH.
 *
 * Node only forwards one case variant of PATH on Windows. Combining variants avoids stale PATH/Path mismatches.
 */
export const createSpawnEnv = ({ platform = process.platform, env = process.env } = {}) => {
	if (platform !== "win32") {
		return env
	}

	const normalizedEnv = {}
	for (const [key, value] of Object.entries(env)) {
		if (key.toLowerCase() !== "path") {
			normalizedEnv[key] = value
		}
	}

	const pathValue = collectWindowsPathSegments(env).join(path.win32.delimiter)
	if (pathValue.length > 0) {
		normalizedEnv.PATH = pathValue
	}

	return normalizedEnv
}

/**
 * Resolves a command to spawn parameters that are safe for the current OS.
 *
 * npm is special on Windows: prefer the npm CLI script beside the active node.exe and fall back to an absolute npm.cmd.
 */
export const resolveCommandInvocation = (
	command,
	args,
	{ platform = process.platform, env = process.env, execPath = process.execPath, fileExists = existsSync } = {},
) => {
	if (platform === "win32" && WINDOWS_COMMAND_SCRIPT_EXECUTABLES.has(command)) {
		return resolveWindowsCommandScriptInvocation(command, args, { env, execPath, fileExists })
	}

	return {
		executable: command,
		args,
	}
}

/**
 * Returns PATH segments from all Windows PATH case variants, preferring PowerShell's canonical Path value.
 */
export const collectWindowsPathSegments = (env = process.env) => {
	const pathValues = Object.entries(env)
		.filter(([key, value]) => key.toLowerCase() === "path" && typeof value === "string" && value.length > 0)
		.sort(([leftKey], [rightKey]) => getWindowsPathKeyPriority(leftKey) - getWindowsPathKeyPriority(rightKey))
		.map(([, value]) => value)

	const seenSegments = new Set()
	const segments = []
	for (const value of pathValues) {
		for (const segment of value.split(path.win32.delimiter)) {
			const trimmedSegment = segment.trim()
			if (trimmedSegment.length === 0) {
				continue
			}
			const normalizedSegment = trimmedSegment.toLowerCase()
			if (seenSegments.has(normalizedSegment)) {
				continue
			}
			seenSegments.add(normalizedSegment)
			segments.push(trimmedSegment)
		}
	}
	return segments
}

const getWindowsPathKeyPriority = (key) => {
	if (key === "Path") {
		return 0
	}
	if (key === "PATH") {
		return 1
	}
	return 2
}

const resolveWindowsCommandScriptInvocation = (command, args, options) => {
	if (command === "npm") {
		const npmCliPath = resolveWindowsNpmCliPath(options)
		if (npmCliPath.length > 0) {
			return {
				executable: options.execPath,
				args: [npmCliPath, ...args],
			}
		}
	}

	const commandScriptPath = resolveWindowsCommandScriptPath(command, options)
	if (commandScriptPath.length > 0) {
		return {
			executable: "cmd.exe",
			args: ["/d", "/c", buildWindowsCmdCommandLine(commandScriptPath, args)],
		}
	}

	const error = new Error(
		`${command}.cmd was not found near node.exe or on PATH. Restart Windows or reinstall Node.js LTS.`,
	)
	error.code = "COMMAND_NOT_FOUND"
	throw error
}

const resolveWindowsNpmCliPath = ({ env, execPath, fileExists }) => {
	const npmExecPath = typeof env.npm_execpath === "string" ? env.npm_execpath : ""
	const candidates = [
		npmExecPath,
		path.win32.join(path.win32.dirname(execPath), "node_modules", "npm", "bin", "npm-cli.js"),
		...collectWindowsPathSegments(env).map((segment) =>
			path.win32.join(segment, "node_modules", "npm", "bin", "npm-cli.js"),
		),
	]

	return findExistingPath(candidates, fileExists)
}

const resolveWindowsCommandScriptPath = (command, { env, execPath, fileExists }) => {
	const candidates = [
		path.win32.join(path.win32.dirname(execPath), `${command}.cmd`),
		...collectWindowsPathSegments(env).map((segment) => path.win32.join(segment, `${command}.cmd`)),
	]

	return findExistingPath(candidates, fileExists)
}

const findExistingPath = (candidates, fileExists) => {
	for (const candidate of candidates) {
		if (typeof candidate !== "string" || candidate.trim().length === 0) {
			continue
		}
		if (fileExists(candidate)) {
			return candidate
		}
	}
	return ""
}

const buildWindowsCmdCommandLine = (commandScriptPath, args) =>
	[quoteWindowsCmdArgument(commandScriptPath), ...args.map(quoteWindowsCmdArgument)].join(" ")

const quoteWindowsCmdArgument = (value) => {
	const text = String(value)
	if (/^[A-Za-z0-9_./:=+\-]+$/u.test(text)) {
		return text
	}
	return `"${text.replace(/"/gu, '""')}"`
}
