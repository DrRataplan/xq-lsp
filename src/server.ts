#!/usr/bin/env node
import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  TextDocumentSyncKind,
  DiagnosticSeverity,
} from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { XQuery31Full } from 'xq-parser';
import { analyze } from './analyzer.ts';
import { getBuiltins } from './builtins.ts';
import { getCompletions } from './completion.ts';
import { getHover, getSignatureHelp, getDocumentSymbols, getDefinition } from './features.ts';
import type { FileAnalysis } from './types.ts';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

const analysisCache = new Map<string, FileAnalysis>();

function analyzeDocument(doc: TextDocument): FileAnalysis {
  const analysis = analyze(doc.getText(), doc.uri);
  analysisCache.set(doc.uri, analysis);
  return analysis;
}

function uriToPath(uri: string): string {
  try {
    return fileURLToPath(uri);
  } catch {
    return uri.replace(/^file:\/\//, '');
  }
}

function resolveImportUri(currentUri: string, atPath: string): string {
  const currentPath = uriToPath(currentUri);
  const dir = path.dirname(currentPath);
  const resolved = path.resolve(dir, atPath);
  return pathToFileURL(resolved).toString();
}

function getImportedAnalysis(importUri: string): FileAnalysis | null {
  if (analysisCache.has(importUri)) return analysisCache.get(importUri)!;
  try {
    const text = fs.readFileSync(uriToPath(importUri), 'utf-8');
    const analysis = analyze(text, importUri);
    analysisCache.set(importUri, analysis);
    return analysis;
  } catch {
    return null;
  }
}

function resolveImports(currentUri: string, analysis: FileAnalysis): Map<string, FileAnalysis> {
  const result = new Map<string, FileAnalysis>();
  result.set('builtin:fn', getBuiltins());
  for (const imp of analysis.imports) {
    const uri = resolveImportUri(currentUri, imp.atPath);
    const imported = getImportedAnalysis(uri);
    if (imported) result.set(imp.atPath, imported);
  }
  return result;
}

function parseDiagnostics(text: string, uri: string) {
  try {
    XQuery31Full(text);
    return [];
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // "at line N, column M:" in the parser's error messages
    const loc = msg.match(/at line (\d+), column (\d+)/);
    const line = loc ? parseInt(loc[1]) - 1 : 0;
    const col = loc ? parseInt(loc[2]) - 1 : 0;
    return [{
      severity: DiagnosticSeverity.Error,
      range: { start: { line, character: col }, end: { line, character: col + 1 } },
      message: msg.split('\n')[0],
      source: 'xquery-lsp',
    }];
  }
}

// ── LSP lifecycle ────────────────────────────────────────────────────────────

let snippetSupport = false;

connection.onInitialize((params) => {
  snippetSupport =
    params.capabilities.textDocument?.completion?.completionItem?.snippetSupport ?? false;
  return {
  capabilities: {
    textDocumentSync: TextDocumentSyncKind.Incremental,
    completionProvider: {
      triggerCharacters: ['$', ':'],
      resolveProvider: false,
    },
    hoverProvider: true,
    signatureHelpProvider: {
      triggerCharacters: ['(', ','],
    },
    documentSymbolProvider: true,
    definitionProvider: true,
  },
}});

documents.onDidChangeContent(change => {
  const doc = change.document;
  analyzeDocument(doc);
  const diagnostics = parseDiagnostics(doc.getText(), doc.uri);
  connection.sendDiagnostics({ uri: doc.uri, diagnostics });
});

connection.onCompletion(params => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];
  const analysis = analysisCache.get(doc.uri) ?? analyzeDocument(doc);
  const imported = resolveImports(doc.uri, analysis);
  const offset = doc.offsetAt(params.position);
  return getCompletions({ textBeforeCursor: doc.getText().slice(0, offset), cursorOffset: offset }, analysis, imported, snippetSupport);
});

connection.onHover(params => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;
  const analysis = analysisCache.get(doc.uri) ?? analyzeDocument(doc);
  const imported = resolveImports(doc.uri, analysis);
  return getHover(doc, doc.offsetAt(params.position), analysis, imported);
});

connection.onSignatureHelp(params => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;
  const analysis = analysisCache.get(doc.uri) ?? analyzeDocument(doc);
  const imported = resolveImports(doc.uri, analysis);
  return getSignatureHelp(doc, doc.offsetAt(params.position), analysis, imported);
});

connection.onDocumentSymbol(params => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];
  const analysis = analysisCache.get(doc.uri) ?? analyzeDocument(doc);
  return getDocumentSymbols(doc, analysis);
});

connection.onDefinition(params => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;
  const analysis = analysisCache.get(doc.uri) ?? analyzeDocument(doc);
  const imported = resolveImports(doc.uri, analysis);
  return getDefinition(
    doc,
    doc.offsetAt(params.position),
    analysis,
    imported,
    atPath => resolveImportUri(doc.uri, atPath),
  );
});

documents.listen(connection);
connection.listen();
