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

	test("arrow with variable specifier ($f => $g()) is silently skipped (no name to check)", () => {
		// When the arrow specifier is a VarRef there is no EQName to resolve,
		// so we skip the check rather than crashing.
		const src = `let $f := fn:concat#2 return "a" => $f("b")`;
		const ds = fnCallDiags(src, withBuiltins);
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

// ── closed-world namespaces: local:, in-file namespace decls, default function
// namespace, and Q{} literals are all namespaces this file has (or could have)
// complete knowledge of, so an unmatched call there is XPST0017 rather than
// silently skipped — see issue #93. ────────────────────────────────────────────

describe("functioncall-diagnostics: closed-world namespaces report XPST0017", () => {
	test("undeclared local: function, even with no local: functions declared at all", () => {
		const ds = fnCallDiags(`local:doesNotExist(1, 2, 3)`);
		const d = ds.find((d) => d.code === "XPST0017");
		assert.ok(d, `expected XPST0017, got ${JSON.stringify(ds)}`);
		assert.ok(d!.message.includes("not declared"), `got: ${d!.message}`);
	});

	test("a namespace declared via 'declare namespace' but never imported has zero visible functions", () => {
		const ds = fnCallDiags(`declare namespace my = "http://example.com/ANamespace"; my:function(1)`);
		assert.ok(ds.some((d) => d.code === "XPST0017"), `expected XPST0017, got ${JSON.stringify(ds)}`);
	});

	test("an explicit default function namespace with no matching declaration", () => {
		const ds = fnCallDiags(`declare default function namespace "http://example.com/"; boolean(1)`);
		assert.ok(ds.some((d) => d.code === "XPST0017"), `expected XPST0017, got ${JSON.stringify(ds)}`);
	});

	test("a Q{} call into a namespace this file never imports", () => {
		const ds = fnCallDiags(
			`import module namespace b = 'http://example.com/m34/b'; Q{http://example.com/m34/c}c()`,
			new Map([
				["builtin:fn", builtins],
				["http://example.com/m34/b", analyzeWithAst(`module namespace b="http://example.com/m34/b"; declare function b:b(){1};`, "file:///b.xq").analysis],
				// "c" sits in the imports map (as a QT4-style catalog would provide it)
				// but was never imported by the query above — it must stay invisible.
				["http://example.com/m34/c", analyzeWithAst(`module namespace c="http://example.com/m34/c"; declare function c:c(){1};`, "file:///c.xq").analysis],
			]),
		);
		assert.ok(ds.some((d) => d.code === "XPST0017"), `expected XPST0017, got ${JSON.stringify(ds)}`);
	});

	test("a genuinely undeclared prefix is left to findUndeclaredPrefixUsages, not flagged here", () => {
		// myns: is never bound by any declaration — this is the same case the
		// "unknown namespace (not our concern)" NO_ERROR case above covers.
		const ds = fnCallDiags(`myns:whatever()`);
		assert.equal(ds.length, 0, `expected no diagnostics, got ${JSON.stringify(ds)}`);
	});
});

describe("functioncall-diagnostics: unresolved imports stay silent", () => {
	test("an import present in source but absent from importedAnalyses is not flagged", () => {
		// Simulates an "import module namespace ... at \"missing.xq\";" whose target
		// couldn't be resolved: the namespace is a real import, but we have no
		// analysis for it, so we can't know whether the function exists.
		const ds = fnCallDiags(`import module namespace ext = "http://example.com/ext" at "missing.xq"; ext:doStuff(1, 2)`, withBuiltins);
		assert.equal(ds.length, 0, `expected no diagnostics, got ${JSON.stringify(ds)}`);
	});
});

// ── %private/%public visibility across module imports ───────────────────────────

describe("functioncall-diagnostics: private function visibility", () => {
	const LIB_URI = "http://example.com/lib";
	function libAnalysis() {
		return analyzeWithAst(
			`module namespace lib = "${LIB_URI}";
			declare %private function lib:helper() { 1 };
			declare function lib:publicFn() { lib:helper() };`,
			"file:///lib.xq",
		).analysis;
	}

	test("a private function is not callable from an importing module", () => {
		const ds = fnCallDiags(
			`import module namespace lib = "${LIB_URI}"; lib:helper()`,
			new Map([
				["builtin:fn", builtins],
				[LIB_URI, libAnalysis()],
			]),
		);
		assert.ok(
			ds.some((d) => d.code === "XPST0017" && d.message.includes("not declared")),
			`expected XPST0017, got ${JSON.stringify(ds)}`,
		);
	});

	test("a public function is still callable and arity-checked normally", () => {
		const ds = fnCallDiags(
			`import module namespace lib = "${LIB_URI}"; lib:publicFn(1)`,
			new Map([
				["builtin:fn", builtins],
				[LIB_URI, libAnalysis()],
			]),
		);
		const d = ds.find((d) => d.code === "XPST0017");
		assert.ok(d, `expected XPST0017 for wrong arity, got ${JSON.stringify(ds)}`);
		assert.ok(d!.message.includes("got 1"), `got: ${d!.message}`);
	});

	test("a private function remains callable from within its own declaring file", () => {
		const ds = fnCallDiags(`declare %private function local:helper() { 1 }; local:helper()`);
		assert.equal(ds.length, 0, `expected no diagnostics, got ${JSON.stringify(ds)}`);
	});
});
