/**
 * Shared workspace machinery: `lsp-config.xq` discovery, glob-backed module resolution,
 * and the full diagnostic pipeline.
 *
 * Both the LSP server (server.ts) and the lint CLI (cli.ts) drive their work through a
 * Workspace instance, so the CLI reports exactly the same diagnostics as the editor.
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { TextDocument } from "vscode-languageserver-textdocument";
import { DiagnosticSeverity, type Diagnostic } from "vscode-languageserver/node.js";
import type { Node } from "xq-parser";
import { analyzeWithAst } from "./analyzer.ts";
import { getBuiltins } from "./builtins.ts";
import { expandGlobs, findConfig, loadConfigAt } from "./config.ts";
import type { LspConfig } from "./config.ts";
import { findUndeclaredPrefixUsages } from "./namespace-diagnostics.ts";
import type { NamespaceUsageKind } from "./namespace-diagnostics.ts";
import { runDiagnostics, runHints } from "./diagnostics.ts";
import { checkUnresolvedImports } from "./module-import-diagnostics.ts";
import {
	getRuntimeAnalyses,
	getRuntimePredeclaredNamespaces,
	withPredeclaredNs,
	withDeclaredBuiltinModules,
	getRuntimePredeclaredVariables,
	withPredeclaredVariables,
} from "./runtimes.ts";
import type { FileAnalysis, TypeDiagnostic } from "./types.ts";
import type { FileRecord, LoadAst } from "./references.ts";
import { siblingModuleAnalysis } from "./module-siblings.ts";

export function uriToPath(uri: string): string {
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

function mergeAnalyses(a: FileAnalysis, b: FileAnalysis): FileAnalysis {
	return {
		...a,
		functions: [...a.functions, ...b.functions],
		moduleVariables: [...a.moduleVariables, ...b.moduleVariables],
	};
}

function buildParseDiagnostics(parseError: Error | null): Diagnostic[] {
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

export interface WorkspaceOptions {
	/** Pin a specific `lsp-config.xq` instead of walking up from each file's directory. */
	configPath?: string;
	/** Returns a currently open (in-editor) document for a URI, if any — its live text wins over disk. */
	getOpenDocument?: (uri: string) => TextDocument | undefined;
}

export interface Workspace {
	analysisCache: Map<string, FileAnalysis>;
	lastValidAnalysisCache: Map<string, FileAnalysis>;
	analyzeDocument(doc: TextDocument): FileAnalysis;
	analyzeDocumentFull(doc: TextDocument): {
		analysis: FileAnalysis;
		parseDiagnostics: Diagnostic[];
		hasAst: boolean;
		ast: Node | null;
	};
	resolveContext(
		currentUri: string,
		rawAnalysis: FileAnalysis,
	): { analysis: FileAnalysis; imported: Map<string, FileAnalysis> };
	getGlobAnalyses(currentUri: string): { byNamespace: Map<string, FileAnalysis>; lib: string[] };
	getGlobFileAccess(currentUri: string): { getOtherFiles: () => FileRecord[]; loadAst: LoadAst };
	loadAnalysisForUri(uri: string): { text: string; analysis: FileAnalysis } | null;
	computeDiagnostics(doc: TextDocument): Diagnostic[];
}

