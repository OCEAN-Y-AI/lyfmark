import { ContentModule } from "../../../remark/content-module"
import type { ContentProcessor } from "../../../remark/types"
import {
	choiceAttribute,
	cssSizeAttribute,
	defineAttributes,
	inlineStyleAttribute,
	numberAttribute,
	textAttribute,
	urlAttribute,
} from "../../../remark/utils/attributes"
import { collectAccessiblePlainText } from "../../../remark/utils/content"
import { createHtmlNode } from "../../../remark/utils/nodes"
import { buildStyleAttribute } from "../../../remark/utils/style"
import { escapeHtml } from "../../../remark/utils/text"

type BackgroundWavePosition = "center" | "left" | "right" | "fill" | "contain"
type BackgroundWaveFit = "none" | "contain" | "cover" | "fill" | "scale-down"
type BackgroundRelativeTo = "module" | "viewport" | "viewport-x" | "viewport-y"
type BackgroundFlip = "none" | "horizontal" | "vertical" | "both"
type BackgroundWaveAlgorithm = "rain" | "wave"

const backgroundWaveValidators = defineAttributes({
	url: urlAttribute({ defaultValue: "/img/lyfmark-wave.svg" }),
	alt: textAttribute(),
	position: choiceAttribute<BackgroundWavePosition>({
		choices: ["center", "left", "right", "fill", "contain"],
		defaultValue: "center",
	}),
	"relative-to": choiceAttribute<BackgroundRelativeTo>({
		choices: ["module", "viewport", "viewport-x", "viewport-y"],
		defaultValue: "module",
	}),
	rotation: numberAttribute({ defaultValue: 0, integer: false }),
	"offset-x": cssSizeAttribute(),
	"offset-y": cssSizeAttribute(),
	opacity: numberAttribute({ defaultValue: 1, min: 0, max: 1, integer: false }),
	flip: choiceAttribute<BackgroundFlip>({
		choices: ["none", "horizontal", "vertical", "both"],
		defaultValue: "none",
	}),
	style: inlineStyleAttribute(),
	"asset-style": inlineStyleAttribute(),
	width: cssSizeAttribute(),
	height: cssSizeAttribute(),
	fit: choiceAttribute<BackgroundWaveFit>({
		choices: ["none", "contain", "cover", "fill", "scale-down"],
		defaultValue: "none",
	}),
	algorithm: choiceAttribute<BackgroundWaveAlgorithm>({
		choices: ["rain", "wave"],
		defaultValue: "wave",
	}),
	frequency: numberAttribute({ defaultValue: 0.9, min: 0, max: 2, integer: false }),
	intensity: numberAttribute({ defaultValue: 0.8, min: 0, max: 2, integer: false }),
	scale: numberAttribute({ defaultValue: 1, min: 0.25, max: 3, integer: false }),
	zoom: numberAttribute({ defaultValue: 1, min: 0.1, max: 4, integer: false }),
})

const buildWrapperStyleAttribute = (
	rotation: number,
	fitOverride: BackgroundWaveFit | null,
	offsetX: string,
	offsetY: string,
	opacity: number,
	flip: BackgroundFlip,
	zoom: number,
	inlineStyle: string,
): string => {
	const declarations = [`--background-wave-rotation:${rotation}deg`, `--background-wave-opacity:${opacity}`, `--background-wave-zoom:${zoom}`]
	if (fitOverride !== null) {
		declarations.push(`--background-wave-fit:${fitOverride}`)
	}
	const flipX = flip === "horizontal" || flip === "both" ? "-1" : "1"
	const flipY = flip === "vertical" || flip === "both" ? "-1" : "1"
	declarations.push(`--background-wave-flip-x:${flipX}`)
	declarations.push(`--background-wave-flip-y:${flipY}`)
	if (offsetX.length > 0) {
		declarations.push(`--background-wave-offset-x:${offsetX}`)
	}
	if (offsetY.length > 0) {
		declarations.push(`--background-wave-offset-y:${offsetY}`)
	}
	return buildStyleAttribute(declarations, inlineStyle)
}

