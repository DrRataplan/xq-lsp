import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { LanguageClient } = require('vscode-languageclient/node.js');

let client;

export function activate(context) {
  const serverScript = require.resolve('xq-lsp/dist/server.js');

  client = new LanguageClient(
    'xquery-lsp',
    'XQuery Language Server',
    { command: 'node', args: [serverScript, '--stdio'] },
    { documentSelector: [{ scheme: 'file', language: 'xquery' }] },
  );

  client.start();
}

export function deactivate() {
  return client?.stop();
}
