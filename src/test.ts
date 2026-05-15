import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { analyze } from "./analyzer.ts";
import { analyzeWithTreeSitter } from "./treesitter.ts";
import { getCompletions } from "./completion.ts";
import { getHover, getSignatureHelp, getDocumentSymbols } from "./features.ts";
import { getBuiltins } from "./builtins.ts";
import { findConfig, expandGlobs } from "./config.ts";
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
    module namespace util="http://example.com/util";
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

	// ── default function namespace ───────────────────────────────────────────────

	test("completion: fn: builtins appear without prefix in plain-name mode", () => {
		const empty = analyze("1", "file:///test.xq");
		const builtins = getBuiltins();
		const items = getCompletions(
			{ textBeforeCursor: "exi", cursorOffset: 3 },
			empty,
			new Map([["builtin:fn", builtins]]),
		);
		const labels = items.map((i) => i.label);
		assert.ok(labels.includes("exists"), `expected exists without prefix, got ${labels}`);
		assert.ok(!labels.some(l => l.startsWith("fn:")), `fn: prefix should not appear, got ${labels}`);
	});

	test("completion: alias prefix resolves to same namespace as declared prefix", () => {
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
		const items = getCompletions(
			{ textBeforeCursor: "m:", cursorOffset: 2 },
			mainAnalysis,
			new Map([["./math.xq", libAnalysis]]),
		);
		const labels = items.map((i) => i.label);
		assert.ok(labels.includes("sin"), `expected sin via aliased prefix m:, got ${labels}`);
	});

	test("hover: unprefixed builtin name resolves via default function namespace", () => {
		const src = `fn:true()`;
		const doc = makeDoc(src);
		const analysis = analyze(src, "file:///test.xq");
		const builtins = getBuiltins();
		const hover = getHover(doc, src.indexOf("true"), analysis, new Map([["builtin:fn", builtins]]));
		assert.ok(hover, "expected hover");
		const value = typeof hover.contents === "object" && "value" in hover.contents ? hover.contents.value : "";
		assert.ok(value.includes("fn:true"), `expected fn:true in hover, got: ${value}`);
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

// ── imports without "at" clause ───────────────────────────────────────────────

describe("imports without at clause", () => {
	const WITHOUT_AT = `import module namespace util="http://example.com/util";
declare function local:main() { util:trim("x") };`;

	test("analyzer: AST path extracts import without at path", () => {
		const result = analyze(WITHOUT_AT, "file:///test.xq");
		assert.equal(result.imports.length, 1);
		assert.equal(result.imports[0].prefix, "util");
		assert.equal(result.imports[0].namespaceUri, "http://example.com/util");
		assert.equal(result.imports[0].atPath, undefined);
	});

	test("analyzer: regex fallback extracts import without at path", () => {
		// Force regex path with trailing invalid syntax
		const result = analyze(WITHOUT_AT + "\nlet $x := util:trim(", "file:///test.xq");
		assert.equal(result.imports.length, 1);
		assert.equal(result.imports[0].prefix, "util");
		assert.equal(result.imports[0].namespaceUri, "http://example.com/util");
		assert.equal(result.imports[0].atPath, undefined);
	});

	test("analyzer: regex fallback still extracts import with at path", () => {
		const src = `import module namespace util="http://example.com/util" at "./util.xq";
let $x := util:trim(`;
		const result = analyze(src, "file:///test.xq");
		assert.equal(result.imports.length, 1);
		assert.equal(result.imports[0].atPath, "./util.xq");
	});
});

// ── lsp-config.xq parsing and glob expansion ─────────────────────────────────

describe("lsp-config", () => {
	function withTmpDir(fn: (dir: string) => void): void {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xq-lsp-test-"));
		try {
			fn(dir);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	}

	test("findConfig: locates lsp-config.xq in the same directory", () => {
		withTmpDir((dir) => {
			fs.writeFileSync(path.join(dir, "lsp-config.xq"), `map { "glob": "**/*.xq" }`);
			const fileUri = pathToFileURL(path.join(dir, "main.xq")).toString();
			const result = findConfig(fileUri);
			assert.ok(result, "expected config to be found");
			assert.deepEqual(result.config.globs, ["**/*.xq"]);
			assert.equal(result.configDir, dir);
		});
	});

	test("findConfig: locates lsp-config.xq in a parent directory", () => {
		withTmpDir((dir) => {
			const sub = path.join(dir, "src");
			fs.mkdirSync(sub);
			fs.writeFileSync(path.join(dir, "lsp-config.xq"), `map { "glob": "src/**/*.xq" }`);
			const fileUri = pathToFileURL(path.join(sub, "main.xq")).toString();
			const result = findConfig(fileUri);
			assert.ok(result, "expected config to be found in parent");
			assert.deepEqual(result.config.globs, ["src/**/*.xq"]);
		});
	});

	test("findConfig: returns null when no config file exists", () => {
		withTmpDir((dir) => {
			const fileUri = pathToFileURL(path.join(dir, "main.xq")).toString();
			assert.equal(findConfig(fileUri), null);
		});
	});

	test("findConfig: parses multiple globs as a sequence", () => {
		withTmpDir((dir) => {
			fs.writeFileSync(
				path.join(dir, "lsp-config.xq"),
				`map { "glob": ("src/**/*.xq", "lib/**/*.xq") }`,
			);
			const fileUri = pathToFileURL(path.join(dir, "main.xq")).toString();
			const result = findConfig(fileUri);
			assert.ok(result);
			assert.deepEqual(result.config.globs, ["src/**/*.xq", "lib/**/*.xq"]);
		});
	});

	test("expandGlobs: finds .xq files recursively via **/*.xq", () => {
		withTmpDir((dir) => {
			const sub = path.join(dir, "lib");
			fs.mkdirSync(sub);
			fs.writeFileSync(path.join(dir, "a.xq"), "");
			fs.writeFileSync(path.join(sub, "b.xq"), "");
			fs.writeFileSync(path.join(sub, "c.txt"), ""); // should not match
			const files = expandGlobs(["**/*.xq"], dir);
			const names = files.map((f) => path.basename(f)).sort();
			assert.deepEqual(names, ["a.xq", "b.xq"]);
		});
	});

	test("expandGlobs: non-recursive pattern matches only in specified dir", () => {
		withTmpDir((dir) => {
			const sub = path.join(dir, "lib");
			fs.mkdirSync(sub);
			fs.writeFileSync(path.join(dir, "a.xq"), "");
			fs.writeFileSync(path.join(sub, "b.xq"), ""); // should not match
			const files = expandGlobs(["*.xq"], dir);
			const names = files.map((f) => path.basename(f));
			assert.deepEqual(names, ["a.xq"]);
		});
	});

	test("completion: glob-loaded module resolves namespace-only import", () => {
		withTmpDir((dir) => {
			// Write a library module to disk
			const libSrc = `module namespace util="http://example.com/util";
declare function util:trim($s as xs:string) as xs:string { $s };`;
			fs.writeFileSync(path.join(dir, "util.xq"), libSrc);

			// The main module imports util without an "at" path
			const mainSrc = `import module namespace util="http://example.com/util";
util:trim("x")`;
			const mainAnalysis = analyze(mainSrc, pathToFileURL(path.join(dir, "main.xq")).toString());

			// Simulate what server.ts does: resolve glob-loaded modules by namespace URI
			const libAnalysis = analyze(libSrc, pathToFileURL(path.join(dir, "util.xq")).toString());
			const globAnalyses = new Map([[libAnalysis.moduleNamespaceUri!, libAnalysis]]);

			const imported = new Map<string, ReturnType<typeof analyze>>();
			for (const imp of mainAnalysis.imports) {
				if (!imp.atPath) {
					const a = globAnalyses.get(imp.namespaceUri);
					if (a) imported.set(imp.namespaceUri, a);
				}
			}

			const items = getCompletions(
				{ textBeforeCursor: "util:", cursorOffset: 5 },
				mainAnalysis,
				imported,
			);
			const labels = items.map((i) => i.label);
			assert.ok(labels.includes("trim"), `expected trim via namespace-only import, got ${labels}`);
		});
	});
});

// ── tree-sitter integration ───────────────────────────────────────────────────

describe("treesitter", () => {
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

	const WITH_DOC = `(:~
 : Adds two numbers.
 : @param $a The first operand
 : @param $b The second operand
 : @return The sum
 :)
declare function local:add($a as xs:integer, $b as xs:integer) as xs:integer {
  $a + $b
};`;

	const INVALID_XQ = `
import module namespace util="http://example.com/util" at "./util.xq";
declare variable $count := 10;
declare function local:double($x as xs:integer) as xs:integer {
  $x * 2
};
let $result := local:double(
`; // intentionally truncated

	test("treesitter: analyzeWithTreeSitter returns non-null for valid XQuery", () => {
		const result = analyzeWithTreeSitter(VALID_XQ, "file:///test.xq");
		assert.ok(result !== null, "expected non-null result for valid XQuery");
	});

	test("treesitter: analyzeWithTreeSitter returns null for invalid/truncated XQuery", () => {
		const result = analyzeWithTreeSitter(INVALID_XQ, "file:///incomplete.xq");
		assert.equal(result, null, "expected null for truncated/invalid XQuery");
	});

	test("treesitter: extracts same functions as xq-parser path", () => {
		const tsResult = analyzeWithTreeSitter(VALID_XQ, "file:///test.xq");
		const xqResult = analyze(VALID_XQ, "file:///test.xq");
		assert.ok(tsResult, "tree-sitter result should be non-null");
		const tsNames = tsResult.functions.map((f) => f.name).sort();
		const xqNames = xqResult.functions.map((f) => f.name).sort();
		assert.deepEqual(tsNames, xqNames, `function names differ: ts=${tsNames} xq=${xqNames}`);
	});

	test("treesitter: extracts same function arity and params as xq-parser path", () => {
		const tsResult = analyzeWithTreeSitter(VALID_XQ, "file:///test.xq");
		assert.ok(tsResult);
		const add = tsResult.functions.find((f) => f.name === "local:add");
		assert.ok(add, "local:add not found in tree-sitter result");
		assert.equal(add.arity, 2);
		assert.equal(add.params[0].name, "a");
		assert.equal(add.params[1].name, "b");
		assert.equal(add.params[0].type, "xs:integer");
		assert.equal(add.returnType, "xs:integer");
	});

	test("treesitter: extracts same module variables as xq-parser path", () => {
		const tsResult = analyzeWithTreeSitter(VALID_XQ, "file:///test.xq");
		assert.ok(tsResult);
		const names = tsResult.moduleVariables.map((v) => v.name);
		assert.ok(names.includes("local:count"), `expected local:count, got ${names}`);
		assert.ok(tsResult.moduleVariables[0].isModuleLevel);
	});

	test("treesitter: extracts same let/for bindings as xq-parser path", () => {
		const tsResult = analyzeWithTreeSitter(VALID_XQ, "file:///test.xq");
		assert.ok(tsResult);
		const names = tsResult.localBindings.map((v) => v.name);
		assert.ok(names.includes("sum"), `expected sum, got ${names}`);
		assert.ok(names.includes("item"), `expected item, got ${names}`);
	});

	test("treesitter: extracts same imports as xq-parser path", () => {
		const tsResult = analyzeWithTreeSitter(VALID_XQ, "file:///test.xq");
		assert.ok(tsResult);
		assert.equal(tsResult.imports.length, 1);
		assert.equal(tsResult.imports[0].prefix, "math");
		assert.equal(tsResult.imports[0].atPath, "./math.xq");
	});

	test("treesitter: extracts doc comment description", () => {
		const result = analyzeWithTreeSitter(WITH_DOC, "file:///test.xq");
		assert.ok(result, "tree-sitter result should be non-null");
		const fn = result.functions.find((f) => f.name === "local:add");
		assert.ok(fn?.doc?.description.includes("Adds two numbers"), `got: ${fn?.doc?.description}`);
	});

	test("treesitter: extracts @param descriptions", () => {
		const result = analyzeWithTreeSitter(WITH_DOC, "file:///test.xq");
		assert.ok(result);
		const fn = result.functions.find((f) => f.name === "local:add");
		assert.equal(fn?.params[0].description, "The first operand");
		assert.equal(fn?.params[1].description, "The second operand");
	});

	test("treesitter: extracts @return description", () => {
		const result = analyzeWithTreeSitter(WITH_DOC, "file:///test.xq");
		assert.ok(result);
		const fn = result.functions.find((f) => f.name === "local:add");
		assert.equal(fn?.doc?.returns, "The sum");
	});

	test("treesitter: analyze() uses tree-sitter for valid XQuery (returns same result as xq-parser)", () => {
		// analyze() should go through tree-sitter for valid files; verify output is equivalent
		const result = analyze(VALID_XQ, "file:///test.xq");
		const fnNames = result.functions.map((f) => f.name).sort();
		assert.ok(fnNames.includes("local:add"), `expected local:add, got ${fnNames}`);
		assert.ok(fnNames.includes("local:greet"), `expected local:greet, got ${fnNames}`);
	});

	test("treesitter: analyze() still falls back correctly for invalid XQuery", () => {
		const result = analyze(INVALID_XQ, "file:///incomplete.xq");
		const fnNames = result.functions.map((f) => f.name);
		assert.ok(fnNames.includes("local:double"), `expected local:double, got ${fnNames}`);
	});
});
