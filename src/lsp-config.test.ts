import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { analyze } from "./analyzer.ts";
import { getCompletions } from "./completion.ts";
import { findConfig, expandGlobs } from "./config.ts";
import { withTmpDir } from "./test-utils.ts";

// ── findConfig ────────────────────────────────────────────────────────────────

describe("findConfig", () => {
	test("finds config in the same directory", () => {
		withTmpDir((dir) => {
			fs.writeFileSync(path.join(dir, "lsp-config.xq"), `map { "glob": "**/*.xq" }`);
			const result = findConfig(pathToFileURL(path.join(dir, "main.xq")).toString());
			assert.ok(result, "expected config to be found");
			assert.deepEqual(result.config.globs, ["**/*.xq"]);
			assert.equal(result.configDir, dir);
		});
	});

	test("finds config in a parent directory", () => {
		withTmpDir((dir) => {
			const sub = path.join(dir, "src");
			fs.mkdirSync(sub);
			fs.writeFileSync(path.join(dir, "lsp-config.xq"), `map { "glob": "src/**/*.xq" }`);
			const result = findConfig(pathToFileURL(path.join(sub, "main.xq")).toString());
			assert.ok(result, "expected config in parent");
			assert.deepEqual(result.config.globs, ["src/**/*.xq"]);
		});
	});

	test("returns null when no config exists", () => {
		withTmpDir((dir) => {
			assert.equal(findConfig(pathToFileURL(path.join(dir, "main.xq")).toString()), null);
		});
	});

	test("parses multiple globs as a sequence", () => {
		withTmpDir((dir) => {
			fs.writeFileSync(
				path.join(dir, "lsp-config.xq"),
				`map { "glob": ("src/**/*.xq", "lib/**/*.xq") }`,
			);
			const result = findConfig(pathToFileURL(path.join(dir, "main.xq")).toString());
			assert.ok(result);
			assert.deepEqual(result.config.globs, ["src/**/*.xq", "lib/**/*.xq"]);
		});
	});

	test("generateLocationHints defaults to true", () => {
		withTmpDir((dir) => {
			fs.writeFileSync(path.join(dir, "lsp-config.xq"), `map { "glob": "**/*.xq" }`);
			const result = findConfig(pathToFileURL(path.join(dir, "main.xq")).toString());
			assert.ok(result);
			assert.equal(result.config.generateLocationHints, true);
		});
	});

	test("generateLocationHints can be set to false", () => {
		withTmpDir((dir) => {
			fs.writeFileSync(
				path.join(dir, "lsp-config.xq"),
				`map { "glob": "**/*.xq", "import": map { "generateLocationHints": false() } }`,
			);
			const result = findConfig(pathToFileURL(path.join(dir, "main.xq")).toString());
			assert.ok(result);
			assert.equal(result.config.generateLocationHints, false);
		});
	});

	test("parses single lib string", () => {
		withTmpDir((dir) => {
			fs.writeFileSync(path.join(dir, "lsp-config.xq"), `map { "lib": "basex" }`);
			const result = findConfig(pathToFileURL(path.join(dir, "main.xq")).toString());
			assert.ok(result);
			assert.deepEqual(result.config.lib, ["basex"]);
		});
	});

	test("parses multiple lib values as a sequence", () => {
		withTmpDir((dir) => {
			fs.writeFileSync(path.join(dir, "lsp-config.xq"), `map { "lib": ("basex", "saxonhe") }`);
			const result = findConfig(pathToFileURL(path.join(dir, "main.xq")).toString());
			assert.ok(result);
			assert.deepEqual(result.config.lib, ["basex", "saxonhe"]);
		});
	});

	test("lib defaults to empty when key absent", () => {
		withTmpDir((dir) => {
			fs.writeFileSync(path.join(dir, "lsp-config.xq"), `map { "glob": "**/*.xq" }`);
			const result = findConfig(pathToFileURL(path.join(dir, "main.xq")).toString());
			assert.ok(result);
			assert.deepEqual(result.config.lib, []);
		});
	});

	test("parses prefixes map", () => {
		withTmpDir((dir) => {
			fs.writeFileSync(
				path.join(dir, "lsp-config.xq"),
				`map { "prefixes": map { "tei": "http://www.tei-c.org/ns/1.0", "dc": "http://purl.org/dc/elements/1.1/" } }`,
			);
			const result = findConfig(pathToFileURL(path.join(dir, "main.xq")).toString());
			assert.ok(result);
			assert.deepEqual(result.config.prefixes, {
				tei: "http://www.tei-c.org/ns/1.0",
				dc: "http://purl.org/dc/elements/1.1/",
			});
		});
	});

	test("prefixes defaults to {} when key absent", () => {
		withTmpDir((dir) => {
			fs.writeFileSync(path.join(dir, "lsp-config.xq"), `map { "glob": "**/*.xq" }`);
			const result = findConfig(pathToFileURL(path.join(dir, "main.xq")).toString());
			assert.ok(result);
			assert.deepEqual(result.config.prefixes, {});
		});
	});
});

