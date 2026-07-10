import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { DocumentHighlightKind } from "vscode-languageserver/node.js";
import { analyzeWithAst } from "./analyzer.ts";
import { getReferences, getRenameLocations, getRenameRangeAtOffset, getDocumentHighlights } from "./references.ts";
import type { FileRecord } from "./references.ts";
import { expandGlobs } from "./config.ts";
import { withTmpDir } from "./test-utils.ts";

function refs(src: string, offset: number, includeDeclaration = true, getOtherFiles: () => FileRecord[] = () => []) {
	const { analysis } = analyzeWithAst(src, "file:///main.xq");
	return getReferences("file:///main.xq", src, offset, analysis, includeDeclaration, getOtherFiles);
}

/** Offset of the `occurrence`-th occurrence (0-indexed) of `needle` in `src`. */
function offsetOf(src: string, needle: string, occurrence = 0): number {
	let idx = -1;
	for (let i = 0; i <= occurrence; i++) {
		idx = src.indexOf(needle, idx + 1);
		assert.ok(idx >= 0, `expected occurrence ${i} of "${needle}" to exist`);
	}
	return idx;
}

function buildRecords(dir: string): FileRecord[] {
	return expandGlobs(["**/*.xq"], dir).map((filePath) => {
		const uri = pathToFileURL(filePath).toString();
		const text = fs.readFileSync(filePath, "utf-8");
		const { analysis } = analyzeWithAst(text, uri);
		return { uri, text, analysis };
	});
}

// ── Functions ─────────────────────────────────────────────────────────────────

describe("getReferences: functions", () => {
	test("matches by arity, excluding overloads", () => {
		const src = `
declare function local:f($x) { $x };
declare function local:f($x, $y) { $x + $y };
local:f(1),
local:f(1, 2),
local:f(2)
`;
		const locs = refs(src, offsetOf(src, "local:f(1),") + "local:".length);
		assert.equal(locs.length, 3); // declaration + two arity-1 calls
	});

	test("includeDeclaration: false omits the declaration", () => {
		const src = `
declare function local:f($x) { $x };
local:f(1), local:f(2)
`;
		const locs = refs(src, offsetOf(src, "local:f(1)") + "local:".length, false);
		assert.equal(locs.length, 2);
	});

	test("cross-file: declaration in one module, calls in another", () => {
		withTmpDir((dir) => {
			fs.writeFileSync(
				path.join(dir, "lib.xq"),
				`module namespace lib = "http://example.com/lib";\ndeclare function lib:greet($name) { concat("hi ", $name) };\n`,
			);
			const mainPath = path.join(dir, "main.xq");
			fs.writeFileSync(
				mainPath,
				`import module namespace lib = "http://example.com/lib" at "lib.xq";\nlib:greet("a"), lib:greet("b")\n`,
			);

			const mainUri = pathToFileURL(mainPath).toString();
			const mainText = fs.readFileSync(mainPath, "utf-8");
			const { analysis } = analyzeWithAst(mainText, mainUri);
			const offset = offsetOf(mainText, "lib:greet(\"a\")") + "lib:".length;

			const locs = getReferences(mainUri, mainText, offset, analysis, true, () => buildRecords(dir));
			assert.equal(locs.length, 3); // declaration (lib.xq) + two calls (main.xq)
			assert.equal(locs.filter((l) => l.uri.endsWith("lib.xq")).length, 1);
			assert.equal(locs.filter((l) => l.uri.endsWith("main.xq")).length, 2);
		});
	});
});

// ── Variables ─────────────────────────────────────────────────────────────────

