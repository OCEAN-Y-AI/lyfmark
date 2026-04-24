import type { DirectiveModule } from "../../remark/types"
import { createInlineContentBlockModule } from "../modules/content-block/module"
import { contentBlockExists } from "../../remark/utils/content-blocks"
import { builtInDirectiveModules } from "./directive-modules"

const registry = new Map<string, DirectiveModule>(builtInDirectiveModules.map((module) => [module.name, module]))

export const getDirectiveModule = (name: string): DirectiveModule | undefined => {
	const known = registry.get(name)
	if (known) {
		if (contentBlockExists(name)) {
			return {
				name,
				selfClosing: known.selfClosing,
				render: (context) => {
					context.file.fail(
						`Content-Block "${name}" kollidiert mit dem eingebauten Modul "${name}". ` +
							`Benenne die Datei in "content-blocks/${name}.md" um oder verwende einen anderen Blocknamen.`,
						context.node,
					)
					return []
				},
			}
		}
		return known
	}
	if (contentBlockExists(name)) {
		return createInlineContentBlockModule(name)
	}
	return undefined
}

export const getKnownDirectiveNames = (): string[] =>
	builtInDirectiveModules.map((module) => module.name).sort()
