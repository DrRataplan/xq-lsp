import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { analyzeWithAst } from "./analyzer.ts";
import { checkDuplicatePrologDecls } from "./prolog-diagnostics.ts";

function codes(src: string): string[] {
	const { analysis, ast } = analyzeWithAst(src, "file:///main.xq");
	if (!ast) return [];
	return checkDuplicatePrologDecls(ast, analysis).map((d) => d.code);
}

describe("prolog-diagnostics: duplicate declarations reported", () => {
	const cases: Array<[string, string, string]> = [
		["XQST0032", "base-uri", `declare base-uri "a"; declare base-uri "b"; 1`],
		["XQST0033", "namespace prefix", `declare namespace p = "a"; declare namespace p = "b"; 1`],
		["XQST0038", "default collation", `declare default collation "a"; declare default collation "b"; 1`],
		["XQST0039", "function parameter", `declare function local:f($x, $x) { 1 }; 1`],
		["XQST0039", "inline function parameter", `function($x, $x) { 1 }`],
		["XQST0065", "ordering", `declare ordering ordered; declare ordering unordered; 1`],
		["XQST0066", "default element namespace", `declare default element namespace "a"; declare default element namespace "b"; 1`],
		["XQST0067", "construction", `declare construction strip; declare construction preserve; 1`],
		["XQST0068", "boundary-space", `declare boundary-space strip; declare boundary-space preserve; 1`],
		["XQST0069", "empty order", `declare default order empty greatest; declare default order empty least; 1`],
		["XQST0111", "named decimal-format", `declare decimal-format d decimal-separator="."; declare decimal-format d decimal-separator=","; 1`],
		["XQST0111", "default decimal-format", `declare default decimal-format decimal-separator="."; declare default decimal-format decimal-separator=","; 1`],
		["XQST0114", "decimal-format property", `declare decimal-format d decimal-separator="." decimal-separator=","; 1`],
	];
	for (const [code, label, src] of cases)
		test(`${code}: ${label}`, () => assert.deepEqual(codes(src), [code]));

	test("default element and function namespaces are independent kinds", () => {
		assert.deepEqual(codes(`declare default function namespace "a"; declare default function namespace "b"; 1`), ["XQST0066"]);
	});
});

describe("prolog-diagnostics: valid prologs not flagged", () => {
	const cases: Array<[string, string]> = [
		["distinct prefixes", `declare namespace p = "a"; declare namespace q = "b"; 1`],
		["element + function default namespaces", `declare default element namespace "a"; declare default function namespace "b"; 1`],
		["different setters", `declare base-uri "a"; declare ordering ordered; declare boundary-space strip; 1`],
		["named and default decimal-format", `declare decimal-format d decimal-separator="."; declare default decimal-format decimal-separator="."; 1`],
		["different decimal-format names", `declare decimal-format a decimal-separator="."; declare decimal-format b decimal-separator="."; 1`],
		["distinct parameters", `declare function local:f($x, $y) { 1 }; 1`],
	];
	for (const [label, src] of cases) test(label, () => assert.deepEqual(codes(src), []));
});
