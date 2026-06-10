import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { analyze } from "./analyzer.ts";
import type { FileAnalysis, NamespaceDecl } from "./types.ts";

const runtimesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "runtimes");

function loadJson(filePath: string): Record<string, string> {
	return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, string>;
}

function toNamespaceDecls(raw: Record<string, string>): NamespaceDecl[] {
	return Object.entries(raw).map(([prefix, namespaceUri]) => ({ prefix, namespaceUri }));
}

// Lazily loaded predeclared namespace lists.
let w3cPredeclared: NamespaceDecl[] | null = null;
function loadW3cPredeclared(): NamespaceDecl[] {
	return (w3cPredeclared ??= toNamespaceDecls(loadJson(path.join(runtimesDir, "w3c-predeclared.json"))));
}

let existdbPredeclared: NamespaceDecl[] | null = null;
function loadExistdbPredeclared(): NamespaceDecl[] {
	return (existdbPredeclared ??= toNamespaceDecls(
		loadJson(path.join(runtimesDir, "existdb", "predeclared-namespaces.json")),
	));
}

const RUNTIME_FILES: Record<string, string[]> = {
	fonto: [path.join(runtimesDir, "fonto", "fonto.xq")],
	existdb: [
		path.join(runtimesDir, "existdb", "cache.xq"),
		path.join(runtimesDir, "existdb", "compression.xq"),
		path.join(runtimesDir, "existdb", "console.xq"),
		path.join(runtimesDir, "existdb", "contentextraction.xq"),
		path.join(runtimesDir, "existdb", "counter.xq"),
		path.join(runtimesDir, "existdb", "crypto.xq"),
		path.join(runtimesDir, "existdb", "datetime.xq"),
		path.join(runtimesDir, "existdb", "file.xq"),
		path.join(runtimesDir, "existdb", "ft.xq"),
		path.join(runtimesDir, "existdb", "httpclient.xq"),
		path.join(runtimesDir, "existdb", "image.xq"),
		path.join(runtimesDir, "existdb", "inspect.xq"),
		path.join(runtimesDir, "existdb", "kwic.xq"),
		path.join(runtimesDir, "existdb", "mail.xq"),
		path.join(runtimesDir, "existdb", "ngram.xq"),
		path.join(runtimesDir, "existdb", "process.xq"),
		path.join(runtimesDir, "existdb", "range.xq"),
		path.join(runtimesDir, "existdb", "repo.xq"),
		path.join(runtimesDir, "existdb", "request.xq"),
		path.join(runtimesDir, "existdb", "response.xq"),
		path.join(runtimesDir, "existdb", "scheduler.xq"),
		path.join(runtimesDir, "existdb", "session.xq"),
		path.join(runtimesDir, "existdb", "sm.xq"),
		path.join(runtimesDir, "existdb", "sort.xq"),
		path.join(runtimesDir, "existdb", "system.xq"),
		path.join(runtimesDir, "existdb", "transform.xq"),
		path.join(runtimesDir, "existdb", "util.xq"),
		path.join(runtimesDir, "existdb", "validation.xq"),
		path.join(runtimesDir, "existdb", "xmldb.xq"),
		path.join(runtimesDir, "existdb", "xmldiff.xq"),
	],
};

const runtimeAnalysisCache = new Map<string, FileAnalysis>();

/**
 * Returns all namespace declarations that are in scope without any explicit
 * `import module namespace` or `declare namespace` statement. Includes the
 * standard XQuery 3.1 predeclared namespaces (math, map, array) and any
 * runtime-specific additions (e.g. eXist-db's util, xmldb, …).
 */
export function getRuntimePredeclaredNamespaces(runtimes: string[]): NamespaceDecl[] {
	const result = [...loadW3cPredeclared()];
	if (runtimes.includes("existdb")) result.push(...loadExistdbPredeclared());
	return result;
}

/**
 * Return a copy of `analysis` with the given predeclared namespace declarations
 * merged into `namespaceDecls`. Prefixes already visible via imports, the
 * module's own prefix, or an existing `declare namespace` are skipped.
 */
export function withPredeclaredNs(analysis: FileAnalysis, predeclaredNs: NamespaceDecl[]): FileAnalysis {
	if (predeclaredNs.length === 0) return analysis;
	const known = new Set<string>([
		...analysis.imports.map((i) => i.prefix),
		...analysis.namespaceDecls.map((nd) => nd.prefix),
		...(analysis.modulePrefix ? [analysis.modulePrefix] : []),
	]);
	const toAdd = predeclaredNs.filter((nd) => !known.has(nd.prefix));
	if (toAdd.length === 0) return analysis;
	return { ...analysis, namespaceDecls: [...analysis.namespaceDecls, ...toAdd] };
}

export function getRuntimeAnalyses(runtimes: string[]): FileAnalysis[] {
	const results: FileAnalysis[] = [];
	for (const runtime of runtimes) {
		const filePaths = RUNTIME_FILES[runtime];
		if (!filePaths) continue;
		for (const filePath of filePaths) {
			const cacheKey = filePath;
			const cached = runtimeAnalysisCache.get(cacheKey);
			if (cached) {
				results.push(cached);
				continue;
			}
			try {
				const text = fs.readFileSync(filePath, "utf-8");
				const analysis = analyze(text, `builtin:${runtime}`);
				runtimeAnalysisCache.set(cacheKey, analysis);
				results.push(analysis);
			} catch {
				// ignore missing or unreadable runtime files
			}
		}
	}
	return results;
}
