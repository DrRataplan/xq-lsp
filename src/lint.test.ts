import { describe, test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { computeExitCode, expandLintTargets, lintTargets } from "./lint.ts";
import { withTmpDir } from "./test-utils.ts";

function writeFile(dir: string, rel: string, content: string): void {
	const file = path.join(dir, rel);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, content);
}

function writeProject(dir: string): void {
	writeFile(dir, "lsp-config.xq", `map { "glob": "src/**/*.xq" }\n`);
	writeFile(
		dir,
		"src/clean.xq",
		`declare function local:ok($x as xs:integer) as xs:integer { $x + 1 };\nlocal:ok(41)\n`,
	);
	writeFile(dir, "src/bad.xq", `$undeclared + 1\n`);
	writeFile(dir, "src/broken.xq", `declare function {\n`);
	writeFile(dir, "src/hint.xq", `declare %private function local:helper() { 42 };\n1\n`);
	writeFile(dir, "src/warn.xq", `import module namespace foo = "http://example.com/foo";\n1\n`);
	writeFile(
		dir,
		"src/lib.xq",
		`module namespace m = "http://example.com/m";\ndeclare function m:f() as xs:integer { 1 };\n`,
	);
	writeFile(dir, "src/uses-lib.xq", `import module namespace m = "http://example.com/m";\nm:f()\n`);
}

describe("lint: expandLintTargets", () => {
	test("directory expands recursively to XQuery files", () => {
		withTmpDir((dir) => {
			writeProject(dir);
			writeFile(dir, "src/notes.txt", "not xquery");
			const { files, fatal } = expandLintTargets(["src"], dir);
			assert.equal(fatal, undefined);
			assert.equal(files.length, 7);
			assert.ok(files.every((f) => /\.(xq|xqm|xql|xquery)$/.test(f)));
			assert.ok(files.every((f) => path.isAbsolute(f)));
		});
	});

	test("glob patterns are expanded relative to cwd", () => {
		withTmpDir((dir) => {
			writeProject(dir);
			const { files, fatal } = expandLintTargets(["src/b*.xq"], dir);
			assert.equal(fatal, undefined);
			assert.deepEqual(
				files.map((f) => path.basename(f)),
				["bad.xq", "broken.xq"],
			);
		});
	});

	test("a literal file is linted whatever its extension, and duplicates are removed", () => {
		withTmpDir((dir) => {
			writeProject(dir);
			writeFile(dir, "src/odd.txt", "1");
			const { files } = expandLintTargets(["src/bad.xq", "src/bad.xq", "src/odd.txt"], dir);
			assert.deepEqual(files.map((f) => path.basename(f)).sort(), ["bad.xq", "odd.txt"]);
		});
	});

	test("a pattern or file matching nothing is fatal", () => {
		withTmpDir((dir) => {
			writeProject(dir);
			assert.match(expandLintTargets(["src/**/*.nope"], dir).fatal!, /No files matching/);
			assert.match(expandLintTargets(["missing.xq"], dir).fatal!, /No files matching/);
		});
	});
});

