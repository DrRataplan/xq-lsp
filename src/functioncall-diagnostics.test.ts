import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { analyzeWithAst } from "./analyzer.ts";
import { getBuiltins } from "./builtins.ts";
import { checkFunctionCalls } from "./functioncall-diagnostics.ts";
import type { FileAnalysis } from "./types.ts";

const builtins = getBuiltins();
const withBuiltins = new Map<string, FileAnalysis>([["builtin:fn", builtins]]);

function fnCallDiags(src: string, importedAnalyses: Map<string, FileAnalysis> = new Map()) {
	const { analysis, ast } = analyzeWithAst(src, "file:///main.xq");
	if (!ast) return [];
	return checkFunctionCalls(ast, analysis, importedAnalyses);
}

// ── cases where XPST0017 SHOULD be reported ───────────────────────────────────

const ARITY_ERRORS: Array<{ src: string; name: string; gotArity: number; imports?: Map<string, FileAnalysis> }> = [
	{ src: `fn:true("extra")`, name: "fn:true", gotArity: 1, imports: withBuiltins },
	{ src: `fn:subsequence((1,2,3), 2, 1, "extra")`, name: "fn:subsequence", gotArity: 4, imports: withBuiltins },
	{
		src: `declare function local:add($a, $b) { $a + $b }; local:add(1, 2, 3)`,
		name: "local:add",
		gotArity: 3,
	},
	{ src: `fn:concat("only-one")`, name: "fn:concat", gotArity: 1, imports: withBuiltins },
];

describe("functioncall-diagnostics: arity error reported (XPST0017)", () => {
	for (const { src, name, gotArity, imports } of ARITY_ERRORS) {
		test(`${name} called with ${gotArity} args`, () => {
			const ds = fnCallDiags(src, imports);
			const d = ds.find((d) => d.code === "XPST0017");
			assert.ok(d, `expected XPST0017, got ${JSON.stringify(ds)}`);
			assert.ok(d!.message.includes(name), `expected ${name} in message, got: ${d!.message}`);
			assert.ok(d!.message.includes(`got ${gotArity}`), `expected "got ${gotArity}" in message, got: ${d!.message}`);
		});
	}

	test("fn:concat with 1 arg message says 'or more' (variadic minimum)", () => {
		const ds = fnCallDiags(`fn:concat("only-one")`, withBuiltins);
		const d = ds.find((d) => d.code === "XPST0017");
		assert.ok(d!.message.includes("or more"), `expected "or more" in variadic message, got: ${d!.message}`);
	});

	test("undeclared function in known namespace reported as not declared", () => {
		const ds = fnCallDiags(`fn:doesNotExist(1)`, withBuiltins);
		const d = ds.find((d) => d.code === "XPST0017");
		assert.ok(d, `expected XPST0017, got ${JSON.stringify(ds)}`);
		assert.ok(d!.message.includes("fn:doesNotExist"), `got: ${d!.message}`);
		assert.ok(d!.message.includes("not declared"), `got: ${d!.message}`);
	});
});

// ── cases where NO diagnostic should be reported ─────────────────────────────

const NO_ERROR: Array<{ src: string; desc: string; imports?: Map<string, FileAnalysis> }> = [
	{ src: `fn:exists((1,2,3))`, desc: "correct arity", imports: withBuiltins },
	{ src: `fn:subsequence((1,2,3), 2)`, desc: "fn:subsequence/2 (valid overload)", imports: withBuiltins },
	{ src: `fn:concat("a", "b")`, desc: "fn:concat/2 (minimum variadic)", imports: withBuiltins },
	{ src: `fn:concat("a", "b", "c", "d", "e")`, desc: "fn:concat/5 (above minimum)", imports: withBuiltins },
	{ src: `myns:unknownFunc(1, 2, 3)`, desc: "unknown namespace (not our concern)", imports: withBuiltins },
];

describe("functioncall-diagnostics: no error", () => {
	for (const { src, desc, imports } of NO_ERROR) {
		test(desc, () => {
			const ds = fnCallDiags(src, imports);
			assert.equal(ds.length, 0, `expected no diagnostics, got ${JSON.stringify(ds)}`);
		});
	}
});
