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

/**
 * Places the cursor just after the `$` that immediately follows `needle` in `src`.
 * `needle` must NOT include the `$` — `src` must have `$` at `src[indexOf(needle) + needle.length]`.
 */
function cursorAfterDollar(src: string, needle: string): { textBeforeCursor: string; cursorOffset: number } {
	const dollarPos = src.indexOf(needle) + needle.length; // points at "$"
	return { textBeforeCursor: src.slice(0, dollarPos + 1), cursorOffset: dollarPos + 1 };
}

describe("completion: function parameters (AST path)", () => {
	test("params appear inside function body", () => {
		const src = `declare function local:f($a-long-param) { $a-long-param }; 1`;
		const analysis = analyze(src, "file:///test.xq");
		assert.ok(analysis.usedAstPath, "expected AST path");
		// Cursor just after the "$" inside the function body (the return-expression "$a-long-param")
		const ctx = cursorAfterDollar(src, "{ ");
		const labels = getCompletions(ctx, analysis, new Map()).map((i) => i.label);
		assert.ok(labels.includes("$a-long-param"), `expected $a-long-param, got ${labels}`);
	});

	test("params filtered by typed prefix", () => {
		const src = `declare function local:f($param, $other) { $param }; 1`;
		const analysis = analyze(src, "file:///test.xq");
		assert.ok(analysis.usedAstPath, "expected AST path");
		// textBeforeCursor ends with "$par" to filter by prefix "par"
		const bodyDollar = src.indexOf("{ $") + 2; // offset of "$" in body
		const ctx = { textBeforeCursor: src.slice(0, bodyDollar + 3), cursorOffset: bodyDollar + 3 };
		const labels = getCompletions(ctx, analysis, new Map()).map((i) => i.label);
		assert.ok(labels.includes("$param"), `expected $param, got ${labels}`);
		assert.ok(!labels.includes("$other"), `$other should be filtered out, got ${labels}`);
	});

	test("params not visible outside function body", () => {
		const src = `declare function local:f($param) { $param }; let $x := $x return $x`;
		const analysis = analyze(src, "file:///test.xq");
		assert.ok(analysis.usedAstPath, "expected AST path");
		// Cursor inside "let $x := $x" — after the second "$" (the variable reference)
		const ctx = cursorAfterDollar(src, ":= ");
		const labels = getCompletions(ctx, analysis, new Map()).map((i) => i.label);
		assert.ok(!labels.includes("$param"), `$param should not appear in query body, got ${labels}`);
	});

	test("let bindings from other function body not visible", () => {
		const src = [
			`declare function local:f1($p1) { let $inner1 := 1 return $inner1 };`,
			`declare function local:f2($p2) { $p2 };`,
			`1`,
		].join("\n");
		const analysis = analyze(src, "file:///test.xq");
		assert.ok(analysis.usedAstPath, "expected AST path");
		// Cursor just after "$" inside f2's body
		const ctx = cursorAfterDollar(src, "local:f2($p2) { ");
		const labels = getCompletions(ctx, analysis, new Map()).map((i) => i.label);
		assert.ok(labels.includes("$p2"), `expected $p2, got ${labels}`);
		assert.ok(!labels.includes("$p1"), `$p1 should not appear in f2 body, got ${labels}`);
		assert.ok(!labels.includes("$inner1"), `$inner1 from f1 should not appear in f2 body, got ${labels}`);
	});

	test("let binding in same function body visible before cursor", () => {
		const src = `declare function local:f($p) { let $bound := $p return $bound }; 1`;
		const analysis = analyze(src, "file:///test.xq");
		assert.ok(analysis.usedAstPath, "expected AST path");
		// Cursor after "return $"
		const ctx = cursorAfterDollar(src, "return ");
		const labels = getCompletions(ctx, analysis, new Map()).map((i) => i.label);
		assert.ok(labels.includes("$bound"), `expected $bound, got ${labels}`);
		assert.ok(labels.includes("$p"), `expected $p, got ${labels}`);
	});

	test("query-body let binding not visible when cursor is inside function", () => {
		const src = `declare function local:f($p) { $p }; let $outer := 1 return $outer`;
		const analysis = analyze(src, "file:///test.xq");
		assert.ok(analysis.usedAstPath, "expected AST path");
		// Cursor just after "$" inside f's body (needle ends right before "$p")
		const ctx = cursorAfterDollar(src, "local:f($p) { ");
		const labels = getCompletions(ctx, analysis, new Map()).map((i) => i.label);
		assert.ok(labels.includes("$p"), `expected $p, got ${labels}`);
		assert.ok(!labels.includes("$outer"), `$outer (query-body binding) should not appear inside function, got ${labels}`);
	});

	test("module variable visible inside function body alongside params", () => {
		const src = `declare variable $local:cfg := 1; declare function local:f($p) { $p }; 1`;
		const analysis = analyze(src, "file:///test.xq");
		assert.ok(analysis.usedAstPath, "expected AST path");
		const ctx = cursorAfterDollar(src, "local:f($p) { ");
		const labels = getCompletions(ctx, analysis, new Map()).map((i) => i.label);
		assert.ok(labels.includes("$p"), `expected $p, got ${labels}`);
		assert.ok(labels.includes("$local:cfg"), `expected $local:cfg to be visible inside function body, got ${labels}`);
	});

	test("typed param completion shows detail", () => {
		const src = `declare function local:f($p as xs:integer) { $p }; 1`;
		const analysis = analyze(src, "file:///test.xq");
		assert.ok(analysis.usedAstPath, "expected AST path");
		const ctx = cursorAfterDollar(src, "xs:integer) { ");
		const items = getCompletions(ctx, analysis, new Map());
		const pItem = items.find((i) => i.label === "$p");
		assert.ok(pItem, `expected $p completion, got ${items.map((i) => i.label)}`);
		assert.equal(pItem.detail, "as xs:integer", `expected detail "as xs:integer", got ${pItem.detail}`);
	});
});

