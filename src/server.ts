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
import { getReferences } from "./references.ts";
import type { FileRecord } from "./references.ts";
import type { FileAnalysis, TypeDiagnostic } from "./types.ts";
import { findConfig, expandGlobs } from "./config.ts";
import {
	findImportInsertPosition,
	findDeclareNsInsertPosition,
	computeRelativePath,
} from "./namespace-diagnostics.ts";
import type { NamespaceUsageKind } from "./namespace-diagnostics.ts";
import { findUndeclaredPrefixUsages } from "./namespace-diagnostics.ts";
import { runDiagnostics, runHints } from "./diagnostics.ts";
import { getRuntimeAnalyses, getRuntimePredeclaredNamespaces, withPredeclaredNs } from "./runtimes.ts";

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

const analysisCache = new Map<string, FileAnalysis>();
const lastValidAnalysisCache = new Map<string, FileAnalysis>(); // last AST-path analysis per URI

// Glob analyses keyed by config directory, then by module namespace URI.
// Populated lazily on the first request for a given config root.
const globAnalysesByConfigDir = new Map<string, Map<string, FileAnalysis>>();

function analyzeDocument(doc: TextDocument): FileAnalysis {
	const { analysis } = analyzeWithAst(doc.getText(), doc.uri);
	analysisCache.set(doc.uri, analysis);
	if (analysis.usedAstPath) lastValidAnalysisCache.set(doc.uri, analysis);
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
	if (analysis.usedAstPath) lastValidAnalysisCache.set(doc.uri, analysis);
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

// Per-file (not merged-by-namespace) glob analyses, for cross-file reference search.
// Keyed by config directory; populated lazily and never invalidated, mirroring globAnalysesByConfigDir.
const globFileRecordsByConfigDir = new Map<string, Map<string, FileRecord>>();

function getGlobFileRecords(currentUri: string): () => FileRecord[] {
	const found = findConfig(currentUri);
	if (!found) return () => [];
	const { config, configDir } = found;

	return () => {
		if (!globFileRecordsByConfigDir.has(configDir)) {
			const predeclaredNs = getRuntimePredeclaredNamespaces(config.lib);
			const records = new Map<string, FileRecord>();
			for (const filePath of expandGlobs(config.globs, configDir)) {
				const fileUri = pathToFileURL(filePath).toString();
				try {
					const text = fs.readFileSync(filePath, "utf-8");
					const { analysis } = analyzeWithAst(text, fileUri);
					records.set(fileUri, { uri: fileUri, text, analysis: withPredeclaredNs(analysis, predeclaredNs) });
				} catch {
					/* unreadable file, skip */
				}
			}
			globFileRecordsByConfigDir.set(configDir, records);
		}
		return [...globFileRecordsByConfigDir.get(configDir)!.values()];
	};
}

function resolveContext(
	currentUri: string,
	rawAnalysis: FileAnalysis,
): { analysis: FileAnalysis; imported: Map<string, FileAnalysis> } {
	const result = new Map<string, FileAnalysis>();
	result.set("builtin:fn", getBuiltins());
	const { byNamespace: globAnalyses, lib } = getGlobAnalyses(currentUri);
	const predeclaredNs = getRuntimePredeclaredNamespaces(lib);
	const analysis = withPredeclaredNs(rawAnalysis, predeclaredNs);

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
	for (const imp of rawAnalysis.imports) {
		let imported: FileAnalysis | undefined;
		if (imp.atPath) {
			const uri = resolveImportUri(currentUri, imp.atPath);
			imported = getImportedAnalysis(uri) ?? undefined;
		}
		if (!imported) {
			// No "at" path, or the location hint didn't resolve: fall back to matching the
			// namespace URI against glob-loaded modules or runtime defs.
			imported = globAnalyses.get(imp.namespaceUri) ?? runtimeByNamespace.get(imp.namespaceUri);
		}
		if (imported) {
			if (imp.atPath) result.set(imp.atPath, imported);
			result.set(imp.namespaceUri, imported);
		}
	}
	// Add pre-declared runtime analyses directly — available without explicit import
	for (const nd of predeclaredNs) {
		if (!result.has(nd.namespaceUri)) {
			const runtimeAnalysis = runtimeByNamespace.get(nd.namespaceUri);
			if (runtimeAnalysis) result.set(nd.namespaceUri, runtimeAnalysis);
		}
	}
	return { analysis, imported: result };
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
			referencesProvider: true,
			codeActionProvider: { codeActionKinds: [CodeActionKind.QuickFix] },
		},
	};
});

