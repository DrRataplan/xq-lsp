import * as fs from "node:fs";
import * as path from "node:path";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "./analyzer.ts";
import { getDefinition } from "./definition.ts";
import { makeDoc, withTmpDir } from "./test-utils.ts";

function def(
	src: string,
	cursorWord: string,
	imported: Map<string, import("./types.ts").FileAnalysis> = new Map(),
	srcUri = "file:///test.xq",
) {
	const doc = makeDoc(src, srcUri);
	const analysis = analyze(src, srcUri);
	const offset = src.indexOf(cursorWord);
	assert.ok(offset >= 0, `"${cursorWord}" not found in source`);
	return getDefinition(doc, offset + 1, analysis, imported, (at) => `file:///${at}`);
}

describe("go-to-definition", () => {
	describe("local variables", () => {
		test("let binding navigates to its declaration", () => {
			const src = `let $x := 1 return $x`;
			const loc = def(src, "$x", new Map(), "file:///test.xq");
			assert.ok(loc, "expected a location");
			// declaration is at offset 4 ($x in 'let $x')
			const declOffset = src.indexOf("$x");
			const doc = makeDoc(src);
			assert.deepEqual(loc!.range.start, doc.positionAt(declOffset));
		});

		test("module-level variable navigates to its declaration", () => {
			const src = `declare variable $local:x := 42; $local:x`;
			const loc = def(src, "$local:x", new Map(), "file:///test.xq");
			assert.ok(loc, "expected a location");
		});
	});

	describe("function params", () => {
		test("param reference inside function body navigates to param declaration", () => {
			const src = `declare function local:f($val as xs:integer) { $val * 2 }; 1`;
			// cursor on the $val in the body
			const bodyRef = src.lastIndexOf("$val");
			const doc = makeDoc(src);
			const analysis = analyze(src, "file:///test.xq");
			const loc = getDefinition(doc, bodyRef + 1, analysis, new Map(), (at) => `file:///${at}`);
			assert.ok(loc, "expected location for $val param");
			// declaration offset: first $val (in parameter list)
			const declOffset = src.indexOf("$val");
			assert.deepEqual(loc!.range.start, doc.positionAt(declOffset));
		});

		test("go-to-def on param name itself works", () => {
			const src = `declare function local:f($p as xs:string) { $p }; 1`;
			const declOffset = src.indexOf("$p");
			const doc = makeDoc(src);
			const analysis = analyze(src, "file:///test.xq");
			const loc = getDefinition(doc, declOffset + 1, analysis, new Map(), (at) => `file:///${at}`);
			assert.ok(loc, "expected location for $p param");
		});
	});

	describe("imported variables", () => {
		const libSrc = `module namespace lib="http://example.com/lib";\ndeclare variable $lib:count := 42;`;

		test("imported module variable navigates to its source file", () => {
			const libAnalysis = analyze(libSrc, "file:///lib.xq");
			const src = `import module namespace lib="http://example.com/lib" at "lib.xq";\n$lib:count`;
			const loc = def(
				src,
				"$lib:count",
				new Map([["file:///lib.xq", libAnalysis]]),
				"file:///main.xq",
			);
			assert.ok(loc, "expected a location for imported $lib:count");
			assert.equal(loc!.uri, "file:///lib.xq", "location should point to lib.xq");
		});

		test("imported variable location is on the declaration line", () => {
			withTmpDir((dir) => {
				const libPath = path.join(dir, "lib.xq");
				fs.writeFileSync(libPath, libSrc);
				const libUri = `file://${libPath}`;
				const libAnalysis = analyze(libSrc, libUri);
				const mainSrc = `import module namespace lib="http://example.com/lib" at "lib.xq";\n$lib:count`;
				const mainDoc = makeDoc(mainSrc, "file:///main.xq");
				const mainAnalysis = analyze(mainSrc, "file:///main.xq");
				const offset = mainSrc.lastIndexOf("$lib:count");
				const loc = getDefinition(mainDoc, offset + 1, mainAnalysis, new Map([[libUri, libAnalysis]]), () => libUri);
				assert.ok(loc, "expected a location");
				assert.equal(loc!.uri, libUri);
				// VarDecl starts at 'variable' keyword which is on line 1
				assert.equal(loc!.range.start.line, 1, "expected declaration on second line of lib file");
			});
		});
	});
});
