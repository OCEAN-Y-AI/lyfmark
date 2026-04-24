import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import prettier from "prettier"
import { fileURLToPath, pathToFileURL } from "node:url"
import { formatLyfMarkMarkdown } from "./lyfmark-prettier-plugin.mjs"
import { createDirectivePolicyResolver } from "./lyfmark-prettier/directive-policies.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")

const normalize = (value) => value.replace(/\r\n?/gu, "\n")

const runUnitCases = () => {
	const rootSelfClosingBlockPath = path.join(repoRoot, "content-blocks", "kontakt.md")
	const temporaryNestedDirectory = path.join(repoRoot, "content-blocks", "tmp")
	const temporaryNestedSelfClosingBlockPath = path.join(temporaryNestedDirectory, "kontakt.md")
	const temporaryNestedChildrenBlockPath = path.join(temporaryNestedDirectory, "column.md")
	const liveUpdateBlockPath = path.join(repoRoot, "src", "content-blocks", "tmp-live-formatter.md")
	const markdownFilePath = path.join(repoRoot, "src/pages/index.md")
	const hadRootSelfClosingBlock = fs.existsSync(rootSelfClosingBlockPath)

	try {
		if (!hadRootSelfClosingBlock) {
			fs.writeFileSync(rootSelfClosingBlockPath, "Temporärer Formatter-Testblock ohne Variablen.\n", "utf8")
		}
		fs.mkdirSync(temporaryNestedDirectory, { recursive: true })
		fs.writeFileSync(temporaryNestedSelfClosingBlockPath, "Temporärer Block ohne Variablen.\n", "utf8")
		fs.writeFileSync(
			temporaryNestedChildrenBlockPath,
			["---", "title: Titel der Spalte", "children: Inhalt der zweiten Spalte", "---", "", "## $title", "", "$children", ""].join("\n"),
			"utf8",
		)

		const cases = [
			{
				name: "nested modules and split separators use render-safe indentation",
				filepath: path.join(repoRoot, "src/pages/index.md"),
				input: [
				":::highlight-card",
				":::split",
				":::space size=\"2rem\"",
				"## H2 Überschrift",
				"",
				"Lorem Ipsum",
				"---",
				":::align x=\"right\"",
				"Text",
				":::",
				":::",
				":::",
				"",
			].join("\n"),
			expected: [
				":::highlight-card",
				"  :::split",
				"    :::space size=\"2rem\"",
				"",
				"    ## H2 Überschrift",
				"",
				"    Lorem Ipsum",
				"",
				"    ---",
				"",
				"    :::align x=\"right\"",
				"      Text",
				"    :::",
				"  :::",
				":::",
				"",
			].join("\n"),
		},
		{
			name: "nested non-split containers still indent inner modules for readability",
			filepath: path.join(repoRoot, "src/pages/index.md"),
			input: [
				":::background-color fill=\"var(--color-dark-accent)\" color=\"dark\"",
				":::tabs color=\"dark\"",
				"### Übersicht 1",
				":::background-image url=\"/img/wave.svg\"",
				":::space size=\"2rem\"",
				":::page-teaser from=\"insight\" display=\"cards\"",
				":::",
				":::",
				":::",
				":::",
				"",
			].join("\n"),
			expected: [
				":::background-color fill=\"var(--color-dark-accent)\" color=\"dark\"",
				"  :::tabs color=\"dark\"",
				"    ### Übersicht 1",
				"",
				"    :::background-image url=\"/img/wave.svg\"",
				"      :::space size=\"2rem\"",
				"",
				"      :::page-teaser from=\"insight\" display=\"cards\"",
				"      :::",
				"    :::",
				"  :::",
				":::",
				"",
			].join("\n"),
		},
		{
			name: "self-closing rows do not increase depth",
			filepath: path.join(repoRoot, "src/pages/index.md"),
			input: [
				":::align x=\"right\"",
				":::link to=\"/kontakt\" text=\"A\"",
				":::link to=\"/kontakt\" text=\"B\"",
				"Text",
				":::",
				"",
			].join("\n"),
			expected: [
				":::align x=\"right\"",
				"  :::link to=\"/kontakt\" text=\"A\"",
				"  :::link to=\"/kontakt\" text=\"B\"",
				"",
				"  Text",
				":::",
				"",
			].join("\n"),
		},
			{
				name: "closing directives keep chained closures compact",
				filepath: path.join(repoRoot, "src/pages/index.md"),
				input: [":::highlight-card", "Text", ":::", ":::", ""].join("\n"),
				expected: [":::highlight-card", "  Text", ":::", ":::", ""].join("\n"),
			},
			{
				name: "consecutive link directives stay grouped without intermediate blank lines",
				filepath: path.join(repoRoot, "src/pages/index.md"),
				input: [":::link to=\"/kontakt\" text=\"A\"", ":::link to=\"/kontakt\" text=\"B\"", "Absatz", ""].join("\n"),
				expected: [":::link to=\"/kontakt\" text=\"A\"", ":::link to=\"/kontakt\" text=\"B\"", "", "Absatz", ""].join("\n"),
			},
			{
				name: "consecutive text-over-picture modules stay grouped without forced blank line",
				filepath: path.join(repoRoot, "src/pages/index.md"),
				input: [
					":::text-over-picture image=\"/img/a.jpg\" image-alt=\"A\"",
					"Text A",
					":::",
					":::text-over-picture image=\"/img/b.jpg\" image-alt=\"B\"",
					"Text B",
					":::",
					"Absatz",
					"",
				].join("\n"),
				expected: [
					":::text-over-picture image=\"/img/a.jpg\" image-alt=\"A\"",
					"  Text A",
					":::",
					":::text-over-picture image=\"/img/b.jpg\" image-alt=\"B\"",
					"  Text B",
					":::",
					"",
					"Absatz",
					"",
				].join("\n"),
			},
			{
				name: "optional image-alt fields and link titles stay untouched",
				filepath: path.join(repoRoot, "src/pages/index.md"),
				input: [
					":::picture-and-text image=\"/img/a.jpg\" image-width=\"320\" image-height=\"240\"",
					"Text A",
					":::",
					":::text-over-picture image=\"/img/b.jpg\"",
					"Text B",
					":::",
					":::quick-nav",
					"- [/img/people/team-member.jpg](/personen/ansprechperson \"Portrait Ansprechpartner\")",
					":::",
					"",
				].join("\n"),
				expected: [
					":::picture-and-text image=\"/img/a.jpg\" image-width=\"320\" image-height=\"240\"",
					"  Text A",
					":::",
					"",
					":::text-over-picture image=\"/img/b.jpg\"",
					"  Text B",
					":::",
					"",
					":::quick-nav",
					"  - [/img/people/team-member.jpg](/personen/ansprechperson \"Portrait Ansprechpartner\")",
					"",
					":::",
					"",
				].join("\n"),
			},
		{
			name: "blank line is inserted between list/blockquote and next module",
			filepath: path.join(repoRoot, "src/pages/index.md"),
			input: ["- Punkt A", ":::space size=\"2rem\"", "", "> Hinweis", ":::space size=\"1rem\"", ""].join("\n"),
			expected: [
				"- Punkt A",
				"",
				":::space size=\"2rem\"",
				"",
				"> Hinweis",
				"",
				":::space size=\"1rem\"",
				"",
			].join("\n"),
		},
		{
			name: "blank line is inserted between html line and following directive",
			filepath: path.join(repoRoot, "content-blocks/impressum-footer.md"),
			input: ["<div>Footer</div>", ":::split", "## A", "---", "## B", ":::", ""].join("\n"),
			expected: ["<div>Footer</div>", "", ":::split", "  ## A", "", "  ---", "", "  ## B", ":::", ""].join("\n"),
		},
			{
				name: "tab-indented page-teaser config lines are normalized to module depth indentation",
				filepath: path.join(repoRoot, "src/pages/personen/index.md"),
			input: [
				":::tabs color=\"light\"",
				"### digitale medien",
				":::page-teaser from=\"/personen\" display=\"revolver-caroussel\"",
				"\t- kompetenzen: Wurst",
				":::",
				":::",
				"",
			].join("\n"),
			expected: [
				":::tabs color=\"light\"",
				"  ### digitale medien",
				"",
				"  :::page-teaser from=\"/personen\" display=\"revolver-caroussel\"",
				"    - kompetenzen: Wurst",
				"",
				"  :::",
				":::",
					"",
				].join("\n"),
			},
			{
				name: "top-level markdown content is left-aligned without wrapper module",
				filepath: path.join(repoRoot, "src/pages/index.md"),
				input: ["  ## Überschrift", "    Einleitung", "", "  :::space size=\"2rem\"", ""].join("\n"),
				expected: ["## Überschrift", "Einleitung", "", ":::space size=\"2rem\"", ""].join("\n"),
			},
			{
				name: "fenced code blocks stay untouched",
				filepath: path.join(repoRoot, "src/pages/index.md"),
			input: [
				":::highlight-card",
				"```md",
				":::split",
				"---",
				":::",
				"```",
				":::",
				"",
			].join("\n"),
			expected: [
				":::highlight-card",
				"  ```md",
				":::split",
				"---",
				":::",
				"```",
				":::",
				"",
			].join("\n"),
		},
		{
			name: "content-block shortcuts are treated as self-closing",
			filepath: path.join(repoRoot, "src/pages/index.md"),
			input: [":::highlight-card", ":::kontakt", "Text", ":::", ""].join("\n"),
			expected: [":::highlight-card", "  :::kontakt", "", "  Text", ":::", ""].join("\n"),
		},
			{
				name: "nested content-block shortcuts are treated as self-closing",
				filepath: path.join(repoRoot, "src/pages/index.md"),
				input: [":::highlight-card", ":::tmp/kontakt", "Text", ":::", ""].join("\n"),
				expected: [":::highlight-card", "  :::tmp/kontakt", "", "  Text", ":::", ""].join("\n"),
			},
			{
				name: "content-block shortcuts with children declaration are treated as containers",
				filepath: path.join(repoRoot, "src/pages/index.md"),
				input: [":::highlight-card", ":::tmp/column title=\"Teamprofil\"", "Text", ":::", ":::", ""].join("\n"),
				expected: [
					":::highlight-card",
					"  :::tmp/column title=\"Teamprofil\"",
					"    Text",
					"  :::",
					":::",
				"",
			].join("\n"),
		},
		{
			name: "anchor directives are treated as self-closing",
			filepath: path.join(repoRoot, "src/pages/index.md"),
			input: [":::split", ":::anchor name=\"uebersicht\"", "## Inhalt", ":::", ""].join("\n"),
			expected: [":::split", "  :::anchor name=\"uebersicht\"", "", "  ## Inhalt", ":::", ""].join("\n"),
		},
		{
			name: "anchor swallows an immediate closing marker",
			filepath: path.join(repoRoot, "src/pages/index.md"),
			input: [":::highlight-card", ":::anchor name=\"uebersicht\"", ":::", "## Inhalt", ":::", ""].join("\n"),
			expected: [":::highlight-card", "  :::anchor name=\"uebersicht\"", "", "  ## Inhalt", ":::", ""].join("\n"),
		},
		{
			name: "blank line is inserted between plain text and following module",
			filepath: path.join(repoRoot, "src/pages/index.md"),
			input: ["Einleitungstext", ":::link to=\"/kontakt\" text=\"Kontakt\"", ""].join("\n"),
			expected: ["Einleitungstext", "", ":::link to=\"/kontakt\" text=\"Kontakt\"", ""].join("\n"),
		},
		{
			name: "blank line is inserted between heading and following module",
			filepath: path.join(repoRoot, "content-blocks/kontakt.md"),
			input: ["## Kontakt", ":::space size=\"2rem\"", ""].join("\n"),
			expected: ["## Kontakt", "", ":::space size=\"2rem\"", ""].join("\n"),
		},
		{
			name: "blank line is inserted between module text content and nested module",
			filepath: path.join(repoRoot, "src/pages/index.md"),
			input: [":::highlight-card", "Textblock", ":::link to=\"/kontakt\" text=\"Kontakt\"", ":::", ""].join("\n"),
			expected: [":::highlight-card", "  Textblock", "", "  :::link to=\"/kontakt\" text=\"Kontakt\"", "", ":::", ""].join("\n"),
		},
		]

		for (const testCase of cases) {
			const actual = formatLyfMarkMarkdown(testCase.input, { filepath: testCase.filepath })
			assert.equal(normalize(actual), normalize(testCase.expected), testCase.name)
		}

		if (fs.existsSync(liveUpdateBlockPath)) {
			fs.unlinkSync(liveUpdateBlockPath)
		}
		const beforeCreateResolver = createDirectivePolicyResolver({ filepath: markdownFilePath })
		assert.equal(beforeCreateResolver.isSelfClosingDirective("tmp-live-formatter"), false, "new content-block is unknown before file creation")

		fs.writeFileSync(liveUpdateBlockPath, "Temporärer Formatter-Testblock ohne Frontmatter.\n", "utf8")
		const afterCreateResolver = createDirectivePolicyResolver({ filepath: markdownFilePath })
		assert.equal(afterCreateResolver.isSelfClosingDirective("tmp-live-formatter"), true, "content-block cache must refresh immediately after file creation")
	} finally {
		if (!hadRootSelfClosingBlock && fs.existsSync(rootSelfClosingBlockPath)) {
			fs.unlinkSync(rootSelfClosingBlockPath)
		}
		if (fs.existsSync(liveUpdateBlockPath)) {
			fs.unlinkSync(liveUpdateBlockPath)
		}
		if (fs.existsSync(temporaryNestedChildrenBlockPath)) {
			fs.unlinkSync(temporaryNestedChildrenBlockPath)
		}
		if (fs.existsSync(temporaryNestedSelfClosingBlockPath)) {
			fs.unlinkSync(temporaryNestedSelfClosingBlockPath)
		}
		if (fs.existsSync(temporaryNestedDirectory)) {
			try {
				fs.rmdirSync(temporaryNestedDirectory)
			} catch {
				// Directory may contain user files; keep it untouched.
			}
		}
	}
}

const runPrettierIntegrationCase = async () => {
	const pluginPath = pathToFileURL(path.join(repoRoot, "tools", "lyfmark-prettier-plugin.mjs")).href
	const source = [":::highlight-card", ":::split", ":::space size=\"2rem\"", "## Überschrift", ":::", ":::", ""].join("\n")
	const formattedViaLyfParser = await prettier.format(source, {
		parser: "lyfmark-markdown",
		filepath: path.join(repoRoot, "src/pages/index.md"),
		plugins: [pluginPath],
	})
	assert.match(formattedViaLyfParser, /^:::highlight-card\n  :::split\n    :::space size="2rem"\n\n    ## Überschrift\n  :::\n:::\n/u)

	const formattedViaMarkdownParser = await prettier.format(source, {
		parser: "markdown",
		filepath: path.join(repoRoot, "src/pages/index.md"),
		plugins: [pluginPath],
	})
	assert.equal(
		normalize(formattedViaMarkdownParser),
		normalize(formattedViaLyfParser),
		'parser="markdown" must resolve to LyfMark formatting for VSCode parity',
	)
}

runUnitCases()
await runPrettierIntegrationCase()
console.log("LyfMark Prettier tests passed.")
