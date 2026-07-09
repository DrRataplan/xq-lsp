import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { analyzeWithAst } from "./analyzer.ts";
import { checkDuplicateFunctions } from "./duplicate-function-diagnostics.ts";
import type { FileAnalysis } from "./types.ts";

function dupDiags(src: string, importedAnalyses: Map<string, FileAnalysis> = new Map()) {
	const { analysis, ast } = analyzeWithAst(src, "file:///main.xq");
	if (!ast) return [];
	return checkDuplicateFunctions(ast, analysis, importedAnalyses);
}

describe("duplicate-function-diagnostics: XQST0034 reported", () => {
	test("same name, same arity, declared twice", () => {
		const src = `
			declare function local:foo($m as xs:integer) { $m };
			declare function local:foo($n as xs:integer) { $n };
			local:foo(4)`;
		const ds = dupDiags(src);
		assert.equal(ds.length, 2, `expected both declarations flagged, got ${JSON.stringify(ds)}`);
		assert.ok(ds.every((d) => d.code === "XQST0034"));
		assert.ok(ds.every((d) => d.message.includes("local:foo")));
	});

	test("differing return type is insignificant to the clash", () => {
		const src = `
			declare function local:myName() as xs:integer { 1 };
			declare function local:myName() as xs:nonPositiveInteger { 1 };
			1`;
		const ds = dupDiags(src);
		assert.equal(ds.length, 2);
	});

	test("differing parameter type is insignificant to the clash", () => {
		const src = `
			declare function local:myName($v as xs:integer) { 1 };
			declare function local:myName($v as xs:nonPositiveInteger) { 1 };
			1`;
		const ds = dupDiags(src);
		assert.equal(ds.length, 2);
	});

	test("differing parameter name is insignificant to the clash", () => {
		const src = `
			declare function local:myName($a) { 1 };
			declare function local:myName($b) { 1 };
			1`;
		const ds = dupDiags(src);
		assert.equal(ds.length, 2);
	});

	test("three declarations with the same key are all flagged", () => {
		const src = `
			declare function local:foo() { 1 };
			declare function local:foo() { 2 };
			declare function local:foo() { 3 };
			1`;
		const ds = dupDiags(src);
		assert.equal(ds.length, 3);
	});

	test("declaration collides with an imported module's function", () => {
		const importedSrc = `module namespace test1 = "http://example.com/test1"; declare function test1:ok() { "ok" };`;
		const { analysis: importedAnalysis } = analyzeWithAst(importedSrc, "file:///test1.xq");
		const imports = new Map<string, FileAnalysis>([["http://example.com/test1", importedAnalysis]]);

		const src = `
			import module namespace test1 = "http://example.com/test1" at "test1.xq";
			declare function test1:ok() { "shadowed" };
			test1:ok()`;
		const ds = dupDiags(src, imports);
		assert.equal(ds.length, 1, `expected the local redeclaration flagged, got ${JSON.stringify(ds)}`);
		assert.equal(ds[0].code, "XQST0034");
		assert.ok(ds[0].message.includes("test1:ok"));
	});

	test("diagnostic offset/length point at the function name", () => {
		const src = `declare function local:dup() { 1 }; declare function local:dup() { 2 }; 1`;
		const ds = dupDiags(src);
		const first = ds.find((d) => d.offset === src.indexOf("local:dup"));
		assert.ok(first, `expected a diagnostic anchored at the first 'local:dup', got ${JSON.stringify(ds)}`);
		assert.equal(first!.length, "local:dup".length);
	});
});

describe("duplicate-function-diagnostics: no error", () => {
	test("single declaration", () => {
		const ds = dupDiags(`declare function local:foo() { 1 }; local:foo()`);
		assert.equal(ds.length, 0);
	});

	test("overloading by arity is allowed", () => {
		const src = `
			declare function local:myName($v as xs:integer) as xs:integer { $v };
			declare function local:myName() as xs:integer { 1 };
			(local:myName(4) - 3) eq local:myName()`;
		const ds = dupDiags(src);
		assert.equal(ds.length, 0);
	});

	test("different namespaces, same local name and arity, no clash", () => {
		const src = `
			declare namespace a = "http://example.com/a";
			declare namespace b = "http://example.com/b";
			declare function a:foo() { 1 };
			declare function b:foo() { 2 };
			1`;
		const ds = dupDiags(src);
		assert.equal(ds.length, 0);
	});
});
