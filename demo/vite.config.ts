import { defineConfig } from "vite";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			// xq-parser is imported by ../src/analyzer.ts; Rollup resolves it
			// from src/'s ancestor chain and misses demo/node_modules.
			"xq-parser": resolve(__dirname, "node_modules/xq-parser"),
			// vscode-languageserver/node.js is imported by ../src/inlay-hints.ts for
			// the InlayHintKind enum; same ancestor-chain resolution gap as xq-parser.
			"vscode-languageserver/node.js": resolve(__dirname, "node_modules/vscode-languageserver/node.js"),
		},
	},
});
