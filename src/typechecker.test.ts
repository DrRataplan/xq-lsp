import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { analyze, analyzeWithAst } from "./analyzer.ts";
import { getBuiltins } from "./builtins.ts";
import { parseType, isAssignable, checkTypes, formatType } from "./typechecker.ts";
import type { XQueryType } from "./types.ts";

// ── parseType ────────────────────────────────────────────────────────────────

describe("parseType", () => {
	test("xs:string is atomic", () => {
		const t = parseType("xs:string");
		assert.equal(t.kind, "atomic");
		assert.equal(t.name, "xs:string");
		assert.equal(t.occurrence, "");
	});

	test("xs:integer* has occurrence *", () => {
		const t = parseType("xs:integer*");
		assert.equal(t.kind, "atomic");
		assert.equal(t.occurrence, "*");
	});

	test("node() is node kind", () => {
		const t = parseType("node()");
		assert.equal(t.kind, "node");
		assert.equal(t.name, "node");
	});

	test("element() is node kind", () => {
		const t = parseType("element()");
		assert.equal(t.kind, "node");
		assert.equal(t.name, "element");
	});

	test("element()? has occurrence ?", () => {
		const t = parseType("element()?");
		assert.equal(t.kind, "node");
		assert.equal(t.occurrence, "?");
	});

	test("item() is item kind", () => {
		const t = parseType("item()");
		assert.equal(t.kind, "item");
	});

	test("empty-sequence() is empty kind", () => {
		const t = parseType("empty-sequence()");
		assert.equal(t.kind, "empty");
	});

	test("map(*) is map kind", () => {
		assert.equal(parseType("map(*)").kind, "map");
	});

	test("unknown type string returns unknown", () => {
		assert.equal(parseType("foobar").kind, "unknown");
	});

	test("xs:integer+ has occurrence +", () => {
		const t = parseType("xs:integer+");
		assert.equal(t.kind, "atomic");
		assert.equal(t.occurrence, "+");
	});

	test("element()+ has occurrence +", () => {
		const t = parseType("element()+");
		assert.equal(t.kind, "node");
		assert.equal(t.occurrence, "+");
	});
});

// ── isAssignable ─────────────────────────────────────────────────────────────

describe("isAssignable", () => {
	const str: XQueryType = { kind: "atomic", name: "xs:string", occurrence: "" };
	const int: XQueryType = { kind: "atomic", name: "xs:integer", occurrence: "" };
	const node: XQueryType = { kind: "node", name: "node", occurrence: "" };
	const elem: XQueryType = { kind: "node", name: "element", occurrence: "" };
	const item: XQueryType = { kind: "item", occurrence: "" };
	const unknown: XQueryType = { kind: "unknown", occurrence: "" };
	const anyAtomic: XQueryType = { kind: "atomic", name: "xs:anyAtomicType", occurrence: "" };

	test("string is not assignable to node()", () => {
		assert.equal(isAssignable(str, node), false);
	});

	test("integer is not assignable to node()", () => {
		assert.equal(isAssignable(int, node), false);
	});

	test("node is not assignable to xs:string", () => {
		assert.equal(isAssignable(node, str), false);
	});

	test("string is assignable to item()", () => {
		assert.equal(isAssignable(str, item), true);
	});

	test("node is assignable to item()", () => {
		assert.equal(isAssignable(node, item), true);
	});

	test("string is assignable to xs:string", () => {
		assert.equal(isAssignable(str, str), true);
	});

	test("integer is assignable to xs:anyAtomicType", () => {
		assert.equal(isAssignable(int, anyAtomic), true);
	});

	test("element is assignable to node()", () => {
		assert.equal(isAssignable(elem, node), true);
	});

	test("integer is assignable to xs:double (numeric promotion)", () => {
		const dbl: XQueryType = { kind: "atomic", name: "xs:double", occurrence: "" };
		assert.equal(isAssignable(int, dbl), true);
	});

	test("integer is assignable to xs:float (numeric promotion)", () => {
		const flt: XQueryType = { kind: "atomic", name: "xs:float", occurrence: "" };
		assert.equal(isAssignable(int, flt), true);
	});

	test("float is assignable to xs:double (numeric promotion)", () => {
		const flt: XQueryType = { kind: "atomic", name: "xs:float", occurrence: "" };
		const dbl: XQueryType = { kind: "atomic", name: "xs:double", occurrence: "" };
		assert.equal(isAssignable(flt, dbl), true);
	});

	test("string is not assignable to xs:double", () => {
		const dbl: XQueryType = { kind: "atomic", name: "xs:double", occurrence: "" };
		assert.equal(isAssignable(str, dbl), false);
	});

	test("integer is assignable to xs:numeric (union type)", () => {
		const num: XQueryType = { kind: "atomic", name: "xs:numeric", occurrence: "" };
		assert.equal(isAssignable(int, num), true);
	});

	test("long is assignable to xs:numeric (transitive via integer→decimal)", () => {
		const lng: XQueryType = { kind: "atomic", name: "xs:long", occurrence: "" };
		const num: XQueryType = { kind: "atomic", name: "xs:numeric", occurrence: "" };
		assert.equal(isAssignable(lng, num), true);
	});

	test("string is not assignable to xs:numeric", () => {
		const num: XQueryType = { kind: "atomic", name: "xs:numeric", occurrence: "" };
		assert.equal(isAssignable(str, num), false);
	});

	test("generic node() is assignable to element() (path expr result)", () => {
		assert.equal(isAssignable(node, elem), true);
	});

	test("element() is not assignable to attribute() (specific node kinds are disjoint)", () => {
		const attr: XQueryType = { kind: "atomic", name: "xs:string", occurrence: "" };
		const attrNode: XQueryType = { kind: "node", name: "attribute", occurrence: "" };
		assert.equal(isAssignable(elem, attrNode), false);
	});

	test("map type is assignable to map type (catch-all)", () => {
		const map: XQueryType = { kind: "map", name: "map(*)", occurrence: "" };
		assert.equal(isAssignable(map, map), true);
	});

	test("unknown on left: always assignable (no false positives)", () => {
		assert.equal(isAssignable(unknown, node), true);
	});

	test("unknown on right: always assignable", () => {
		assert.equal(isAssignable(str, unknown), true);
	});
});

