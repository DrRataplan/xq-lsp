/**
 * QT4 diagnostic coverage test.
 *
 * Downloads and runs against the W3C QT4 test suite to detect:
 *   - false positives: we report a diagnostic but the query is valid (or only has a dynamic error)
 *   - false negatives: the test expects a static error but we report nothing
 *
 * Requires QT4_TESTS_DIR env var pointing at a local checkout of qt4cg/qt4tests.
 * In CI the checkout is pinned to the SHA in qt4-testset-commit.txt.
 *
 * Run once to generate snapshots:
 *   QT4_TESTS_DIR=/path/to/qt4tests node --test --test-update-snapshots src/qt4-diagnostic.test.ts
 *
 * Normal runs compare against stored snapshots in src/qt4-snaps/.
 */

import { test } from "node:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { Worker } from "node:worker_threads";
import * as slimdom from "slimdom";
import { fileURLToPath } from "node:url";
import type { TestInput, TestOutput } from "./qt4-worker.ts";

const NS = "http://www.w3.org/2010/09/qt-fots-catalog";

// Spec tokens that are compatible with XQuery 3.1 (the version our LSP targets).
const XQ31_COMPAT = new Set([
	"XP20",
	"XP20+",
	"XP30",
	"XP30+",
	"XP31",
	"XP31+",
	"XQ10",
	"XQ10+",
	"XQ30",
	"XQ30+",
	"XQ31",
	"XQ31+",
]);

// Feature dependencies that require infrastructure we don't have.
const SKIP_FEATURES = new Set([
	"staticTyping",
	"schemaImport",
	"schemaValidation",
	"schemaAware",
	"externalFunctions",
	"serialization",
]);

// ── DOM helpers ───────────────────────────────────────────────────────────────

function childEls(parent: slimdom.Element, localName?: string): slimdom.Element[] {
	const out: slimdom.Element[] = [];
	for (const child of parent.children) {
		if (!localName || child.localName === localName) out.push(child as slimdom.Element);
	}
	return out;
}

// ── Dependency filtering ──────────────────────────────────────────────────────

interface Dep {
	type: string;
	value: string;
	satisfied: boolean;
}

function getDeps(el: slimdom.Element): Dep[] {
	return childEls(el, "dependency").map((d) => ({
		type: d.getAttribute("type") ?? "",
		value: d.getAttribute("value") ?? "",
		satisfied: (d.getAttribute("satisfied") ?? "true") !== "false",
	}));
}

function shouldInclude(deps: Dep[]): boolean {
	for (const dep of deps) {
		if (!dep.satisfied) continue; // "satisfied=false" means we must NOT have it; skip checking
		if (dep.type === "spec") {
			const alts = dep.value.trim().split(/\s+/);
			if (!alts.some((s) => XQ31_COMPAT.has(s))) return false;
		}
		if (dep.type === "feature" && SKIP_FEATURES.has(dep.value)) return false;
	}
	return true;
}

// ── Expected outcome extraction ───────────────────────────────────────────────

type Expected = "static-error" | "no-static-error" | "ambiguous";

function isStaticCode(code: string): boolean {
	return code.startsWith("XPST") || code.startsWith("XQST");
}

function getExpected(resultEl: slimdom.Element): { expected: Expected; code: string | null } {
	// Direct <error> child
	const errs = childEls(resultEl, "error");
	if (errs.length > 0) {
		const code = errs[0].getAttribute("code") ?? "";
		if (code === "*") return { expected: "ambiguous", code: null };
		return { expected: isStaticCode(code) ? "static-error" : "no-static-error", code };
	}

	// <any-of> — treat as static-error only if ALL children are static errors
	const anyOf = childEls(resultEl, "any-of")[0];
	if (anyOf) {
		const kids = childEls(anyOf);
		if (kids.every((k) => k.localName === "error")) {
			const codes = kids.map((k) => k.getAttribute("code") ?? "");
			if (codes.some((c) => c === "*")) return { expected: "ambiguous", code: null };
			if (codes.every(isStaticCode)) return { expected: "static-error", code: codes[0] };
		}
		return { expected: "ambiguous", code: null };
	}

	return { expected: "no-static-error", code: null };
}

