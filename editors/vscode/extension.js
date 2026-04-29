'use strict';

const path = require('path');
const { LanguageClient } = require('vscode-languageclient/node');

let client;

function activate(context) {
  const serverScript = path.join(context.extensionPath, '..', '..', 'src', 'server.ts');

  client = new LanguageClient(
    'xquery-lsp',
    'XQuery Language Server',
    {
      command: 'node',
      args: [serverScript, '--stdio'],
    },
    {
      documentSelector: [{ scheme: 'file', language: 'xquery' }],
    }
  );

  client.start();
}

function deactivate() {
  return client?.stop();
}

module.exports = { activate, deactivate };
