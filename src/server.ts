#!/usr/bin/env node
import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	TextDocumentSyncKind,
	DiagnosticSeverity,
	CodeAction,
	CodeActionKind,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { analyzeWithAst } from "./analyzer.ts";
import { getBuiltins } from "./builtins.ts";
import { getCompletions } from "./completion.ts";
import { getHover, getSignatureHelp, getDocumentSymbols } from "./features.ts";
import { getDefinition } from "./definition.ts";
import type { FileAnalysis, TypeDiagnostic } from "./types.ts";
import { checkTypes } from "./typechecker.ts";
import { checkFunctionCalls } from "./functioncall-diagnostics.ts";
import { findConfig, expandGlobs } from "./config.ts";
import {
	findUndeclaredPrefixUsages,
	findImportInsertPosition,
	findDeclareNsInsertPosition,
} from "./namespace-diagnostics.ts";
import type { NamespaceUsageKind } from "./namespace-diagnostics.ts";
import { checkUnused } from "./unused-diagnostics.ts";
import { checkContextItemUsage } from "./context-item-diagnostics.ts";
import { getRuntimeAnalyses } from "./runtimes.ts";

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
	ast: import("xq-parser").Node | null;
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
	return [
		{
			severity: DiagnosticSeverity.Error,
			range: { start: { line, character: col }, end: { line, character: col + 1 } },
			message: msg.split("\n")[0],
			code: "XPST0003",
			source: "xquery-lsp",
		},
	];
}

function uriToPath(uri: string): string {
	try {
		return fileURLToPath(uri);
	} catch {
		return uri.replace(/^file:\/\//, "");
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
		const text = fs.readFileSync(uriToPath(importUri), "utf-8");
		const { analysis } = analyzeWithAst(text, importUri);
		analysisCache.set(importUri, analysis);
		return analysis;
	} catch {
		return null;
	}
}

function mergeAnalyses(a: FileAnalysis, b: FileAnalysis): FileAnalysis {
	return {
		...a,
		functions: [...a.functions, ...b.functions],
		moduleVariables: [...a.moduleVariables, ...b.moduleVariables],
	};
}

function getGlobAnalyses(currentUri: string): { byNamespace: Map<string, FileAnalysis>; lib: string[] } {
	const found = findConfig(currentUri);
	if (!found) return { byNamespace: new Map(), lib: [] };

	const { config, configDir } = found;
	const lib = config.lib;

	if (globAnalysesByConfigDir.has(configDir)) {
		return { byNamespace: globAnalysesByConfigDir.get(configDir)!, lib };
	}

	const byNamespace = new Map<string, FileAnalysis>();
	for (const filePath of expandGlobs(config.globs, configDir)) {
		const fileUri = pathToFileURL(filePath).toString();
		const imported = getImportedAnalysis(fileUri);
		if (!imported?.moduleNamespaceUri) continue;
		const existing = byNamespace.get(imported.moduleNamespaceUri);
		byNamespace.set(imported.moduleNamespaceUri, existing ? mergeAnalyses(existing, imported) : imported);
	}
	globAnalysesByConfigDir.set(configDir, byNamespace);
	return { byNamespace, lib };
}

function resolveImports(currentUri: string, analysis: FileAnalysis): Map<string, FileAnalysis> {
	const result = new Map<string, FileAnalysis>();
	result.set("builtin:fn", getBuiltins());
	const { byNamespace: globAnalyses, lib } = getGlobAnalyses(currentUri);
	const runtimeByNamespace = new Map<string, FileAnalysis>();
	for (const runtimeAnalysis of getRuntimeAnalyses(lib)) {
		if (runtimeAnalysis.moduleNamespaceUri) {
			const existing = runtimeByNamespace.get(runtimeAnalysis.moduleNamespaceUri);
			runtimeByNamespace.set(
				runtimeAnalysis.moduleNamespaceUri,
				existing ? mergeAnalyses(existing, runtimeAnalysis) : runtimeAnalysis,
			);
		}
	}
	for (const imp of analysis.imports) {
		if (imp.atPath) {
			const uri = resolveImportUri(currentUri, imp.atPath);
			const imported = getImportedAnalysis(uri);
			if (imported) result.set(imp.atPath, imported);
		} else {
			// No "at" path: resolve by matching namespace URI against glob-loaded modules or runtime defs
			const imported = globAnalyses.get(imp.namespaceUri) ?? runtimeByNamespace.get(imp.namespaceUri);
			if (imported) result.set(imp.namespaceUri, imported);
		}
	}
	return result;
}

// ── LSP lifecycle ────────────────────────────────────────────────────────────

let snippetSupport = false;

connection.onInitialize((params) => {
	snippetSupport = params.capabilities.textDocument?.completion?.completionItem?.snippetSupport ?? false;
	return {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			completionProvider: {
				triggerCharacters: ["$", ":"],
				resolveProvider: false,
			},
			hoverProvider: true,
			signatureHelpProvider: {
				triggerCharacters: ["(", ","],
			},
			documentSymbolProvider: true,
			definitionProvider: true,
			codeActionProvider: { codeActionKinds: [CodeActionKind.QuickFix] },
		},
	};
});

