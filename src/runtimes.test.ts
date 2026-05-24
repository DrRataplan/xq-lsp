import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { analyze } from "./analyzer.ts";
import { getCompletions } from "./completion.ts";
import { formatQName } from "./types.ts";
import { getRuntimeAnalyses } from "./runtimes.ts";

const runtimesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "runtimes");

describe("runtime defs: fonto", () => {
	const fontoPath = path.join(runtimesDir, "fonto", "fonto.xq");
	const fonto = analyze(fs.readFileSync(fontoPath, "utf-8"), "builtin:fonto");

	test("fonto:selection-common-ancestor is present", () => {
		assert.ok(
			fonto.functions.map((f) => formatQName(f.qname)).includes("fonto:selection-common-ancestor"),
			"fonto:selection-common-ancestor not found",
		);
	});

	test("fonto:dita-class has arity 2", () => {
		const fn = fonto.functions.find((f) => formatQName(f.qname) === "fonto:dita-class");
		assert.ok(fn, "fonto:dita-class not found");
		assert.equal(fn.arity, 2);
	});

	test("functions have @see doc links", () => {
		const raw = fs.readFileSync(fontoPath, "utf-8");
		assert.ok(raw.includes("@see https://documentation.fontoxml.com"), "expected @see links");
	});
});

describe("runtime defs: completions", () => {
	function buildImported(libs: string[]) {
		const byNamespace = new Map(
			getRuntimeAnalyses(libs)
				.filter((a) => a.moduleNamespaceUri)
				.map((a) => [a.moduleNamespaceUri!, a]),
		);
		return (analysis: ReturnType<typeof analyze>) => {
			const imported = new Map<string, ReturnType<typeof analyze>>();
			for (const imp of analysis.imports) {
				if (!imp.atPath) {
					const a = byNamespace.get(imp.namespaceUri);
					if (a) imported.set(imp.namespaceUri, a);
				}
			}
			return imported;
		};
	}

	test("fonto functions appear when namespace is imported", () => {
		const src = `import module namespace fonto="http://www.fontoxml.com/functions"; fonto:`;
		const analysis = analyze(src, "file:///main.xq");
		const imported = buildImported(["fonto"])(analysis);
		const labels = getCompletions({ textBeforeCursor: "fonto:", cursorOffset: 6 }, analysis, imported).map(
			(i) => i.label,
		);
		assert.ok(labels.includes("selection-common-ancestor"), `expected fonto functions, got ${labels}`);
	});

	test("fonto functions absent without import", () => {
		const src = `let $x := 1 return $x`;
		const analysis = analyze(src, "file:///main.xq");
		const imported = buildImported(["fonto"])(analysis);
		const labels = getCompletions({ textBeforeCursor: "fonto:", cursorOffset: 6 }, analysis, imported).map(
			(i) => i.label,
		);
		assert.ok(!labels.includes("selection-common-ancestor"), `fonto functions should not appear without import`);
	});
});

describe("runtime defs: existdb smoketest", () => {
	const existdbDir = path.join(runtimesDir, "existdb");
	const xqFiles = fs.readdirSync(existdbDir).filter((f) => f.endsWith(".xq"));

	test("all .xq files parse without throwing", () => {
		const errors: string[] = [];
		for (const file of xqFiles) {
			const src = fs.readFileSync(path.join(existdbDir, file), "utf-8");
			try {
				analyze(src, `builtin:existdb/${file}`);
			} catch (e) {
				errors.push(`${file}: ${e}`);
			}
		}
		assert.deepEqual(errors, [], `parse errors in existdb files`);
	});

	test("all .xq files export at least one function", () => {
		const empty: string[] = [];
		for (const file of xqFiles) {
			const src = fs.readFileSync(path.join(existdbDir, file), "utf-8");
			const analysis = analyze(src, `builtin:existdb/${file}`);
			if (analysis.functions.length === 0) empty.push(file);
		}
		assert.deepEqual(empty, [], `existdb files with no functions`);
	});

	test("request:get-parameter has arity 2 and typed params", () => {
		const src = fs.readFileSync(path.join(existdbDir, "request.xq"), "utf-8");
		const analysis = analyze(src, "builtin:existdb/request.xq");
		const fn = analysis.functions.find(
			(f) => formatQName(f.qname) === "request:get-parameter" && f.arity === 2,
		);
		assert.ok(fn, "request:get-parameter#2 not found");
		assert.equal(fn.params[0].name, "name");
		assert.equal(fn.params[0].type, "xs:string");
	});

	test("sm:create-account has arity 3", () => {
		const src = fs.readFileSync(path.join(existdbDir, "sm.xq"), "utf-8");
		const analysis = analyze(src, "builtin:existdb/sm.xq");
		const fn = analysis.functions.find(
			(f) => formatQName(f.qname) === "sm:create-account" && f.arity === 3,
		);
		assert.ok(fn, "sm:create-account#3 not found");
	});

	test("cache:put has arity 3 with typed params", () => {
		const src = fs.readFileSync(path.join(existdbDir, "cache.xq"), "utf-8");
		const analysis = analyze(src, "builtin:existdb/cache.xq");
		const fn = analysis.functions.find(
			(f) => formatQName(f.qname) === "cache:put" && f.arity === 3,
		);
		assert.ok(fn, "cache:put#3 not found");
		assert.equal(fn.params[0].name, "cache-name");
	});

	test("request functions appear in completions when namespace is imported", () => {
		const src = `import module namespace request="http://exist-db.org/xquery/request"; request:`;
		const analysis = analyze(src, "file:///main.xq");
		const byNamespace = new Map(
			getRuntimeAnalyses(["existdb"])
				.filter((a) => a.moduleNamespaceUri)
				.map((a) => [a.moduleNamespaceUri!, a]),
		);
		const imported = new Map<string, ReturnType<typeof analyze>>();
		for (const imp of analysis.imports) {
			const a = byNamespace.get(imp.namespaceUri);
			if (a) imported.set(imp.namespaceUri, a);
		}
		const labels = getCompletions({ textBeforeCursor: "request:", cursorOffset: 8 }, analysis, imported).map(
			(i) => i.label,
		);
		assert.ok(labels.includes("get-parameter"), `expected request functions, got ${labels.slice(0, 5)}`);
		assert.ok(labels.includes("get-header"), `expected get-header in completions`);
	});
});
