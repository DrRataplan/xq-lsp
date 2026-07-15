import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { analyzeWithAst } from "./analyzer.ts";
import { buildCodeLenses, resolveCodeLens } from "./code-lens.ts";
import type { CodeLensData } from "./code-lens.ts";
import { expandGlobs } from "./config.ts";
import type { FileRecord } from "./references.ts";
import { makeDoc, withTmpDir } from "./test-utils.ts";

function buildRecords(dir: string): FileRecord[] {
	return expandGlobs(["**/*.xq"], dir).map((filePath) => {
		const uri = pathToFileURL(filePath).toString();
		const text = fs.readFileSync(filePath, "utf-8");
		const { analysis } = analyzeWithAst(text, uri);
		return { uri, text, analysis };
	});
}

describe("buildCodeLenses", () => {
	test("one unresolved lens per function and module variable", () => {
		const src = `
declare function local:f($x) { $x };
declare variable $v := 1;
1
`;
		const doc = makeDoc(src);
		const { analysis } = analyzeWithAst(src, doc.uri);
		const lenses = buildCodeLenses(doc, analysis);

		assert.equal(lenses.length, 2);
		assert.ok(lenses.every((l) => l.command === undefined));
		for (const lens of lenses) {
			const data = lens.data as CodeLensData;
			assert.equal(data.uri, doc.uri);
			assert.ok(data.kind === "function" || data.kind === "variable");
		}
	});
});

describe("resolveCodeLens: functions", () => {
	test("counts calls, excluding the declaration", () => {
		const src = `
declare function local:f($x) { $x };
local:f(1), local:f(2)
`;
		const doc = makeDoc(src);
		const { analysis } = analyzeWithAst(src, doc.uri);
		const [lens] = buildCodeLenses(doc, analysis);

		const resolved = resolveCodeLens(lens, src, analysis, () => []);
		assert.equal(resolved.command?.title, "2 references");
	});

	test("zero references is reported, not hidden", () => {
		const src = `
declare function local:unused($x) { $x };
1
`;
		const doc = makeDoc(src);
		const { analysis } = analyzeWithAst(src, doc.uri);
		const [lens] = buildCodeLenses(doc, analysis);

		const resolved = resolveCodeLens(lens, src, analysis, () => []);
		assert.equal(resolved.command?.title, "0 references");
	});

	test("cross-file: calls from another module count towards the declaration's lens", () => {
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

			const libPath = path.join(dir, "lib.xq");
			const libUri = pathToFileURL(libPath).toString();
			const libText = fs.readFileSync(libPath, "utf-8");
			const { analysis } = analyzeWithAst(libText, libUri);
			const doc = makeDoc(libText, libUri);
			const [lens] = buildCodeLenses(doc, analysis);

			const resolved = resolveCodeLens(lens, libText, analysis, () => buildRecords(dir));
			assert.equal(resolved.command?.title, "2 references");
		});
	});
});

describe("resolveCodeLens: module variables", () => {
	test("counts usages, excluding the declaration", () => {
		const src = `
declare variable $v := 1;
$v, $v
`;
		const doc = makeDoc(src);
		const { analysis } = analyzeWithAst(src, doc.uri);
		const [lens] = buildCodeLenses(doc, analysis);

		assert.equal((lens.data as CodeLensData).kind, "variable");
		const resolved = resolveCodeLens(lens, src, analysis, () => []);
		assert.equal(resolved.command?.title, "2 references");
	});

	test("cross-file: usage from another module counts towards the declaration's lens", () => {
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
			const doc = makeDoc(libText, libUri);
			const [lens] = buildCodeLenses(doc, analysis);

			const resolved = resolveCodeLens(lens, libText, analysis, () => buildRecords(dir));
			assert.equal(resolved.command?.title, "1 references");
		});
	});
});
