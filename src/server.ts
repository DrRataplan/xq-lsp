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
import { analyzeWithAst } from './analyzer.ts';
import { getBuiltins } from './builtins.ts';
import { getCompletions } from './completion.ts';
import { getHover, getSignatureHelp, getDocumentSymbols, getDefinition } from './features.ts';
import type { FileAnalysis, TypeDiagnostic } from './types.ts';
import { checkTypes } from './typechecker.ts';
import { findConfig, expandGlobs } from './config.ts';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

const analysisCache = new Map<string, FileAnalysis>();
const typeErrorCache = new Map<string, TypeDiagnostic[]>();

// Glob analyses keyed by config directory, then by module namespace URI.
// Populated lazily on the first request for a given config root.
const globAnalysesByConfigDir = new Map<string, Map<string, FileAnalysis>>();

function analyzeDocument(doc: TextDocument): FileAnalysis {
  const { analysis } = analyzeWithAst(doc.getText(), doc.uri);
  analysisCache.set(doc.uri, analysis);
  return analysis;
}

function analyzeDocumentFull(doc: TextDocument): {
  analysis: FileAnalysis;
  parseDiagnostics: ReturnType<typeof buildParseDiagnostics>;
  hasAst: boolean;
  ast: import('xq-parser').Node | null;
} {
  const { analysis, ast, parseError } = analyzeWithAst(doc.getText(), doc.uri);
  analysisCache.set(doc.uri, analysis);
  return { analysis, parseDiagnostics: buildParseDiagnostics(parseError), hasAst: ast !== null, ast };
}

function buildParseDiagnostics(parseError: Error | null) {
  if (!parseError) return [];
  const msg = parseError.message;
  const loc = msg.match(/at line (\d+), column (\d+)/);
  const line = loc ? parseInt(loc[1]) - 1 : 0;
  const col = loc ? parseInt(loc[2]) - 1 : 0;
  return [{
    severity: DiagnosticSeverity.Error,
    range: { start: { line, character: col }, end: { line, character: col + 1 } },
    message: msg.split('\n')[0],
    code: 'XPST0003',
    source: 'xquery-lsp',
  }];
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
    const { analysis } = analyzeWithAst(text, importUri);
    analysisCache.set(importUri, analysis);
    return analysis;
  } catch {
    return null;
  }
}

function getGlobAnalyses(currentUri: string): Map<string, FileAnalysis> {
  const found = findConfig(currentUri);
  if (!found) return new Map();

  const { config, configDir } = found;
  if (globAnalysesByConfigDir.has(configDir)) return globAnalysesByConfigDir.get(configDir)!;

  const byNamespace = new Map<string, FileAnalysis>();
  for (const filePath of expandGlobs(config.globs, configDir)) {
    const fileUri = pathToFileURL(filePath).toString();
    const imported = getImportedAnalysis(fileUri);
    if (imported?.moduleNamespaceUri) byNamespace.set(imported.moduleNamespaceUri, imported);
  }
  globAnalysesByConfigDir.set(configDir, byNamespace);
  return byNamespace;
}

function resolveImports(currentUri: string, analysis: FileAnalysis): Map<string, FileAnalysis> {
  const result = new Map<string, FileAnalysis>();
  result.set('builtin:fn', getBuiltins());
  const globAnalyses = getGlobAnalyses(currentUri);
  for (const imp of analysis.imports) {
    if (imp.atPath) {
      const uri = resolveImportUri(currentUri, imp.atPath);
      const imported = getImportedAnalysis(uri);
      if (imported) result.set(imp.atPath, imported);
    } else {
      // No "at" path: resolve by matching namespace URI against glob-loaded modules
      const imported = globAnalyses.get(imp.namespaceUri);
      if (imported) result.set(imp.namespaceUri, imported);
    }
  }
  return result;
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
  const { analysis, parseDiagnostics: parseDiags, hasAst, ast } = analyzeDocumentFull(doc);

  if (hasAst && ast !== null) {
    const imported = resolveImports(doc.uri, analysis);
    typeErrorCache.set(doc.uri, checkTypes(ast, doc.getText(), analysis, imported));
  }

  const typeDiags = (typeErrorCache.get(doc.uri) ?? []).map(td => ({
    severity: DiagnosticSeverity.Warning,
    range: {
      start: doc.positionAt(td.offset),
      end: doc.positionAt(td.offset + td.length),
    },
    message: td.message,
    code: td.code,
    source: 'xquery-lsp',
  }));

  connection.sendDiagnostics({ uri: doc.uri, diagnostics: [...parseDiags, ...typeDiags] });
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