export function createWorkspace(options: WorkspaceOptions = {}): Workspace {
	const analysisCache = new Map<string, FileAnalysis>();
	const lastValidAnalysisCache = new Map<string, FileAnalysis>(); // last AST-path analysis per URI

	// Glob analyses keyed by config directory, then by module namespace URI.
	// Populated lazily on the first request for a given config root.
	const globAnalysesByConfigDir = new Map<string, Map<string, FileAnalysis>>();

	// Lightweight (ast-free) per-file records for every glob-matched file: source text plus the
	// *extracted* FileAnalysis (functions, module variables, imports, namespace decls, ...), with
	// the AST itself dropped once those fields are pulled out. xq-parser's AST runs roughly two
	// orders of magnitude larger than the source text — XQuery's operator-precedence grammar wraps
	// even a bare `$x` variable reference in ~30 levels of single-child wrapper nodes, none of them
	// collapsed — so retaining a full AST for every glob-matched file (often hundreds, only a
	// handful of which anyone is actually looking at) is the dominant memory cost of any glob-backed
	// feature. None of the FileAnalysis fields other than `.ast` hold node references (they're all
	// plain offsets/strings — see types.ts), so dropping `.ast` after extraction is safe: nothing
	// downstream keeps the tree reachable. Populated lazily per config dir; never invalidated.
	const globFileSummariesByConfigDir = new Map<string, Map<string, FileRecord>>();

	function findConfigForUri(uri: string): { config: LspConfig; configDir: string } | null {
		return options.configPath ? loadConfigAt(options.configPath) : findConfig(uri);
	}

	function analyzeDocument(doc: TextDocument): FileAnalysis {
		const { analysis } = analyzeWithAst(doc.getText(), doc.uri);
		analysisCache.set(doc.uri, analysis);
		if (analysis.usedAstPath) lastValidAnalysisCache.set(doc.uri, analysis);
		return analysis;
	}

	function analyzeDocumentFull(doc: TextDocument) {
		const { analysis, ast, parseError } = analyzeWithAst(doc.getText(), doc.uri);
		analysisCache.set(doc.uri, analysis);
		if (analysis.usedAstPath) lastValidAnalysisCache.set(doc.uri, analysis);
		return { analysis, parseDiagnostics: buildParseDiagnostics(parseError), hasAst: ast !== null, ast };
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

	// Loads text + analysis for a call-hierarchy item's uri, which may not be an open document.
	function loadAnalysisForUri(uri: string): { text: string; analysis: FileAnalysis } | null {
		const doc = options.getOpenDocument?.(uri);
		if (doc) return { text: doc.getText(), analysis: analysisCache.get(uri) ?? analyzeDocument(doc) };
		try {
			const text = fs.readFileSync(uriToPath(uri), "utf-8");
			const { analysis } = analyzeWithAst(text, uri);
			return { text, analysis };
		} catch {
			return null;
		}
	}

	function buildGlobFileSummaries(config: LspConfig, configDir: string): Map<string, FileRecord> {
		const records = new Map<string, FileRecord>();
		for (const filePath of expandGlobs(config.globs, configDir)) {
			const fileUri = pathToFileURL(filePath).toString();
			try {
				const text = fs.readFileSync(filePath, "utf-8");
				const { analysis } = analyzeWithAst(text, fileUri);
				records.set(fileUri, { uri: fileUri, text, analysis: { ...analysis, ast: undefined } });
			} catch {
				/* unreadable file, skip */
			}
		}
		return records;
	}

	function getGlobFileSummaries(configDir: string, config: LspConfig): Map<string, FileRecord> {
		if (!globFileSummariesByConfigDir.has(configDir)) {
			globFileSummariesByConfigDir.set(configDir, buildGlobFileSummaries(config, configDir));
		}
		return globFileSummariesByConfigDir.get(configDir)!;
	}

	function getGlobAnalyses(currentUri: string): { byNamespace: Map<string, FileAnalysis>; lib: string[] } {
		const found = findConfigForUri(currentUri);
		if (!found) return { byNamespace: new Map(), lib: [] };

		const { config, configDir } = found;
		const lib = config.lib;

		if (globAnalysesByConfigDir.has(configDir)) {
			return { byNamespace: globAnalysesByConfigDir.get(configDir)!, lib };
		}

		const byNamespace = new Map<string, FileAnalysis>();
		for (const { analysis } of getGlobFileSummaries(configDir, config).values()) {
			if (!analysis.moduleNamespaceUri) continue;
			const existing = byNamespace.get(analysis.moduleNamespaceUri);
			byNamespace.set(analysis.moduleNamespaceUri, existing ? mergeAnalyses(existing, analysis) : analysis);
		}
		globAnalysesByConfigDir.set(configDir, byNamespace);
		return { byNamespace, lib };
	}

	/**
	 * Cross-file access for find-references / rename / call-hierarchy: `getOtherFiles` returns the
	 * cached, ast-free summaries above for cheap candidate filtering (see references.ts's text
	 * pre-filter); `loadAst` parses one specific candidate's full AST on demand, once it survives
	 * that filter, reusing `analysisCache` when the file is already resident (open document, or
	 * explicitly imported elsewhere) instead of re-parsing. The parsed result is intentionally NOT
	 * cached here — a cross-file search should never retain more than the handful of files it's
	 * actually walking.
	 */
	function getGlobFileAccess(currentUri: string): { getOtherFiles: () => FileRecord[]; loadAst: LoadAst } {
		const found = findConfigForUri(currentUri);
		if (!found) return { getOtherFiles: () => [], loadAst: () => null };
		const { config, configDir } = found;
		const predeclaredNs = getRuntimePredeclaredNamespaces(config.lib);

		return {
			getOtherFiles: () =>
				[...getGlobFileSummaries(configDir, config).values()].map((r) => ({
					...r,
					analysis: withPredeclaredNs(r.analysis, predeclaredNs),
				})),
			loadAst: (uri: string, text: string) => {
				const cached = analysisCache.get(uri);
				if (cached?.ast) return withPredeclaredNs(cached, predeclaredNs);
				const { analysis } = analyzeWithAst(text, uri);
				return withPredeclaredNs(analysis, predeclaredNs);
			},
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
		const predeclaredVars = getRuntimePredeclaredVariables(lib, currentUri);
		const withPredeclared = withPredeclaredVariables(
			withPredeclaredNs(rawAnalysis, predeclaredNs),
			predeclaredVars,
		);

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
		const analysis = withDeclaredBuiltinModules(withPredeclared, new Set(runtimeByNamespace.keys()));
		// Their functions are callable by namespace URI alone (see withDeclaredBuiltinModules).
		for (const nd of analysis.namespaceDecls) {
			const runtimeAnalysis = nd.offset === -1 ? runtimeByNamespace.get(nd.namespaceUri) : undefined;
			if (runtimeAnalysis && !result.has(nd.namespaceUri)) result.set(nd.namespaceUri, runtimeAnalysis);
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
		// Other files implementing the same module namespace are in scope without an import.
		if (rawAnalysis.moduleNamespaceUri) {
			const merged = globAnalyses.get(rawAnalysis.moduleNamespaceUri);
			const siblings = merged && siblingModuleAnalysis(merged, currentUri);
			if (siblings) result.set(rawAnalysis.moduleNamespaceUri, siblings);
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

	function computeDiagnostics(doc: TextDocument): Diagnostic[] {
		const { analysis: rawAnalysis, parseDiagnostics: parseDiags, hasAst, ast } = analyzeDocumentFull(doc);
		const { analysis, imported: resolvedImported } = resolveContext(doc.uri, rawAnalysis);
		const config = findConfigForUri(doc.uri)?.config;

		// Run all error-level diagnostics and hints via the central registry.
		// findUndeclaredPrefixUsages returns [] when ast is null; runDiagnostics guards the rest.
		const nsDiagRaw = findUndeclaredPrefixUsages(ast, analysis);
		const errorDiagRaw =
			hasAst && ast !== null
				? runDiagnostics(ast, doc.getText(), analysis, resolvedImported, {
						strictCardinality: config?.strict.cardinality ?? false,
					})
				: [];
		const hintDiagRaw = hasAst && ast !== null ? runHints(ast, analysis) : [];

		const unresolvedImportRaw = hasAst ? checkUnresolvedImports(analysis, resolvedImported) : [];

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
		// Opt-in strict-mode diagnostics are flagged severity "warning" and surface as warnings.
		const errorDiags = errorDiagRaw
			.filter((d) => d.code !== "XQST0081")
			.map((d) => toLsp(d, d.severity === "warning" ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error));
		const hintDiags = hintDiagRaw.map((d) => toLsp(d, DiagnosticSeverity.Hint));

		const unresolvedImportDiags = unresolvedImportRaw.map((d) => toLsp(d, DiagnosticSeverity.Warning));

		return [...parseDiags, ...nsDiags, ...errorDiags, ...unresolvedImportDiags, ...hintDiags];
	}

	return {
		analysisCache,
		lastValidAnalysisCache,
		analyzeDocument,
		analyzeDocumentFull,
		resolveContext,
		getGlobAnalyses,
		getGlobFileAccess,
		loadAnalysisForUri,
		computeDiagnostics,
	};
}
