const vscode = require('vscode');
const assert = require('assert');

exports.run = async function () {
	const ext = vscode.extensions.getExtension('elliat.xquery-lsp-vscode');
	assert.ok(ext, 'extension not found — check publisher + name in package.json');

	await ext.activate();
	assert.ok(ext.isActive, 'extension failed to activate');
};