documents.onDidChangeContent((change) => {
	const doc = change.document;
	const { analysis, parseDiagnostics: parseDiags, hasAst, ast } = analyzeDocumentFull(doc);

	if (hasAst && ast !== null) {
		const imported = resolveImports(doc.uri, analysis);
		typeErrorCache.set(doc.uri, [
			...checkTypes(ast, doc.getText(), analysis, imported),
			...checkFunctionCalls(ast, analysis, imported),
		]);
	}

	const typeDiags = (typeErrorCache.get(doc.uri) ?? []).map((td) => ({
		severity: DiagnosticSeverity.Warning,
		range: {
			start: doc.positionAt(td.offset),
			end: doc.positionAt(td.offset + td.length),
		},
		message: td.message,
		code: td.code,
		source: "xquery-lsp",
	}));

	// findUndeclaredPrefixUsages returns [] when ast is null (parse error path).
	const nsDiagRaw = findUndeclaredPrefixUsages(ast, analysis);
	const nsDiags = nsDiagRaw.map((nd) => ({
		severity: DiagnosticSeverity.Error,
		range: {
			start: doc.positionAt(nd.offset),
			end: doc.positionAt(nd.offset + nd.length),
		},
		message: nd.message,
		code: nd.code,
		source: "xquery-lsp",
		data: { prefix: nd.prefix, usageKind: nd.usageKind } as { prefix: string; usageKind: NamespaceUsageKind },
	}));

	// checkUnused only runs when the AST is available.
	const unusedDiagRaw = hasAst && ast !== null ? checkUnused(ast, analysis) : [];
	const unusedDiags = unusedDiagRaw.map((ud) => ({
		severity: DiagnosticSeverity.Hint,
		range: {
			start: doc.positionAt(ud.offset),
			end: doc.positionAt(ud.offset + ud.length),
		},
		message: ud.message,
		code: ud.code,
		source: "xquery-lsp",
	}));

	const contextItemDiagRaw = hasAst && ast !== null ? checkContextItemUsage(ast) : [];
	const contextItemDiags = contextItemDiagRaw.map((cd) => ({
		severity: DiagnosticSeverity.Error,
		range: {
			start: doc.positionAt(cd.offset),
			end: doc.positionAt(cd.offset + cd.length),
		},
		message: cd.message,
		code: cd.code,
		source: "xquery-lsp",
	}));

	connection.sendDiagnostics({
		uri: doc.uri,
		diagnostics: [...parseDiags, ...typeDiags, ...nsDiags, ...unusedDiags, ...contextItemDiags],
	});
});

connection.onCompletion((params) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return [];
	const analysis = analysisCache.get(doc.uri) ?? analyzeDocument(doc);
	const imported = resolveImports(doc.uri, analysis);
	const offset = doc.offsetAt(params.position);
	return getCompletions(
		{ textBeforeCursor: doc.getText().slice(0, offset), cursorOffset: offset },
		analysis,
		imported,
		snippetSupport,
	);
});

connection.onHover((params) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return null;
	const analysis = analysisCache.get(doc.uri) ?? analyzeDocument(doc);
	const imported = resolveImports(doc.uri, analysis);
	return getHover(doc, doc.offsetAt(params.position), analysis, imported);
});

