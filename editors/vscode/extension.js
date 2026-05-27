const path = require('path');
const prettier = require('prettier');
const prettierPluginXQuery = require('prettier-plugin-xquery');
const vscode = require('vscode');
const { LanguageClient } = require('vscode-languageclient/node.js');

let client;

function activate(context) {
	const serverScript = path.join(__dirname, 'server.js');

	client = new LanguageClient(
		'xquery-lsp',
		'XQuery Language Server',
		{ command: 'node', args: [serverScript, '--stdio'] },
		{ documentSelector: [{ scheme: 'file', language: 'xquery' }] },
	);

	client.start();

	const formatter = vscode.languages.registerDocumentFormattingEditProvider(
		{ language: 'xquery' },
		{
			async provideDocumentFormattingEdits(document) {
				const text = document.getText();
				let formatted;
				try {
					formatted = await prettier.format(text, {
						parser: 'xquery',
						plugins: [prettierPluginXQuery],
					});
				} catch {
					return [];
				}
				const fullRange = new vscode.Range(
					document.positionAt(0),
					document.positionAt(text.length),
				);
				return [vscode.TextEdit.replace(fullRange, formatted)];
			},
		},
	);

	context.subscriptions.push(formatter);
}

function deactivate() {
	return client?.stop();
}

module.exports = { activate, deactivate };
