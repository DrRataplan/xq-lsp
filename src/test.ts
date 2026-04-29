import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "./analyzer.ts";
import { getCompletions } from "./completion.ts";
import { getHover, getSignatureHelp, getDocumentSymbols } from "./features.ts";
import { getBuiltins } from "./builtins.ts";
import { TextDocument } from "vscode-languageserver-textdocument";

// ── analyzer: valid XQuery via AST ──────────────────────────────────────────
describe("analyze", () => {
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

	test("analyzer: extracts functions from valid XQuery", () => {
		const result = analyze(VALID_XQ, "file:///test.xq");
		const names = result.functions.map((f) => f.name);
		assert.ok(names.includes("local:add"), `expected local:add, got ${names}`);
		assert.ok(names.includes("local:greet"), `expected local:greet, got ${names}`);
	});

	test("analyzer: extracts function arity and params", () => {
		const result = analyze(VALID_XQ, "file:///test.xq");
		const add = result.functions.find((f) => f.name === "local:add");
		assert.ok(add, "local:add not found");
		assert.equal(add.arity, 2);
		assert.equal(add.params[0].name, "a");
		assert.equal(add.params[1].name, "b");
	});

	test("analyzer: extracts function prefix and localName", () => {
		const result = analyze(VALID_XQ, "file:///test.xq");
		const add = result.functions.find((f) => f.name === "local:add");
		assert.ok(add);
		assert.equal(add.prefix, "local");
		assert.equal(add.localName, "add");
	});

	test("analyzer: extracts module-level variable", () => {
		const result = analyze(VALID_XQ, "file:///test.xq");
		const names = result.moduleVariables.map((v) => v.name);
		assert.ok(names.includes("local:count"), `expected local:count, got ${names}`);
		assert.ok(result.moduleVariables[0].isModuleLevel);
	});

	test("analyzer: extracts let/for bindings", () => {
		const result = analyze(VALID_XQ, "file:///test.xq");
		const names = result.localBindings.map((v) => v.name);
		assert.ok(names.includes("sum"), `expected sum, got ${names}`);
		assert.ok(names.includes("item"), `expected item, got ${names}`);
		assert.ok(!result.localBindings[0].isModuleLevel);
	});

	test("analyzer: extracts imports", () => {
		const result = analyze(VALID_XQ, "file:///test.xq");
		assert.equal(result.imports.length, 1);
		assert.equal(result.imports[0].prefix, "math");
		assert.equal(result.imports[0].atPath, "./math.xq");
	});

	// ── doc comments ─────────────────────────────────────────────────────────────

	const WITH_DOC = `(:~
 : Adds two numbers.
 : @param $a The first operand
 : @param $b The second operand
 : @return The sum
 :)
declare function local:add($a as xs:integer, $b as xs:integer) as xs:integer {
  $a + $b
};`;

	test("analyzer: extracts doc comment description", () => {
		const result = analyze(WITH_DOC, "file:///test.xq");
		const fn = result.functions.find((f) => f.name === "local:add");
		assert.ok(fn?.doc?.description.includes("Adds two numbers"), `got: ${fn?.doc?.description}`);
	});

	test("analyzer: extracts @param descriptions", () => {
		const result = analyze(WITH_DOC, "file:///test.xq");
		const fn = result.functions.find((f) => f.name === "local:add");
		assert.equal(fn?.params[0].description, "The first operand");
		assert.equal(fn?.params[1].description, "The second operand");
	});

	test("analyzer: extracts @return description", () => {
		const result = analyze(WITH_DOC, "file:///test.xq");
		const fn = result.functions.find((f) => f.name === "local:add");
		assert.equal(fn?.doc?.returns, "The sum");
	});

	test("analyzer: regex fallback extracts doc comments", () => {
		const result = analyze(WITH_DOC + "\nlet $x := local:add(", "file:///test.xq");
		const fn = result.functions.find((f) => f.name === "local:add");
		assert.ok(fn?.doc?.description.includes("Adds two numbers"), `got: ${fn?.doc?.description}`);
	});

	// ── analyzer: regex fallback for invalid XQuery ──────────────────────────────

	const INVALID_XQ = `
import module namespace util="http://example.com/util" at "./util.xq";

declare variable $count := 10;

declare function local:double($x as xs:integer) as xs:integer {
  $x * 2
};

let $result := local:double(
`; // intentionally truncated / invalid

	test("analyzer: falls back to regex on invalid XQuery", () => {
		// Should not throw
		const result = analyze(INVALID_XQ, "file:///incomplete.xq");
		const fnNames = result.functions.map((f) => f.name);
		assert.ok(fnNames.includes("local:double"), `expected local:double, got ${fnNames}`);
	});

	test("analyzer: regex fallback extracts variable declaration", () => {
		const result = analyze(INVALID_XQ, "file:///incomplete.xq");
		const names = result.moduleVariables.map((v) => v.name);
		assert.ok(names.includes("count"), `expected count, got ${names}`);
	});

	test("analyzer: regex fallback extracts import module namespace", () => {
		const result = analyze(INVALID_XQ, "file:///incomplete.xq");
		assert.equal(result.imports.length, 1);
		assert.equal(result.imports[0].prefix, "util");
		assert.equal(result.imports[0].atPath, "./util.xq");
	});

	// ── completion: variable context ─────────────────────────────────────────────

	const ANALYSIS_WITH_VARS = analyze(
		`
declare variable $local:total := 0;
declare function local:f($x) { $x };
let $myVar := 1
return $myVar
`,
		"file:///a.xq",
	);

	test("completion: $ triggers variable completions", () => {
		const items = getCompletions(
			{ textBeforeCursor: "let $result := $", cursorOffset: 100 },
			ANALYSIS_WITH_VARS,
			new Map(),
		);
		const labels = items.map((i) => i.label);
		assert.ok(
			labels.some((l) => l.startsWith("$")),
			`no variable items, got: ${labels}`,
		);
	});

	test("completion: variable completions include module-level variables", () => {
		const items = getCompletions({ textBeforeCursor: "$", cursorOffset: 200 }, ANALYSIS_WITH_VARS, new Map());
		const labels = items.map((i) => i.label);
		assert.ok(labels.includes("$local:total"), `expected $local:total, got ${labels}`);
	});

	test("completion: let binding is visible after its definition offset", () => {
		// The let binding for $myVar is somewhere in the source; offset 200 is past it
		const items = getCompletions({ textBeforeCursor: "$", cursorOffset: 200 }, ANALYSIS_WITH_VARS, new Map());
		const labels = items.map((i) => i.label);
		assert.ok(labels.includes("$myVar"), `expected $myVar, got ${labels}`);
	});

	test("completion: let binding not visible before its offset", () => {
		// offset 0 is before any let binding
		const items = getCompletions({ textBeforeCursor: "$", cursorOffset: 0 }, ANALYSIS_WITH_VARS, new Map());
		const labels = items.map((i) => i.label);
		assert.ok(!labels.includes("$myVar"), `$myVar should not appear at offset 0`);
	});

	// ── completion: function context ─────────────────────────────────────────────

	test("completion: plain name returns function completions", () => {
		const items = getCompletions({ textBeforeCursor: "local:", cursorOffset: 6 }, ANALYSIS_WITH_VARS, new Map());
		const labels = items.map((i) => i.label);
		assert.ok(labels.includes("f"), `expected f, got ${labels}`);
	});

	test("completion: namespace prefix filters to matching functions only", () => {
		const analysis = analyze(
			`
    declare function local:foo($x) { $x };
    declare function math:sin($x) { $x };
  `,
			"file:///b.xq",
		);

		const items = getCompletions({ textBeforeCursor: "math:", cursorOffset: 5 }, analysis, new Map());
		const labels = items.map((i) => i.label);
		assert.ok(labels.includes("sin"), `expected sin, got ${labels}`);
		assert.ok(!labels.includes("foo"), `local:foo should not appear`);
	});

	test("completion: imported functions appear under correct prefix", () => {
		const importedAnalysis = analyze(
			`
    declare function util:trim($s) { $s };
  `,
			"file:///util.xq",
		);

		const mainAnalysis = analyze(
			`
    import module namespace util="http://example.com/util" at "./util.xq";
    1
  `,
			"file:///main.xq",
		);

		const items = getCompletions(
			{ textBeforeCursor: "util:", cursorOffset: 5 },
			mainAnalysis,
			new Map([["./util.xq", importedAnalysis]]),
		);
		const labels = items.map((i) => i.label);
		assert.ok(labels.includes("trim"), `expected trim, got ${labels}`);
	});

	test("completion: function snippet has parameter placeholders when snippets enabled", () => {
		const analysis = analyze(`declare function local:add($a, $b) { $a + $b };`, "file:///c.xq");
		const items = getCompletions({ textBeforeCursor: "local:", cursorOffset: 6 }, analysis, new Map(), true);
		const addItem = items.find((i) => i.label === "add");
		assert.ok(addItem, "add item not found");
		assert.ok(addItem.insertText?.includes("${1"), `expected snippet placeholders, got: ${addItem.insertText}`);
	});

	test("completion: function uses plain text when snippets disabled", () => {
		const analysis = analyze(`declare function local:add($a, $b) { $a + $b };`, "file:///c.xq");
		const items = getCompletions({ textBeforeCursor: "local:", cursorOffset: 6 }, analysis, new Map(), false);
		const addItem = items.find((i) => i.label === "add");
		assert.ok(addItem, "add item not found");
		assert.ok(!addItem.insertText?.includes("${1"), `expected no snippet syntax, got: ${addItem.insertText}`);
		assert.ok(addItem.insertText?.includes("$a"), `expected plain param names, got: ${addItem.insertText}`);
	});
});

