export type MenuTextTone = "default" | "emphasized" | "muted"

export interface MenuLink {
	readonly label: string
	readonly href: string
	readonly line: number
	readonly tone: MenuTextTone
}

export interface ManualMenuAdvertiseContent {
	readonly line: number
	readonly markdown: string
	readonly html: string
}

export interface ManualMenuSectionContent {
	readonly line: number
	readonly markdown: string
	readonly html: string
}

export interface ManualMenuNode {
	readonly type: "item"
	readonly label: string
	readonly href?: string
	readonly tone: MenuTextTone
	readonly depth: number
	readonly line: number
	readonly sections: readonly ManualMenuNode[]
	readonly links: readonly MenuLink[]
	readonly button?: MenuLink
	readonly content?: ManualMenuSectionContent
	readonly advertise?: ManualMenuAdvertiseContent
}

export interface ManualMenuSeparator {
	readonly type: "separator"
	readonly line: number
}

export type ManualMenuEntry = ManualMenuNode | ManualMenuSeparator

export interface ManualMenuTemplate {
	readonly sourcePath: string
	readonly sourceRelativePath: string
	readonly items: readonly ManualMenuEntry[]
}

export interface LoadManualMenuOptions {
	readonly pathnameWithoutBase: string
	readonly knownInternalPaths: ReadonlySet<string>
}
