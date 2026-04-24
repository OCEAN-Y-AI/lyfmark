const path = require("node:path")

module.exports = {
	plugins: [path.join(__dirname, "tools", "lyfmark-prettier-plugin.mjs")],
	overrides: [
		{
			files: "**/*.md",
			options: {
				parser: "lyfmark-markdown",
			},
		},
	],
}