// ── helpers for feature tests ────────────────────────────────────────────────

function makeDoc(content: string, uri = "file:///test.xq"): TextDocument {
	return TextDocument.create(uri, "xquery", 1, content);
}

// ── hover ────────────────────────────────────────────────────────────────────

describe("hover", () => {
	const SRC = `declare function local:double($x as xs:integer) as xs:integer { $x * 2 };
local:double(5)`;
	const analysis = analyze(SRC, "file:///test.xq");

	test("hover over function name returns signature", () => {
		const doc = makeDoc(SRC);
		const offset = SRC.indexOf("local:double(5)");
		const hover = getHover(doc, offset + 1, analysis, new Map());
		assert.ok(hover, "expected hover result");
		const value = typeof hover.contents === "object" && "value" in hover.contents ? hover.contents.value : "";
		assert.ok(value.includes("local:double"), `signature missing, got: ${value}`);
		assert.ok(value.includes("$x"), `param missing, got: ${value}`);
	});

	test("hover over unknown word returns null", () => {
		const doc = makeDoc(SRC);
		const hover = getHover(doc, 0, analysis, new Map());
		assert.equal(hover, null);
	});
});

// ── signature help ────────────────────────────────────────────────────────────

describe("signatureHelp", () => {
	const SRC = `declare function local:add($a, $b) { $a + $b };
local:add(1, `;
	const analysis = analyze(SRC, "file:///test.xq");

	test("signature help inside first argument", () => {
		const doc = makeDoc(SRC);
		const offset = SRC.indexOf("local:add(1,") + "local:add(".length;
		const help = getSignatureHelp(doc, offset, analysis, new Map());
		assert.ok(help, "expected signature help");
		assert.equal(help.signatures.length, 1);
		assert.ok(help.signatures[0].label.includes("local:add"));
		assert.equal(help.activeParameter, 0);
	});

	test("signature help tracks active parameter after comma", () => {
		const doc = makeDoc(SRC);
		const offset = SRC.length;
		const help = getSignatureHelp(doc, offset, analysis, new Map());
		assert.ok(help, "expected signature help");
		assert.equal(help.activeParameter, 1);
	});

	test("signature help returns null outside any call", () => {
		const doc = makeDoc(SRC);
		const help = getSignatureHelp(doc, 0, analysis, new Map());
		assert.equal(help, null);
	});
});

