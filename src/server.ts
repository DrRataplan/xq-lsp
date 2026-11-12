#!/usr/bin/env node
import { redundantXmlnsRemovalRange } from "./redundant-xmlns-diagnostics.ts";
import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	TextDocumentSyncKind,
	DocumentDiagnosticReportKind,
	CodeAction,
	CodeActionKind,
	TextEdit,
	ResponseError,
	ErrorCodes,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as fs from "fs";
import { getCompletions } from "./completion.ts";
import { getHover, getSignatureHelp, getDocumentSymbols } from "./features.ts";
import { getDefinition } from "./definition.ts";
import { getDocumentLinks } from "./document-links.ts";
import { getInlayHints } from "./inlay-hints.ts";
import { getReferences, getRenameRangeAtOffset, getRenameLocations, getDocumentHighlights } from "./references.ts";
import type { FileRecord } from "./references.ts";
import { buildCodeLenses, resolveCodeLens } from "./code-lens.ts";
import type { CodeLensData } from "./code-lens.ts";
import { prepareCallHierarchy, getIncomingCalls, getOutgoingCalls } from "./call-hierarchy.ts";
import type { FileAnalysis } from "./types.ts";
import { findConfig } from "./config.ts";
import { findImportInsertPosition, findDeclareNsInsertPosition, computeRelativePath } from "./namespace-diagnostics.ts";
import type { NamespaceUsageKind } from "./namespace-diagnostics.ts";
import { buildOrganizeImportsEdit, buildExtractVariableEdit, buildExtractFunctionEdit } from "./refactor-actions.ts";
import type { OffsetEdit } from "./refactor-actions.ts";
import { getWorkspaceSymbols } from "./workspace-symbol.ts";
import { getSemanticTokensData, SEMANTIC_TOKENS_LEGEND } from "./semantic-tokens.ts";
import { createWorkspace, uriToPath } from "./workspace.ts";

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

// All cross-file machinery (config discovery, glob indexes, import resolution, the
// diagnostic pipeline) lives in the shared Workspace — the lint CLI uses the same one.
const ws = createWorkspace({ getOpenDocument: (uri) => documents.get(uri) });

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
			workspaceSymbolProvider: true,
			definitionProvider: true,
			referencesProvider: true,
			renameProvider: { prepareProvider: true },
			documentHighlightProvider: true,

			codeActionProvider: {
				codeActionKinds: [
					CodeActionKind.QuickFix,
					CodeActionKind.SourceOrganizeImports,
					CodeActionKind.RefactorExtract,
				],
			},
			codeLensProvider: { resolveProvider: true },
			documentLinkProvider: { resolveProvider: false },
			callHierarchyProvider: true,
			inlayHintProvider: true,
			diagnosticProvider: { interFileDependencies: true, workspaceDiagnostics: false },
			semanticTokensProvider: { legend: SEMANTIC_TOKENS_LEGEND, full: true },
		},
	};
});

documents.onDidChangeContent((change) => {
	connection.sendDiagnostics({ uri: change.document.uri, diagnostics: ws.computeDiagnostics(change.document) });
});

// LSP 3.17 pull diagnostics. Falls back to reading the file from disk so clients that edit
// files outside an editor session (no didOpen) can still ask "does this file have errors?".
connection.languages.diagnostics.on((params) => {
	let doc = documents.get(params.textDocument.uri);
	if (!doc) {
		try {
			const text = fs.readFileSync(uriToPath(params.textDocument.uri), "utf-8");
			doc = TextDocument.create(params.textDocument.uri, "xquery", 0, text);
		} catch {
			return { kind: DocumentDiagnosticReportKind.Full, items: [] };
		}
	}
	return { kind: DocumentDiagnosticReportKind.Full, items: ws.computeDiagnostics(doc) };
});

