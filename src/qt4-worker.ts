import { workerData, parentPort } from "node:worker_threads";
import { analyzeWithAst } from "./analyzer.ts";
import { checkTypes } from "./typechecker.ts";
import { checkFunctionCalls } from "./functioncall-diagnostics.ts";
import { findUndeclaredPrefixUsages } from "./namespace-diagnostics.ts";
import { getBuiltins } from "./builtins.ts";

export interface TestInput {
	testSetSlug: string;
	testCase: string;
	query: string;
	expected: "static-error" | "no-static-error";
	expectedCode: string | null;
	envNamespaces: Array<{ prefix: string; uri: string }>;
}

export interface TestOutput {
	testSetSlug: string;
	testCase: string;
	outcome: "pass" | "false-positive" | "false-negative";
	expectedCode: string | null;
	got: string[];
}

const BUILTINS = new Map([["builtin:fn", getBuiltins()]]);

function runDiagnostics(query: string, envNamespaces: Array<{ prefix: string; uri: string }>): string[] {
	try {
		const { analysis, ast, parseError } = analyzeWithAst(query, "file:///test.xq");
		for (const ns of envNamespaces) {
			if (ns.prefix && !analysis.namespaceDecls.some((d) => d.prefix === ns.prefix)) {
				analysis.namespaceDecls.push({ prefix: ns.prefix, namespaceUri: ns.uri });
			}
		}
		const codes: string[] = [];
		if (parseError) codes.push("XPST0003");
		if (ast) {
			for (const d of checkTypes(ast, query, analysis, BUILTINS)) codes.push(d.code);
			for (const d of checkFunctionCalls(ast, analysis, BUILTINS)) codes.push(d.code);
			for (const d of findUndeclaredPrefixUsages(ast, analysis)) codes.push(d.code);
		}
		return [...new Set(codes)];
	} catch {
		return [];
	}
}

const batch = workerData as TestInput[];
const results: TestOutput[] = batch.map((tc) => {
	const got = runDiagnostics(tc.query, tc.envNamespaces);
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
