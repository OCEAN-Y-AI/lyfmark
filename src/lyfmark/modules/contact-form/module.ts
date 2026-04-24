import { ContentModule } from "../../../remark/content-module"
import type { ContentProcessor, DirectiveContentNode } from "../../../remark/types"
import { defineAttributes, inlineStyleAttribute, textAttribute } from "../../../remark/utils/attributes"
import { renderForm, type FormFieldDefinition } from "../../../remark/utils/forms"
import { createHtmlNode } from "../../../remark/utils/nodes"
import { escapeHtml } from "../../../remark/utils/text"
import { buildStyleAttribute } from "../../../remark/utils/style"
import { resolveBackgroundImageLayerPlan } from "../../../remark/utils/background-image-layers"

const contactFormValidators = defineAttributes({
	heading: textAttribute({ required: true }),
	subheading: textAttribute({ required: false, defaultValue: "" }),
	submit: textAttribute({ required: true, defaultValue: "Nachricht absenden" }),
	style: inlineStyleAttribute(),
})

const defaultFields: FormFieldDefinition[] = [
	{ id: "first-name", label: "Vorname", type: "text", required: true },
	{ id: "last-name", label: "Nachname", type: "text", required: true },
	{ id: "contact", label: "Telefonnummer / E-Mail", type: "text", required: true },
	{ id: "practice-area", label: "Rechtsgebiet", type: "select", options: ["Gesellschaftsrecht", "Technologie & Daten", "IP / IT", "Arbeitsrecht", "Weitere"], required: true },
	{ id: "timeslot", label: "Terminwunsch", type: "text", placeholder: "z. B. 12.03.2025 – 14:30 Uhr" },
	{ id: "attachment", label: "Unterlagen hochladen", type: "file" },
	{ id: "message", label: "Ihre Nachricht", type: "textarea", fullRow: true, required: true },
]

const contactFormProcessor: ContentProcessor = (attributes, context) => {
	const layerPlan = resolveBackgroundImageLayerPlan(context.node.children, "contact-form", ["auto"], context.file)
	const contentNodes = layerPlan.contentNodes
	const heading = attributes["heading"] as string
	const subheading = attributes["subheading"] as string
	const submitLabel = attributes["submit"] as string
	const nodes: DirectiveContentNode[] = []

	const inlineStyle = attributes["style"] as string
	const styleAttribute = buildStyleAttribute([], inlineStyle)

	nodes.push(createHtmlNode(`<section class="contact-form-module" data-bg-image-layer="auto"${styleAttribute}>`))
	nodes.push(...layerPlan.renderLayerNodes("auto"))
	nodes.push(createHtmlNode(`<header class="contact-form-module__header">`))
	nodes.push(createHtmlNode(`<h2>${escapeHtml(heading)}</h2>`))
	if (subheading.length > 0) {
		nodes.push(createHtmlNode(`<h1 class="contact-form-module__subtitle">${escapeHtml(subheading)}</h1>`))
	}
	nodes.push(createHtmlNode(`</header>`))

	if (contentNodes.length > 0) {
		nodes.push(createHtmlNode(`<div class="contact-form-module__intro">`))
		nodes.push(...contentNodes)
		nodes.push(createHtmlNode(`</div>`))
	}

	nodes.push(createHtmlNode(`<div class="contact-form-module__form-wrapper">`))
	nodes.push(...renderForm(defaultFields, submitLabel))
	nodes.push(createHtmlNode(`</div></section>`))
	return nodes
}

export const contactFormModule = ContentModule("contact-form", contactFormValidators, contactFormProcessor)
