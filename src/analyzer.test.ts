import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { analyze, parseEQName } from "./analyzer.ts";
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

	test("a leading 'import module namespace' is not mistaken for this file's own module namespace", () => {
		const src = `import module namespace test="http://example.com/test";
<result>{test:ok()}</result>`;
		const result = analyze(src, "file:///test.xq");
		assert.equal(result.moduleNamespaceUri, undefined, "a main module importing a library must not pick up its namespace");
	});

	test("this file's own 'module namespace' declaration is still extracted", () => {
		const src = `module namespace foo = "http://example.com/foo";
declare function foo:bar() { 1 };`;
		const result = analyze(src, "file:///test.xq");
		assert.equal(result.moduleNamespaceUri, "http://example.com/foo");
		assert.equal(result.modulePrefix, "foo");
	});
});

// ── function visibility (%public / %private annotations) ───────────────────────

describe("analyzer: function visibility", () => {
	test("unannotated function has undefined visibility (defaults to public)", () => {
		const result = analyze(`declare function local:f() { 1 }; local:f()`, "file:///test.xq");
		const f = result.functions.find((f) => f.qname.localName === "f");
		assert.equal(f?.visibility, undefined);
	});

	test("%private annotation is captured", () => {
		const result = analyze(`declare %private function local:f() { 1 }; local:f()`, "file:///test.xq");
		const f = result.functions.find((f) => f.qname.localName === "f");
		assert.equal(f?.visibility, "private");
	});

	test("%public annotation is captured", () => {
		const result = analyze(`declare %public function local:f() { 1 }; local:f()`, "file:///test.xq");
		const f = result.functions.find((f) => f.qname.localName === "f");
		assert.equal(f?.visibility, "public");
	});

	test("%private alongside another annotation is still captured", () => {
		const result = analyze(`declare %private %nonDeterministic function local:f() { 1 }; local:f()`, "file:///test.xq");
		const f = result.functions.find((f) => f.qname.localName === "f");
		assert.equal(f?.visibility, "private");
	});
});

// ── BracedURILiteral character reference decoding ───────────────────────────────

describe("analyzer: BracedURILiteral character references", () => {
	test("CharRef (&#xHH;) is decoded", () => {
		const { uri } = parseEQName("Q{http:&#x2F;&#x2F;example.com&#x2F;ns}f");
		assert.equal(uri, "http://example.com/ns");
	});

	test("decimal CharRef (&#DD;) is decoded", () => {
		const { uri } = parseEQName("Q{http:&#47;&#47;example.com}f");
		assert.equal(uri, "http://example.com");
	});

	test("PredefinedEntityRef (&amp; etc.) is decoded", () => {
		const { uri } = parseEQName("Q{http://example.com/a&amp;b}f");
		assert.equal(uri, "http://example.com/a&b");
	});

	test("an unrecognized entity name is left untouched", () => {
		const { uri } = parseEQName("Q{http://example.com/&bogus;}f");
		assert.equal(uri, "http://example.com/&bogus;");
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

	const WITH_VAR_DOC = `(:~
 : The maximum number of retries allowed.
 :)
declare variable $local:max-retries := 3;`;

	test("extracts doc comment on a module variable", () => {
		const v = analyze(WITH_VAR_DOC, "file:///test.xq").moduleVariables.find(
			(v) => v.qname.localName === "max-retries",
		);
		assert.ok(v?.doc?.includes("maximum number of retries"), `got: ${v?.doc}`);
	});

	test("module variable without a preceding comment has no doc", () => {
		const v = analyze(`declare variable $local:x := 1;`, "file:///test.xq").moduleVariables.find(
			(v) => v.qname.localName === "x",
		);
		assert.equal(v?.doc, undefined);
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

	test("extracts doc comment on a module variable via regex fallback", () => {
		const src = `(:~\n : Running total.\n :)\ndeclare variable $count := 10;\n\nlet $result := local:double(\n`;
		const result = analyze(src, "file:///incomplete.xq");
		const v = result.moduleVariables.find((v) => v.qname.localName === "count");
		assert.ok(v?.doc?.includes("Running total"), `got: ${v?.doc}`);
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
