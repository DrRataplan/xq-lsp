import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "./analyzer.ts";
import { formatQName } from "./types.ts";

const VALID_XQ = `
import module namespace math="http://example.com/math" at "./math.xq";

declare variable $local:count := 10;

declare function local:add($a as xs:integer, $b as xs:integer) as xs:integer {
  let $sum := $a + $b
  for $item in (1 to $sum)
  return $item
};

declare function local:greet($name) {
  "Hello " || $name
};

local:add(1, 2)
`;

describe("analyzer: AST path", () => {
	test("extracts functions", () => {
		const result = analyze(VALID_XQ, "file:///test.xq");
		const names = result.functions.map((f) => formatQName(f.qname));
		assert.ok(names.includes("local:add"), `expected local:add, got ${names}`);
		assert.ok(names.includes("local:greet"), `expected local:greet, got ${names}`);
	});

	test("extracts function arity and params", () => {
		const result = analyze(VALID_XQ, "file:///test.xq");
		const add = result.functions.find((f) => formatQName(f.qname) === "local:add");
		assert.ok(add, "local:add not found");
		assert.equal(add.arity, 2);
		assert.equal(add.params[0].name, "a");
		assert.equal(add.params[1].name, "b");
	});

	test("extracts function prefix and localName", () => {
		const result = analyze(VALID_XQ, "file:///test.xq");
		const add = result.functions.find((f) => formatQName(f.qname) === "local:add");
		assert.ok(add);
		assert.equal(add.qname.prefix, "local");
		assert.equal(add.qname.localName, "add");
	});

	test("extracts module-level variable", () => {
		const result = analyze(VALID_XQ, "file:///test.xq");
		const names = result.moduleVariables.map((v) => formatQName(v.qname));
		assert.ok(names.includes("local:count"), `expected local:count, got ${names}`);
		assert.ok(result.moduleVariables[0].isModuleLevel);
	});

	test("extracts let/for bindings", () => {
		const result = analyze(VALID_XQ, "file:///test.xq");
		const names = result.localBindings.map((v) => v.qname.localName);
		assert.ok(names.includes("sum"), `expected sum, got ${names}`);
		assert.ok(names.includes("item"), `expected item, got ${names}`);
		assert.ok(!result.localBindings[0].isModuleLevel);
	});

	test("extracts imports", () => {
		const result = analyze(VALID_XQ, "file:///test.xq");
		assert.equal(result.imports.length, 1);
		assert.equal(result.imports[0].prefix, "math");
		assert.equal(result.imports[0].atPath, "./math.xq");
	});

	test("extracts import without at path", () => {
		const src = `import module namespace util="http://example.com/util";
declare function local:main() { util:trim("x") };`;
		const result = analyze(src, "file:///test.xq");
		assert.equal(result.imports.length, 1);
		assert.equal(result.imports[0].prefix, "util");
		assert.equal(result.imports[0].namespaceUri, "http://example.com/util");
		assert.equal(result.imports[0].atPath, undefined);
	});
});

// ── doc comments ──────────────────────────────────────────────────────────────

const WITH_DOC = `(:~
 : Adds two numbers.
 : @param $a The first operand
 : @param $b The second operand
 : @return The sum
 :)
declare function local:add($a as xs:integer, $b as xs:integer) as xs:integer {
  $a + $b
};`;

describe("analyzer: doc comments", () => {
	test("extracts description", () => {
		const fn = analyze(WITH_DOC, "file:///test.xq").functions.find((f) => formatQName(f.qname) === "local:add");
		assert.ok(fn?.doc?.description.includes("Adds two numbers"), `got: ${fn?.doc?.description}`);
	});

	test("extracts @param descriptions", () => {
		const fn = analyze(WITH_DOC, "file:///test.xq").functions.find((f) => formatQName(f.qname) === "local:add");
		assert.equal(fn?.params[0].description, "The first operand");
		assert.equal(fn?.params[1].description, "The second operand");
	});

	test("extracts @return description", () => {
		const fn = analyze(WITH_DOC, "file:///test.xq").functions.find((f) => formatQName(f.qname) === "local:add");
		assert.equal(fn?.doc?.returns, "The sum");
	});
});

// ── regex fallback ─────────────────────────────────────────────────────────────

const TRUNCATED_XQ = `
import module namespace util="http://example.com/util" at "./util.xq";

declare variable $count := 10;

declare function local:double($x as xs:integer) as xs:integer {
  $x * 2
};

let $result := local:double(
`; // intentionally invalid / truncated

describe("analyzer: regex fallback", () => {
	test("falls back without throwing", () => {
		const result = analyze(TRUNCATED_XQ, "file:///incomplete.xq");
		const fnNames = result.functions.map((f) => formatQName(f.qname));
		assert.ok(fnNames.includes("local:double"), `expected local:double, got ${fnNames}`);
	});

	test("extracts variable declaration", () => {
		const result = analyze(TRUNCATED_XQ, "file:///incomplete.xq");
		const names = result.moduleVariables.map((v) => v.qname.localName);
		assert.ok(names.includes("count"), `expected count, got ${names}`);
	});

	test("extracts import with at path", () => {
		const result = analyze(TRUNCATED_XQ, "file:///incomplete.xq");
		assert.equal(result.imports.length, 1);
		assert.equal(result.imports[0].prefix, "util");
		assert.equal(result.imports[0].atPath, "./util.xq");
	});

	test("extracts import without at path", () => {
		const src = `import module namespace util="http://example.com/util";
declare function local:main() { util:trim("x") };
let $x := util:trim(`;
		const result = analyze(src, "file:///test.xq");
		assert.equal(result.imports.length, 1);
		assert.equal(result.imports[0].prefix, "util");
		assert.equal(result.imports[0].namespaceUri, "http://example.com/util");
		assert.equal(result.imports[0].atPath, undefined);
	});

	test("extracts doc comments", () => {
		const fn = analyze(WITH_DOC + "\nlet $x := local:add(", "file:///test.xq").functions.find(
			(f) => formatQName(f.qname) === "local:add",
		);
		assert.ok(fn?.doc?.description.includes("Adds two numbers"), `got: ${fn?.doc?.description}`);
	});
});
