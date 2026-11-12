import { describe, test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { DiagnosticSeverity } from "vscode-languageserver/node.js";
import { createWorkspace, uriToPath } from "./workspace.ts";
import { analyze } from "./analyzer.ts";
import { makeDoc, withTmpDir } from "./test-utils.ts";

function writeFile(dir: string, rel: string, content: string): void {
	const file = path.join(dir, rel);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, content);
}

function fileUri(dir: string, rel: string): string {
	return pathToFileURL(path.join(dir, rel)).toString();
}

/** A minimal two-file project: src/main.xq imports src/lib.xq via an `at` path. */
function setupProject(dir: string, config = `map { "glob": "src/**/*.xq" }`): void {
	writeFile(dir, "lsp-config.xq", `${config}\n`);
	writeFile(
		dir,
		"src/lib.xq",
		`module namespace m = "http://example.com/m";\ndeclare function m:f() as xs:integer { 1 };\n`,
	);
	writeFile(dir, "src/main.xq", `import module namespace m = "http://example.com/m" at "./lib.xq";\nm:f()\n`);
}

describe("workspace: uriToPath", () => {
	test("file URLs become paths; other URIs fall back to stripping file://", () => {
		assert.equal(uriToPath(pathToFileURL("/tmp/x.xq").toString()), "/tmp/x.xq");
		assert.equal(uriToPath("untitled:Untitled-1"), "untitled:Untitled-1");
	});
});

describe("workspace: analyzeDocument / analyzeDocumentFull", () => {
	test("analyzeDocument caches the analysis and the last valid AST-path analysis", () => {
		const ws = createWorkspace();
		const doc = makeDoc(`1 + 1`, "file:///good.xq");
		const analysis = ws.analyzeDocument(doc);
		assert.ok(analysis.usedAstPath);
		assert.equal(ws.analysisCache.get("file:///good.xq"), analysis);
		assert.equal(ws.lastValidAnalysisCache.get("file:///good.xq"), analysis);
	});

	test("analyzeDocumentFull reports parse errors and skips the last-valid cache on the regex path", () => {
		const ws = createWorkspace();
		const full = ws.analyzeDocumentFull(makeDoc(`declare function {`, "file:///broken.xq"));
		assert.equal(full.hasAst, false);
		assert.equal(full.parseDiagnostics.length, 1);
		assert.equal(full.parseDiagnostics[0].code, "XPST0003");
		assert.equal(ws.lastValidAnalysisCache.has("file:///broken.xq"), false);

		const good = ws.analyzeDocumentFull(makeDoc(`1 + 1`, "file:///good.xq"));
		assert.equal(good.hasAst, true);
		assert.deepEqual(good.parseDiagnostics, []);
	});
});

describe("workspace: loadAnalysisForUri", () => {
	test("loads text and analysis from disk, returns null for missing files", () => {
		withTmpDir((dir) => {
			writeFile(dir, "a.xq", `1 + 1\n`);
			const ws = createWorkspace();
			const loaded = ws.loadAnalysisForUri(fileUri(dir, "a.xq"));
			assert.equal(loaded?.text, "1 + 1\n");
			assert.ok(loaded?.analysis.usedAstPath);
			assert.equal(ws.loadAnalysisForUri(fileUri(dir, "missing.xq")), null);
		});
	});

	test("prefers the open document and caches its analysis", () => {
		withTmpDir((dir) => {
			writeFile(dir, "open.xq", `2 + 2\n`);
			const uri = fileUri(dir, "open.xq");
			const openDoc = makeDoc(`3 + 3`, uri);
			const ws = createWorkspace({ getOpenDocument: (u) => (u === uri ? openDoc : undefined) });
			const loaded = ws.loadAnalysisForUri(uri);
			assert.equal(loaded?.text, "3 + 3");
			assert.ok(ws.analysisCache.has(uri));
		});
	});
});

