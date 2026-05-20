import { createRequire } from "module";
import prettier from "prettier";
import prettierPluginXQuery from "prettier-plugin-xquery";

const require = createRequire(import.meta.url);
const vscode = require("vscode");
const { LanguageClient } = require("vscode-languageclient/node.js");

let client;

export function activate(context) {
	const serverScript = require.resolve("xq-lsp/dist/server.js");

	client = new LanguageClient(
		"xquery-lsp",
		"XQuery Language Server",
		{ command: "node", args: [serverScript, "--stdio"] },
		{ documentSelector: [{ scheme: "file", language: "xquery" }] },
	);

	client.start();

	const formatter = vscode.languages.registerDocumentFormattingEditProvider(
		{ language: "xquery" },
		{
			async provideDocumentFormattingEdits(document) {
				const text = document.getText();
				let formatted;
				try {
					formatted = await prettier.format(text, {
						parser: "xquery",
						plugins: [prettierPluginXQuery],
					});
				} catch {
					return [];
				}
				const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(text.length));
				return [vscode.TextEdit.replace(fullRange, formatted)];
			},
		},
	);

	context.subscriptions.push(formatter);
}

export function deactivate() {
	return client?.stop();
}