const buildAssetStyleAttribute = (width: string, height: string, inlineStyle: string): string => {
	const declarations: string[] = []
	if (width.length > 0) {
		declarations.push(`width:${width}`)
	}
	if (height.length > 0) {
		declarations.push(`height:${height}`)
	}
	return buildStyleAttribute(declarations, inlineStyle)
}

const backgroundWaveProcessor: ContentProcessor = (attributes, context) => {
	const { node, file } = context
	const contentNodes = node.children
	if (contentNodes.length === 0) {
		file.fail("Bitte füge Inhalte für das background-wave Modul hinzu.", node)
	}

	const labelText = collectAccessiblePlainText(contentNodes)
	const ariaLabel = labelText.length > 0 ? labelText : "Dekorierter Wellenbereich"
	const position = attributes["position"] as BackgroundWavePosition
	const relativeTo = attributes["relative-to"] as BackgroundRelativeTo
	const rotation = attributes["rotation"] as number
	const inlineStyle = attributes["style"] as string
	const assetInlineStyle = attributes["asset-style"] as string
	const waveImageUrl = attributes["url"] as string
	const waveImageAlt = attributes["alt"] as string
	const width = (attributes["width"] as string) ?? ""
	const offsetX = (attributes["offset-x"] as string) ?? ""
	const offsetY = (attributes["offset-y"] as string) ?? ""
	const opacity = attributes["opacity"] as number
	const flip = attributes["flip"] as BackgroundFlip
	const height = (attributes["height"] as string) ?? ""
	const fit = attributes["fit"] as BackgroundWaveFit
	const algorithm = attributes["algorithm"] as BackgroundWaveAlgorithm
	const frequency = attributes["frequency"] as number
	const intensity = attributes["intensity"] as number
	const scale = attributes["scale"] as number
	const zoom = attributes["zoom"] as number
	const hasExplicitFit = Object.prototype.hasOwnProperty.call(node.attributes ?? {}, "fit")

	const relativeClassMap: Record<BackgroundRelativeTo, string> = {
		module: "",
		viewport: " background-wave-module--relative-viewport",
		"viewport-x": " background-wave-module--relative-viewport-x",
		"viewport-y": " background-wave-module--relative-viewport-y",
	}
	const relativeClass = relativeClassMap[relativeTo]
	const wrapperClass = `background-wave-module background-wave-module--${position}${relativeClass}`
	const wrapperStyleAttribute = buildWrapperStyleAttribute(
		rotation,
		hasExplicitFit ? fit : null,
		offsetX,
		offsetY,
		opacity,
		flip,
		zoom,
		inlineStyle,
	)
	const assetStyleAttribute = buildAssetStyleAttribute(width, height, assetInlineStyle)

	return [
		createHtmlNode(
			`<section class="${wrapperClass}" aria-label="${escapeHtml(ariaLabel)}" data-background-wave data-wave-algorithm="${escapeHtml(algorithm)}" data-wave-frequency="${frequency}" data-wave-intensity="${intensity}" data-wave-scale="${scale}"${wrapperStyleAttribute}>`,
		),
		createHtmlNode(`<div class="background-wave-module__media" aria-hidden="true">`),
		createHtmlNode(
			`<img src="${escapeHtml(waveImageUrl)}" alt="${escapeHtml(waveImageAlt)}" decoding="async" loading="lazy" class="background-wave-module__asset" draggable="false"${assetStyleAttribute} />`,
		),
		createHtmlNode(
			`<canvas class="background-wave-module__canvas" aria-hidden="true" data-wave-canvas draggable="false"${assetStyleAttribute}></canvas>`,
		),
		createHtmlNode(`</div>`),
		createHtmlNode(`<div class="background-wave-module__inner">`),
		...contentNodes,
		createHtmlNode(`</div>`),
		createHtmlNode(`</section>`),
	]
}

/**
 * background-wave rendert eine dekorative Drahtgitter-Welle mit konfigurierbarer Wasseranimation.
 */
export const backgroundWaveModule = ContentModule("background-wave", backgroundWaveValidators, backgroundWaveProcessor)
