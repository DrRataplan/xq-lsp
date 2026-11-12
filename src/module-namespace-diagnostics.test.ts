import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { analyzeWithAst } from "./analyzer.ts";
import { checkModuleNamespaceDecls } from "./module-namespace-diagnostics.ts";

function diags(src: string) {
	const { analysis, ast } = analyzeWithAst(src, "file:///lib.xq");
	return ast ? checkModuleNamespaceDecls(ast, analysis) : [];
}

describe("XQST0048", () => {
	test("local function in library module", () => {
		const ds = diags(`module namespace m = "urn:m"; declare function local:f() { 1 };`);
		assert.deepEqual(ds.map((d) => d.code), ["XQST0048"]);
		assert.match(ds[0].message, /expected prefix: 'm'/);
	});
	test("variable in wrong namespace", () => {
		const ds = diags(`module namespace m = "urn:m"; declare variable $local:v := 1;`);
		assert.deepEqual(ds.map((d) => d.code), ["XQST0048"]);
		assert.match(ds[0].message, /expected prefix: 'm'/);
	});
	test("function in module namespace is fine", () => {
		assert.deepEqual(diags(`module namespace m = "urn:m"; declare function m:f() { 1 }; declare variable $m:v := 1;`), []);
	});
	test("main module may use local:", () => {
		assert.deepEqual(diags(`declare function local:f() { 1 }; local:f()`), []);
	});
});
