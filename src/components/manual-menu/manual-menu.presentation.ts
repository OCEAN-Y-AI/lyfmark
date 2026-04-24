import type { MenuTextTone } from "~/components/manual-menu/manual-menu.types"

/**
 * Maps semantic text tones to CSS modifier classes.
 */
export const toMenuToneClass = (tone: MenuTextTone): string => {
	if (tone === "emphasized") {
		return "manual-menu__text--emphasized"
	}
	if (tone === "muted") {
		return "manual-menu__text--muted"
	}
	return ""
}