// ── Worker runner ─────────────────────────────────────────────────────────────

function runInWorker(batch: TestInput[]): Promise<TestOutput[]> {
	return new Promise((resolve, reject) => {
		const w = new Worker(new URL("./qt4-worker.ts", import.meta.url), { workerData: batch });
		w.on("message", resolve);
		w.on("error", reject);
		w.on("exit", (code) => {
			if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
		});
	});
}

// ── Main ──────────────────────────────────────────────────────────────────────

const QT4_DIR = process.env.QT4_TESTS_DIR;
const SNAP_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "qt4-snaps");

if (QT4_DIR) {
	fs.mkdirSync(SNAP_DIR, { recursive: true });

	// Parse catalog
	const catalogXml = fs.readFileSync(path.join(QT4_DIR, "catalog.xml"), "utf8");
	const catalogDoc = slimdom.parseXmlDocument(catalogXml);
	const testSetFiles = Array.from(catalogDoc.getElementsByTagNameNS(NS, "test-set"))
		.map((el) => (el as slimdom.Element).getAttribute("file"))
		.filter((f): f is string => f !== null);

	// Collect all test inputs and track slug order
	const allInputs: TestInput[] = [];
	const slugOrder: string[] = [];
	const seenSlugs = new Set<string>();

	for (const tsFile of testSetFiles) {
		const xmlPath = path.join(QT4_DIR, tsFile);
		let xml: string;
		try {
			xml = fs.readFileSync(xmlPath, "utf8");
		} catch {
			continue;
		}

		let doc: slimdom.Document;
		try {
			doc = slimdom.parseXmlDocument(xml);
		} catch {
			continue;
		}

		const root = doc.documentElement;
		const tsDepsList = getDeps(root);
		const slug = tsFile.replace(/[/\\]/g, "-").replace(/\.xml$/, "");

		for (const tc of childEls(root, "test-case")) {
			const name = tc.getAttribute("name") ?? "";
			const tcDeps = getDeps(tc);

			if (!shouldInclude([...tsDepsList, ...tcDeps])) continue;

			const testEl = childEls(tc, "test")[0];
			const resultEl = childEls(tc, "result")[0];
			if (!testEl || !resultEl) continue;

			const { expected, code: expectedCode } = getExpected(resultEl);
			if (expected === "ambiguous") continue;

			allInputs.push({
				testSetSlug: slug,
				testCase: name,
				query: testEl.textContent ?? "",
				expected,
				expectedCode,
			});

			if (!seenSlugs.has(slug)) {
				seenSlugs.add(slug);
				slugOrder.push(slug);
			}
		}
	}

	// Run analysis in parallel workers
	const N = Math.max(1, os.availableParallelism());
	const chunkSize = Math.ceil(allInputs.length / N);
	const batches: TestInput[][] = [];
	for (let i = 0; i < N; i++) {
		const batch = allInputs.slice(i * chunkSize, (i + 1) * chunkSize);
		if (batch.length > 0) batches.push(batch);
	}

	const allResults: TestOutput[] = (await Promise.all(batches.map(runInWorker))).flat();

	// Group by slug
	const bySlug = new Map<string, TestOutput[]>();
	for (const r of allResults) {
		const arr = bySlug.get(r.testSetSlug);
		if (arr) arr.push(r);
		else bySlug.set(r.testSetSlug, [r]);
	}

	// Register one test per test-set, each with its own snapshot file
	for (const slug of slugOrder) {
		const results = bySlug.get(slug) ?? [];
		const failures = results
			.filter((r) => r.outcome !== "pass")
			.map((r) => ({ testCase: r.testCase, outcome: r.outcome, expectedCode: r.expectedCode, got: r.got }));

		const snapPath = path.join(SNAP_DIR, `${slug}.snap`);

		test(`qt4/${slug}`, async (t) => {
			await t.assert.fileSnapshot(failures, snapPath);
		});
	}
}