// ── inferExprType (tested indirectly via checkTypes) ─────────────────────────

describe("inferExprType", () => {
	test("string literal inferred as xs:string", () => {
		const src = `declare function local:f($x as node()) { $x }; local:f("hello")`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		const errors = checkTypes(ast, src, analysis, new Map());
		assert.equal(errors.length, 1, `expected 1 error, got: ${JSON.stringify(errors)}`);
		assert.ok(errors[0].message.includes("xs:string"), `message: ${errors[0].message}`);
	});

	test("integer literal inferred as xs:integer", () => {
		const src = `declare function local:f($x as node()) { $x }; local:f(42)`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		const errors = checkTypes(ast, src, analysis, new Map());
		assert.equal(errors.length, 1);
		assert.ok(errors[0].message.includes("xs:integer"), `message: ${errors[0].message}`);
	});

	test("path expression passed to atomic param: no error (atomization applies)", () => {
		// XQuery function conversion rules atomize nodes to atomic values, so this is valid.
		const src = `declare function local:f($x as xs:string) { $x }; local:f(//foo)`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		const errors = checkTypes(ast, src, analysis, new Map());
		assert.equal(errors.length, 0, `unexpected errors: ${JSON.stringify(errors)}`);
	});

	test("bare axis step as argument inferred as node (no false positive)", () => {
		// child::* is an AxisStep — should infer node()* and not error against node() param.
		const src = `declare function local:f($x as node()) { $x }; local:f(child::*)`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		assert.equal(checkTypes(ast, src, analysis, new Map()).length, 0);
	});
});

// ── checkTypes ───────────────────────────────────────────────────────────────

