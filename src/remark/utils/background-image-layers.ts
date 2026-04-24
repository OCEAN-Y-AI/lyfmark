import type { VFile } from "vfile"
import type { AttributeValidator, AttributeValidators, ContainerDirectiveNode, DirectiveContentNode, NodeAttributes } from "../types"
import { choiceAttribute, cssSizeAttribute, defineAttributes, inlineStyleAttribute, numberAttribute, textAttribute, urlAttribute } from "./attributes"
import { createHtmlNode } from "./nodes"
import { buildStyleAttribute } from "./style"
import { escapeHtml } from "./text"

export type BackgroundImagePosition = "center" | "left" | "right" | "fill" | "contain"
export type BackgroundImageFit = "none" | "contain" | "cover" | "fill" | "scale-down"
export type BackgroundImageFlip = "none" | "horizontal" | "vertical" | "both"
type ConstraintVariant = "module" | "viewport" | "viewport-x"

export interface BackgroundImageAttributes {
	readonly url: string
	readonly alt: string
	readonly position: BackgroundImagePosition
	readonly constraint: string
	readonly rotation: number
	readonly offsetX: string
	readonly offsetY: string
	readonly opacity: number
	readonly flip: BackgroundImageFlip
	readonly style: string
	readonly assetStyle: string
	readonly width: string
	readonly height: string
	readonly fit: BackgroundImageFit
}

interface ResolvedConstraint {
	readonly variant: ConstraintVariant
	readonly targetLayer: string
}

interface ParsedBackgroundImageDecorator {
	readonly targetLayer: string
	readonly layerNodes: DirectiveContentNode[]
}

export interface BackgroundImageLayerPlan {
	readonly contentNodes: DirectiveContentNode[]
	readonly hasDecorators: boolean
	readonly renderLayerNodes: (layer: string) => DirectiveContentNode[]
}

const CONSTRAINT_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u

export const backgroundImageLayerValidators = defineAttributes({
	url: urlAttribute({ required: true }),
	alt: textAttribute(),
	position: choiceAttribute<BackgroundImagePosition>({
		choices: ["center", "left", "right", "fill", "contain"],
		defaultValue: "center",
	}),
	constraint: textAttribute({ defaultValue: "auto" }),
	rotation: numberAttribute({ defaultValue: 0, integer: false }),
	"offset-x": cssSizeAttribute(),
	"offset-y": cssSizeAttribute(),
	opacity: numberAttribute({ defaultValue: 1, min: 0, max: 1, integer: false }),
	flip: choiceAttribute<BackgroundImageFlip>({
		choices: ["none", "horizontal", "vertical", "both"],
		defaultValue: "none",
	}),
	style: inlineStyleAttribute(),
	"asset-style": inlineStyleAttribute(),
	width: cssSizeAttribute(),
	height: cssSizeAttribute(),
	fit: choiceAttribute<BackgroundImageFit>({
		choices: ["none", "contain", "cover", "fill", "scale-down"],
		defaultValue: "contain",
	}),
})

const validateDirectiveAttributes = (
	attributeValidators: AttributeValidators,
	node: ContainerDirectiveNode,
	file: VFile,
): NodeAttributes => {
	const providedAttributes = node.attributes ?? {}
	for (const key of Object.keys(providedAttributes)) {
		if (!(key in attributeValidators)) {
			file.fail(`Unbekanntes Attribut: ${key}`, node)
		}
	}
	const validated: NodeAttributes = {}
	for (const [key, validator] of Object.entries(attributeValidators)) {
		const attributeValidator: AttributeValidator = validator
		try {
			validated[key] = attributeValidator(providedAttributes[key])
		} catch (error: unknown) {
			if (typeof error === "string") {
				file.fail(error, node)
			}
			throw error
		}
	}
	return validated
}

const normalizeConstraint = (value: string, file: VFile, node: ContainerDirectiveNode): string => {
	const trimmed = value.trim()
	const normalized = trimmed.length > 0 ? trimmed : "auto"
	if (!CONSTRAINT_NAME_PATTERN.test(normalized)) {
		file.fail(
			`Ungültiger Wert für "constraint": "${normalized}". Erlaubt sind Kleinbuchstaben, Zahlen und Bindestriche.`,
			node,
		)
	}
	return normalized
}