documents.onDidChangeContent((change) => {
	const doc = change.document;
	const { analysis: rawAnalysis, parseDiagnostics: parseDiags, hasAst, ast } = analyzeDocumentFull(doc);
	const { analysis, imported: resolvedImported } = resolveContext(doc.uri, rawAnalysis);

	// Run all error-level diagnostics and hints via the central registry.
	// findUndeclaredPrefixUsages returns [] when ast is null; runDiagnostics guards the rest.
	const nsDiagRaw = findUndeclaredPrefixUsages(ast, analysis);
	const errorDiagRaw = hasAst && ast !== null ? runDiagnostics(ast, doc.getText(), analysis, resolvedImported) : [];
	const hintDiagRaw = hasAst && ast !== null ? runHints(ast, analysis) : [];

	function toLsp(d: TypeDiagnostic, severity: DiagnosticSeverity) {
		return {
			severity,
			range: { start: doc.positionAt(d.offset), end: doc.positionAt(d.offset + d.length) },
			message: d.message,
			code: d.code,
			source: "xquery-lsp",
		};
	}

	const nsDiags = nsDiagRaw.map((nd) => ({
		...toLsp(nd, DiagnosticSeverity.Error),
		data: { prefix: nd.prefix, usageKind: nd.usageKind } as { prefix: string; usageKind: NamespaceUsageKind },
	}));
	// nsDiags already covers XQST0081 (with the code-action data field), so exclude those here.
	const errorDiags = errorDiagRaw.filter((d) => d.code !== "XQST0081").map((d) => toLsp(d, DiagnosticSeverity.Error));
	const hintDiags = hintDiagRaw.map((d) => toLsp(d, DiagnosticSeverity.Hint));

	connection.sendDiagnostics({
		uri: doc.uri,
		diagnostics: [...parseDiags, ...nsDiags, ...errorDiags, ...hintDiags],
	});
});

connection.onCompletion((params) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return [];
	const rawAnalysis = analysisCache.get(doc.uri) ?? analyzeDocument(doc);
	const { analysis, imported } = resolveContext(doc.uri, rawAnalysis);
	const offset = doc.offsetAt(params.position);

	const { byNamespace: globAnalyses } = getGlobAnalyses(doc.uri);
	const config = findConfig(doc.uri)?.config;
	const generateLocationHints = config?.generateLocationHints ?? true;

	// Build the set of modules available to auto-import (known in the workspace, not yet imported).
	const availableAnalyses = new Map<string, FileAnalysis>();
	for (const [nsUri, analysis] of globAnalyses) {
		if (!imported.has(nsUri) && !imported.has(analysis.modulePrefix ?? "")) {
			// Only include if not already reachable via the imported map
			const alreadyImported = [...imported.values()].some(
				(a) => a.moduleNamespaceUri === nsUri,
			);
			if (!alreadyImported) availableAnalyses.set(nsUri, analysis);
		}
	}

	// Build known pure-XML namespaces (from config prefixes + glob file namespace declarations).
	const configPrefixes = config?.prefixes ?? {};
	const knownNamespaces = new Map<string, string>(
		Object.entries(configPrefixes) as [string, string][],
	);
	for (const a of globAnalyses.values()) {
		for (const nd of a.namespaceDecls) {
			if (!knownNamespaces.has(nd.prefix)) knownNamespaces.set(nd.prefix, nd.namespaceUri);
		}
		for (const imp of a.imports) {
			if (!knownNamespaces.has(imp.prefix)) knownNamespaces.set(imp.prefix, imp.namespaceUri);
		}
	}

	return getCompletions(
		{ textBeforeCursor: doc.getText().slice(0, offset), cursorOffset: offset },
		analysis,
		imported,
		snippetSupport,
		lastValidAnalysisCache.get(doc.uri),
		availableAnalyses,
		knownNamespaces,
		{ docText: doc.getText(), docUri: doc.uri, generateLocationHints },
	);
});

connection.onHover((params) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return null;
	const rawAnalysis = analysisCache.get(doc.uri) ?? analyzeDocument(doc);
	const { analysis, imported } = resolveContext(doc.uri, rawAnalysis);
	return getHover(doc, doc.offsetAt(params.position), analysis, imported);
});

connection.onSignatureHelp((params) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return null;
	const rawAnalysis = analysisCache.get(doc.uri) ?? analyzeDocument(doc);
	const { analysis, imported } = resolveContext(doc.uri, rawAnalysis);
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
	const rawAnalysis = analysisCache.get(doc.uri) ?? analyzeDocument(doc);
	const { analysis, imported } = resolveContext(doc.uri, rawAnalysis);
	return getDefinition(doc, doc.offsetAt(params.position), analysis, imported);
});

connection.onReferences((params) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return [];
	const rawAnalysis = analysisCache.get(doc.uri) ?? analyzeDocument(doc);
	const { analysis } = resolveContext(doc.uri, rawAnalysis);
	return getReferences(
		doc.uri,
		doc.getText(),
		doc.offsetAt(params.position),
		analysis,
		params.context.includeDeclaration,
		getGlobFileRecords(doc.uri),
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


documents.listen(connection);
connection.listen();
