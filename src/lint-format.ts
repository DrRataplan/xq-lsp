/**
 * Output formatters for the lint CLI — eslint-style: `stylish` (default, human-readable,
 * colored on a TTY), `json` (machine-readable), `compact` (unix/gcc-style, one line
 * per message, for piping into other tools), and `github` (GitHub Actions workflow commands,
 * rendered as inline annotations on pull requests).
 */
import type { LintResult, LintSeverity } from "./lint.ts";

export interface FormatOptions {
	color: boolean;
}

export type Formatter = (results: LintResult[], options: FormatOptions) => string;

function paint(color: boolean, open: string, close: string, text: string): string {
	return color ? `${open}${text}${close}` : text;
}

const SEVERITY_COLOR: Record<LintSeverity, (color: boolean, s: string) => string> = {
	error: (c, s) => paint(c, "\x1b[31m", "\x1b[39m", s), // red
	warning: (c, s) => paint(c, "\x1b[33m", "\x1b[39m", s), // yellow
	hint: (c, s) => paint(c, "\x1b[34m", "\x1b[39m", s), // blue
};

function pluralize(count: number, singular: string, plural: string = `${singular}s`): string {
	return `${count} ${count === 1 ? singular : plural}`;
}

function totals(results: LintResult[]): { errors: number; warnings: number; hints: number; messages: number } {
	let errors = 0;
	let warnings = 0;
	let hints = 0;
	for (const r of results) {
		errors += r.errorCount;
		warnings += r.warningCount;
		hints += r.hintCount;
	}
	return { errors, warnings, hints, messages: errors + warnings + hints };
}

/** eslint's default formatter: per-file blocks of `line:col  severity  message  code`, plus a summary. */
export function formatStylish(results: LintResult[], options: FormatOptions): string {
	const { color } = options;
	const { errors, warnings, hints, messages } = totals(results);
	if (messages === 0) return "";

	const out: string[] = [];
	for (const result of results) {
		if (result.messages.length === 0) continue;
		out.push(paint(color, "\x1b[1m\x1b[4m", "\x1b[24m\x1b[22m", result.filePath));

		const locWidth = Math.max(...result.messages.map((m) => `${m.line}:${m.column}`.length));
		for (const m of result.messages) {
			const loc = `${m.line}:${m.column}`.padStart(locWidth);
			const severity = SEVERITY_COLOR[m.severity](color, m.severity.padEnd(7));
			const code = paint(color, "\x1b[90m", "\x1b[39m", m.code);
			out.push(`  ${loc}  ${severity}  ${m.message}  ${code}`);
		}
		out.push("");
	}

	const parts: string[] = [];
	if (errors > 0) parts.push(pluralize(errors, "error"));
	if (warnings > 0) parts.push(pluralize(warnings, "warning"));
	if (hints > 0) parts.push(pluralize(hints, "hint"));
	const summary = `✖ ${pluralize(messages, "problem")} (${parts.join(", ")})`;
	out.push(SEVERITY_COLOR[errors > 0 ? "error" : "warning"](color, summary));
	return out.join("\n");
}

/** Machine-readable output: the raw results array, pretty-printed. */
export function formatJson(results: LintResult[]): string {
	return JSON.stringify(results, null, 2);
}

/** gcc-style: `path:line:col: severity: message [code]`, one line per message, no summary. */
export function formatCompact(results: LintResult[]): string {
	const lines: string[] = [];
	for (const result of results) {
		for (const m of result.messages) {
			lines.push(`${result.filePath}:${m.line}:${m.column}: ${m.severity}: ${m.message} [${m.code}]`);
		}
	}
	return lines.join("\n");
}

const escapeData = (s: string) => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const escapeProperty = (s: string) => escapeData(s).replace(/:/g, "%3A").replace(/,/g, "%2C");

const ANNOTATION_LEVEL: Record<LintSeverity, string> = { error: "error", warning: "warning", hint: "notice" };

/** GitHub Actions workflow commands: `::warning file=…,line=…,col=…,title=…::message`, one per message. */
export function formatGithub(results: LintResult[]): string {
	const lines: string[] = [];
	for (const result of results) {
		for (const m of result.messages) {
			const props = [
				`file=${escapeProperty(result.filePath)}`,
				`line=${m.line}`,
				`col=${m.column}`,
				`endLine=${m.endLine}`,
				`endColumn=${m.endColumn}`,
				`title=${escapeProperty(m.code)}`,
			].join(",");
			lines.push(`::${ANNOTATION_LEVEL[m.severity]} ${props}::${escapeData(m.message)}`);
		}
	}
	return lines.join("\n");
}

const SUMMARY_ROW_LIMIT = 50;
const escapeCell = (s: string) =>
	s
		.replace(/\r?\n/g, " ")
		.replace(/[\\`*_[\]<>|~]/g, "\\$&");
const escapeCodeCell = (s: string) => s.replace(/\r?\n/g, " ").replace(/\|/g, "\\|");

/**
 * Markdown report for `$GITHUB_STEP_SUMMARY`: totals plus a table of the first findings. Unlike
 * annotations (capped by GitHub at 10 per level per step) it lists everything up to the row limit.
 */
export function formatMarkdownSummary(results: LintResult[]): string {
	const { errors, warnings, hints, messages } = totals(results);
	if (messages === 0) return "### xq-lsp\n\n✅ No problems found.\n";
	const out = [
		"### xq-lsp",
		"",
		`${errors > 0 ? "❌" : "⚠️"} ${pluralize(messages, "problem")}: ${pluralize(errors, "error")}, ${pluralize(warnings, "warning")}, ${pluralize(hints, "hint")}`,
		"",
		"| Severity | Location | Message | Code |",
		"| --- | --- | --- | --- |",
	];
	let rows = 0;
	for (const result of results) {
		for (const m of result.messages) {
			if (rows === SUMMARY_ROW_LIMIT) break;
			rows++;
			out.push(
				`| ${m.severity} | \`${escapeCodeCell(result.filePath)}:${m.line}:${m.column}\` | ${escapeCell(m.message)} | ${escapeCell(m.code)} |`,
			);
		}
	}
	if (messages > rows) out.push("", `… and ${messages - rows} more.`);
	return out.join("\n") + "\n";
}

const FORMATTERS: Record<string, Formatter> = {
	stylish: formatStylish,
	json: formatJson,
	compact: formatCompact,
	github: formatGithub,
};

export function getFormatter(name: string): Formatter | null {
	return FORMATTERS[name] ?? null;
}
