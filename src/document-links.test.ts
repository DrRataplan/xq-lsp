import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { analyzeWithAst } from "./analyzer.ts";
import { getDocumentLinks } from "./document-links.ts";
import { makeDoc, withTmpDir } from "./test-utils.ts";

function links(src: string, uri: string) {
	const doc = makeDoc(src, uri);
	const { analysis } = analyzeWithAst(src, uri);
	return getDocumentLinks(analysis, doc);
}

describe("getDocumentLinks", () => {
	describe("import module ... at", () => {
		test("resolvable at-path becomes a link to the module file", () => {
			withTmpDir((dir) => {
				const libPath = path.join(dir, "lib.xq");
				fs.writeFileSync(libPath, `module namespace lib = "http://example.com/lib";\n`);
				const mainUri = pathToFileURL(path.join(dir, "main.xq")).toString();
				const src = `import module namespace lib = "http://example.com/lib" at "lib.xq";\n1`;
				const result = links(src, mainUri);

				assert.equal(result.length, 1);
				assert.equal(result[0].target, pathToFileURL(libPath).toString());
				// range covers only the path content, not the surrounding quotes
				const doc = makeDoc(src, mainUri);
				const quoteOffset = src.indexOf('"lib.xq"');
				assert.deepEqual(result[0].range.start, doc.positionAt(quoteOffset + 1));
				assert.deepEqual(result[0].range.end, doc.positionAt(quoteOffset + 1 + "lib.xq".length));
			});
		});

		test("unresolvable at-path emits no link", () => {
			withTmpDir((dir) => {
				const mainUri = pathToFileURL(path.join(dir, "main.xq")).toString();
				const src = `import module namespace lib = "http://example.com/lib" at "does-not-exist.xq";\n1`;
				const result = links(src, mainUri);
				assert.equal(result.length, 0);
			});
		});

		test("import with no at-clause emits no link", () => {
			withTmpDir((dir) => {
				const mainUri = pathToFileURL(path.join(dir, "main.xq")).toString();
				const src = `import module namespace lib = "http://example.com/lib";\n1`;
				const result = links(src, mainUri);
				assert.equal(result.length, 0);
			});
		});
	});

	describe("fn:doc() / fn:collection()", () => {
		test("resolvable doc() path becomes a link to the file", () => {
			withTmpDir((dir) => {
				const dataPath = path.join(dir, "data.xml");
				fs.writeFileSync(dataPath, "<root/>");
				const mainUri = pathToFileURL(path.join(dir, "main.xq")).toString();
				const src = `doc("data.xml")`;
				const result = links(src, mainUri);

				assert.equal(result.length, 1);
				assert.equal(result[0].target, pathToFileURL(dataPath).toString());
			});
		});

		test("resolvable collection() path becomes a link to the file", () => {
			withTmpDir((dir) => {
				const dataPath = path.join(dir, "data");
				fs.writeFileSync(dataPath, "");
				const mainUri = pathToFileURL(path.join(dir, "main.xq")).toString();
				const src = `fn:collection("data")`;
				const result = links(src, mainUri);

				assert.equal(result.length, 1);
				assert.equal(result[0].target, pathToFileURL(dataPath).toString());
			});
		});

		test("doc() path that doesn't resolve to a file emits no link", () => {
			withTmpDir((dir) => {
				const mainUri = pathToFileURL(path.join(dir, "main.xq")).toString();
				const src = `doc("missing.xml")`;
				const result = links(src, mainUri);
				assert.equal(result.length, 0);
			});
		});

		test("non-literal doc() argument emits no link", () => {
			withTmpDir((dir) => {
				const mainUri = pathToFileURL(path.join(dir, "main.xq")).toString();
				const src = `declare variable $x := "data.xml"; doc($x)`;
				const result = links(src, mainUri);
				assert.equal(result.length, 0);
			});
		});
	});
});
