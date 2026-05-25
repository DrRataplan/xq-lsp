import { workerData, parentPort } from "node:worker_threads";
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
	// Catalog <module uri="..." file="..."/> entries: the test harness's own
	// namespace-to-file association, used when a query imports a module
	// without (or without a resolvable) "at" location hint. Keyed by the
	// catalog's declared uri so mismatches against the file's own `module
	// namespace` decl can be caught the same way a resolved "at" hint would be.
	moduleCatalog: Array<{ uri: string; text: string }>;
	xqueryVersion: "3.1" | "4.0";
}

export interface TestOutput {
	testSetSlug: string;
	testCase: string;
	outcome: "pass" | "false-positive" | "false-negative";
	expectedCode: string | null;
	got: string[];
}

function collectCodes(
	query: string,
	envNamespaces: Array<{ prefix: string; uri: string }>,
	envVariables: Array<{ prefix: string; localName: string }>,
	moduleCatalog: Array<{ uri: string; text: string }>,
	xqueryVersion: "3.1" | "4.0",
): string[] {
	try {
		const { analysis, ast, parseError } = analyzeWithAst(query, "file:///test.xq", xqueryVersion);
		const imports = new Map<string, FileAnalysis>([["builtin:fn", getBuiltins(xqueryVersion)]]);
		for (const m of moduleCatalog) {
			const modAnalysis = analyzeWithAst(m.text, "file:///catalog-module.xq", xqueryVersion).analysis;
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
		if (parseError) codes.push("XPST0003");
		if (ast) {
			for (const d of runDiagnostics(ast, query, analysis, imports)) codes.push(d.code);
		}
		return [...new Set(codes)];
	} catch {
		return [];
	}
}

const batch = workerData as TestInput[];
const results: TestOutput[] = batch.map((tc) => {
	const got = collectCodes(tc.query, tc.envNamespaces, tc.envVariables, tc.moduleCatalog, tc.xqueryVersion);
	const hasError = got.length > 0;
	const outcome =
		tc.expected === "static-error"
			? hasError
				? "pass"
				: "false-negative"
			: hasError
				? "false-positive"
				: "pass";
	return { testSetSlug: tc.testSetSlug, testCase: tc.testCase, outcome, expectedCode: tc.expectedCode, got };
});

parentPort!.postMessage(results);