describe("checkTypes", () => {
	test("no error when types match", () => {
		const src = `
			declare function local:f($x as xs:string) { $x };
			local:f("hello")
		`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		const errors = checkTypes(ast, src, analysis, new Map());
		assert.equal(errors.length, 0, `unexpected errors: ${JSON.stringify(errors)}`);
	});

	test("error when string passed to node() param", () => {
		const src = `
			declare function local:f($x as node()) { $x };
			local:f("hello")
		`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		const errors = checkTypes(ast, src, analysis, new Map());
		assert.equal(errors.length, 1, `expected 1 error, got ${errors.length}`);
		assert.ok(errors[0].message.includes("Argument 1"), errors[0].message);
	});

	test("error when integer passed to element() param", () => {
		const src = `
			declare function local:f($x as element()) { $x };
			local:f(42)
		`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		const errors = checkTypes(ast, src, analysis, new Map());
		assert.equal(errors.length, 1);
	});

	test("no error for item() param (accepts anything)", () => {
		const src = `
			declare function local:f($x as item()) { $x };
			local:f("hello")
		`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		assert.equal(checkTypes(ast, src, analysis, new Map()).length, 0);
	});

	test("no error when param has no declared type", () => {
		const src = `
			declare function local:f($x) { $x };
			local:f("hello")
		`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		assert.equal(checkTypes(ast, src, analysis, new Map()).length, 0);
	});

	test("typed variable passed to incompatible param is flagged", () => {
		const src = `
			declare function local:f($x as node()) { $x };
			let $s as xs:string := "hello"
			return local:f($s)
		`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		const errors = checkTypes(ast, src, analysis, new Map());
		assert.equal(errors.length, 1, `expected 1 error, got ${errors.length}: ${JSON.stringify(errors)}`);
	});

	test("typed variable passed to compatible param is not flagged", () => {
		const src = `
			declare function local:f($x as xs:string) { $x };
			let $s as xs:string := "hello"
			return local:f($s)
		`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		assert.equal(checkTypes(ast, src, analysis, new Map()).length, 0);
	});

	test("function return type used for argument inference", () => {
		const src = `
			declare function local:get-str() as xs:string { "x" };
			declare function local:f($x as node()) { $x };
			local:f(local:get-str())
		`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		const errors = checkTypes(ast, src, analysis, new Map());
		assert.equal(errors.length, 1, `expected 1 error, got ${errors.length}`);
	});

	test("errors have correct offsets into source", () => {
		const src = `declare function local:f($x as node()) { $x };\nlocal:f("hello")`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		const errors = checkTypes(ast, src, analysis, new Map());
		assert.equal(errors.length, 1);
		const snippet = src.slice(errors[0].offset, errors[0].offset + errors[0].length);
		assert.ok(snippet.includes('"hello"') || snippet.includes("hello"), `snippet: ${snippet}`);
	});

	test("multiple arguments: only the wrong one is flagged", () => {
		const src = `
			declare function local:f($a as xs:string, $b as node()) { $a };
			local:f("ok", "bad")
		`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		const errors = checkTypes(ast, src, analysis, new Map());
		assert.equal(errors.length, 1);
		assert.ok(errors[0].message.includes("Argument 2"), errors[0].message);
	});

	test("null ast (regex fallback) means no type checking", () => {
		const src = `
			declare function local:f($x as node()) { $x };
			local:f("hello"
		`; // truncated — invalid XQuery
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.equal(ast, null, "expected null ast for invalid XQuery");
	});

	test("document constructor inferred as document-node(), not flagged for node() param", () => {
		const src = `declare function local:f($x as node()) { $x }; local:f(document { "x" })`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		assert.equal(checkTypes(ast, src, analysis, new Map()).length, 0);
	});

	test("element constructor inferred as element(), not flagged for node() param", () => {
		const src = `declare function local:f($x as node()) { $x }; local:f(<a/>)`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		assert.equal(checkTypes(ast, src, analysis, new Map()).length, 0);
	});

	test("direct element constructor inferred as element()", () => {
		const src = `declare function local:f($x as element()) { $x }; local:f(<root/>)`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		assert.equal(checkTypes(ast, src, analysis, new Map()).length, 0);
	});

	test("computed attribute constructor inferred as attribute(), not flagged for node() param", () => {
		const src = `declare function local:f($x as node()) { $x }; local:f(attribute a { "v" })`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		assert.equal(checkTypes(ast, src, analysis, new Map()).length, 0);
	});

	test("computed text constructor inferred as text(), not flagged for node() param", () => {
		const src = `declare function local:f($x as node()) { $x }; local:f(text { "hello" })`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		assert.equal(checkTypes(ast, src, analysis, new Map()).length, 0);
	});

	test("computed comment constructor inferred as comment(), not flagged for node() param", () => {
		const src = `declare function local:f($x as node()) { $x }; local:f(comment { "x" })`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		assert.equal(checkTypes(ast, src, analysis, new Map()).length, 0);
	});

	test("module-level typed variable is visible in query body type checks", () => {
		const src = `
			declare variable $x as xs:string := "hello";
			declare function local:f($a as node()) { $a };
			local:f($x)
		`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		const errors = checkTypes(ast, src, analysis, new Map());
		assert.equal(errors.length, 1, `expected 1 error, got: ${JSON.stringify(errors)}`);
	});

	test("inline function inside function body gets isolated scope", () => {
		const src = `
			declare function local:outer($x as xs:string) {
				let $fn := function($n as node()) { $n }
				return $fn(<a/>)
			};
			()
		`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		assert.equal(checkTypes(ast, src, analysis, new Map()).length, 0);
	});

	test("partial function application is not flagged against function-typed param", () => {
		const src = `fn:filter((1,2,3), fn:string-length#1)`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		const builtins = getBuiltins();
		assert.equal(checkTypes(ast, src, analysis, new Map([["builtin:fn", builtins]])).length, 0);
	});

	test("builtin function type checking: node passed to xs:string? is not flagged (atomization applies)", () => {
		const src = `fn:string-length(//foo)`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		const builtins = getBuiltins();
		// XQuery atomizes the node to its string value — not a static error.
		const errors = checkTypes(ast, src, analysis, new Map([["builtin:fn", builtins]]));
		assert.equal(errors.length, 0, `unexpected errors: ${JSON.stringify(errors)}`);
	});

	test("no error for subsequence with integer arguments (numeric promotion)", () => {
		const src = `fn:subsequence((1,2,3), 1, 2)`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		const builtins = getBuiltins();
		// fn:subsequence expects xs:double — integer literals must be accepted via promotion
		const errors = checkTypes(ast, src, analysis, new Map([["builtin:fn", builtins]]));
		assert.equal(errors.length, 0, `unexpected errors: ${JSON.stringify(errors)}`);
	});

	test("no false positive when same variable name appears as param in one function and let-binding in another (issue #21)", () => {
		// m:baz has $some-random-name as xs:string (param)
		// m:entry has let $some-random-name := m:foo() (untyped let binding)
		// m:bar expects $node as element()
		// The call m:bar($some-random-name) inside m:entry must NOT be flagged,
		// because the $some-random-name there is from the untyped let binding (unknown type),
		// not from m:baz's typed param.
		const src = `
			module namespace m = 'uri';
			declare function m:foo() as element()? external;
			declare function m:baz ($some-random-name as xs:string) as map(*)? external;
			declare function m:entry ($node as map(*)) as map(*)+ {
				let $some-random-name := m:foo()
				let $bar := m:bar($some-random-name)
				return $bar
			};
			declare function m:bar ($node as element()) as map(*) {
				map{"node": $node}
			};
		`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		const errors = checkTypes(ast, src, analysis, new Map());
		assert.equal(errors.length, 0, `unexpected false-positive errors: ${JSON.stringify(errors)}`);
	});

	test("param type from one function does not bleed into sibling function scope", () => {
		// local:a's $x is xs:string — passing it to local:needs-node($x as node()) should error
		// local:b's $x is node() — passing it to local:needs-node($x as node()) should NOT error
		const src = `
			declare function local:needs-node($x as node()) { $x };
			declare function local:a($x as xs:string) { local:needs-node($x) };
			declare function local:b($x as node()) { local:needs-node($x) };
			()
		`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		const errors = checkTypes(ast, src, analysis, new Map());
		// local:a passes xs:string to node() — 1 error; local:b passes node() to node() — no error
		assert.equal(errors.length, 1, `expected exactly 1 error, got: ${JSON.stringify(errors)}`);
		assert.ok(errors[0].message.includes("needs-node"), errors[0].message);
	});

	test("atomic-to-atomic type mismatch is not flagged as static error (dynamic coercion)", () => {
		// fn:abs expects xs:numeric?; xs:string("1") returns xs:string.
		// XQuery allows runtime coercions between atomic types, so this is never XPTY0004
		// statically — the spec makes such mismatches dynamic errors only.
		const src = `fn:abs(xs:string("1"))`;
		const { ast } = analyzeWithAst(src, "file:///test.xq");
		assert.ok(ast);
		const analysis = analyze(src, "file:///test.xq");
		const builtins = getBuiltins();
		const errors = checkTypes(ast, src, analysis, new Map([["builtin:fn", builtins]]));
		assert.equal(errors.length, 0, `unexpected errors: ${JSON.stringify(errors)}`);
	});
});

// ── formatType ────────────────────────────────────────────────────────────────

describe("formatType", () => {
	test("atomic type formats as name", () => {
		assert.equal(formatType({ kind: "atomic", name: "xs:string", occurrence: "" }), "xs:string");
	});

	test("node type formats with parens", () => {
		assert.equal(formatType({ kind: "node", name: "element", occurrence: "?" }), "element()?");
	});

	test("item() formats correctly", () => {
		assert.equal(formatType({ kind: "item", occurrence: "*" }), "item()*");
	});

	test("map(*) formats with parentheses and content", () => {
		assert.equal(formatType(parseType("map(*)")), "map(*)");
	});

	test("map(*)? retains occurrence", () => {
		assert.equal(formatType(parseType("map(*)?")), "map(*)?");
	});

	test("array(*) formats with parentheses", () => {
		assert.equal(formatType(parseType("array(*)")), "array(*)");
	});

	test("function(*) formats with parentheses", () => {
		assert.equal(formatType(parseType("function(*)")), "function(*)");
	});
});
