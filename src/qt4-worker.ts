import { workerData, parentPort } from "node:worker_threads";
import type { Node } from "xq-parser";
import { analyzeWithAst, resolvePrefix } from "./analyzer.ts";
import { runDiagnostics } from "./diagnostics.ts";
import { getBuiltins } from "./builtins.ts";
import { qnameKey } from "./types.ts";
import type { FileAnalysis } from "./types.ts";

export interface TestInput {
	testSetSlug: string;
	testCase: string;
	query: string;
	expected: "static-error" | "no-static-error";
	expectedCode: string | null;
	envNamespaces: Array<{ prefix: string; uri: string }>;
	envVariables: Array<{ prefix: string; localName: string }>;
	// The environment supplies a context item (<source role=".">).
	envContextItem: boolean;
	// Catalog <module uri="..." file="..."/> entries: the test harness's own
	// namespace-to-file association, used when a query imports a module
	// without (or without a resolvable) "at" location hint. Keyed by the
	// catalog's declared uri so mismatches against the file's own `module
	// namespace` decl can be caught the same way a resolved "at" hint would be.
	moduleCatalog: Array<{ uri: string; text: string }>;
}

export interface TestOutput {
	testSetSlug: string;
	testCase: string;
	outcome: "pass" | "false-positive" | "false-negative";
	expectedCode: string | null;
	got: string[];
	// Codes of opt-in strict-mode warnings (severity "warning") from a second run
	// with strictCardinality enabled. Tracked separately: they never affect `outcome`.
	strictGot: string[];
}

const BUILTINS = new Map([["builtin:fn", getBuiltins()]]);

function collectCodes(
	query: string,
	envNamespaces: Array<{ prefix: string; uri: string }>,
	envVariables: Array<{ prefix: string; localName: string }>,
	moduleCatalog: Array<{ uri: string; text: string }>,
	envContextItem: boolean,
): { got: string[]; strictGot: string[] } {
	try {
		const { analysis, ast, parseError } = analyzeWithAst(query, "file:///test.xq");
		const imports = new Map<string, FileAnalysis>(BUILTINS);
		// Analyze all catalog modules up front so their symbols are in `imports`
		// both when diagnosing the main query and when diagnosing each other —
		// otherwise calls to builtins or sibling-module functions in a module
		// would be falsely reported as XPST0017.
		const modules: Array<{ uri: string; text: string; analysis: FileAnalysis; ast: Node | null }> = [];
		for (const m of moduleCatalog) {
			const { analysis: modAnalysis, ast: modAst } = analyzeWithAst(m.text, "file:///catalog-module.xq");
			modules.push({ uri: m.uri, text: m.text, analysis: modAnalysis, ast: modAst });
			// Multiple <module> catalog entries can share the same uri (alternate
			// location-hint candidates for one namespace) — merge their symbols
			// rather than letting the last one clobber the others.
			const existing = imports.get(m.uri);
			imports.set(
				m.uri,
				existing
					? {
							...existing,
							functions: [...existing.functions, ...modAnalysis.functions],
							moduleVariables: [...existing.moduleVariables, ...modAnalysis.moduleVariables],
						}
					: modAnalysis,
			);
		}
		for (const ns of envNamespaces) {
			if (ns.prefix && !analysis.namespaceDecls.some((d) => d.prefix === ns.prefix)) {
				analysis.namespaceDecls.push({ prefix: ns.prefix, namespaceUri: ns.uri, offset: -1 });
			}
		}
		// <param>/<source role="$..."> bind variables externally, without a
		// `declare variable ... external;` in the query text — model them as
		// known module variables so they don't trip the undeclared-variable check.
		for (const v of envVariables) {
			const namespaceUri = v.prefix ? resolvePrefix(v.prefix, analysis) : "";
			const key = qnameKey({ namespaceUri, localName: v.localName, prefix: v.prefix });
			if (!analysis.moduleVariables.some((m) => qnameKey(m.qname) === key)) {
				analysis.moduleVariables.push({
					qname: { namespaceUri, localName: v.localName, prefix: v.prefix },
					offset: -1,
					isModuleLevel: true,
					sourceUri: "file:///test.xq",
				});
			}
		}
		const codes: string[] = [];
		const strictCodes: string[] = [];
		if (parseError) codes.push("XPST0003");
		if (ast) {
			// Run diagnostics on the main query
			for (const d of runDiagnostics(ast, query, analysis, imports, { externalContextItem: envContextItem })) codes.push(d.code);
			// Aggregate diagnostics from imported modules. The same module file can
			// be registered under several catalog uris (alternate location hints)
			// and several files can share one uri (import-cycle tests): when
			// diagnosing one of them, its own declarations must not collide with
			// themselves as XQST0034, so the imports entries for its own uris get
			// those declarations filtered out (they remain visible through the
			// module's own analysis). The context-item check is suppressed too:
			// whether a module gets a context item is decided at
			// fn:load-xquery-module call time, not statically.
			const urisByText = new Map<string, string[]>();
			for (const m of modules) {
				const arr = urisByText.get(m.text) ?? [];
				arr.push(m.uri);
				urisByText.set(m.text, arr);
			}
			const diagnosedTexts = new Set<string>();
			for (const m of modules) {
				if (!m.ast || diagnosedTexts.has(m.text)) continue;
				diagnosedTexts.add(m.text);
				const moduleImports = new Map(imports);
				for (const u of urisByText.get(m.text) ?? []) {
					const entry = imports.get(u);
					if (!entry) continue;
					const ownKeys = new Set(m.analysis.functions.map((f) => `${qnameKey(f.qname)}#${f.arity}`));
					const ownVarKeys = new Set(m.analysis.moduleVariables.map((v) => qnameKey(v.qname)));
					moduleImports.set(u, {
						...entry,
						functions: entry.functions.filter((f) => !ownKeys.has(`${qnameKey(f.qname)}#${f.arity}`)),
						moduleVariables: entry.moduleVariables.filter((v) => !ownVarKeys.has(qnameKey(v.qname))),
					});
				}
				for (const d of runDiagnostics(m.ast, m.text, m.analysis, moduleImports, { externalContextItem: true })) codes.push(d.code);
			}
			// Second pass with strict cardinality checking: warning-severity diagnostics
			// are tracked separately and never affect the outcome.
			for (const d of runDiagnostics(ast, query, analysis, imports, { externalContextItem: envContextItem, strictCardinality: true })) {
				if (d.severity === "warning") strictCodes.push(d.code);
			}
		}
		return { got: [...new Set(codes)], strictGot: [...new Set(strictCodes)] };
	} catch {
		return { got: [], strictGot: [] };
	}
}

const batch = workerData as TestInput[];
const results: TestOutput[] = batch.map((tc) => {
	const { got, strictGot } = collectCodes(tc.query, tc.envNamespaces, tc.envVariables, tc.moduleCatalog, tc.envContextItem);
	const hasError = got.length > 0;
	// A static analyzer may detect a dynamic error early: when the test expects a
	// dynamic error (e.g. XPTY0004) and that is exactly what we reported, it's a pass.
	const outcome: TestOutput["outcome"] =
		tc.expected === "static-error"
			? hasError
				? "pass"
				: "false-negative"
			: !hasError || got.every((c) => c === tc.expectedCode)
				? "pass"
				: "false-positive";
	return { testSetSlug: tc.testSetSlug, testCase: tc.testCase, outcome, expectedCode: tc.expectedCode, got, strictGot };
});

parentPort!.postMessage(results);