describe("completion: function parameters (mid-edit, uses last valid AST)", () => {
	test("params appear while file has syntax errors (last valid AST used)", () => {
		const validSrc = `declare function local:f($param) { $param }; 1`;
		const lastValidAnalysis = analyze(validSrc, "file:///test.xq");
		assert.ok(lastValidAnalysis.usedAstPath, "expected AST path for valid source");

		// Mid-edit: user typed "$" inside function body → syntax error → regex analysis
		const midEditSrc = `declare function local:f($param) { $`;
		const currentAnalysis = analyze(midEditSrc, "file:///test.xq");
		assert.ok(!currentAnalysis.usedAstPath, "expected regex path for mid-edit source");

		const labels = getCompletions(
			{ textBeforeCursor: midEditSrc, cursorOffset: midEditSrc.length },
			currentAnalysis, new Map(), false, lastValidAnalysis,
		).map((i) => i.label);
		assert.ok(labels.includes("$param"), `expected $param using last valid AST, got ${labels}`);
	});

	test("params not shown when cursor is after function body (mid-edit)", () => {
		const validSrc = `declare function local:f($param) { $param }; $x`;
		const lastValidAnalysis = analyze(validSrc, "file:///test.xq");

		// Mid-edit: cursor is in query body, not inside function
		const midEditSrc = `declare function local:f($param) { $param }; $`;
		const currentAnalysis = analyze(midEditSrc, "file:///test.xq");
		assert.ok(!currentAnalysis.usedAstPath, "expected regex path for mid-edit source");

		const labels = getCompletions(
			{ textBeforeCursor: midEditSrc, cursorOffset: midEditSrc.length },
			currentAnalysis, new Map(), false, lastValidAnalysis,
		).map((i) => i.label);
		assert.ok(!labels.includes("$param"), `$param should not appear outside function body, got ${labels}`);
	});
});