// ── document symbols ──────────────────────────────────────────────────────────

describe("documentSymbols", () => {
	const SRC = `declare variable $local:count := 0;
declare function local:add($a, $b) { $a + $b };
declare function local:noop() { () };`;
	const analysis = analyze(SRC, "file:///test.xq");

	test("returns all declared functions", () => {
		const doc = makeDoc(SRC);
		const symbols = getDocumentSymbols(doc, analysis);
		const names = symbols.map((s) => s.name);
		assert.ok(names.includes("local:add"), `missing local:add, got ${names}`);
		assert.ok(names.includes("local:noop"), `missing local:noop, got ${names}`);
	});

	test("returns declared variables", () => {
		const doc = makeDoc(SRC);
		const symbols = getDocumentSymbols(doc, analysis);
		const names = symbols.map((s) => s.name);
		assert.ok(names.includes("$local:count"), `missing $local:count, got ${names}`);
	});

	test("function symbol has arity in detail", () => {
		const doc = makeDoc(SRC);
		const symbols = getDocumentSymbols(doc, analysis);
		const add = symbols.find((s) => s.name === "local:add");
		assert.ok(add?.detail?.includes("2"), `expected arity 2, got ${add?.detail}`);
	});
});

// ── builtins ──────────────────────────────────────────────────────────────────

describe("builtins", () => {
	const builtins = getBuiltins();

	test("loads fn:exists with correct arity", () => {
		const fn = builtins.functions.find((f) => f.name === "fn:exists");
		assert.ok(fn, "fn:exists not found");
		assert.equal(fn.arity, 1);
	});

	test("fn:exists has full type text for param and return", () => {
		const fn = builtins.functions.find((f) => f.name === "fn:exists");
		assert.equal(fn?.params[0].type, "item()*");
		assert.equal(fn?.returnType, "xs:boolean");
	});

	test("fn:true has arity 0", () => {
		const fn = builtins.functions.find((f) => f.name === "fn:true");
		assert.ok(fn, "fn:true not found");
		assert.equal(fn.arity, 0);
	});

	test("builtins have doc comments", () => {
		const fn = builtins.functions.find((f) => f.name === "fn:empty");
		assert.ok(fn?.doc?.description, "expected doc description");
		assert.ok(fn?.params[0].description, "expected param description");
	});

	test("fn: functions appear in completions via imported analyses", () => {
		const empty = analyze("1", "file:///test.xq");
		const items = getCompletions(
			{ textBeforeCursor: "fn:", cursorOffset: 3 },
			empty,
			new Map([["builtin:fn", builtins]]),
		);
		const labels = items.map((i) => i.label);
		assert.ok(labels.includes("exists"), `expected exists, got ${labels}`);
		assert.ok(labels.includes("empty"), `expected empty, got ${labels}`);
		assert.ok(labels.includes("true"), `expected true, got ${labels}`);
		assert.ok(labels.includes("false"), `expected false, got ${labels}`);
	});
});