describe("getReferences: variables", () => {
	test("local let-binding: same-file only, shadowing respected", () => {
		const src = `
let $x := 1
return ($x, let $x := 2 return $x)
`;
		const outerDecl = offsetOf(src, "$x", 0) + 1;
		const outerUsage = offsetOf(src, "$x", 1) + 1;
		const innerDecl = offsetOf(src, "$x", 2) + 1;
		const innerUsage = offsetOf(src, "$x", 3) + 1;

		const fromOuterDecl = refs(src, outerDecl);
		assert.equal(fromOuterDecl.length, 2);
		const outerStarts = fromOuterDecl.map((l) => l.range.start).sort((a, b) => a.character - b.character);
		assert.equal(outerStarts.length, 2);

		const fromOuterUsage = refs(src, outerUsage);
		assert.equal(fromOuterUsage.length, 2);

		const fromInnerDecl = refs(src, innerDecl);
		assert.equal(fromInnerDecl.length, 2);

		const fromInnerUsage = refs(src, innerUsage);
		assert.equal(fromInnerUsage.length, 2);
	});

	test("function parameter: declaration plus all body usages", () => {
		const src = `declare function local:f($x) { $x + $x };\n1`;
		const paramDecl = offsetOf(src, "$x", 0) + 1;
		const locs = refs(src, paramDecl);
		assert.equal(locs.length, 3); // declaration + two usages in body

		const withoutDecl = refs(src, paramDecl, false);
		assert.equal(withoutDecl.length, 2);
	});

	test("module variable: cross-file search by namespace + local name", () => {
		withTmpDir((dir) => {
			fs.writeFileSync(
				path.join(dir, "lib.xq"),
				`module namespace lib = "http://example.com/lib";\ndeclare variable $lib:x := 42;\n`,
			);
			const mainPath = path.join(dir, "main.xq");
			fs.writeFileSync(
				mainPath,
				`import module namespace lib = "http://example.com/lib" at "lib.xq";\n$lib:x\n`,
			);

			const libPath = path.join(dir, "lib.xq");
			const libUri = pathToFileURL(libPath).toString();
			const libText = fs.readFileSync(libPath, "utf-8");
			const { analysis } = analyzeWithAst(libText, libUri);
			const declOffset = offsetOf(libText, "lib:x") + "lib:".length;

			const locs = getReferences(libUri, libText, declOffset, analysis, true, () => buildRecords(dir));
			assert.equal(locs.length, 2); // declaration (lib.xq) + usage (main.xq)
			assert.equal(locs.filter((l) => l.uri.endsWith("lib.xq")).length, 1);
			assert.equal(locs.filter((l) => l.uri.endsWith("main.xq")).length, 1);

			const withoutDecl = getReferences(libUri, libText, declOffset, analysis, false, () => buildRecords(dir));
			assert.equal(withoutDecl.length, 1);
			assert.ok(withoutDecl[0].uri.endsWith("main.xq"));
		});
	});
});

// ── Namespace prefixes ────────────────────────────────────────────────────────

describe("getReferences: namespace prefixes", () => {
	test("same-file usages plus the import declaration, other prefixes excluded", () => {
		const src = `
import module namespace ex = "http://example.com/ex" at "ex.xq";
import module namespace other = "http://example.com/other" at "other.xq";
ex:foo(), ex:bar(), other:baz()
`;
		const locs = refs(src, offsetOf(src, "ex:foo"));
		assert.equal(locs.length, 3); // import decl + ex:foo + ex:bar
	});

	test("includeDeclaration: false omits the import statement", () => {
		const src = `
import module namespace ex = "http://example.com/ex" at "ex.xq";
ex:foo(), ex:bar()
`;
		const locs = refs(src, offsetOf(src, "ex:foo"), false);
		assert.equal(locs.length, 2);
	});

	test("declare namespace prefix", () => {
		const src = `
declare namespace ex = "http://example.com/ex";
ex:foo()
`;
		const locs = refs(src, offsetOf(src, "ex:foo"));
		assert.equal(locs.length, 2); // declare-namespace decl + one usage
	});

	test("clicking the bare prefix on the import statement itself finds usages", () => {
		const src = `
import module namespace ex = "http://example.com/ex" at "ex.xq";
ex:foo(), ex:bar()
`;
		const offset = offsetOf(src, "import module namespace ex") + "import module namespace ".length;
		const locs = refs(src, offset);
		assert.equal(locs.length, 3); // the import decl itself + ex:foo + ex:bar
	});

	test("clicking the bare prefix on a declare-namespace statement finds usages", () => {
		const src = `
declare namespace ex = "http://example.com/ex";
ex:foo()
`;
		const offset = offsetOf(src, "declare namespace ex") + "declare namespace ".length;
		const locs = refs(src, offset);
		assert.equal(locs.length, 2); // the declare-namespace decl itself + ex:foo
	});
});