describe("completion: no-AST fallback (simple offset)", () => {
	test("let binding visible by offset when no AST and no lastValidAnalysis", () => {
		// Source with bare "$" at end → parse fails → regex path → ast undefined
		const midEditSrc = `let $x := 1 return $`;
		const analysis = analyze(midEditSrc, "file:///test.xq");
		assert.ok(!analysis.usedAstPath, "expected regex path for mid-edit source");
		// No lastValidAnalysis provided → simple offset fallback path
		const labels = getCompletions(
			{ textBeforeCursor: midEditSrc, cursorOffset: midEditSrc.length },
			analysis,
			new Map(),
		).map((i) => i.label);
		// $x is defined before cursor → should appear via offset-based filter
		assert.ok(labels.includes("$x"), `expected $x via offset fallback, got ${labels}`);
	});

	test("let binding before cursor hidden when cursor precedes its offset", () => {
		const midEditSrc = `let $x := 1 return $`;
		const analysis = analyze(midEditSrc, "file:///test.xq");
		assert.ok(!analysis.usedAstPath, "expected regex path for mid-edit source");
		// Cursor at offset 0 — before $x is defined
		const labels = getCompletions(
			{ textBeforeCursor: "$", cursorOffset: 0 },
			analysis,
			new Map(),
		).map((i) => i.label);
		assert.ok(!labels.includes("$x"), `$x should not appear before its offset, got ${labels}`);
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

describe("completion: imported module variables", () => {
	const libAnalysis = analyze(
		`module namespace lib="http://example.com/lib";
declare variable $lib:config := "x";`,
		"file:///lib.xq",
	);

	test("imported variable appears when same prefix is used", () => {
		const mainAnalysis = analyze(
			`import module namespace lib="http://example.com/lib" at "./lib.xq"; 1`,
			"file:///main.xq",
		);
		const labels = getCompletions(
			{ textBeforeCursor: "$", cursorOffset: 1 },
			mainAnalysis,
			new Map([["./lib.xq", libAnalysis]]),
		).map((i) => i.label);
		assert.ok(labels.includes("$lib:config"), `expected $lib:config, got ${labels}`);
	});

	test("imported variable appears under aliased import prefix", () => {
		const mainAnalysis = analyze(
			`import module namespace mylib="http://example.com/lib" at "./lib.xq"; 1`,
			"file:///main.xq",
		);
		const labels = getCompletions(
			{ textBeforeCursor: "$", cursorOffset: 1 },
			mainAnalysis,
			new Map([["./lib.xq", libAnalysis]]),
		).map((i) => i.label);
		assert.ok(labels.includes("$mylib:config"), `expected $mylib:config (import prefix), got ${labels}`);
		assert.ok(!labels.includes("$lib:config"), `should not expose library-internal prefix $lib:config, got ${labels}`);
	});

	test("aliased prefix filters correctly when user types prefix", () => {
		const mainAnalysis = analyze(
			`import module namespace mylib="http://example.com/lib" at "./lib.xq"; 1`,
			"file:///main.xq",
		);
		const labels = getCompletions(
			{ textBeforeCursor: "$mylib:", cursorOffset: 7 },
			mainAnalysis,
			new Map([["./lib.xq", libAnalysis]]),
		).map((i) => i.label);
		assert.ok(labels.includes("$mylib:config"), `expected $mylib:config after typing $mylib:, got ${labels}`);
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

// ── Auto-import / auto-declare via additionalTextEdits ────────────────────────

const utilLib = analyze(
	`module namespace util="http://example.com/util";
declare function util:trim($s as xs:string) { $s };
declare function util:upper($s as xs:string) { $s };`,
	"file:///util.xq",
);

const configLib = analyze(
	`module namespace cfg="http://example.com/cfg";
declare variable $cfg:debug := false();`,
	"file:///cfg.xq",
);

const bare = analyze(`1`, "file:///main.xq");
const available = new Map([
	["http://example.com/util", utilLib],
	["http://example.com/cfg", configLib],
]);

describe("completion: auto-import — functions from unimported module", () => {
	test("functions appear when prefix matches module prefix", () => {
		const items = getCompletions(
			{ textBeforeCursor: "util:", cursorOffset: 5 },
			bare, new Map(), false, undefined, available,
		);
		assert.ok(items.some((i) => i.label === "trim"), `expected trim, got ${items.map((i) => i.label)}`);
	});

	test("additionalTextEdits inserts import statement", () => {
		const items = getCompletions(
			{ textBeforeCursor: "util:", cursorOffset: 5 },
			bare, new Map(), false, undefined, available, undefined,
			{ docText: "1", docUri: "file:///main.xq", generateLocationHints: true },
		);
		const trim = items.find((i) => i.label === "trim");
		assert.ok(trim?.additionalTextEdits?.length, "expected additionalTextEdits");
		const edit = trim!.additionalTextEdits![0];
		assert.ok(edit.newText.includes("import module namespace util"), `wrong import text: ${edit.newText}`);
		assert.ok(edit.newText.includes("http://example.com/util"), `missing URI: ${edit.newText}`);
		assert.ok(edit.newText.includes(`at "./util.xq"`), `expected relative at-path: ${edit.newText}`);
	});

	test("filter by local name still works", () => {
		const items = getCompletions(
			{ textBeforeCursor: "util:up", cursorOffset: 7 },
			bare, new Map(), false, undefined, available,
		);
		const labels = items.map((i) => i.label);
		assert.ok(labels.includes("upper"), `expected upper, got ${labels}`);
		assert.ok(!labels.includes("trim"), `trim should be filtered out, got ${labels}`);
	});

	test("no additionalTextEdits when module is already imported", () => {
		const alreadyImported = analyze(
			`import module namespace util="http://example.com/util" at "./util.xq"; 1`,
			"file:///main.xq",
		);
		const items = getCompletions(
			{ textBeforeCursor: "util:", cursorOffset: 5 },
			alreadyImported,
			new Map([["./util.xq", utilLib]]),
			false, undefined, available,
		);
		const trim = items.find((i) => i.label === "trim");
		assert.ok(trim, "expected trim from imported module");
		assert.ok(!trim!.additionalTextEdits?.length, "should have no additionalTextEdits when already imported");
	});
});

describe("completion: auto-import — variables from unimported module", () => {
	test("variables appear when namespace prefix matches module prefix", () => {
		const items = getCompletions(
			{ textBeforeCursor: "$cfg:", cursorOffset: 5 },
			bare, new Map(), false, undefined, available,
		);
		assert.ok(items.some((i) => i.label === "$cfg:debug"), `expected $cfg:debug, got ${items.map((i) => i.label)}`);
	});

	test("additionalTextEdits inserts import statement for variables", () => {
		const items = getCompletions(
			{ textBeforeCursor: "$cfg:", cursorOffset: 5 },
			bare, new Map(), false, undefined, available, undefined,
			{ docText: "1", docUri: "file:///main.xq", generateLocationHints: true },
		);
		const debug = items.find((i) => i.label === "$cfg:debug");
		assert.ok(debug?.additionalTextEdits?.length, "expected additionalTextEdits on variable");
		assert.ok(debug!.additionalTextEdits![0].newText.includes("import module namespace cfg"), "expected cfg import");
	});

	test("no additionalTextEdits for variable when module is already imported", () => {
		const alreadyImported = analyze(
			`import module namespace cfg="http://example.com/cfg" at "./cfg.xq"; 1`,
			"file:///main.xq",
		);
		const items = getCompletions(
			{ textBeforeCursor: "$cfg:", cursorOffset: 5 },
			alreadyImported,
			new Map([["./cfg.xq", configLib]]),
			false, undefined, available,
		);
		const debug = items.find((i) => i.label === "$cfg:debug");
		assert.ok(debug, "expected $cfg:debug from imported module");
		assert.ok(!debug!.additionalTextEdits?.length, "should have no additionalTextEdits when already imported");
	});
});

describe("completion: auto-declare-namespace for pure XML namespaces (knownNamespaces)", () => {
	const knownNs = new Map([["tei", "http://www.tei-c.org/ns/1.0"]]);

	test("declare-namespace item appears for undeclared prefix in knownNamespaces", () => {
		const items = getCompletions(
			{ textBeforeCursor: "tei:", cursorOffset: 4 },
			bare, new Map(), false, undefined, new Map(), knownNs,
		);
		assert.ok(
			items.some((i) => i.label.includes("tei") && i.label.includes("http://www.tei-c.org/ns/1.0")),
			`expected declare-namespace item for tei, got ${items.map((i) => i.label)}`,
		);
	});

	test("declare-namespace item has additionalTextEdits with declare namespace statement", () => {
		const items = getCompletions(
			{ textBeforeCursor: "tei:", cursorOffset: 4 },
			bare, new Map(), false, undefined, new Map(), knownNs,
			{ docText: "1", docUri: "file:///main.xq", generateLocationHints: false },
		);
		const nsItem = items.find((i) => i.label.includes("tei") && i.label.includes("http://www.tei-c.org/ns/1.0"));
		assert.ok(nsItem?.additionalTextEdits?.length, "expected additionalTextEdits");
		assert.ok(
			nsItem!.additionalTextEdits![0].newText.includes(`declare namespace tei = "http://www.tei-c.org/ns/1.0"`),
			`wrong text: ${nsItem!.additionalTextEdits![0].newText}`,
		);
	});

	test("declare-namespace item does not appear when prefix is already declared", () => {
		const declared = analyze(
			`declare namespace tei="http://www.tei-c.org/ns/1.0"; 1`,
			"file:///main.xq",
		);
		const items = getCompletions(
			{ textBeforeCursor: "tei:", cursorOffset: 4 },
			declared, new Map(), false, undefined, new Map(), knownNs,
		);
		assert.ok(
			!items.some((i) => i.label.includes("declare namespace")),
			`declare-namespace item should not appear when tei is already declared, got ${items.map((i) => i.label)}`,
		);
	});
});
