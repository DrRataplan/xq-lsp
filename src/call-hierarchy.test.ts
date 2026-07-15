import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { analyzeWithAst } from "./analyzer.ts";
import { prepareCallHierarchy, getIncomingCalls, getOutgoingCalls } from "./call-hierarchy.ts";
import { expandGlobs } from "./config.ts";
import { withTmpDir } from "./test-utils.ts";
import type { FileAnalysis } from "./types.ts";
import type { FileRecord } from "./references.ts";

function prepare(uri: string, src: string, cursorWord: string, imported: Map<string, FileAnalysis> = new Map()) {
	const { analysis } = analyzeWithAst(src, uri);
	const offset = src.indexOf(cursorWord);
	assert.ok(offset >= 0, `"${cursorWord}" not found in source`);
	return prepareCallHierarchy(uri, src, offset, analysis, imported);
}

function buildRecords(dir: string): FileRecord[] {
	return expandGlobs(["**/*.xq"], dir).map((filePath) => {
		const uri = pathToFileURL(filePath).toString();
		const text = fs.readFileSync(filePath, "utf-8");
		const { analysis } = analyzeWithAst(text, uri);
		return { uri, text, analysis };
	});
}

describe("call hierarchy: same file", () => {
	const src = `
declare function local:f($x) { $x };
declare function local:g() { local:f(1) };
1
`;
	const uri = "file:///main.xq";
	const { analysis } = analyzeWithAst(src, uri);

	test("prepareCallHierarchy resolves the function under the cursor", () => {
		const items = prepare(uri, src, "local:g");
		assert.equal(items.length, 1);
		assert.equal(items[0].name, "local:g");
		assert.equal(items[0].uri, uri);
	});

	test("outgoingCalls: g calls f once", () => {
		const items = prepare(uri, src, "local:g");
		const outgoing = getOutgoingCalls(items[0], src, analysis, new Map());
		assert.equal(outgoing.length, 1);
		assert.equal(outgoing[0].to.name, "local:f");
		assert.equal(outgoing[0].fromRanges.length, 1);
	});

	test("incomingCalls: f is called once, by g", () => {
		const items = prepare(uri, src, "local:f($x)");
		const incoming = getIncomingCalls(items[0], src, analysis, () => []);
		assert.equal(incoming.length, 1);
		assert.equal(incoming[0].from.name, "local:g");
		assert.equal(incoming[0].fromRanges.length, 1);
	});

	test("leaf function: no outgoing calls", () => {
		const leafSrc = `declare function local:leaf() { 42 };\n1`;
		const { analysis: leafAnalysis } = analyzeWithAst(leafSrc, uri);
		const items = prepare(uri, leafSrc, "local:leaf");
		assert.equal(items.length, 1);
		const outgoing = getOutgoingCalls(items[0], leafSrc, leafAnalysis, new Map());
		assert.equal(outgoing.length, 0);
	});

	test("no symbol at cursor: prepareCallHierarchy returns no items", () => {
		const items = prepareCallHierarchy(uri, src, 0, analysis, new Map());
		assert.equal(items.length, 0);
	});
});

describe("call hierarchy: cross file", () => {
	test("outgoingCalls: caller resolves to callee declared in another module", () => {
		withTmpDir((dir) => {
			fs.writeFileSync(
				path.join(dir, "lib.xq"),
				`module namespace lib = "http://example.com/lib";\ndeclare function lib:greet($name) { concat("hi ", $name) };\n`,
			);
			const mainPath = path.join(dir, "main.xq");
			fs.writeFileSync(
				mainPath,
				`import module namespace lib = "http://example.com/lib" at "lib.xq";\ndeclare function local:caller() { lib:greet("a") };\n1\n`,
			);

			const mainUri = pathToFileURL(mainPath).toString();
			const mainText = fs.readFileSync(mainPath, "utf-8");
			const { analysis: mainAnalysis } = analyzeWithAst(mainText, mainUri);

			const libPath = path.join(dir, "lib.xq");
			const libUri = pathToFileURL(libPath).toString();
			const libText = fs.readFileSync(libPath, "utf-8");
			const { analysis: libAnalysis } = analyzeWithAst(libText, libUri);

			const imported = new Map([
				["http://example.com/lib", libAnalysis],
				["lib.xq", libAnalysis],
			]);

			const items = prepare(mainUri, mainText, "local:caller", imported);
			assert.equal(items.length, 1);

			const outgoing = getOutgoingCalls(items[0], mainText, mainAnalysis, imported);
			assert.equal(outgoing.length, 1);
			assert.equal(outgoing[0].to.name, "lib:greet");
			assert.equal(outgoing[0].to.uri, libUri);
		});
	});

	test("incomingCalls: callee finds the caller declared in another module", () => {
		withTmpDir((dir) => {
			fs.writeFileSync(
				path.join(dir, "lib.xq"),
				`module namespace lib = "http://example.com/lib";\ndeclare function lib:greet($name) { concat("hi ", $name) };\n`,
			);
			const mainPath = path.join(dir, "main.xq");
			fs.writeFileSync(
				mainPath,
				`import module namespace lib = "http://example.com/lib" at "lib.xq";\ndeclare function local:caller() { lib:greet("a") };\n1\n`,
			);

			const libPath = path.join(dir, "lib.xq");
			const libUri = pathToFileURL(libPath).toString();
			const libText = fs.readFileSync(libPath, "utf-8");
			const { analysis: libAnalysis } = analyzeWithAst(libText, libUri);

			const items = prepare(libUri, libText, "lib:greet");
			assert.equal(items.length, 1);

			const incoming = getIncomingCalls(items[0], libText, libAnalysis, () => buildRecords(dir));
			assert.equal(incoming.length, 1);
			assert.equal(incoming[0].from.name, "local:caller");
			assert.equal(incoming[0].from.uri, pathToFileURL(mainPath).toString());
			assert.equal(incoming[0].fromRanges.length, 1);
		});
	});
});