// ── Rename ────────────────────────────────────────────────────────────────────

function rename(src: string, offset: number, getOtherFiles: () => FileRecord[] = () => []) {
	const { analysis } = analyzeWithAst(src, "file:///main.xq");
	return getRenameLocations("file:///main.xq", src, offset, analysis, getOtherFiles);
}

function prepareRename(src: string, offset: number) {
	const { analysis } = analyzeWithAst(src, "file:///main.xq");
	return getRenameRangeAtOffset(src, offset, analysis);
}

describe("getRenameLocations: variables", () => {
	test("local let-binding: same locations as find-references", () => {
		const src = `
let $x := 1
return ($x, $x)
`;
		const decl = offsetOf(src, "$x", 0) + 1;
		const locs = rename(src, decl);
		assert.equal(locs?.length, 3);
	});

	test("module variable: cross-file, prefix qualifier untouched", () => {
		withTmpDir((dir) => {
			fs.writeFileSync(
				path.join(dir, "lib.xq"),
				`module namespace lib = "http://example.com/lib";\ndeclare variable $lib:x := 42;\n`,
			);
			const mainPath = path.join(dir, "main.xq");
			fs.writeFileSync(mainPath, `import module namespace lib = "http://example.com/lib" at "lib.xq";\n$lib:x\n`);

			const mainUri = pathToFileURL(mainPath).toString();
			const mainText = fs.readFileSync(mainPath, "utf-8");
			const { analysis } = analyzeWithAst(mainText, mainUri);
			const offset = offsetOf(mainText, "lib:x") + "lib:".length;

			const locs = getRenameLocations(mainUri, mainText, offset, analysis, () => buildRecords(dir));
			assert.equal(locs?.length, 2);
			const usage = locs!.find((l) => l.uri.endsWith("main.xq"))!;
			const lines = mainText.split("\n");
			assert.equal(lines[usage.range.start.line].slice(usage.range.start.character, usage.range.end.character), "x");
		});
	});

	test("builtin/predeclared function has no local declaration: not renameable", () => {
		const src = `string-length("abc")`;
		const offset = offsetOf(src, "string-length");
		assert.equal(rename(src, offset), null);
	});
});

describe("getRenameLocations: functions", () => {
	test("cross-file: declaration plus calls, prefix qualifier untouched", () => {
		withTmpDir((dir) => {
			fs.writeFileSync(
				path.join(dir, "lib.xq"),
				`module namespace lib = "http://example.com/lib";\ndeclare function lib:greet($name) { concat("hi ", $name) };\n`,
			);
			const mainPath = path.join(dir, "main.xq");
			fs.writeFileSync(
				mainPath,
				`import module namespace lib = "http://example.com/lib" at "lib.xq";\nlib:greet("a"), lib:greet("b")\n`,
			);

			const mainUri = pathToFileURL(mainPath).toString();
			const mainText = fs.readFileSync(mainPath, "utf-8");
			const { analysis } = analyzeWithAst(mainText, mainUri);
			const offset = offsetOf(mainText, `lib:greet("a")`) + "lib:".length;

			const locs = getRenameLocations(mainUri, mainText, offset, analysis, () => buildRecords(dir));
			assert.equal(locs?.length, 3);
			const lines = mainText.split("\n");
			const usageTexts = locs!
				.filter((l) => l.uri.endsWith("main.xq"))
				.map((l) => lines[l.range.start.line].slice(l.range.start.character, l.range.end.character));
			assert.deepEqual(usageTexts.sort(), ["greet", "greet"]);
		});
	});
});

describe("getRenameLocations: namespace prefixes", () => {
	test("declared prefix: same locations as find-references", () => {
		const src = `
import module namespace ex = "http://example.com/ex" at "ex.xq";
ex:foo(), ex:bar()
`;
		const locs = rename(src, offsetOf(src, "ex:foo"));
		assert.equal(locs?.length, 3);
	});

	test("undeclared prefix: not renameable", () => {
		const src = `ex:foo()`;
		assert.equal(rename(src, offsetOf(src, "ex:foo")), null);
	});
});