connection.onCompletion((params) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return [];
	const rawAnalysis = ws.analysisCache.get(doc.uri) ?? ws.analyzeDocument(doc);
	const { analysis, imported } = ws.resolveContext(doc.uri, rawAnalysis);
	const offset = doc.offsetAt(params.position);

	const { byNamespace: globAnalyses } = ws.getGlobAnalyses(doc.uri);
	const config = findConfig(doc.uri)?.config;
	const generateLocationHints = config?.generateLocationHints ?? true;

	// Build the set of modules available to auto-import (known in the workspace, not yet imported).
	const availableAnalyses = new Map<string, FileAnalysis>();
	for (const [nsUri, analysis] of globAnalyses) {
		if (!imported.has(nsUri) && !imported.has(analysis.modulePrefix ?? "")) {
			// Only include if not already reachable via the imported map
			const alreadyImported = [...imported.values()].some((a) => a.moduleNamespaceUri === nsUri);
			if (!alreadyImported) availableAnalyses.set(nsUri, analysis);
		}
	}

	// Build known pure-XML namespaces (from config prefixes + glob file namespace declarations).
	const configPrefixes = config?.prefixes ?? {};
	const knownNamespaces = new Map<string, string>(Object.entries(configPrefixes) as [string, string][]);
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
		ws.lastValidAnalysisCache.get(doc.uri),
		availableAnalyses,
		knownNamespaces,
		{ docText: doc.getText(), docUri: doc.uri, generateLocationHints },
	);
});

connection.onHover((params) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return null;
	const rawAnalysis = ws.analysisCache.get(doc.uri) ?? ws.analyzeDocument(doc);
	const { analysis, imported } = ws.resolveContext(doc.uri, rawAnalysis);
	return getHover(doc, doc.offsetAt(params.position), analysis, imported);
});

connection.onSignatureHelp((params) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return null;
	const rawAnalysis = ws.analysisCache.get(doc.uri) ?? ws.analyzeDocument(doc);
	const { analysis, imported } = ws.resolveContext(doc.uri, rawAnalysis);
	return getSignatureHelp(doc, doc.offsetAt(params.position), analysis, imported);
});

connection.onDocumentSymbol((params) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return [];
	const analysis = ws.analysisCache.get(doc.uri) ?? ws.analyzeDocument(doc);
	return getDocumentSymbols(doc, analysis);
});

connection.onWorkspaceSymbol((params) => {
	// No single document anchors a workspace-wide request, so gather config dirs from every open document.
	const filesByUri = new Map<string, FileRecord>();
	for (const doc of documents.all()) {
		for (const file of ws.getGlobFileAccess(doc.uri).getOtherFiles()) filesByUri.set(file.uri, file);
	}
	return getWorkspaceSymbols([...filesByUri.values()], params.query);
});

connection.onDefinition((params) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return null;
	const rawAnalysis = ws.analysisCache.get(doc.uri) ?? ws.analyzeDocument(doc);
	const { analysis, imported } = ws.resolveContext(doc.uri, rawAnalysis);
	return getDefinition(doc, doc.offsetAt(params.position), analysis, imported);
});

connection.onReferences((params) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return [];
	const rawAnalysis = ws.analysisCache.get(doc.uri) ?? ws.analyzeDocument(doc);
	const { analysis } = ws.resolveContext(doc.uri, rawAnalysis);
	const { getOtherFiles, loadAst } = ws.getGlobFileAccess(doc.uri);
	return getReferences(doc.uri, doc.getText(), doc.offsetAt(params.position), analysis, params.context.includeDeclaration, getOtherFiles, loadAst);
});

const NCNAME_RE = /^[A-Za-z_][\w.-]*$/;

connection.onPrepareRename((params) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return null;
	const rawAnalysis = ws.analysisCache.get(doc.uri) ?? ws.analyzeDocument(doc);
	const { analysis } = ws.resolveContext(doc.uri, rawAnalysis);
	const range = getRenameRangeAtOffset(doc.getText(), doc.offsetAt(params.position), analysis);
	if (!range) return null;
	return { start: doc.positionAt(range.start), end: doc.positionAt(range.end) };
});

