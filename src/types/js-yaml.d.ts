declare module "js-yaml" {
	export interface LoadOptions {
		readonly json?: boolean
	}

	export function load(input: string, options?: LoadOptions): unknown
}