describe("workspace: getGlobFileAccess", () => {
	test("without a config there are no other files and loadAst returns null", () => {
		withTmpDir((dir) => {
			writeFile(dir, "plain.xq", `1\n`);
			const ws = createWorkspace();
			const access = ws.getGlobFileAccess(fileUri(dir, "plain.xq"));
			assert.deepEqual(access.getOtherFiles(), []);
			assert.equal(access.loadAst(fileUri(dir, "plain.xq"), "1"), null);
		});
	});

	test("with a config: summaries are ast-free, loadAst parses and then reuses the cache", () => {
		withTmpDir((dir) => {
			setupProject(dir);
			const ws = createWorkspace();
			const mainUri = fileUri(dir, "src/main.xq");
			const access = ws.getGlobFileAccess(mainUri);

			const others = access.getOtherFiles();
			assert.equal(others.length, 2);
			assert.ok(others.every((r) => r.analysis.ast === undefined));

			// Cache miss: parses the given text.
			const parsed = access.loadAst(fileUri(dir, "src/lib.xq"), `module namespace m = "http://example.com/m";\n`);
			assert.ok(parsed?.ast);
			assert.equal(parsed?.moduleNamespaceUri, "http://example.com/m");

			// Cache hit: the AST from computeDiagnostics is reused.
			ws.computeDiagnostics(makeDoc(`m:f()`, mainUri));
			const cached = access.loadAst(mainUri, "ignored");
			assert.ok(cached.ast);
		});
	});
});

describe("workspace: getGlobAnalyses", () => {
	test("indexes modules by namespace, merging files that share one", () => {
		withTmpDir((dir) => {
			setupProject(dir);
			writeFile(
				dir,
				"src/lib2.xq",
				`module namespace m = "http://example.com/m";\ndeclare function m:g() as xs:integer { 2 };\n`,
			);
			const ws = createWorkspace();
			const { byNamespace, lib } = ws.getGlobAnalyses(fileUri(dir, "src/main.xq"));
			const merged = byNamespace.get("http://example.com/m");
			assert.ok(merged);
			assert.deepEqual(merged!.functions.map((f) => f.qname.localName).sort(), ["f", "g"]);
			assert.deepEqual(lib, []);
		});
	});

	test("caches the index per config dir and reports the configured lib", () => {
		withTmpDir((dir) => {
			setupProject(dir, `map { "glob": "src/**/*.xq", "lib": "existdb" }`);
			const ws = createWorkspace();
			const uri = fileUri(dir, "src/main.xq");
			const first = ws.getGlobAnalyses(uri);
			assert.deepEqual(first.lib, ["existdb"]);
			const second = ws.getGlobAnalyses(uri);
			assert.equal(second.byNamespace, first.byNamespace);
		});
	});

	test("unreadable glob files are skipped", () => {
		withTmpDir((dir) => {
			setupProject(dir);
			const locked = path.join(dir, "src", "locked.xq");
			writeFile(dir, "src/locked.xq", `1\n`);
			fs.chmodSync(locked, 0o000);
			try {
				const ws = createWorkspace();
				const access = ws.getGlobFileAccess(fileUri(dir, "src/main.xq"));
				assert.equal(access.getOtherFiles().length, 2);
				assert.ok(ws.getGlobAnalyses(fileUri(dir, "src/main.xq")).byNamespace.has("http://example.com/m"));
			} finally {
				fs.chmodSync(locked, 0o644);
			}
		});
	});
});

