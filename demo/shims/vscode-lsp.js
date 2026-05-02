// Inline the LSP protocol constants used by completion.ts so the bundle
// has no dependency on the vscode-languageserver Node.js package.
export const CompletionItemKind = { Function: 3, Variable: 6 };
export const InsertTextFormat   = { PlainText: 1, Snippet: 2 };
export const MarkupKind         = { Markdown: 'markdown', PlainText: 'plaintext' };
