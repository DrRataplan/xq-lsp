import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { analyzeWithAst } from "./analyzer.ts";
import { checkUndeclaredVariables } from "./variable-diagnostics.ts";
import type { FileAnalysis } from "./types.ts";

function undeclaredVarDiags(src: string, imported: Map<string, FileAnalysis> = new Map()) {
	const { analysis, ast } = analyzeWithAst(src, "file:///main.xq");
	if (!ast) return [];
	return checkUndeclaredVariables(ast, analysis, imported);
}

describe("variable-diagnostics: undeclared variable (XPST0008)", () => {
	describe("flagged cases", () => {
		test("simple undeclared variable in query body", () => {
			const ds = undeclaredVarDiags(`$undefined`);
			assert.ok(ds.some((d) => d.code === "XPST0008" && d.message.includes("undefined")),
				`expected XPST0008 for $undefined, got ${JSON.stringify(ds)}`);
		});

		test("undeclared variable in let initializer", () => {
			const ds = undeclaredVarDiags(`let $x := $ghost return $x`);
			assert.ok(ds.some((d) => d.message.includes("ghost")),
				`expected XPST0008 for $ghost, got ${JSON.stringify(ds)}`);
		});

		test("undeclared variable in return expression", () => {
			const ds = undeclaredVarDiags(`let $x := 1 return $typo`);
			assert.ok(ds.some((d) => d.message.includes("typo")),
				`expected XPST0008 for $typo, got ${JSON.stringify(ds)}`);
		});

		test("undeclared variable in quantified satisfies clause", () => {
			const ds = undeclaredVarDiags(`every $x in (1, 2) satisfies $ghost > 0`);
			assert.ok(ds.some((d) => d.message.includes("ghost")),
				`expected XPST0008 for $ghost in satisfies, got ${JSON.stringify(ds)}`);
		});

		test("function param referenced outside function body", () => {
			const ds = undeclaredVarDiags(`declare function local:f($p) { $p }; $p`);
			assert.ok(ds.some((d) => d.message.includes("'$p'")),
				`expected XPST0008 for $p outside function, got ${JSON.stringify(ds)}`);
		});

		test("function param from another function body", () => {
			const ds = undeclaredVarDiags([
				`declare function local:f($p1) { 1 };`,
				`declare function local:g($p2) { $p1 };`,
				`1`,
			].join("\n"));
			assert.ok(ds.some((d) => d.message.includes("p1")),
				`expected XPST0008 for $p1 in local:g, got ${JSON.stringify(ds)}`);
		});

		test("let binding from another function body", () => {
			const ds = undeclaredVarDiags([
				`declare function local:f() { let $inner := 1 return $inner };`,
				`declare function local:g() { $inner };`,
				`1`,
			].join("\n"));
			assert.ok(ds.some((d) => d.message.includes("inner")),
				`expected XPST0008 for $inner in local:g, got ${JSON.stringify(ds)}`);
		});
	});

	describe("not flagged cases", () => {
		test("let binding visible in return", () => {
			const ds = undeclaredVarDiags(`let $x := 1 return $x`);
			assert.equal(ds.length, 0, `no errors expected, got ${JSON.stringify(ds)}`);
		});

		test("for binding visible in return", () => {
			const ds = undeclaredVarDiags(`for $x in (1, 2) return $x`);
			assert.equal(ds.length, 0, `no errors expected, got ${JSON.stringify(ds)}`);
		});

		test("function param visible in its body", () => {
			const ds = undeclaredVarDiags(`declare function local:f($p) { $p }; 1`);
			assert.equal(ds.length, 0, `no errors expected, got ${JSON.stringify(ds)}`);
		});

		test("module variable visible in query body", () => {
			const ds = undeclaredVarDiags(`declare variable $local:x := 1; $local:x`);
			assert.equal(ds.length, 0, `no errors expected, got ${JSON.stringify(ds)}`);
		});

		test("imported module variable not flagged", () => {
			const importedAnalysis = analyzeWithAst(
				`module namespace m="http://example.com"; declare variable $m:config := "x";`,
				"file:///lib.xq",
			).analysis;
			const ds = undeclaredVarDiags(
				`import module namespace m="http://example.com" at "lib.xq"; $m:config`,
				new Map([["file:///lib.xq", importedAnalysis]]),
			);
			assert.equal(ds.length, 0, `no errors expected, got ${JSON.stringify(ds)}`);
		});

		test("variable with undeclared prefix not flagged (XQST0081 handles it)", () => {
			// $ns:foo where ns is undeclared — XQST0081 fires, XPST0008 should not add noise
			const ds = undeclaredVarDiags(`$ns:foo`);
			assert.ok(!ds.some((d) => d.code === "XPST0008"),
				`XPST0008 should not fire for undeclared-prefix variables, got ${JSON.stringify(ds)}`);
		});

		test("inline function param visible inside its body", () => {
			const ds = undeclaredVarDiags(`
array:for-each(function ($item as xs:string) { $item }, ())`);
			assert.equal(ds.length, 0, `no errors expected, got ${JSON.stringify(ds)}`);
		});

		test("let binding inside inline function body not flagged", () => {
			const ds = undeclaredVarDiags(`
array:for-each(function ($cfg as map(*)) {
    let $name := map:keys($cfg)
    return $name
}, ())`);
			assert.equal(ds.length, 0, `no errors expected, got ${JSON.stringify(ds)}`);
		});

		test("inline function param not visible outside its body", () => {
			const ds = undeclaredVarDiags(
				`(array:for-each(function ($item as xs:string) { $item }, ()), $item)`,
			);
			assert.ok(ds.some((d) => d.message.includes("'$item'")),
				`expected XPST0008 for $item outside inline function, got ${JSON.stringify(ds)}`);
		});

		test("$err:* variables in catch clause not flagged", () => {
			const ds = undeclaredVarDiags(`try { 1 } catch * { $err:code }`);
			assert.ok(!ds.some((d) => d.message.includes("err:code")),
				`$err:code in catch should not be flagged, got ${JSON.stringify(ds)}`);
		});

		test("multiple lets visible to each other sequentially", () => {
			const ds = undeclaredVarDiags(
				`let $a := 1 let $b := $a return $b`,
			);
			assert.equal(ds.length, 0, `no errors expected, got ${JSON.stringify(ds)}`);
		});

		test("some-binding visible in satisfies expression", () => {
			const ds = undeclaredVarDiags(`some $x in (1, 2, 3) satisfies $x > 0`);
			assert.equal(ds.length, 0, `no errors expected, got ${JSON.stringify(ds)}`);
		});

		test("for positional variable visible in return", () => {
			const ds = undeclaredVarDiags(`for $item at $pos in ("a", "b") return $pos`);
			assert.equal(ds.length, 0, `no errors expected, got ${JSON.stringify(ds)}`);
		});

		test("count variable visible in return", () => {
			const ds = undeclaredVarDiags(`for $x in (1, 2) count $cnt return $cnt`);
			assert.equal(ds.length, 0, `no errors expected, got ${JSON.stringify(ds)}`);
		});

		test("outer FLWOR variable visible in nested FLWOR return", () => {
			const ds = undeclaredVarDiags(
				`for $outer in (1, 2) return (for $inner in (1, 2) return ($outer, $inner))`,
			);
			assert.equal(ds.length, 0, `no errors expected, got ${JSON.stringify(ds)}`);
		});

		test("typeswitch case-clause variable visible in its return expression", () => {
			const ds = undeclaredVarDiags(
				`typeswitch(1) case $a as xs:integer return $a default return 0`,
			);
			assert.equal(ds.length, 0, `no errors expected, got ${JSON.stringify(ds)}`);
		});

		test("typeswitch default-clause variable visible in its return expression", () => {
			const ds = undeclaredVarDiags(`typeswitch(1) case xs:string return 0 default $v return $v`);
			assert.equal(ds.length, 0, `no errors expected, got ${JSON.stringify(ds)}`);
		});

		test("typeswitch case-clause variable with union type visible in its return expression", () => {
			const ds = undeclaredVarDiags(
				`typeswitch(1) case $i as xs:integer | xs:string return $i default return 0`,
			);
			assert.equal(ds.length, 0, `no errors expected, got ${JSON.stringify(ds)}`);
		});

		test("typeswitch case-clause variable not visible in a different case's return expression", () => {
			const ds = undeclaredVarDiags(
				`typeswitch(1) case $a as xs:integer return 0 case $b as xs:string return $a default return 0`,
			);
			assert.ok(ds.some((d) => d.message.includes("'$a'")),
				`expected XPST0008 for $a leaking into the next case, got ${JSON.stringify(ds)}`);
		});

		test("EQName BracedURILiteral whitespace is insignificant", () => {
			const ds = undeclaredVarDiags(`for $Q{ urn:foo bar }x in 1 to 5 return $Q{urn:foo   bar}x`);
			assert.equal(ds.length, 0, `no errors expected, got ${JSON.stringify(ds)}`);
		});
	});
});
