import type { RootContent } from "mdast"
import { createHtmlNode } from "./nodes"
import { escapeHtml } from "./text"

export type FormFieldType = "text" | "textarea" | "email" | "tel" | "select" | "file" | "date" | "datetime" | "url"

export interface FormFieldDefinition {
	readonly id: string
	readonly label: string
	readonly type: FormFieldType
	readonly placeholder?: string
	readonly required?: boolean
	readonly options?: readonly string[]
	readonly fullRow?: boolean
}

const renderField = (field: FormFieldDefinition): string => {
	const label = `<label class="contact-form-module__label" for="${escapeHtml(field.id)}">${escapeHtml(field.label)}${field.required ? " *" : ""}</label>`
	const commonAttributes = `id="${escapeHtml(field.id)}" name="${escapeHtml(field.id)}"${field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : ""}${field.required ? " required" : ""}`

	switch (field.type) {
		case "textarea":
			return `${label}<textarea class="contact-form-module__input contact-form-module__input--textarea" ${commonAttributes}></textarea>`
		case "select":
			return `${label}<select class="contact-form-module__input" ${commonAttributes}>${(field.options ?? []).map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("")}</select>`
		case "file":
			return `${label}<input type="file" class="contact-form-module__input" ${commonAttributes} />`
		default:
			return `${label}<input type="${escapeHtml(field.type)}" class="contact-form-module__input" ${commonAttributes} />`
	}
}

export const renderForm = (fields: readonly FormFieldDefinition[], submitLabel: string): RootContent[] => {
	const fieldMarkup = fields
		.map((field) => {
			const classes = field.fullRow ? "full-row" : ""
			return `<div class="contact-form-module__field ${classes}">${renderField(field)}</div>`
		})
		.join("")

	const formMarkup = `<form class="contact-form-module__form" method="post">${fieldMarkup}<div class="contact-form-module__actions"><button type="submit" class="contact-form-module__submit">${escapeHtml(submitLabel)}</button></div></form>`
	return [createHtmlNode(formMarkup)]
}
