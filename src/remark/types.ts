import type { RootContent } from "mdast"
import type { VFile } from "vfile"

export type NodeAttributes = Record<string, unknown>

/**
 * DirectiveContentNode beschreibt Inhalte, die während des Remark-Transforms sowohl reguläre MDAST-Knoten
 * als auch noch nicht gerenderte Container-Direktiven enthalten dürfen.
 */
export type DirectiveContentNode = RootContent | ContainerDirectiveNode

export interface DirectiveNode {
	type: "textDirective" | "leafDirective" | "containerDirective"
	name?: string
	attributes?: NodeAttributes
	children?: DirectiveContentNode[]
	data?: Record<string, unknown>
}

export interface ContainerDirectiveNode extends DirectiveNode {
	type: "containerDirective"
	name: string
	children: DirectiveContentNode[]
}

export interface DirectiveRendererContext {
	node: ContainerDirectiveNode
	file: VFile
}

export type DirectiveRenderer = (context: DirectiveRendererContext) => DirectiveContentNode[]

export interface DirectiveModule {
	name: string
	render: DirectiveRenderer
	selfClosing?: boolean
}

export type FailOnNode = (reason: string) => never
export type AttributeValidator<R = unknown> = (val: unknown) => R | null
export type AttributeValidators = Record<string, AttributeValidator>
export type ContentProcessor = (attributes: NodeAttributes, context: DirectiveRendererContext) => DirectiveContentNode[]