connection.onRenameRequest((params) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return null;
	if (!NCNAME_RE.test(params.newName)) {
		throw new ResponseError(ErrorCodes.InvalidParams, `"${params.newName}" is not a valid XQuery name`);
	}
	const rawAnalysis = ws.analysisCache.get(doc.uri) ?? ws.analyzeDocument(doc);
	const { analysis } = ws.resolveContext(doc.uri, rawAnalysis);
	const { getOtherFiles, loadAst } = ws.getGlobFileAccess(doc.uri);
	const locations = getRenameLocations(doc.uri, doc.getText(), doc.offsetAt(params.position), analysis, getOtherFiles, loadAst);
	if (!locations) return null;

	const changes: Record<string, TextEdit[]> = {};
	for (const loc of locations) {
		(changes[loc.uri] ??= []).push(TextEdit.replace(loc.range, params.newName));
	}
	return { changes };
});

connection.languages.inlayHint.on((params) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return [];
	const rawAnalysis = ws.analysisCache.get(doc.uri) ?? ws.analyzeDocument(doc);
	const { analysis, imported } = ws.resolveContext(doc.uri, rawAnalysis);
	if (!analysis.ast) return []; // mid-edit / regex fallback — no AST to walk
	return getInlayHints(doc, analysis.ast, analysis, imported, params.range);
});

connection.onDocumentHighlight((params) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return null;
	const rawAnalysis = ws.analysisCache.get(doc.uri) ?? ws.analyzeDocument(doc);
	const { analysis } = ws.resolveContext(doc.uri, rawAnalysis);
	return getDocumentHighlights(doc.getText(), doc.offsetAt(params.position), analysis);
});

connection.onCodeLens((params) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return [];
	const rawAnalysis = ws.analysisCache.get(doc.uri) ?? ws.analyzeDocument(doc);
	const { analysis } = ws.resolveContext(doc.uri, rawAnalysis);
	return buildCodeLenses(doc, analysis);
});

connection.onCodeLensResolve((lens) => {
	const data = lens.data as CodeLensData | undefined;
	const doc = data && documents.get(data.uri);
	if (!doc) return { ...lens, command: { title: "0 references", command: "" } };
	const rawAnalysis = ws.analysisCache.get(doc.uri) ?? ws.analyzeDocument(doc);
	const { analysis } = ws.resolveContext(doc.uri, rawAnalysis);
	const { getOtherFiles, loadAst } = ws.getGlobFileAccess(doc.uri);
	return resolveCodeLens(lens, doc.getText(), analysis, getOtherFiles, loadAst);
});

connection.onDocumentLinks((params) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return [];
	const rawAnalysis = ws.analysisCache.get(doc.uri) ?? ws.analyzeDocument(doc);
	const { analysis } = ws.resolveContext(doc.uri, rawAnalysis);
	return getDocumentLinks(analysis, doc);
});

connection.languages.callHierarchy.onPrepare((params) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return null;
	const rawAnalysis = ws.analysisCache.get(doc.uri) ?? ws.analyzeDocument(doc);
	const { analysis, imported } = ws.resolveContext(doc.uri, rawAnalysis);
	return prepareCallHierarchy(doc.uri, doc.getText(), doc.offsetAt(params.position), analysis, imported);
});

connection.languages.callHierarchy.onIncomingCalls((params) => {
	const loaded = ws.loadAnalysisForUri(params.item.uri);
	if (!loaded) return null;
	const { analysis } = ws.resolveContext(params.item.uri, loaded.analysis);
	const { getOtherFiles, loadAst } = ws.getGlobFileAccess(params.item.uri);
	return getIncomingCalls(params.item, loaded.text, analysis, getOtherFiles, loadAst);
});

