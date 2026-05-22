import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { analyzeWithAst } from "./analyzer.ts";
import {
	findUndeclaredPrefixUsages,
	findImportInsertPosition,
	findDeclareNsInsertPosition,
} from "./namespace-diagnostics.ts";

function diags(src: string) {
	const { analysis, ast } = analyzeWithAst(src, "file:///main.xq");
	return findUndeclaredPrefixUsages(ast, analysis);
}

// ── undeclared prefixes that SHOULD be reported ───────────────────────────────

const REPORTED: Array<{ src: string; prefix: string; kind: string }> = [
	{ src: `myns:compute(1)`, prefix: "myns", kind: "function" },
	{ src: `<ns:foo/>`, prefix: "ns", kind: "element" },
	{ src: `element ns:foo {}`, prefix: "ns", kind: "element" },
	{ src: `attribute ns:attr { "x" }`, prefix: "ns", kind: "element" },
	{ src: `ns:func#2`, prefix: "ns", kind: "function" },
	{ src: `$ext:someVar`, prefix: "ext", kind: "variable" },
];

describe("namespace-diagnostics: undeclared prefix reported", () => {
	for (const { src, prefix, kind } of REPORTED) {
		test(`"${prefix}" in: ${src}`, () => {
			const ds = diags(src);
			const d = ds.find((d) => d.prefix === prefix);
			assert.ok(d, `expected ${prefix} diagnostic, got ${JSON.stringify(ds)}`);
			assert.equal(d!.code, "XQST0081");
			assert.equal(d!.usageKind, kind);
		});
	}
});

// ── declared prefixes that should NOT be reported ─────────────────────────────

const SUPPRESSED: Array<{ src: string; prefix: string; reason: string }> = [
	{
		src: `import module namespace myns="http://example.com/myns" at "./myns.xq"; myns:compute(1)`,
		prefix: "myns",
		reason: "import module namespace",
	},
	{
		src: `declare namespace ns = "http://example.com/ns"; <ns:foo/>`,
		prefix: "ns",
		reason: "declare namespace",
	},
	{
		src: `module namespace mymod="http://example.com/mymod"; declare function mymod:doThing() { 1 };`,
		prefix: "mymod",
		reason: "module's own prefix",
	},
	{
		src: `import module namespace myns="http://example.com/myns" at "./myns.xq"; 1`,
		prefix: "myns",
		reason: "import statement itself",
	},
];

describe("namespace-diagnostics: declared prefix suppressed", () => {
	for (const { src, prefix, reason } of SUPPRESSED) {
		test(`no diagnostic for "${prefix}" (${reason})`, () => {
			assert.ok(!diags(src).some((d) => d.prefix === prefix), `${prefix} should not be reported`);
		});
	}
});

// ── other cases ───────────────────────────────────────────────────────────────

describe("namespace-diagnostics: other", () => {
	test("builtin prefixes (fn:, xs:, math:) produce no diagnostic", () => {
		const ds = diags(`(fn:true(), xs:string("x"), math:sqrt(4.0))`);
		assert.equal(ds.length, 0, `expected no diagnostics, got ${JSON.stringify(ds)}`);
	});

	test("prefix inside a comment is not reported", () => {
		assert.ok(!diags(`(: undeclared:prefix in a comment :) 1`).some((d) => d.prefix === "undeclared"));
	});

	test("returns empty array when ast is null (parse error)", () => {
		const { ast } = analyzeWithAst("declare function local:broken(", "file:///broken.xq");
		assert.equal(ast, null);
		const ds = findUndeclaredPrefixUsages(null, {
			functions: [],
			moduleVariables: [],
			localBindings: [],
			imports: [],
			namespaceDecls: [],
			defaultFunctionNamespace: "http://www.w3.org/2005/xpath-functions",
			usedAstPath: false,
		});
		assert.equal(ds.length, 0);
	});
});

// ── insert positions ──────────────────────────────────────────────────────────

describe("insert positions", () => {
	test("findImportInsertPosition: line 0 when no version/module decl", () => {
		assert.deepEqual(
			findImportInsertPosition(`import module namespace a="http://a.com" at "./a.xq"; a:f()`),
			{ line: 0, character: 0 },
		);
	});

	test("findImportInsertPosition: skips xquery version decl", () => {
		assert.deepEqual(
			findImportInsertPosition(`xquery version "3.1";\nimport module namespace a="http://a.com" at "./a.xq";\na:f()`),
			{ line: 1, character: 0 },
		);
	});

	test("findImportInsertPosition: skips module namespace decl in library module", () => {
		assert.deepEqual(
			findImportInsertPosition(`module namespace m="http://m.com";\ndeclare function m:f() { 1 };`),
			{ line: 1, character: 0 },
		);
	});

	test("findDeclareNsInsertPosition: skips xquery version decl", () => {
		assert.deepEqual(
			findDeclareNsInsertPosition(`xquery version "3.1";\ndeclare function local:f() { 1 };`),
			{ line: 1, character: 0 },
		);
	});
});

// ── config prefixes ───────────────────────────────────────────────────────────

test("undeclared prefix still reported even when in config prefixMap (quickfix needs it)", () => {
	const { analysis, ast } = analyzeWithAst(`<tei:body/>`, "file:///main.xq");
	const d = findUndeclaredPrefixUsages(ast, analysis).find((d) => d.prefix === "tei");
	assert.ok(d, `expected XQST0081 for 'tei'`);
	assert.equal(d!.code, "XQST0081");
});