const resolveConstraint = (
	constraint: string,
	moduleName: string,
	availableLayers: readonly string[],
	file: VFile,
	node: ContainerDirectiveNode,
): ResolvedConstraint => {
	if (constraint === "viewport") {
		return { variant: "viewport", targetLayer: "auto" }
	}
	if (constraint === "viewport-x") {
		return { variant: "viewport-x", targetLayer: "auto" }
	}
	if (availableLayers.includes(constraint)) {
		return { variant: "module", targetLayer: constraint }
	}
	file.fail(
		`"${moduleName}" bietet keinen Background-Layer "${constraint}" an. Verfügbare Layer: ${availableLayers.join(", ")}. ` +
			`Sonderwerte: viewport, viewport-x.`,
		node,
	)
}

const mapAttributes = (attributes: NodeAttributes, file: VFile, node: ContainerDirectiveNode): BackgroundImageAttributes => {
	const normalizedConstraint = normalizeConstraint((attributes["constraint"] as string) ?? "auto", file, node)
	return {
		url: (attributes["url"] as string) ?? "",
		alt: (attributes["alt"] as string) ?? "",
		position: attributes["position"] as BackgroundImagePosition,
		constraint: normalizedConstraint,
		rotation: attributes["rotation"] as number,
		offsetX: (attributes["offset-x"] as string) ?? "",
		offsetY: (attributes["offset-y"] as string) ?? "",
		opacity: attributes["opacity"] as number,
		flip: attributes["flip"] as BackgroundImageFlip,
		style: (attributes["style"] as string) ?? "",
		assetStyle: (attributes["asset-style"] as string) ?? "",
		width: (attributes["width"] as string) ?? "",
		height: (attributes["height"] as string) ?? "",
		fit: attributes["fit"] as BackgroundImageFit,
	}
}

const buildLayerStyleAttribute = (attributes: BackgroundImageAttributes): string => {
	const declarations: string[] = [
		`--background-image-rotation:${attributes.rotation}deg`,
		`--background-image-fit:${attributes.fit}`,
		`--background-image-opacity:${attributes.opacity}`,
	]
	const flipX = attributes.flip === "horizontal" || attributes.flip === "both" ? "-1" : "1"
	const flipY = attributes.flip === "vertical" || attributes.flip === "both" ? "-1" : "1"
	declarations.push(`--background-image-flip-x:${flipX}`)
	declarations.push(`--background-image-flip-y:${flipY}`)
	if (attributes.offsetX.length > 0) {
		declarations.push(`--background-image-offset-x:${attributes.offsetX}`)
	}
	if (attributes.offsetY.length > 0) {
		declarations.push(`--background-image-offset-y:${attributes.offsetY}`)
	}
	return buildStyleAttribute(declarations, attributes.style)
}

const buildAssetStyleAttribute = (attributes: BackgroundImageAttributes): string => {
	const declarations: string[] = []
	if (attributes.width.length > 0) {
		declarations.push(`width:${attributes.width}`)
	}
	if (attributes.height.length > 0) {
		declarations.push(`height:${attributes.height}`)
	}
	return buildStyleAttribute(declarations, attributes.assetStyle)
}

const toLayerNodes = (
	attributes: BackgroundImageAttributes,
	constraint: ResolvedConstraint,
): DirectiveContentNode[] => {
	const classes = [
		"background-image-layer",
		`background-image-layer--constraint-${constraint.variant}`,
		`background-image-layer--position-${attributes.position}`,
	]
	const layerStyleAttribute = buildLayerStyleAttribute(attributes)
	const assetStyleAttribute = buildAssetStyleAttribute(attributes)
	return [
		createHtmlNode(`<div class="${classes.join(" ")}" aria-hidden="true"${layerStyleAttribute}>`),
		createHtmlNode(`<div class="background-image-layer__frame">`),
		createHtmlNode(
			`<img src="${escapeHtml(attributes.url)}" alt="${escapeHtml(attributes.alt)}" decoding="async" loading="lazy" class="background-image-layer__asset" draggable="false"${assetStyleAttribute} />`,
		),
		createHtmlNode(`</div>`),
		createHtmlNode(`</div>`),
	]
}

