import type { Heading, ThematicBreak } from "mdast"
import type { DirectiveContentNode } from "../types"
import { collectPlainText } from "./content"

export interface HeadingGroup {
	readonly title: string
	readonly nodes: DirectiveContentNode[]
}

const isHeading = (node: DirectiveContentNode): node is Heading => node.type === "heading"
const isThematicBreak = (node: DirectiveContentNode): node is ThematicBreak => node.type === "thematicBreak"

export interface HeadingSplitResult {
	readonly leading: DirectiveContentNode[]
	readonly groups: HeadingGroup[]
}

export const splitByHeading = (nodes: DirectiveContentNode[], depth = 3): HeadingSplitResult => {
	const groups: HeadingGroup[] = []
	const leading: DirectiveContentNode[] = []
	let current: HeadingGroup | null = null

	for (const node of nodes) {
		if (isHeading(node) && node.depth === depth) {
			current = {
				title: collectPlainText(node.children),
				nodes: [],
			}
			groups.push(current)
			continue
		}

		if (current) {
			current.nodes.push(node)
			continue
		}

		leading.push(node)
	}

	return { leading, groups }
}

export const partitionByThematicBreak = (nodes: DirectiveContentNode[]): DirectiveContentNode[][] => {
	const sections: DirectiveContentNode[][] = []
	let current: DirectiveContentNode[] = []

	nodes.forEach((node) => {
		if (isThematicBreak(node)) {
			sections.push(current)
			current = []
			return
		}
		current.push(node)
	})

	sections.push(current)
	return sections
}
