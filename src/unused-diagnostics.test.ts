import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { analyzeWithAst } from "./analyzer.ts";
import { checkUnused } from "./unused-diagnostics.ts";

function unusedDiags(src: string) {
	const { analysis, ast } = analyzeWithAst(src, "file:///main.xq");
	if (!ast) return [];
	return checkUnused(ast, analysis);
}

// ── cases that SHOULD flag unused ────────────────────────────────────────────

describe("unused-diagnostics: flagged", () => {
	test("%private function never called → xq-lsp:unused-function", () => {
		const ds = unusedDiags(`
declare %private function local:unused($x) { $x };
1
`);
		const d = ds.find((d) => d.code === "xq-lsp:unused-function");
		assert.ok(d, `expected xq-lsp:unused-function, got ${JSON.stringify(ds)}`);
		assert.ok(d!.message.includes("unused"), `got: ${d!.message}`);
	});

	test("%private module variable never referenced → xq-lsp:unused-variable", () => {
		const ds = unusedDiags(`
declare %private variable $local:unused := 42;
1
`);
		const d = ds.find((d) => d.code === "xq-lsp:unused-variable");
		assert.ok(d, `expected xq-lsp:unused-variable, got ${JSON.stringify(ds)}`);
		assert.ok(d!.message.includes("unused"), `got: ${d!.message}`);
	});

	test("%private function called with wrong arity only → flagged as unused", () => {
		const ds = unusedDiags(`
declare %private function local:f($x) { $x };
local:f(1, 2)
`);
		assert.ok(ds.find((d) => d.code === "xq-lsp:unused-function"), `expected flag when only called with wrong arity`);
	});

	test("overloaded %private functions — unused arity is flagged, used arity is not", () => {
		const ds = unusedDiags(`
declare %private function local:f($x) { $x };
declare %private function local:f($x, $y) { $x + $y };
local:f(42)
`);
		assert.equal(ds.length, 1, `expected only the unused overload, got ${JSON.stringify(ds)}`);
		assert.equal(ds[0].code, "xq-lsp:unused-function");
	});

	test("local let-binding does not suppress unused diagnostic on module variable", () => {
		const ds = unusedDiags(`
declare %private variable $x := 42;
let $x := "shadow"
return $x
`);
		assert.ok(ds.find((d) => d.code === "xq-lsp:unused-variable"), `expected module $x to be flagged`);
	});
});

// ── cases that should NOT flag ────────────────────────────────────────────────

describe("unused-diagnostics: not flagged", () => {
	test("%private function that is called", () => {
		const ds = unusedDiags(`
declare %private function local:greet($name) { "Hello " || $name };
local:greet("World")
`);
		assert.equal(ds.length, 0, `got ${JSON.stringify(ds)}`);
	});

	test("unannotated function (public by default)", () => {
		const ds = unusedDiags(`
declare function local:pub($x) { $x };
1
`);
		assert.equal(ds.length, 0, `got ${JSON.stringify(ds)}`);
	});

	test("%public function", () => {
		const ds = unusedDiags(`
declare %public function local:pub($x) { $x };
1
`);
		assert.equal(ds.length, 0, `got ${JSON.stringify(ds)}`);
	});

	test("%private function with _ prefix", () => {
		const ds = unusedDiags(`
declare %private function local:_helper($x) { $x };
1
`);
		assert.equal(ds.length, 0, `got ${JSON.stringify(ds)}`);
	});

	test("unannotated module variable (public by default)", () => {
		const ds = unusedDiags(`
declare variable $local:count := 42;
1
`);
		assert.equal(ds.length, 0, `got ${JSON.stringify(ds)}`);
	});

	test("%private module variable that is referenced", () => {
		const ds = unusedDiags(`
declare %private variable $local:count := 42;
$local:count + 1
`);
		assert.equal(ds.length, 0, `got ${JSON.stringify(ds)}`);
	});

	test("%private variable with _ prefix", () => {
		const ds = unusedDiags(`
declare %private variable $local:_unused := 42;
1
`);
		assert.equal(ds.length, 0, `got ${JSON.stringify(ds)}`);
	});

	test("function used via NamedFunctionRef (#arity)", () => {
		const ds = unusedDiags(`
declare function local:fn($x) { $x };
let $ref := local:fn#1
return $ref(42)
`);
		assert.equal(ds.length, 0, `got ${JSON.stringify(ds)}`);
	});

	test("mutually recursive %private functions with external caller", () => {
		const ds = unusedDiags(`
declare %private function local:even($n) { if ($n = 0) then true() else local:odd($n - 1) };
declare %private function local:odd($n) { if ($n = 0) then false() else local:even($n - 1) };
local:even(4)
`);
		assert.equal(ds.length, 0, `got ${JSON.stringify(ds)}`);
	});

	test("mutually recursive %private functions without external caller (cycle not tracked)", () => {
		const ds = unusedDiags(`
declare %private function local:ping($n) { local:pong($n) };
declare %private function local:pong($n) { local:ping($n) };
1
`);
		assert.equal(ds.length, 0, `expected no diagnostics (cycle detection not implemented), got ${JSON.stringify(ds)}`);
	});
});

// ── FLWOR clause walker: scoped bindings must not shadow module variables ─────

const FLWOR_WALKER_CASES: Array<{ desc: string; body: string }> = [
	{ desc: "for with positional var", body: `for $item at $pos in (1, 2, 3) return $pos` },
	{ desc: "count clause", body: `for $x in (1, 2) count $i return $i` },
	{ desc: "group-by with :=", body: `for $x in (1, 2) let $y := $x group by $key := $y return $key` },
	{ desc: "tumbling window", body: `for tumbling window $w in (1, 2, 3) start when true() return count($w)` },
	{ desc: "quantified expression", body: `some $x in (1, 2, 3) satisfies $x > 2` },
	{ desc: "catch clause body", body: `try { 1 } catch * { 0 }` },
];

describe("unused-diagnostics: FLWOR walker coverage", () => {
	for (const { desc, body } of FLWOR_WALKER_CASES) {
		test(`${desc} — $local:unused still flagged`, () => {
			const ds = unusedDiags(`
declare %private variable $local:unused := 0;
${body}
`);
			assert.ok(
				ds.some((d) => d.code === "xq-lsp:unused-variable"),
				`expected $local:unused to be flagged, got ${JSON.stringify(ds)}`,
			);
		});
	}
});