connection.languages.callHierarchy.onOutgoingCalls((params) => {
	const loaded = ws.loadAnalysisForUri(params.item.uri);
	if (!loaded) return null;
	const { analysis, imported } = ws.resolveContext(params.item.uri, loaded.analysis);
	return getOutgoingCalls(params.item, loaded.text, analysis, imported);
});

// True when `kind` is (or is a sub-kind of) one of the client-requested `only` kinds; unset means no filter.
function matchesOnly(kind: string, only: CodeActionKind[] | undefined): boolean {
	return !only || only.some((k) => kind === k || kind.startsWith(`${k}.`));
}

function toEditRange(doc: TextDocument, edit: OffsetEdit) {
	return { range: { start: doc.positionAt(edit.start), end: doc.positionAt(edit.end) }, newText: edit.newText };
}

connection.languages.semanticTokens.on((params) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return { data: [] };
	const { analysis: rawAnalysis, ast } = ws.analyzeDocumentFull(doc);
	const { analysis, imported } = ws.resolveContext(doc.uri, rawAnalysis);
	return { data: getSemanticTokensData(ast, doc.getText(), analysis, imported) };
});

connection.onCodeAction((params) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return [];

	const text = doc.getText();
	const globAnalyses = ws.getGlobAnalyses(doc.uri);
	const config = findConfig(doc.uri)?.config;
	const generateLocationHints = config?.generateLocationHints ?? true;
	const configPrefixes = config?.prefixes ?? {};
	const actions: CodeAction[] = [];
	const only = params.context.only as CodeActionKind[] | undefined;

	for (const diag of params.context.diagnostics) {
		if (diag.code !== "XQST0081" && diag.code !== "FONS0004") continue;
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

	for (const diag of params.context.diagnostics) {
		if (diag.code !== "xq-lsp:redundant-xmlns") continue;
		const offset = doc.offsetAt(diag.range.start);
		const { start, end } = redundantXmlnsRemovalRange(text, { offset, length: doc.offsetAt(diag.range.end) - offset });
		actions.push({
			title: "Remove redundant namespace declaration",
			kind: CodeActionKind.QuickFix,
			diagnostics: [diag],
			edit: { changes: { [doc.uri]: [{ range: { start: doc.positionAt(start), end: doc.positionAt(end) }, newText: "" }] } },
		});
	}

	const rawAnalysis = ws.analysisCache.get(doc.uri) ?? ws.analyzeDocument(doc);
	const ast = rawAnalysis.ast ?? null;

	if (ast && matchesOnly(CodeActionKind.SourceOrganizeImports, only)) {
		const edit = buildOrganizeImportsEdit(ast, rawAnalysis, text);
		if (edit) {
			actions.push({
				title: "Organize imports",
				kind: CodeActionKind.SourceOrganizeImports,
				edit: { changes: { [doc.uri]: [toEditRange(doc, edit)] } },
			});
		}
	}

	const selStart = doc.offsetAt(params.range.start);
	const selEnd = doc.offsetAt(params.range.end);
	if (ast && selStart < selEnd && matchesOnly(CodeActionKind.RefactorExtract, only)) {
		const varResult = buildExtractVariableEdit(ast, rawAnalysis, text, selStart, selEnd);
		if (varResult) {
			actions.push({
				title: `Extract to variable '$${varResult.variableName}'`,
				kind: CodeActionKind.RefactorExtract,
				edit: { changes: { [doc.uri]: varResult.edits.map((e) => toEditRange(doc, e)) } },
			});
		}

		const fnResult = buildExtractFunctionEdit(ast, rawAnalysis, text, selStart, selEnd);
		if (fnResult) {
			actions.push({
				title: `Extract to function 'local:${fnResult.functionName}'`,
				kind: CodeActionKind.RefactorExtract,
				edit: { changes: { [doc.uri]: fnResult.edits.map((e) => toEditRange(doc, e)) } },
			});
		}
	}

	return actions;
});

documents.listen(connection);
connection.listen();
