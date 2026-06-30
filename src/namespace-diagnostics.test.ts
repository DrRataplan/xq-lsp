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

	test("inline xmlns:prefix on element is in scope within that element", () => {
		// m: declared on <root>, used on child elements inside it — no diagnostic
		const src = `<root xmlns:m="http://www.w3.org/2005/xpath-functions/math"><m:pi/></root>`;
		assert.equal(diags(src).filter((d) => d.prefix === "m").length, 0);
	});

	test("inline xmlns:prefix is out of scope on sibling elements", () => {
		// m: declared only on <inner>, used on the sibling <m:pi/> — must be reported
		const src = `<root><inner xmlns:m="http://www.w3.org/2005/xpath-functions/math"><m:ok/></inner><m:pi/></root>`;
		const ds = diags(src).filter((d) => d.prefix === "m");
		assert.equal(ds.length, 1, `expected exactly one XQST0081 for m:, got ${JSON.stringify(ds)}`);
		// the diagnostic should point at <m:pi/>, not at <m:ok/>
		assert.ok(src.lastIndexOf("m:pi") > 0);
		assert.ok(ds[0].offset >= src.lastIndexOf("m:pi"), "diagnostic offset should be in the sibling, not the inner element");
	});

	test("inline xmlns:prefix is out of scope for function calls outside the declaring element", () => {
		// m: declared only on <inner>, used as a function call outside it — must be reported
		const src = `<root><inner xmlns:m="http://www.w3.org/2005/xpath-functions/math">{m:pi()}</inner>{m:pi()}</root>`;
		const ds = diags(src).filter((d) => d.prefix === "m");
		assert.equal(ds.length, 1, `expected exactly one XQST0081 for m:, got ${JSON.stringify(ds)}`);
		assert.ok(ds[0].offset >= src.lastIndexOf("m:pi"), "diagnostic offset should be outside <inner>, not inside it");
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
	// ── findImportInsertPosition ─────────────────────────────────────────────────

	test("findImportInsertPosition: after last existing import (single import, no header)", () => {
		assert.deepEqual(
			findImportInsertPosition(`import module namespace a="http://a.com" at "./a.xq";\na:f()`),
			{ line: 1, character: 0 },
		);
	});

	test("findImportInsertPosition: after last import when version decl precedes it", () => {
		assert.deepEqual(
			findImportInsertPosition(`xquery version "3.1";\nimport module namespace a="http://a.com" at "./a.xq";\na:f()`),
			{ line: 2, character: 0 },
		);
	});

	test("findImportInsertPosition: after last of multiple imports", () => {
		const src = [
			`xquery version "3.1";`,
			`import module namespace a="http://a.com" at "./a.xq";`,
			`import module namespace b="http://b.com";`,
			`a:f()`,
		].join("\n");
		assert.deepEqual(findImportInsertPosition(src), { line: 3, character: 0 });
	});

	test("findImportInsertPosition: after header when no imports (module namespace decl)", () => {
		assert.deepEqual(
			findImportInsertPosition(`module namespace m="http://m.com";\ndeclare function m:f() { 1 };`),
			{ line: 1, character: 0 },
		);
	});

	test("findImportInsertPosition: after multi-line docblock when no imports", () => {
		const src = [
			`(:~`,
			` : Module description.`,
			` :)`,
			`module namespace m="http://m.com";`,
			`declare function m:f() { 1 };`,
		].join("\n");
		assert.deepEqual(findImportInsertPosition(src), { line: 4, character: 0 });
	});

	test("findImportInsertPosition: after last import when docblock precedes imports", () => {
		const src = [
			`(:~`,
			` : Main module.`,
			` :)`,
			`import module namespace a="http://a.com" at "./a.xq";`,
			`a:f()`,
		].join("\n");
		assert.deepEqual(findImportInsertPosition(src), { line: 4, character: 0 });
	});

	test("findImportInsertPosition: line 0 for bare expression with no header and no imports", () => {
		assert.deepEqual(
			findImportInsertPosition(`local:f()`),
			{ line: 0, character: 0 },
		);
	});

	// ── findDeclareNsInsertPosition ──────────────────────────────────────────────

	test("findDeclareNsInsertPosition: skips xquery version decl", () => {
		assert.deepEqual(
			findDeclareNsInsertPosition(`xquery version "3.1";\ndeclare function local:f() { 1 };`),
			{ line: 1, character: 0 },
		);
	});

	test("findDeclareNsInsertPosition: after multi-line docblock", () => {
		const src = [
			`(:~`,
			` : description`,
			` :)`,
			`declare function local:f() { 1 };`,
		].join("\n");
		assert.deepEqual(findDeclareNsInsertPosition(src), { line: 3, character: 0 });
	});
});

// ── config prefixes ───────────────────────────────────────────────────────────

test("undeclared prefix still reported even when in config prefixMap (quickfix needs it)", () => {
	const { analysis, ast } = analyzeWithAst(`<tei:body/>`, "file:///main.xq");
	const d = findUndeclaredPrefixUsages(ast, analysis).find((d) => d.prefix === "tei");
	assert.ok(d, `expected XQST0081 for 'tei'`);
	assert.equal(d!.code, "XQST0081");
});
