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
	});
});
