/**
 * Lint core: expands file arguments (files / directories / globs), runs the same
 * diagnostic pipeline as the LSP server over each file, and returns eslint-shaped
 * results. No printing, no process access beyond cwd — cli.ts wraps this.
 */
import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import { TextDocument } from "vscode-languageserver-textdocument";
import { DiagnosticSeverity } from "vscode-languageserver/node.js";
import { createWorkspace, type Workspace } from "./workspace.ts";

/** CLI severity levels. Hints (unused symbols, style) never affect the exit code. */
export type LintSeverity = "error" | "warning" | "hint";

export interface LintMessage {
	line: number; // 1-based
	column: number; // 1-based
	endLine: number;
	endColumn: number;
	severity: LintSeverity;
	message: string;
	code: string;
}

export interface LintResult {
	/** Display path — relative to the working directory when possible. */
	filePath: string;
	messages: LintMessage[];
	errorCount: number;
	warningCount: number;
	hintCount: number;
}

export interface LintOptions {
	/** Pin a specific `lsp-config.xq` instead of walking up from each file. */
	configPath?: string;
	/** Report errors only (eslint `--quiet`). */
	quiet?: boolean;
	/** Working directory for glob expansion and display paths. Default: `process.cwd()`. */
	cwd?: string;
}

export interface LintOutcome {
	results: LintResult[];
	/** Fatal problem (no files matched, unreadable file) — the CLI maps this to exit code 2. */
	fatal?: string;
}

const XQUERY_EXTENSIONS = [".xq", ".xqm", ".xql", ".xquery"];
const GLOB_MAGIC = /[*?[\]{}]/;

function displayPath(cwd: string, file: string): string {
	const rel = path.relative(cwd, file);
	return rel === "" || rel.startsWith("..") ? file : rel;
}

/**
 * Expands lint targets to an absolute, de-duplicated, sorted file list. A target is a
 * glob (used as-is), a directory (searched recursively for XQuery extensions), or a
 * single file (linted as-is, whatever its extension). A target matching nothing is fatal.
 */
export function expandLintTargets(targets: string[], cwd: string): { files: string[]; fatal?: string } {
	const files = new Set<string>();
	for (const target of targets) {
		if (GLOB_MAGIC.test(target)) {
			const matches = fs.globSync(target, { cwd }).map((f) => path.resolve(cwd, f));
			if (matches.length === 0) {
				return { files: [], fatal: `No files matching the pattern "${target}" were found.` };
			}
			for (const match of matches) files.add(match);
			continue;
		}
		const abs = path.resolve(cwd, target);
		let stat: fs.Stats;
		try {
			stat = fs.statSync(abs);
		} catch {
			return { files: [], fatal: `No files matching the pattern "${target}" were found.` };
		}
		if (stat.isDirectory()) {
			for (const ext of XQUERY_EXTENSIONS) {
				for (const f of fs.globSync(`**/*${ext}`, { cwd: abs })) files.add(path.resolve(abs, f));
			}
		} else {
			files.add(abs);
		}
	}
	return { files: [...files].sort() };
}

function toLintSeverity(severity: DiagnosticSeverity | undefined): LintSeverity {
	switch (severity) {
		case DiagnosticSeverity.Warning:
			return "warning";
		case DiagnosticSeverity.Information:
		case DiagnosticSeverity.Hint:
			return "hint";
		default:
			return "error";
	}
}

/** Lints one file's text through the shared workspace pipeline. */
export function lintText(
	ws: Workspace,
	filePath: string,
	text: string,
	opts: { quiet?: boolean; displayPath?: string },
): LintResult {
	const uri = pathToFileURL(filePath).toString();
	const doc = TextDocument.create(uri, "xquery", 0, text);
	const messages: LintMessage[] = [];
	for (const d of ws.computeDiagnostics(doc)) {
		const severity = toLintSeverity(d.severity);
		if (opts.quiet && severity !== "error") continue;
		messages.push({
			line: d.range.start.line + 1,
			column: d.range.start.character + 1,
			endLine: d.range.end.line + 1,
			endColumn: d.range.end.character + 1,
			severity,
			message: d.message,
			code: String(d.code),
		});
	}
	messages.sort((a, b) => a.line - b.line || a.column - b.column);
	return {
		filePath: opts.displayPath ?? filePath,
		messages,
		errorCount: messages.filter((m) => m.severity === "error").length,
		warningCount: messages.filter((m) => m.severity === "warning").length,
		hintCount: messages.filter((m) => m.severity === "hint").length,
	};
}

/** Lints a set of file/directory/glob targets. */
export function lintTargets(targets: string[], options: LintOptions = {}): LintOutcome {
	const cwd = options.cwd ?? process.cwd();
	const expanded = expandLintTargets(targets, cwd);
	if (expanded.fatal) return { results: [], fatal: expanded.fatal };

	const ws = createWorkspace({ configPath: options.configPath });
	const results: LintResult[] = [];
	for (const file of expanded.files) {
		let text: string;
		try {
			text = fs.readFileSync(file, "utf-8");
		} catch (e) {
			return { results, fatal: `Cannot read file "${displayPath(cwd, file)}": ${(e as Error).message}` };
		}
		results.push(lintText(ws, file, text, { quiet: options.quiet, displayPath: displayPath(cwd, file) }));
	}
	return { results };
}

/** eslint exit-code semantics: 1 when errors were reported, or warnings exceeded `maxWarnings`. */
export function computeExitCode(results: LintResult[], maxWarnings?: number): number {
	const errors = results.reduce((n, r) => n + r.errorCount, 0);
	const warnings = results.reduce((n, r) => n + r.warningCount, 0);
	if (errors > 0) return 1;
	if (maxWarnings !== undefined && warnings > maxWarnings) return 1;
	return 0;
}
