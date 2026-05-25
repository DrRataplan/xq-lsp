/**
 * QT4 diagnostic coverage test.
 *
 * Downloads and runs against the W3C QT4 test suite to detect:
 *   - false positives: we report a diagnostic but the query is valid (or only has a dynamic error)
 *   - false negatives: the test expects a static error but we report nothing
 *
 * Requires QT4_TESTS_DIR env var pointing at a local checkout of qt4cg/qt4tests.
 *
 * XQuery 3.1 mode (default):
 *   QT4_TESTS_DIR=qt4tests node --test src/qt4-diagnostic.test.ts
 *   Snapshots: src/qt4-snaps/
 *
 * XQuery 4.0 mode (includes XQ40+ tests, uses XQuery4Full parser):
 *   QT4_TESTS_DIR=qt4tests XQ4_TESTS_MODE=1 node --test src/qt4-diagnostic.test.ts
 *   Snapshots: src/qt4-snaps-xq4/
 *
 * Regenerate snapshots:
 *   QT4_TESTS_DIR=qt4tests node --test --test-update-snapshots src/qt4-diagnostic.test.ts
 *   QT4_TESTS_DIR=qt4tests XQ4_TESTS_MODE=1 node --test --test-update-snapshots src/qt4-diagnostic.test.ts
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

// XQ4_TESTS_MODE=1 enables the XQuery 4.0 parser and includes XQ40+ test cases.
const XQ4_MODE = !!process.env.XQ4_TESTS_MODE;
const XQUERY_VERSION: "3.1" | "4.0" = XQ4_MODE ? "4.0" : "3.1";

// Spec tokens compatible with XQuery 3.1.
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

// Additional spec tokens compatible with XQuery 4.0 (superset of XQ31_COMPAT).
const XQ40_COMPAT = new Set([...XQ31_COMPAT, "XQ40", "XQ40+", "XP40", "XP40+"]);

const SPEC_COMPAT = XQ4_MODE ? XQ40_COMPAT : XQ31_COMPAT;

// Feature dependencies that require infrastructure we don't have.
const SKIP_FEATURES = new Set([
	"staticTyping",
	"schemaImport",
	"schemaValidation",
	"schemaAware",
	"externalFunctions",
	"serialization",
	"namespace-axis", // xq-parser doesn't parse the deprecated `namespace::` axis
]);

// ── DOM helpers ───────────────────────────────────────────────────────────────

function childEls(parent: slimdom.Element, localName?: string): slimdom.Element[] {
	const out: slimdom.Element[] = [];
	for (const child of parent.children) {
		if (!localName || child.localName === localName) out.push(child as slimdom.Element);
	}
	return out;
}

// ── Environment namespace/variable extraction ────────────────────────────────

type NsBinding = { prefix: string; uri: string };
type VarBinding = { prefix: string; localName: string };
type EnvMap = Map<string, NsBinding[]>;
type EnvVarMap = Map<string, VarBinding[]>;

function extractEnvNamespaces(envEl: slimdom.Element): NsBinding[] {
	return childEls(envEl, "namespace")
		.map((n) => ({ prefix: n.getAttribute("prefix") ?? "", uri: n.getAttribute("uri") ?? "" }))
		.filter((ns) => ns.prefix !== "");
}

// <param name="..."> and <source role="$..."> bind variables that are in scope
// for the test's query without being declared in the query text itself — the
// harness equivalent of `declare variable $x external;`. `role="."` sets the
// context item, not a variable, so it's excluded.
function splitVarName(raw: string): VarBinding {
	const idx = raw.indexOf(":");
	return idx === -1 ? { prefix: "", localName: raw } : { prefix: raw.slice(0, idx), localName: raw.slice(idx + 1) };
}

function extractEnvVariables(envEl: slimdom.Element): VarBinding[] {
	const fromParams = childEls(envEl, "param")
		.map((n) => n.getAttribute("name"))
		.filter((n): n is string => !!n)
		.map(splitVarName);
	const fromSources = childEls(envEl, "source")
		.map((n) => n.getAttribute("role"))
		.filter((r): r is string => !!r && r !== "." && r.startsWith("$"))
		.map((r) => splitVarName(r.slice(1)));
	return [...fromParams, ...fromSources];
}

function buildEnvMap(root: slimdom.Element): EnvMap {
	const map: EnvMap = new Map();
	for (const envEl of childEls(root, "environment")) {
		const name = envEl.getAttribute("name");
		if (name) map.set(name, extractEnvNamespaces(envEl));
	}
	return map;
}

function buildEnvVarMap(root: slimdom.Element): EnvVarMap {
	const map: EnvVarMap = new Map();
	for (const envEl of childEls(root, "environment")) {
		const name = envEl.getAttribute("name");
		if (name) map.set(name, extractEnvVariables(envEl));
	}
	return map;
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
			if (!alts.some((s) => SPEC_COMPAT.has(s))) return false;
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

// A query whose only top-level expression is a call to fn:error()/error() with
// literal arguments (string literals, `()`, or `QName(literal, literal)`) names
// its error code as arbitrary caller data, not a static property of the query.
// The QT4 suite uses this to test that a runtime propagates dynamically raised
// errors — it's a dynamic-evaluation test, not a static-analysis test, so a
// static analyzer can never satisfy it and it shouldn't count as a gap.
const STRING_LITERAL_RE = /^(?:'[^']*'|"[^"]*")$/;

function splitTopLevelArgs(s: string): string[] {
	const args: string[] = [];
	let depth = 0;
	let quote: string | null = null;
	let current = "";
	for (const ch of s) {
		if (quote) {
			current += ch;
			if (ch === quote) quote = null;
			continue;
		}
		if (ch === "'" || ch === '"') {
			quote = ch;
			current += ch;
			continue;
		}
		if (ch === "(") depth++;
		if (ch === ")") depth--;
		if (ch === "," && depth === 0) {
			args.push(current);
			current = "";
			continue;
		}
		current += ch;
	}
	if (current.trim() !== "" || args.length > 0) args.push(current);
	return args.map((a) => a.trim());
}

function isLiteralErrorArg(arg: string): boolean {
	if (arg === "()") return true;
	if (STRING_LITERAL_RE.test(arg)) return true;
	const qnameMatch = arg.match(/^(?:fn:)?QName\(([\s\S]*)\)$/);
	if (!qnameMatch) return false;
	const qnameArgs = splitTopLevelArgs(qnameMatch[1]);
	return qnameArgs.length === 2 && qnameArgs.every((a) => STRING_LITERAL_RE.test(a));
}

function isLiteralErrorOnlyQuery(query: string): boolean {
	const match = query.trim().match(/^(?:fn:)?error\(([\s\S]*)\)$/);
	if (!match) return false;
	const args = splitTopLevelArgs(match[1]);
	// fn:error's signatures take at most 3 args (code, description, error-object);
	// more than that is a genuine static arity error, not a dynamic-code test.
	return args.length > 0 && args.length <= 3 && args.every(isLiteralErrorArg);
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
const SNAP_DIR = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	XQ4_MODE ? "qt4-snaps-xq4" : "qt4-snaps",
);

if (QT4_DIR) {
	fs.mkdirSync(SNAP_DIR, { recursive: true });

	// Parse catalog
	const catalogXml = fs.readFileSync(path.join(QT4_DIR, "catalog.xml"), "utf8");
	const catalogDoc = slimdom.parseXmlDocument(catalogXml);
	const catalogEnvMap = buildEnvMap(catalogDoc.documentElement as slimdom.Element);
	const catalogEnvVarMap = buildEnvVarMap(catalogDoc.documentElement as slimdom.Element);
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
		const tsEnvMap = buildEnvMap(root);
		const tsEnvVarMap = buildEnvVarMap(root);

		for (const tc of childEls(root, "test-case")) {
			const name = tc.getAttribute("name") ?? "";
			const tcDeps = getDeps(tc);

			if (!shouldInclude([...tsDepsList, ...tcDeps])) continue;

			const testEl = childEls(tc, "test")[0];
			const resultEl = childEls(tc, "result")[0];
			if (!testEl || !resultEl) continue;

			let { expected, code: expectedCode } = getExpected(resultEl);
			if (expected === "ambiguous") continue;

			// The query is either inline text or, via <test file="...">, a path
			// relative to the test-set XML's own directory.
			const testFileAttr = testEl.getAttribute("file");
			let query: string;
			if (testFileAttr) {
				try {
					query = fs.readFileSync(path.join(path.dirname(xmlPath), testFileAttr), "utf8");
				} catch {
					continue;
				}
			} else {
				query = testEl.textContent ?? "";
			}

			if (expected === "static-error" && isLiteralErrorOnlyQuery(query)) {
				expected = "no-static-error";
				expectedCode = null;
			}

			const tcEnvEl = childEls(tc, "environment")[0];
			let envNamespaces: NsBinding[] = [];
			let envVariables: VarBinding[] = [];
			if (tcEnvEl) {
				const ref = tcEnvEl.getAttribute("ref");
				if (ref) {
					envNamespaces = tsEnvMap.get(ref) ?? catalogEnvMap.get(ref) ?? [];
					envVariables = tsEnvVarMap.get(ref) ?? catalogEnvVarMap.get(ref) ?? [];
				} else {
					envNamespaces = extractEnvNamespaces(tcEnvEl);
					envVariables = extractEnvVariables(tcEnvEl);
				}
			}

			// <module uri="..." file="..."/> is the catalog's own namespace-to-file
			// association — the harness equivalent of a resolved "at" location hint,
			// used to detect XQST0059 (target namespace mismatch) on bare imports.
			const moduleCatalog: Array<{ uri: string; text: string }> = [];
			for (const modEl of childEls(tc, "module")) {
				const uri = modEl.getAttribute("uri");
				const file = modEl.getAttribute("file");
				if (!uri || !file) continue;
				try {
					moduleCatalog.push({ uri, text: fs.readFileSync(path.join(path.dirname(xmlPath), file), "utf8") });
				} catch {
					/* referenced module file unreadable, skip */
				}
			}

			allInputs.push({
				testSetSlug: slug,
				testCase: name,
				query,
				expected,
				expectedCode,
				envNamespaces,
				envVariables,
				moduleCatalog,
				xqueryVersion: XQUERY_VERSION,
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
