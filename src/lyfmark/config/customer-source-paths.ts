import { lstatSync } from "node:fs"
import { resolve } from "node:path"

type CustomerSourceKind = "content-blocks" | "forms"

const resolveDirectoryIfPresent = (candidatePath: string): string | null => {
	try {
		return lstatSync(candidatePath).isDirectory() ? candidatePath : null
	} catch {
		return null
	}
}

/**
 * Resolves the canonical customer-editable source directory.
 * Contract:
 * - Root directories (`content-blocks`, `forms`) are source of truth.
 * - `src/*` paths remain technical mirror fallback for compatibility.
 */
export const resolveCustomerSourceDirectory = (kind: CustomerSourceKind): string => {
	const rootDirectory = resolve(process.cwd(), kind)
	const mirrorDirectory = resolve(process.cwd(), "src", kind)

	return resolveDirectoryIfPresent(rootDirectory) ?? resolveDirectoryIfPresent(mirrorDirectory) ?? rootDirectory
}
