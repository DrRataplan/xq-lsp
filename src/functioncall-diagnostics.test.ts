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

// ── NamedFunctionRef arity errors ──────────────────────────────────────────────

describe("functioncall-diagnostics: NamedFunctionRef arity error (XPST0017)", () => {
	test("fn:filter#0 (expects 2)", () => {
		const ds = fnCallDiags(`fn:filter#0`, withBuiltins);
		const d = ds.find((d) => d.code === "XPST0017");
		assert.ok(d, `expected XPST0017, got ${JSON.stringify(ds)}`);
		assert.ok(d!.message.includes("got 0"), `got: ${d!.message}`);
	});

	test("fn:exists#3 (expects 1)", () => {
		const ds = fnCallDiags(`fn:exists#3`, withBuiltins);
		const d = ds.find((d) => d.code === "XPST0017");
		assert.ok(d, `expected XPST0017, got ${JSON.stringify(ds)}`);
		assert.ok(d!.message.includes("got 3"), `got: ${d!.message}`);
	});

	test("fn:doesNotExist#2 in known namespace (not declared)", () => {
		const ds = fnCallDiags(`fn:doesNotExist#2`, withBuiltins);
		const d = ds.find((d) => d.code === "XPST0017");
		assert.ok(d, `expected XPST0017, got ${JSON.stringify(ds)}`);
		assert.ok(d!.message.includes("not declared"), `got: ${d!.message}`);
	});

	test("xs:string#1 (correct arity — no error)", () => {
		const ds = fnCallDiags(`xs:string#1`, withBuiltins);
		assert.equal(ds.length, 0, `expected no diagnostics, got ${JSON.stringify(ds)}`);
	});

	test("xs:string#2 (wrong arity)", () => {
		const ds = fnCallDiags(`xs:string#2`, withBuiltins);
		const d = ds.find((d) => d.code === "XPST0017");
		assert.ok(d, `expected XPST0017, got ${JSON.stringify(ds)}`);
		assert.ok(d!.message.includes("got 2"), `got: ${d!.message}`);
	});
});

// ── ArrowExpr arity errors ────────────────────────────────────────────────────

describe("functioncall-diagnostics: ArrowExpr arity (XPST0017)", () => {
	test('"a" => fn:concat() is XPST0017 (effective arity 1, concat needs 2+)', () => {
		const ds = fnCallDiags(`"a" => fn:concat()`, withBuiltins);
		const d = ds.find((d) => d.code === "XPST0017");
		assert.ok(d, `expected XPST0017, got ${JSON.stringify(ds)}`);
	});

	test('"a" => fn:concat("b") is valid (effective arity 2)', () => {
		const ds = fnCallDiags(`"a" => fn:concat("b")`, withBuiltins);
		assert.equal(ds.length, 0, `expected no diagnostics, got ${JSON.stringify(ds)}`);
	});
});

// ── xs: constructor arity errors ──────────────────────────────────────────────

describe("functioncall-diagnostics: xs: constructor arity (XPST0017)", () => {
	test("xs:string() with 0 args", () => {
		const ds = fnCallDiags(`xs:string()`, withBuiltins);
		const d = ds.find((d) => d.code === "XPST0017");
		assert.ok(d, `expected XPST0017, got ${JSON.stringify(ds)}`);
		assert.ok(d!.message.includes("got 0"), `got: ${d!.message}`);
	});

	test("xs:integer() with 0 args", () => {
		const ds = fnCallDiags(`xs:integer()`, withBuiltins);
		assert.ok(ds.some((d) => d.code === "XPST0017"), `expected XPST0017`);
	});

	test("xs:NOTATION() not declared (forbidden constructor)", () => {
		const ds = fnCallDiags(`xs:NOTATION("prefix:local")`, withBuiltins);
		const d = ds.find((d) => d.code === "XPST0017");
		assert.ok(d, `expected XPST0017, got ${JSON.stringify(ds)}`);
		assert.ok(d!.message.includes("not declared"), `got: ${d!.message}`);
	});

	test("xs:anyAtomicType() not declared (abstract type)", () => {
		const ds = fnCallDiags(`xs:anyAtomicType("x")`, withBuiltins);
		const d = ds.find((d) => d.code === "XPST0017");
		assert.ok(d, `expected XPST0017, got ${JSON.stringify(ds)}`);
	});

	test("xs:string(1) with 1 arg — no error", () => {
		const ds = fnCallDiags(`xs:string(1)`, withBuiltins);
		assert.equal(ds.length, 0, `expected no diagnostics, got ${JSON.stringify(ds)}`);
	});
});

// ── cases where NO diagnostic should be reported ─────────────────────────────

const NO_ERROR: Array<{ src: string; desc: string; imports?: Map<string, FileAnalysis> }> = [
	{ src: `fn:exists((1,2,3))`, desc: "correct arity", imports: withBuiltins },
	{ src: `fn:subsequence((1,2,3), 2)`, desc: "fn:subsequence/2 (valid overload)", imports: withBuiltins },
	{ src: `fn:concat("a", "b")`, desc: "fn:concat/2 (minimum variadic)", imports: withBuiltins },
	{ src: `fn:concat("a", "b", "c", "d", "e")`, desc: "fn:concat/5 (above minimum)", imports: withBuiltins },
	{ src: `myns:unknownFunc(1, 2, 3)`, desc: "unknown namespace (not our concern)", imports: withBuiltins },
	{ src: `fn:exists#1`, desc: "fn:exists#1 (correct arity)", imports: withBuiltins },
	{ src: `xs:integer(1)`, desc: "xs:integer/1 (valid constructor call)", imports: withBuiltins },
];

describe("functioncall-diagnostics: no error", () => {
	for (const { src, desc, imports } of NO_ERROR) {
		test(desc, () => {
			const ds = fnCallDiags(src, imports);
			assert.equal(ds.length, 0, `expected no diagnostics, got ${JSON.stringify(ds)}`);
		});
	}
});
