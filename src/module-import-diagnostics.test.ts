import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { analyzeWithAst } from "./analyzer.ts";
import { checkModuleImportTargets } from "./module-import-diagnostics.ts";
import type { FileAnalysis } from "./types.ts";

function importDiags(src: string, importedAnalyses: Map<string, FileAnalysis> = new Map()) {
	const { analysis } = analyzeWithAst(src, "file:///main.xq");
	return checkModuleImportTargets(analysis, importedAnalyses);
}

describe("module-import-diagnostics: XQST0059 reported", () => {
	test("resolved location hint declares a different target namespace", () => {
		const importedSrc = `module namespace other = "http://example.com/other";`;
		const { analysis: importedAnalysis } = analyzeWithAst(importedSrc, "file:///A.xqm");
		const imports = new Map<string, FileAnalysis>([["./A.xqm", importedAnalysis]]);

		const src = `import module namespace a = "http://example.com/a" at "./A.xqm"; ()`;
		const ds = importDiags(src, imports);
		assert.equal(ds.length, 1);
		assert.equal(ds[0].code, "XQST0059");
		assert.ok(ds[0].message.includes("http://example.com/other"));
		assert.ok(ds[0].message.includes("http://example.com/a"));
	});

	test("resolved location hint has no target namespace at all", () => {
		const importedSrc = `1 + 1`; // main module — no 'module namespace' decl
		const { analysis: importedAnalysis } = analyzeWithAst(importedSrc, "file:///A.xqm");
		const imports = new Map<string, FileAnalysis>([["./A.xqm", importedAnalysis]]);

		const src = `import module namespace a = "http://example.com/a" at "./A.xqm"; ()`;
		const ds = importDiags(src, imports);
		assert.equal(ds.length, 1);
		assert.equal(ds[0].code, "XQST0059");
		assert.ok(ds[0].message.includes("no target namespace"));
	});

	test("no location hint, but a namespace-keyed resolution mismatches (e.g. catalog-based resolution)", () => {
		const importedSrc = `module namespace other = "http://example.com/other";`;
		const { analysis: importedAnalysis } = analyzeWithAst(importedSrc, "file:///A.xqm");
		const imports = new Map<string, FileAnalysis>([["http://example.com/a", importedAnalysis]]);

		const src = `import module namespace a = "http://example.com/a"; ()`;
		const ds = importDiags(src, imports);
		assert.equal(ds.length, 1);
		assert.equal(ds[0].code, "XQST0059");
		assert.ok(ds[0].message.includes("http://example.com/other"));
	});

	test("diagnostic offset/length point at the import prefix", () => {
		const importedSrc = `module namespace other = "http://example.com/other";`;
		const { analysis: importedAnalysis } = analyzeWithAst(importedSrc, "file:///A.xqm");
		const imports = new Map<string, FileAnalysis>([["./A.xqm", importedAnalysis]]);

		const src = `import module namespace a = "http://example.com/a" at "./A.xqm"; ()`;
		const { analysis } = analyzeWithAst(src, "file:///main.xq");
		const ds = checkModuleImportTargets(analysis, imports);
		assert.equal(ds[0].offset, analysis.imports[0].offset);
		assert.equal(ds[0].length, "a".length);
	});
});

describe("module-import-diagnostics: no error", () => {
	test("target namespace matches", () => {
		const importedSrc = `module namespace a = "http://example.com/a";`;
		const { analysis: importedAnalysis } = analyzeWithAst(importedSrc, "file:///A.xqm");
		const imports = new Map<string, FileAnalysis>([["./A.xqm", importedAnalysis]]);

		const src = `import module namespace a = "http://example.com/a" at "./A.xqm"; ()`;
		const ds = importDiags(src, imports);
		assert.equal(ds.length, 0);
	});

	test("import has no location hint", () => {
		const src = `import module namespace a = "http://example.com/a"; ()`;
		const ds = importDiags(src);
		assert.equal(ds.length, 0);
	});

	test("location hint present but unresolved (absent from importedAnalyses)", () => {
		const src = `import module namespace a = "http://example.com/a" at "./missing.xqm"; ()`;
		const ds = importDiags(src);
		assert.equal(ds.length, 0);
	});
});
