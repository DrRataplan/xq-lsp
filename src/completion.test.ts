import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "./analyzer.ts";
import { getCompletions } from "./completion.ts";
import { getBuiltins } from "./builtins.ts";

const ANALYSIS_WITH_VARS = analyze(
	`
declare variable $local:total := 0;
declare function local:f($x) { $x };
let $myVar := 1
return $myVar
`,
	"file:///a.xq",
);

describe("completion: variables", () => {
	test("$ triggers variable completions", () => {
		const labels = getCompletions(
			{ textBeforeCursor: "let $result := $", cursorOffset: 100 },
			ANALYSIS_WITH_VARS,
			new Map(),
		).map((i) => i.label);
		assert.ok(labels.some((l) => l.startsWith("$")), `no variable items, got: ${labels}`);
	});

	test("includes module-level variables", () => {
		const labels = getCompletions({ textBeforeCursor: "$", cursorOffset: 200 }, ANALYSIS_WITH_VARS, new Map()).map(
			(i) => i.label,
		);
		assert.ok(labels.includes("$local:total"), `expected $local:total, got ${labels}`);
	});

	test("let binding visible after its definition offset", () => {
		const labels = getCompletions({ textBeforeCursor: "$", cursorOffset: 200 }, ANALYSIS_WITH_VARS, new Map()).map(
			(i) => i.label,
		);
		assert.ok(labels.includes("$myVar"), `expected $myVar, got ${labels}`);
	});

	test("let binding not visible before its offset", () => {
		const labels = getCompletions({ textBeforeCursor: "$", cursorOffset: 0 }, ANALYSIS_WITH_VARS, new Map()).map(
			(i) => i.label,
		);
		assert.ok(!labels.includes("$myVar"), `$myVar should not appear at offset 0`);
	});
});

describe("completion: functions", () => {
	test("namespace prefix returns matching functions", () => {
		const labels = getCompletions(
			{ textBeforeCursor: "local:", cursorOffset: 6 },
			ANALYSIS_WITH_VARS,
			new Map(),
		).map((i) => i.label);
		assert.ok(labels.includes("f"), `expected f, got ${labels}`);
	});

	test("prefix filters to matching namespace only", () => {
		const analysis = analyze(
			`declare function local:foo($x) { $x };
declare function math:sin($x) { $x };`,
			"file:///b.xq",
		);
		const labels = getCompletions({ textBeforeCursor: "math:", cursorOffset: 5 }, analysis, new Map()).map(
			(i) => i.label,
		);
		assert.ok(labels.includes("sin"), `expected sin, got ${labels}`);
		assert.ok(!labels.includes("foo"), `local:foo should not appear`);
	});

	test("imported functions appear under the import prefix", () => {
		const importedAnalysis = analyze(
			`module namespace util="http://example.com/util";
declare function util:trim($s) { $s };`,
			"file:///util.xq",
		);
		const mainAnalysis = analyze(
			`import module namespace util="http://example.com/util" at "./util.xq";
1`,
			"file:///main.xq",
		);
		const labels = getCompletions(
			{ textBeforeCursor: "util:", cursorOffset: 5 },
			mainAnalysis,
			new Map([["./util.xq", importedAnalysis]]),
		).map((i) => i.label);
		assert.ok(labels.includes("trim"), `expected trim, got ${labels}`);
	});

	test("alias prefix resolves to the same namespace", () => {
		const libAnalysis = analyze(
			`module namespace math="http://example.com/math";
declare function math:sin($x) { $x };`,
			"file:///math.xq",
		);
		const mainAnalysis = analyze(
			`import module namespace m="http://example.com/math" at "./math.xq";
1`,
			"file:///main.xq",
		);
		const labels = getCompletions(
			{ textBeforeCursor: "m:", cursorOffset: 2 },
			mainAnalysis,
			new Map([["./math.xq", libAnalysis]]),
		).map((i) => i.label);
		assert.ok(labels.includes("sin"), `expected sin via aliased prefix m:, got ${labels}`);
	});

	test("snippet mode includes parameter placeholders", () => {
		const analysis = analyze(`declare function local:add($a, $b) { $a + $b };`, "file:///c.xq");
		const addItem = getCompletions({ textBeforeCursor: "local:", cursorOffset: 6 }, analysis, new Map(), true).find(
			(i) => i.label === "add",
		);
		assert.ok(addItem, "add item not found");
		assert.ok(addItem.insertText?.includes("${1"), `expected snippet placeholders, got: ${addItem.insertText}`);
	});

	test("plain-text mode uses param names without snippet syntax", () => {
		const analysis = analyze(`declare function local:add($a, $b) { $a + $b };`, "file:///c.xq");
		const addItem = getCompletions({ textBeforeCursor: "local:", cursorOffset: 6 }, analysis, new Map(), false).find(
			(i) => i.label === "add",
		);
		assert.ok(addItem, "add item not found");
		assert.ok(!addItem.insertText?.includes("${1"), `expected no snippet syntax, got: ${addItem.insertText}`);
		assert.ok(addItem.insertText?.includes("$a"), `expected plain param names, got: ${addItem.insertText}`);
	});
});

describe("completion: builtins", () => {
	const builtins = getBuiltins();

	test("fn: prefix shows builtin functions", () => {
		const labels = getCompletions(
			{ textBeforeCursor: "fn:", cursorOffset: 3 },
			analyze("1", "file:///test.xq"),
			new Map([["builtin:fn", builtins]]),
		).map((i) => i.label);
		assert.ok(labels.includes("exists"), `expected exists, got ${labels}`);
		assert.ok(labels.includes("empty"), `expected empty, got ${labels}`);
	});

	test("plain-name mode omits fn: prefix on builtins", () => {
		const labels = getCompletions(
			{ textBeforeCursor: "exi", cursorOffset: 3 },
			analyze("1", "file:///test.xq"),
			new Map([["builtin:fn", builtins]]),
		).map((i) => i.label);
		assert.ok(labels.includes("exists"), `expected exists without prefix, got ${labels}`);
		assert.ok(!labels.some((l) => l.startsWith("fn:")), `fn: prefix should not appear, got ${labels}`);
	});
});
