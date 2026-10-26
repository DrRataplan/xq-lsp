import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { withTmpDir } from "./test-utils.ts";

const MAIN_TS = fileURLToPath(new URL("./main.ts", import.meta.url));
const PACKAGE_VERSION = JSON.parse(
	fs.readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf-8"),
).version;

interface CliResult {
	status: number | null;
	stdout: string;
	stderr: string;
}

function runMain(cwd: string, args: string[]): CliResult {
	const proc = spawnSync(process.execPath, [MAIN_TS, ...args], { cwd, encoding: "utf-8", timeout: 60000 });
	return { status: proc.status, stdout: proc.stdout, stderr: proc.stderr };
}

function runLint(cwd: string, args: string[]): CliResult {
	return runMain(cwd, ["lint", ...args]);
}

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
}

describe("cli: xq-lsp lint", () => {
	test("clean file: exit 0, no output", () => {
		withTmpDir((dir) => {
			writeProject(dir);
			const r = runLint(dir, ["src/clean.xq"]);
			assert.equal(r.status, 0, r.stderr);
			assert.equal(r.stdout, "");
		});
	});

	test("file with an error: exit 1, stylish report", () => {
		withTmpDir((dir) => {
			writeProject(dir);
			const r = runLint(dir, ["src/bad.xq"]);
			assert.equal(r.status, 1, r.stderr);
			assert.match(r.stdout, /src[\\/]bad\.xq/);
			assert.match(r.stdout, /1:1\s+error\s+Variable '\$undeclared' is not declared\s+XPST0008/);
			assert.match(r.stdout, /✖ 1 problem \(1 error\)/);
		});
	});

	test("no arguments lints the current directory (eslint behavior)", () => {
		withTmpDir((dir) => {
			writeProject(dir);
			const r = runLint(dir, []);
			assert.equal(r.status, 1, r.stderr);
			assert.match(r.stdout, /bad\.xq/);
			assert.match(r.stdout, /broken\.xq/);
		});
	});

	test("json format prints a parseable results array", () => {
		withTmpDir((dir) => {
			writeProject(dir);
			const r = runLint(dir, ["src/bad.xq", "-f", "json"]);
			assert.equal(r.status, 1, r.stderr);
			const results = JSON.parse(r.stdout);
			assert.equal(results.length, 1);
			assert.equal(results[0].messages[0].code, "XPST0008");
			assert.equal(results[0].messages[0].severity, "error");
			assert.equal(results[0].errorCount, 1);
		});
	});

	test("compact format prints gcc-style lines", () => {
		withTmpDir((dir) => {
			writeProject(dir);
			const r = runLint(dir, ["src/bad.xq", "-f", "compact"]);
			assert.equal(r.status, 1, r.stderr);
			assert.match(r.stdout, /bad\.xq:1:1: error: Variable '\$undeclared' is not declared \[XPST0008\]/);
		});
	});

	test("--quiet reports errors only", () => {
		withTmpDir((dir) => {
			writeProject(dir);
			const r = runLint(dir, ["src/hint.xq", "src/warn.xq", "-q"]);
			assert.equal(r.status, 0, r.stderr);
			assert.equal(r.stdout, "");
			const withError = runLint(dir, ["src/bad.xq", "src/hint.xq", "-q"]);
			assert.equal(withError.status, 1);
			assert.doesNotMatch(withError.stdout, /unused-function/);
		});
	});

	test("--max-warnings fails the build when warnings are exceeded", () => {
		withTmpDir((dir) => {
			writeProject(dir);
			assert.equal(runLint(dir, ["src/warn.xq", "--max-warnings", "0"]).status, 1);
			assert.equal(runLint(dir, ["src/warn.xq", "--max-warnings", "5"]).status, 0);
			assert.equal(runLint(dir, ["src/warn.xq", "--max-warnings=0"]).status, 1);
			assert.equal(runLint(dir, ["src/clean.xq", "--max-warnings", "0"]).status, 0);
		});
	});

	test("glob that matches nothing: exit 2 with an error on stderr", () => {
		withTmpDir((dir) => {
			writeProject(dir);
			const r = runLint(dir, ["src/**/*.nope"]);
			assert.equal(r.status, 2);
			assert.match(r.stderr, /No files matching the pattern/);
		});
	});

	test("unknown option and invalid --max-warnings: exit 2", () => {
		withTmpDir((dir) => {
			writeProject(dir);
			assert.equal(runLint(dir, ["--bogus", "src"]).status, 2);
			assert.match(runLint(dir, ["--bogus", "src"]).stderr, /Unknown option/);
			assert.equal(runLint(dir, ["--max-warnings", "lots", "src"]).status, 2);
			assert.equal(runLint(dir, ["--max-warnings", "-1", "src"]).status, 2);
		});
	});

	test("unknown format: exit 2", () => {
		withTmpDir((dir) => {
			writeProject(dir);
			const r = runLint(dir, ["src/clean.xq", "-f", "xml"]);
			assert.equal(r.status, 2);
			assert.match(r.stderr, /Unknown format/);
		});
	});

	test("--config with a missing file: exit 2", () => {
		withTmpDir((dir) => {
			writeProject(dir);
			const r = runLint(dir, ["src/clean.xq", "--config", "nope.xq"]);
			assert.equal(r.status, 2);
			assert.match(r.stderr, /Cannot read config file/);
		});
	});

	test("--help and --version", () => {
		withTmpDir((dir) => {
			const help = runLint(dir, ["--help"]);
			assert.equal(help.status, 0);
			assert.match(help.stdout, /Usage:/);
			assert.match(help.stdout, /--max-warnings/);

			const version = runMain(dir, ["--version"]);
			assert.equal(version.status, 0);
			assert.equal(version.stdout.trim(), PACKAGE_VERSION);
		});
	});
});