describe("getRenameRangeAtOffset", () => {
	test("variable: range excludes the leading $", () => {
		const src = `let $x := 1 return $x`;
		const range = prepareRename(src, offsetOf(src, "$x", 1) + 1);
		assert.deepEqual(range, { start: offsetOf(src, "$x", 1) + 1, end: offsetOf(src, "$x", 1) + 2 });
	});

	test("prefixed function call: range excludes the prefix", () => {
		const src = `
import module namespace ex = "http://example.com/ex" at "ex.xq";
ex:foo()
`;
		const callOffset = offsetOf(src, "ex:foo");
		const range = prepareRename(src, callOffset + "ex:".length);
		assert.deepEqual(range, { start: callOffset + "ex:".length, end: callOffset + "ex:foo".length });
	});

	test("undeclared prefix: null", () => {
		const src = `ex:foo()`;
		assert.equal(prepareRename(src, offsetOf(src, "ex:foo")), null);
	});
});

// ── Document highlights ─────────────────────────────────────────────────────────

function highlights(src: string, offset: number) {
	const { analysis } = analyzeWithAst(src, "file:///main.xq");
	return getDocumentHighlights(src, offset, analysis);
}

describe("getDocumentHighlights", () => {
	test("local let-binding: declaration is Write, usages are Read", () => {
		const src = `
let $x := 1
return ($x, $x)
`;
		const hl = highlights(src, offsetOf(src, "$x", 0) + 1)!;
		assert.equal(hl.length, 3);
		assert.equal(hl.filter((h) => h.kind === DocumentHighlightKind.Write).length, 1);
		assert.equal(hl.filter((h) => h.kind === DocumentHighlightKind.Read).length, 2);
	});

	test("module variable: same-file only, declaration in another file is not included", () => {
		withTmpDir((dir) => {
			fs.writeFileSync(
				path.join(dir, "lib.xq"),
				`module namespace lib = "http://example.com/lib";\ndeclare variable $lib:x := 42;\n`,
			);
			const mainPath = path.join(dir, "main.xq");
			fs.writeFileSync(mainPath, `import module namespace lib = "http://example.com/lib" at "lib.xq";\n$lib:x, $lib:x\n`);
			const mainText = fs.readFileSync(mainPath, "utf-8");

			const hl = highlights(mainText, offsetOf(mainText, "lib:x") + "lib:".length)!;
			assert.equal(hl.length, 2); // two same-file usages; declaration lives in lib.xq
			assert.equal(hl.filter((h) => h.kind === DocumentHighlightKind.Write).length, 0);
		});
	});

	test("function: declaration Write, calls Read, arity-matched only", () => {
		const src = `
declare function local:f($x) { $x };
declare function local:f($x, $y) { $x + $y };
local:f(1), local:f(2)
`;
		const hl = highlights(src, offsetOf(src, "local:f(1)") + "local:".length)!;
		assert.equal(hl.length, 3); // arity-1 decl + two arity-1 calls
		assert.equal(hl.filter((h) => h.kind === DocumentHighlightKind.Write).length, 1);
	});

	test("namespace prefix: import decl is Write, usages are Read", () => {
		const src = `
import module namespace ex = "http://example.com/ex" at "ex.xq";
ex:foo(), ex:bar()
`;
		const hl = highlights(src, offsetOf(src, "ex:foo"))!;
		assert.equal(hl.length, 3);
		assert.equal(hl.filter((h) => h.kind === DocumentHighlightKind.Write).length, 1);
		assert.equal(hl.filter((h) => h.kind === DocumentHighlightKind.Read).length, 2);
	});

	test("builtin function: still highlights call sites, just no Write occurrence", () => {
		const src = `string-length("a"), string-length("b")`;
		const hl = highlights(src, offsetOf(src, "string-length"))!;
		assert.equal(hl.length, 2);
		assert.ok(hl.every((h) => h.kind === DocumentHighlightKind.Read));
	});

	test("no symbol at offset: null", () => {
		const src = `1 + 1`;
		assert.equal(highlights(src, 1), null);
	});
});
