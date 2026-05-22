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

function loadRuntime(name: string) {
	return analyze(fs.readFileSync(path.join(runtimesDir, `${name}.xq`), "utf-8"), `builtin:${name}`);
}

describe("runtime defs: fonto", () => {
	const fonto = loadRuntime("fonto");

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
		const raw = fs.readFileSync(path.join(runtimesDir, "fonto.xq"), "utf-8");
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
