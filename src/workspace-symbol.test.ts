import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { SymbolKind } from "vscode-languageserver/node.js";
import { analyzeWithAst } from "./analyzer.ts";
import { getWorkspaceSymbols } from "./workspace-symbol.ts";
import type { FileRecord } from "./references.ts";
import { expandGlobs } from "./config.ts";
import { withTmpDir } from "./test-utils.ts";

function buildRecords(dir: string): FileRecord[] {
	return expandGlobs(["**/*.xq"], dir).map((filePath) => {
		const uri = pathToFileURL(filePath).toString();
		const text = fs.readFileSync(filePath, "utf-8");
		const { analysis } = analyzeWithAst(text, uri);
		return { uri, text, analysis };
	});
}

describe("getWorkspaceSymbols", () => {
	test("matches a function by substring, case-insensitively", () => {
		const src = `declare function local:doStuff($x) { $x };`;
		const { analysis } = analyzeWithAst(src, "file:///main.xq");
		const records: FileRecord[] = [{ uri: "file:///main.xq", text: src, analysis }];

		const symbols = getWorkspaceSymbols(records, "stuff");
		assert.equal(symbols.length, 1);
		assert.equal(symbols[0].name, "local:doStuff");
		assert.equal(symbols[0].kind, SymbolKind.Function);
		assert.equal(symbols[0].location.uri, "file:///main.xq");
	});

	test("matches a module variable, prefixing the name with $", () => {
		const src = `declare variable $local:greeting := "hi";`;
		const { analysis } = analyzeWithAst(src, "file:///main.xq");
		const records: FileRecord[] = [{ uri: "file:///main.xq", text: src, analysis }];

		const symbols = getWorkspaceSymbols(records, "greeting");
		assert.equal(symbols.length, 1);
		assert.equal(symbols[0].name, "$local:greeting");
		assert.equal(symbols[0].kind, SymbolKind.Variable);
	});

	test("no match returns an empty array", () => {
		const src = `declare function local:doStuff($x) { $x };`;
		const { analysis } = analyzeWithAst(src, "file:///main.xq");
		const records: FileRecord[] = [{ uri: "file:///main.xq", text: src, analysis }];

		assert.deepEqual(getWorkspaceSymbols(records, "nonexistent"), []);
	});

	test("empty query matches everything", () => {
		const src = `declare function local:f($x) { $x };\ndeclare variable $local:v := 1;`;
		const { analysis } = analyzeWithAst(src, "file:///main.xq");
		const records: FileRecord[] = [{ uri: "file:///main.xq", text: src, analysis }];

		assert.equal(getWorkspaceSymbols(records, "").length, 2);
	});

	test("searches across every file in the workspace", () => {
		withTmpDir((dir) => {
			fs.writeFileSync(
				path.join(dir, "lib.xq"),
				`module namespace lib = "http://example.com/lib";\ndeclare function lib:greet($name) { concat("hi ", $name) };\n`,
			);
			fs.writeFileSync(
				path.join(dir, "main.xq"),
				`import module namespace lib = "http://example.com/lib" at "lib.xq";\ndeclare function local:main() { lib:greet("a") };\n`,
			);

			const symbols = getWorkspaceSymbols(buildRecords(dir), "greet");
			assert.equal(symbols.length, 1);
			assert.equal(symbols[0].name, "lib:greet");
			assert.ok(symbols[0].location.uri.endsWith("lib.xq"));
		});
	});
});