describe("workspace: resolveContext", () => {
	test("resolves an at-path import from disk and caches it; builtin:fn is always present", () => {
		withTmpDir((dir) => {
			setupProject(dir);
			const ws = createWorkspace();
			const mainUri = fileUri(dir, "src/main.xq");
			const raw = analyze(`import module namespace m = "http://example.com/m" at "./lib.xq";\nm:f()\n`, mainUri);
			const { imported } = ws.resolveContext(mainUri, raw);
			const libAnalysis = imported.get("http://example.com/m");
			assert.ok(libAnalysis);
			assert.equal(imported.get("./lib.xq"), libAnalysis);
			assert.ok(imported.has("builtin:fn"));
			assert.ok(ws.analysisCache.has(fileUri(dir, "src/lib.xq")));
			// Second resolution hits the import cache.
			ws.resolveContext(mainUri, raw);
		});
	});

	test("an at-path import whose file is missing falls back to the glob index", () => {
		withTmpDir((dir) => {
			setupProject(dir);
			const ws = createWorkspace();
			const mainUri = fileUri(dir, "src/main.xq");
			const raw = analyze(`import module namespace m = "http://example.com/m" at "./missing.xq";\nm:f()\n`, mainUri);
			const { imported } = ws.resolveContext(mainUri, raw);
			assert.ok(imported.get("http://example.com/m"));
		});
	});

	test("resolves a namespace-only import through the glob index", () => {
		withTmpDir((dir) => {
			setupProject(dir);
			const ws = createWorkspace();
			const mainUri = fileUri(dir, "src/main.xq");
			const raw = analyze(`import module namespace m = "http://example.com/m";\nm:f()\n`, mainUri);
			const { imported } = ws.resolveContext(mainUri, raw);
			assert.ok(imported.get("http://example.com/m"));
		});
	});

	test("sibling files sharing the module namespace are in scope without an import", () => {
		withTmpDir((dir) => {
			setupProject(dir);
			writeFile(
				dir,
				"src/lib2.xq",
				`module namespace m = "http://example.com/m";\ndeclare function m:g() as xs:integer { 2 };\n`,
			);
			const ws = createWorkspace();
			const libUri = fileUri(dir, "src/lib.xq");
			const raw = analyze(
				`module namespace m = "http://example.com/m";\ndeclare function m:f() as xs:integer { 1 };\n`,
				libUri,
			);
			const { imported } = ws.resolveContext(libUri, raw);
			const siblings = imported.get("http://example.com/m");
			assert.ok(siblings);
			assert.deepEqual(
				siblings!.functions.map((f) => f.qname.localName),
				["g"],
			);
		});
	});

	test("with lib existdb, predeclared namespaces are in scope without an import", () => {
		withTmpDir((dir) => {
			writeFile(dir, "lsp-config.xq", `map { "glob": "src/**/*.xq", "lib": "existdb" }\n`);
			writeFile(dir, "src/app.xq", `util:uuid()\n`);
			const ws = createWorkspace();
			const uri = fileUri(dir, "src/app.xq");
			const { analysis, imported } = ws.resolveContext(uri, analyze(`util:uuid()\n`, uri));
			assert.ok(imported.has("http://exist-db.org/xquery/util"));
			assert.ok(analysis.namespaceDecls.some((nd) => nd.prefix === "util" && nd.offset === -1));
			// ... so computeDiagnostics does not flag util: as an undeclared prefix.
			const diags = ws.computeDiagnostics(makeDoc(`util:uuid()`, uri));
			assert.ok(!diags.some((d) => d.code === "XQST0081"), JSON.stringify(diags));
		});
	});
});

describe("workspace: computeDiagnostics", () => {
	test("undeclared prefix is an XQST0081 error carrying code-action data", () => {
		withTmpDir((dir) => {
			setupProject(dir);
			const ws = createWorkspace();
			const diags = ws.computeDiagnostics(makeDoc(`foo:bar()`, fileUri(dir, "src/prefix.xq")));
			const ns = diags.find((d) => d.code === "XQST0081");
			assert.ok(ns, JSON.stringify(diags));
			assert.equal(ns.severity, DiagnosticSeverity.Error);
			assert.deepEqual(ns.data, { prefix: "foo", usageKind: "function" });
		});
	});

	test("strict cardinality from the config surfaces as a warning", () => {
		withTmpDir((dir) => {
			writeFile(dir, "lsp-config.xq", `map { "glob": "src/**/*.xq", "strict": map { "cardinality": true() } }\n`);
			const text = `declare function local:one($x as item()) as item() { $x };\ndeclare function local:many() as item()* { (1, 2) };\nlocal:one(local:many())\n`;
			writeFile(dir, "src/strict.xq", text);
			const ws = createWorkspace();
			const diags = ws.computeDiagnostics(makeDoc(text, fileUri(dir, "src/strict.xq")));
			const warning = diags.find((d) => d.code === "XPTY0004");
			assert.ok(warning, JSON.stringify(diags));
			assert.equal(warning.severity, DiagnosticSeverity.Warning);
		});
	});

	test("parse errors, unresolved imports, and hints come back with their severities", () => {
		withTmpDir((dir) => {
			setupProject(dir);
			writeFile(
				dir,
				"src/mixed.xq",
				`import module namespace foo = "http://example.com/foo";\ndeclare %private function local:h() { 1 };\n$undeclared\n`,
			);
			const ws = createWorkspace();
			const diags = ws.computeDiagnostics(
				makeDoc(fs.readFileSync(path.join(dir, "src/mixed.xq"), "utf-8"), fileUri(dir, "src/mixed.xq")),
			);
			assert.ok(diags.some((d) => d.code === "XPST0008" && d.severity === DiagnosticSeverity.Error));
			assert.ok(
				diags.some((d) => d.code === "xq-lsp:unresolved-import" && d.severity === DiagnosticSeverity.Warning),
			);
			assert.ok(diags.some((d) => d.code === "xq-lsp:unused-function" && d.severity === DiagnosticSeverity.Hint));

			const broken = ws.computeDiagnostics(makeDoc(`declare function {`, fileUri(dir, "src/broken.xq")));
			assert.ok(broken.some((d) => d.code === "XPST0003" && d.severity === DiagnosticSeverity.Error));
		});
	});
});