// ── expandGlobs ───────────────────────────────────────────────────────────────

describe("expandGlobs", () => {
	test("**/*.xq finds .xq files recursively", () => {
		withTmpDir((dir) => {
			const sub = path.join(dir, "lib");
			fs.mkdirSync(sub);
			fs.writeFileSync(path.join(dir, "a.xq"), "");
			fs.writeFileSync(path.join(sub, "b.xq"), "");
			fs.writeFileSync(path.join(sub, "c.txt"), "");
			const names = expandGlobs(["**/*.xq"], dir)
				.map((f) => path.basename(f))
				.sort();
			assert.deepEqual(names, ["a.xq", "b.xq"]);
		});
	});

	test("non-recursive pattern matches only the specified dir", () => {
		withTmpDir((dir) => {
			const sub = path.join(dir, "lib");
			fs.mkdirSync(sub);
			fs.writeFileSync(path.join(dir, "a.xq"), "");
			fs.writeFileSync(path.join(sub, "b.xq"), "");
			const names = expandGlobs(["*.xq"], dir).map((f) => path.basename(f));
			assert.deepEqual(names, ["a.xq"]);
		});
	});
});

// ── namespace-only imports via glob ───────────────────────────────────────────

test("glob-loaded module resolves namespace-only import in completions", () => {
	withTmpDir((dir) => {
		const libSrc = `module namespace util="http://example.com/util";
declare function util:trim($s as xs:string) as xs:string { $s };`;
		fs.writeFileSync(path.join(dir, "util.xq"), libSrc);

		const mainSrc = `import module namespace util="http://example.com/util";
util:trim("x")`;
		const mainAnalysis = analyze(mainSrc, pathToFileURL(path.join(dir, "main.xq")).toString());

		const libAnalysis = analyze(libSrc, pathToFileURL(path.join(dir, "util.xq")).toString());
		const globAnalyses = new Map([[libAnalysis.moduleNamespaceUri!, libAnalysis]]);

		const imported = new Map<string, ReturnType<typeof analyze>>();
		for (const imp of mainAnalysis.imports) {
			if (!imp.atPath) {
				const a = globAnalyses.get(imp.namespaceUri);
				if (a) imported.set(imp.namespaceUri, a);
			}
		}

		const labels = getCompletions({ textBeforeCursor: "util:", cursorOffset: 5 }, mainAnalysis, imported).map(
			(i) => i.label,
		);
		assert.ok(labels.includes("trim"), `expected trim via namespace-only import, got ${labels}`);
	});
});

test("two module files sharing the same namespace URI have their functions unioned", () => {
	withTmpDir((dir) => {
		const ns = "http://example.com/util";

		const srcA = `module namespace util="${ns}";
declare function util:trim($s as xs:string) as xs:string { $s };`;
		const srcB = `module namespace util="${ns}";
declare function util:pad($s as xs:string, $n as xs:integer) as xs:string { $s };`;
		fs.writeFileSync(path.join(dir, "util-a.xq"), srcA);
		fs.writeFileSync(path.join(dir, "util-b.xq"), srcB);

		const mainSrc = `import module namespace util="${ns}"; 1`;
		const mainAnalysis = analyze(mainSrc, pathToFileURL(path.join(dir, "main.xq")).toString());

		// Simulate what getGlobAnalyses does after the fix: merge both files into one entry
		const aAnalysis = analyze(srcA, pathToFileURL(path.join(dir, "util-a.xq")).toString());
		const bAnalysis = analyze(srcB, pathToFileURL(path.join(dir, "util-b.xq")).toString());
		const merged = { ...aAnalysis, functions: [...aAnalysis.functions, ...bAnalysis.functions] };
		const imported = new Map([[ns, merged]]);

		const labels = getCompletions({ textBeforeCursor: "util:", cursorOffset: 5 }, mainAnalysis, imported).map(
			(i) => i.label,
		);
		assert.ok(labels.includes("trim"), `expected trim, got ${labels}`);
		assert.ok(labels.includes("pad"), `expected pad, got ${labels}`);
	});
});
