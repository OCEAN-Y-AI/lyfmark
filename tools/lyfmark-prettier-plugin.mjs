/**
 * Compatibility entry point for existing Prettier config paths.
 * Re-exports the modular LyfMark plugin implementation.
 */
export * from "./lyfmark-prettier/prettier-plugin.mjs"
import plugin from "./lyfmark-prettier/prettier-plugin.mjs"

export default plugin