connection.onSignatureHelp((params) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return null;
	const analysis = analysisCache.get(doc.uri) ?? analyzeDocument(doc);
	const imported = resolveImports(doc.uri, analysis);
	return getSignatureHelp(doc, doc.offsetAt(params.position), analysis, imported);
});

connection.onDocumentSymbol((params) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return [];
	const analysis = analysisCache.get(doc.uri) ?? analyzeDocument(doc);
	return getDocumentSymbols(doc, analysis);
});

connection.onDefinition((params) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return null;
	const analysis = analysisCache.get(doc.uri) ?? analyzeDocument(doc);
	const imported = resolveImports(doc.uri, analysis);
	return getDefinition(doc, doc.offsetAt(params.position), analysis, imported, (atPath) =>
		resolveImportUri(doc.uri, atPath),
	);
});

connection.onCodeAction((params) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return [];

	const text = doc.getText();
	const globAnalyses = getGlobAnalyses(doc.uri);
	const config = findConfig(doc.uri)?.config;
	const generateLocationHints = config?.generateLocationHints ?? true;
	const configPrefixes = config?.prefixes ?? {};
	const actions: CodeAction[] = [];

	for (const diag of params.context.diagnostics) {
		if (diag.code !== "XQST0081") continue;
		const data = diag.data as { prefix: string; usageKind: NamespaceUsageKind } | undefined;
		if (!data?.prefix) continue;

		const { prefix, usageKind } = data;

		// Find all glob modules whose module namespace prefix matches the used prefix.
		for (const [nsUri, fa] of globAnalyses.byNamespace) {
			if (fa.modulePrefix !== prefix) continue;

			if (usageKind === "element") {
				// Elements only need a namespace declaration, not a module import.
				const insertPos = findDeclareNsInsertPosition(text);
				actions.push({
					title: `Declare namespace ${prefix} = "${nsUri}"`,
					kind: CodeActionKind.QuickFix,
					diagnostics: [diag],
					edit: {
						changes: {
							[doc.uri]: [
								{
									range: { start: insertPos, end: insertPos },
									newText: `declare namespace ${prefix} = "${nsUri}";\n`,
								},
							],
						},
					},
				});
			} else {
				// Function/variable usage — import the module.
				const moduleFileUri = fa.functions[0]?.sourceUri ?? fa.moduleVariables[0]?.sourceUri;
				const insertPos = findImportInsertPosition(text);

				let newText: string;
				if (generateLocationHints && moduleFileUri) {
					const atPath = computeRelativePath(doc.uri, moduleFileUri);
					newText = `import module namespace ${prefix} = "${nsUri}" at "${atPath}";\n`;
				} else {
					newText = `import module namespace ${prefix} = "${nsUri}";\n`;
				}

				actions.push({
					title: `Import module namespace ${prefix} = "${nsUri}"`,
					kind: CodeActionKind.QuickFix,
					diagnostics: [diag],
					edit: {
						changes: {
							[doc.uri]: [
								{
									range: { start: insertPos, end: insertPos },
									newText,
								},
							],
						},
					},
				});
			}
		}

		// Config-defined prefix: offer to insert a declare namespace statement.
		if (Object.prototype.hasOwnProperty.call(configPrefixes, prefix)) {
			const nsUri = configPrefixes[prefix];
			const insertPos = findDeclareNsInsertPosition(text);
			actions.push({
				title: `Declare namespace ${prefix} = "${nsUri}"`,
				kind: CodeActionKind.QuickFix,
				diagnostics: [diag],
				edit: {
					changes: {
						[doc.uri]: [
							{
								range: { start: insertPos, end: insertPos },
								newText: `declare namespace ${prefix} = "${nsUri}";\n`,
							},
						],
					},
				},
			});
		}
	}

	return actions;
});

function computeRelativePath(fromUri: string, toUri: string): string {
	const fromPath = uriToPath(fromUri);
	const toPath = uriToPath(toUri);
	const fromDir = path.dirname(fromPath);
	let rel = path.relative(fromDir, toPath).replace(/\\/g, "/");
	if (!rel.startsWith(".")) rel = "./" + rel;
	return rel;
}

documents.listen(connection);
connection.listen();