describe("lint: lintTargets", () => {
	test("undeclared variable is an error with 1-based position", () => {
		withTmpDir((dir) => {
			writeProject(dir);
			const { results, fatal } = lintTargets(["src/bad.xq"], { cwd: dir });
			assert.equal(fatal, undefined);
			assert.equal(results.length, 1);
			const [result] = results;
			assert.equal(result.filePath, path.join("src", "bad.xq"));
			assert.equal(result.errorCount, 1);
			assert.equal(result.messages.length, 1);
			const [message] = result.messages;
			assert.equal(message.severity, "error");
			assert.equal(message.code, "XPST0008");
			assert.equal(message.line, 1);
			assert.equal(message.column, 1);
		});
	});

	test("syntax error is a parse error", () => {
		withTmpDir((dir) => {
			writeProject(dir);
			const { results } = lintTargets(["src/broken.xq"], { cwd: dir });
			assert.equal(results[0].errorCount, 1);
			assert.equal(results[0].messages[0].code, "XPST0003");
		});
	});

	test("unresolved import is a warning, not an error", () => {
		withTmpDir((dir) => {
			writeProject(dir);
			const { results } = lintTargets(["src/warn.xq"], { cwd: dir });
			const warning = results[0].messages.find((m) => m.code === "xq-lsp:unresolved-import");
			assert.ok(warning, `expected unresolved-import warning, got ${JSON.stringify(results[0].messages)}`);
			assert.equal(warning.severity, "warning");
			assert.equal(results[0].errorCount, 0);
			assert.equal(results[0].warningCount, 1);
		});
	});

	test("unused private function is a hint", () => {
		withTmpDir((dir) => {
			writeProject(dir);
			const { results } = lintTargets(["src/hint.xq"], { cwd: dir });
			const hint = results[0].messages.find((m) => m.code === "xq-lsp:unused-function");
			assert.ok(hint, `expected unused-function hint, got ${JSON.stringify(results[0].messages)}`);
			assert.equal(hint.severity, "hint");
			assert.equal(results[0].hintCount, 1);
		});
	});

	test("clean file produces no messages", () => {
		withTmpDir((dir) => {
			writeProject(dir);
			const { results } = lintTargets(["src/clean.xq"], { cwd: dir });
			assert.deepEqual(results[0].messages, []);
		});
	});

	test("quiet reports errors only", () => {
		withTmpDir((dir) => {
			writeProject(dir);
			const { results } = lintTargets(["src/warn.xq", "src/hint.xq"], { cwd: dir, quiet: true });
			assert.ok(results.every((r) => r.messages.length === 0));
			const withErrors = lintTargets(["src/bad.xq", "src/hint.xq"], { cwd: dir, quiet: true });
			assert.equal(withErrors.results[0].messages.length, 1);
			assert.equal(withErrors.results[0].messages[0].severity, "error");
		});
	});

	test("config discovery: import resolves through the glob index", () => {
		withTmpDir((dir) => {
			writeProject(dir);
			const { results } = lintTargets(["src/uses-lib.xq"], { cwd: dir });
			assert.equal(results[0].errorCount, 0);
			assert.ok(
				!results[0].messages.some((m) => m.code === "xq-lsp:unresolved-import"),
				`expected the import to resolve, got ${JSON.stringify(results[0].messages)}`,
			);
		});
	});

	test("without a config the same import is an unresolved-import warning", () => {
		withTmpDir((dir) => {
			writeFile(
				dir,
				"lib.xq",
				`module namespace m = "http://example.com/m";\ndeclare function m:f() as xs:integer { 1 };\n`,
			);
			writeFile(dir, "uses-lib.xq", `import module namespace m = "http://example.com/m";\nm:f()\n`);
			const { results } = lintTargets(["uses-lib.xq"], { cwd: dir });
			assert.ok(results[0].messages.some((m) => m.code === "xq-lsp:unresolved-import"));
		});
	});

	test("configPath pins a config for files outside its tree", () => {
		withTmpDir((projectDir) => {
			writeProject(projectDir);
			withTmpDir((outsideDir) => {
				writeFile(outsideDir, "uses-lib.xq", `import module namespace m = "http://example.com/m";\nm:f()\n`);
				const configPath = path.join(projectDir, "lsp-config.xq");
				const without = lintTargets(["uses-lib.xq"], { cwd: outsideDir });
				assert.ok(without.results[0].messages.some((m) => m.code === "xq-lsp:unresolved-import"));
				const pinned = lintTargets(["uses-lib.xq"], { cwd: outsideDir, configPath });
				assert.equal(pinned.results[0].errorCount, 0);
				assert.ok(!pinned.results[0].messages.some((m) => m.code === "xq-lsp:unresolved-import"));
			});
		});
	});

	test("display paths are relative to cwd", () => {
		withTmpDir((dir) => {
			writeProject(dir);
			const { results } = lintTargets([path.join(dir, "src", "bad.xq")], { cwd: dir });
			assert.equal(results[0].filePath, path.join("src", "bad.xq"));
		});
	});
});

describe("lint: computeExitCode", () => {
	const result = (errorCount: number, warningCount = 0, hintCount = 0) => [
		{ filePath: "f.xq", messages: [], errorCount, warningCount, hintCount },
	];

	test("clean is 0; hints never fail the build", () => {
		assert.equal(computeExitCode([]), 0);
		assert.equal(computeExitCode(result(0, 0, 3)), 0);
	});

	test("warnings alone are 0, unless --max-warnings is exceeded", () => {
		assert.equal(computeExitCode(result(0, 2)), 0);
		assert.equal(computeExitCode(result(0, 2), 2), 0);
		assert.equal(computeExitCode(result(0, 2), 1), 1);
		assert.equal(computeExitCode(result(0, 2), 0), 1);
	});

	test("errors are always 1", () => {
		assert.equal(computeExitCode(result(1)), 1);
		assert.equal(computeExitCode(result(1), 100), 1);
	});
});
