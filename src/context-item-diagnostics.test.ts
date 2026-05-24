import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { analyzeWithAst } from "./analyzer.ts";
import { checkContextItemUsage } from "./context-item-diagnostics.ts";

function ciDiags(src: string) {
	const { ast } = analyzeWithAst(src, "file:///main.xq");
	if (!ast) return [];
	return checkContextItemUsage(ast);
}

function hasError(src: string) {
	return ciDiags(src).some((d) => d.code === "XPDY0002");
}

// ── Flagged: function bodies ──────────────────────────────────────────────────

describe("context-item-diagnostics: flagged in function bodies", () => {
	test("bare axis step in function body", () => {
		assert.ok(hasError(`declare function local:f() { child::x }; 1`));
	});

	test("context item expression (.) in function body", () => {
		assert.ok(hasError(`declare function local:f() { . }; 1`));
	});

	test("parent axis (..) in function body", () => {
		assert.ok(hasError(`declare function local:f() { .. }; 1`));
	});

	test("attribute axis (@attr) in function body", () => {
		assert.ok(hasError(`declare function local:f() { @type }; 1`));
	});

	test("axis step in let binding inside function body", () => {
		assert.ok(hasError(`declare function local:f() { let $c := child::x return $c }; 1`));
	});

	test("axis step in for-in binding inside function body", () => {
		assert.ok(hasError(`declare function local:f() { for $x in child::y return $x }; 1`));
	});

	test("dot as leading step of path inside function body", () => {
		// The "." is the error; child::x after "/" has CI from the dot result
		const ds = ciDiags(`declare function local:f() { ./child::x }; 1`);
		assert.ok(
			ds.some((d) => d.code === "XPDY0002"),
			`expected XPDY0002, got ${JSON.stringify(ds)}`,
		);
		// Only the leading "." is flagged, not child::x (it gets CI from the dot step)
		assert.equal(ds.length, 1, `expected exactly one diagnostic, got ${JSON.stringify(ds)}`);
	});

	test("axis step in else branch of if inside function body", () => {
		assert.ok(hasError(`declare function local:f() { if (true()) then 1 else child::x }; 1`));
	});

	test("axis step in function argument inside function body", () => {
		assert.ok(hasError(`declare function local:f() { count(child::x) }; 1`));
	});
});

// ── Flagged: declare variable bindings ───────────────────────────────────────

describe("context-item-diagnostics: flagged in declare variable", () => {
	test("axis step in declare variable binding", () => {
		assert.ok(hasError(`declare variable $v := child::x; 1`));
	});

	test("context item expression in declare variable binding", () => {
		assert.ok(hasError(`declare variable $v := .; 1`));
	});

	test("attribute step in declare variable binding", () => {
		assert.ok(hasError(`declare variable $v := @id; 1`));
	});
});

// ── Flagged: inline function bodies ──────────────────────────────────────────

describe("context-item-diagnostics: flagged in inline functions", () => {
	test("axis step in inline function body in main module", () => {
		assert.ok(hasError(`let $f := function() { child::x } return $f()`));
	});

	test("axis step in inline function body inside declared function", () => {
		assert.ok(hasError(`declare function local:f() { let $g := function() { child::x } return $g() }; 1`));
	});
});

// ── Not flagged: CI is available ─────────────────────────────────────────────

describe("context-item-diagnostics: not flagged when CI is present", () => {
	test("path starting with variable reference", () => {
		assert.equal(ciDiags(`declare function local:f($n) { $n/child::x }; 1`).length, 0);
	});

	test("absolute path (starts with /)", () => {
		assert.equal(ciDiags(`declare function local:f() { /root/child::x }; 1`).length, 0);
	});

	test("absolute path // shorthand", () => {
		assert.equal(ciDiags(`declare function local:f() { //child::x }; 1`).length, 0);
	});

	test("axis step inside predicate gets CI from filtered sequence", () => {
		assert.equal(ciDiags(`declare function local:f($nodes) { $nodes[child::x] }; 1`).length, 0);
	});

	test("context item inside predicate is OK", () => {
		assert.equal(ciDiags(`declare function local:f($items) { $items[. = "a"] }; 1`).length, 0);
	});

	test("attribute step inside predicate is OK", () => {
		assert.equal(ciDiags(`declare function local:f($nodes) { $nodes[@id = "x"] }; 1`).length, 0);
	});

	test("dot on right-hand side of simple map", () => {
		assert.equal(ciDiags(`declare function local:f($items) { $items ! . }; 1`).length, 0);
	});

	test("path after simple map ! has CI from left operand", () => {
		assert.equal(ciDiags(`declare function local:f($items) { $items ! ./name }; 1`).length, 0);
	});

	test("axis step after ! in simple map", () => {
		assert.equal(ciDiags(`declare function local:f($nodes) { $nodes ! child::x }; 1`).length, 0);
	});

	test("axis step in subsequent path step (has CI from preceding)", () => {
		// $n/child::a — child::a is the second step, has CI from $n
		assert.equal(ciDiags(`declare function local:f($n) { $n/child::a/child::b }; 1`).length, 0);
	});

	test("axis step at module top level is not flagged", () => {
		// Main module body: CI may be provided externally
		assert.equal(ciDiags(`child::x`).length, 0);
	});

	test("dot at module top level is not flagged", () => {
		assert.equal(ciDiags(`.`).length, 0);
	});

	test("predicate on axis step that itself has CI", () => {
		// $n/child::x[child::y] — both child::x and child::y have CI
		assert.equal(ciDiags(`declare function local:f($n) { $n/child::x[child::y] }; 1`).length, 0);
	});

	test("inline function with parameter providing CI via path", () => {
		assert.equal(
			ciDiags(`declare function local:f($nodes) { $nodes ! (function($n) { $n/child::x })(.) }; 1`).length,
			0,
		);
	});

	test("for binding over absolute path in function body", () => {
		assert.equal(ciDiags(`declare function local:f() { for $x in /root/child return $x }; 1`).length, 0);
	});
});

// ── Offset and length correctness ─────────────────────────────────────────────

describe("context-item-diagnostics: diagnostic positions", () => {
	test("offset points at the start of the axis step", () => {
		// "declare variable $v := child::x; 1"
		//  0123456789012345678901234
		//                          ^ offset 23
		const src = `declare variable $v := child::x; 1`;
		const ds = ciDiags(src);
		assert.equal(ds.length, 1, `expected one diagnostic, got ${JSON.stringify(ds)}`);
		const d = ds[0];
		assert.equal(src.slice(d.offset, d.offset + d.length), "child::x", `expected axis step text`);
	});

	test("offset points at '.' for context item expression", () => {
		const src = `declare variable $v := .; 1`;
		const ds = ciDiags(src);
		assert.equal(ds.length, 1, `expected one diagnostic, got ${JSON.stringify(ds)}`);
		const d = ds[0];
		assert.equal(src.slice(d.offset, d.offset + d.length), ".", `expected '.'`);
	});
});