const parseBackgroundImageDirective = (
	node: ContainerDirectiveNode,
	moduleName: string,
	availableLayers: readonly string[],
	file: VFile,
): ParsedBackgroundImageDecorator => {
	const validatedAttributes = validateDirectiveAttributes(backgroundImageLayerValidators, node, file)
	const attributes = mapAttributes(validatedAttributes, file, node)
	const resolvedConstraint = resolveConstraint(attributes.constraint, moduleName, availableLayers, file, node)
	return {
		targetLayer: resolvedConstraint.targetLayer,
		layerNodes: toLayerNodes(attributes, resolvedConstraint),
	}
}

interface ConsumedDecorators {
	readonly contentNodes: DirectiveContentNode[]
	readonly decorators: ParsedBackgroundImageDecorator[]
}

const consumeBackgroundImageNodes = (
	nodes: readonly DirectiveContentNode[],
	moduleName: string,
	availableLayers: readonly string[],
	file: VFile,
): ConsumedDecorators => {
	const contentNodes: DirectiveContentNode[] = []
	const decorators: ParsedBackgroundImageDecorator[] = []

	nodes.forEach((node) => {
		if (node.type === "containerDirective" && node.name === "background-image") {
			const parsed = parseBackgroundImageDirective(node, moduleName, availableLayers, file)
			decorators.push(parsed)
			const nested = consumeBackgroundImageNodes(node.children, moduleName, availableLayers, file)
			decorators.push(...nested.decorators)
			contentNodes.push(...nested.contentNodes)
			return
		}
		contentNodes.push(node)
	})

	return { contentNodes, decorators }
}

export const resolveBackgroundImageLayerPlan = (
	nodes: readonly DirectiveContentNode[],
	moduleName: string,
	availableLayers: readonly string[],
	file: VFile,
): BackgroundImageLayerPlan => {
	if (!availableLayers.includes("auto")) {
		throw new Error(`Module "${moduleName}" muss mindestens den Layer "auto" definieren.`)
	}

	const consumed = consumeBackgroundImageNodes(nodes, moduleName, availableLayers, file)
	const layerMap = new Map<string, DirectiveContentNode[]>()
	consumed.decorators.forEach((decorator) => {
		const existingLayerNodes = layerMap.get(decorator.targetLayer) ?? []
		existingLayerNodes.push(...decorator.layerNodes)
		layerMap.set(decorator.targetLayer, existingLayerNodes)
	})

	return {
		contentNodes: consumed.contentNodes,
		hasDecorators: consumed.decorators.length > 0,
		renderLayerNodes: (layer) => {
			const layerNodes = layerMap.get(layer)
			return layerNodes ? [...layerNodes] : []
		},
	}
}

export const validateBackgroundImageLayerAttributes = (
	attributes: NodeAttributes,
	file: VFile,
	node: ContainerDirectiveNode,
): BackgroundImageAttributes => {
	const mapped = mapAttributes(attributes, file, node)
	return mapped
}

export const resolveStandaloneBackgroundImageConstraint = (
	constraint: string,
	moduleName: string,
	availableLayers: readonly string[],
	file: VFile,
	node: ContainerDirectiveNode,
): string => {
	return resolveConstraint(constraint, moduleName, availableLayers, file, node).targetLayer
}

export const renderBackgroundImageLayerNodes = (
	attributes: BackgroundImageAttributes,
	constraint: string,
): DirectiveContentNode[] => {
	const variant: ConstraintVariant = constraint === "viewport" ? "viewport" : constraint === "viewport-x" ? "viewport-x" : "module"
	const resolved: ResolvedConstraint = {
		variant,
		targetLayer: variant === "module" ? constraint : "auto",
	}
	return toLayerNodes(attributes, resolved)
}
