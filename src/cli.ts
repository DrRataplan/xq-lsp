/**
 * The `xq-lsp lint` subcommand: parses arguments, runs the linter over the given
 * files/directories/globs, prints the report, and returns the process exit code.
 *
 * Exit codes mirror eslint: 0 = clean, 1 = lint errors (or too many warnings),
 * 2 = fatal (bad arguments, no files matched, unreadable file/config).
 */
import * as fs from "fs";
import * as path from "path";
import { computeExitCode, lintTargets } from "./lint.ts";
import { getFormatter } from "./lint-format.ts";
import { loadConfigAt } from "./config.ts";

const USAGE = `xq-lsp lint — lint XQuery files from the command line

Usage:
  xq-lsp lint [options] [file | directory | glob]...

Arguments:
  Files, directories, or glob patterns to lint. With no arguments, the current
  directory is linted. Directories are searched recursively for .xq, .xqm,
  .xql, and .xquery files.

Options:
  -c, --config <path>     Use this lsp-config.xq instead of walking up from each file
  -f, --format <name>     Output format: stylish (default), json, compact
  -q, --quiet             Report errors only
      --max-warnings <n>  Exit with code 1 when more than n warnings are reported
      --no-color          Disable colored output
  -h, --help              Show this help
  -v, --version           Show the xq-lsp version

Configuration:
  Like the language server, the linter walks up from each file to find the
  nearest lsp-config.xq (glob index, runtime libs, strict mode, prefixes).

Exit codes:
  0  No errors (and warnings within --max-warnings)
  1  Lint errors found, or warnings exceeded --max-warnings
  2  Fatal error (bad arguments, no files matched, unreadable file or config)
`;

interface ParsedArgs {
	targets: string[];
	config?: string;
	format: string;
	quiet: boolean;
	maxWarnings?: number;
	help: boolean;
	version: boolean;
	color: boolean;
	error?: string;
}

function parseArgs(args: string[], colorDefault: boolean): ParsedArgs {
	const out: ParsedArgs = {
		targets: [],
		format: "stylish",
		quiet: false,
		help: false,
		version: false,
		color: colorDefault,
	};
	for (let i = 0; i < args.length; i++) {
		let arg = args[i];
		// Support --flag=value for long options.
		let inlineValue: string | undefined;
		if (arg.startsWith("--")) {
			const eq = arg.indexOf("=");
			if (eq !== -1) {
				inlineValue = arg.slice(eq + 1);
				arg = arg.slice(0, eq);
			}
		}
		const takeValue = (): string | undefined => {
			if (inlineValue !== undefined) return inlineValue;
			return args[++i];
		};
		switch (arg) {
			case "-c":
			case "--config":
				out.config = takeValue();
				if (out.config === undefined) out.error = `Missing value for ${arg}`;
				break;
			case "-f":
			case "--format":
				out.format = takeValue() ?? "";
				if (out.format === "") out.error = `Missing value for ${arg}`;
				break;
			case "-q":
			case "--quiet":
				out.quiet = true;
				break;
			case "--max-warnings": {
				const raw = takeValue();
				const n = raw === undefined ? NaN : Number(raw);
				if (!Number.isInteger(n) || n < 0) {
					out.error = `Invalid value for --max-warnings: "${raw ?? ""}" (expected a non-negative integer)`;
				} else {
					out.maxWarnings = n;
				}
				break;
			}
			case "--no-color":
				out.color = false;
				break;
			case "--color":
				out.color = true;
				break;
			case "-h":
			case "--help":
				out.help = true;
				break;
			case "-v":
			case "--version":
				out.version = true;
				break;
			default:
				if (arg.startsWith("-") && arg.length > 1) {
					out.error = `Unknown option "${arg}"`;
				} else {
					out.targets.push(arg);
				}
		}
		if (out.error) break;
	}
	return out;
}

function readVersion(): string {
	try {
		const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf-8"));
		return typeof pkg.version === "string" ? pkg.version : "unknown";
	} catch {
		return "unknown";
	}
}

/**
 * Runs the lint subcommand. Returns the exit code; never throws — fatal problems
 * are reported on stderr and mapped to exit code 2.
 */
export async function runCli(args: string[]): Promise<number> {
	const colorDefault = process.stdout.isTTY === true && !process.env.NO_COLOR;
	const parsed = parseArgs(args, colorDefault);

	if (parsed.error) {
		console.error(`xq-lsp lint: error: ${parsed.error}`);
		console.error("Run 'xq-lsp lint --help' for usage.");
		return 2;
	}
	if (parsed.help) {
		process.stdout.write(USAGE);
		return 0;
	}
	if (parsed.version) {
		console.log(readVersion());
		return 0;
	}

	const formatter = getFormatter(parsed.format);
	if (!formatter) {
		console.error(`xq-lsp lint: error: Unknown format "${parsed.format}" (expected stylish, json, or compact)`);
		return 2;
	}

	// eslint lints the current directory when no targets are given.
	const targets = parsed.targets.length > 0 ? parsed.targets : ["."];

	if (parsed.config !== undefined) {
		const configPath = path.resolve(parsed.config);
		if (!loadConfigAt(configPath)) {
			console.error(`xq-lsp lint: error: Cannot read config file "${parsed.config}"`);
			return 2;
		}
	}

	const outcome = lintTargets(targets, { configPath: parsed.config, quiet: parsed.quiet });
	if (outcome.fatal) {
		console.error(`xq-lsp lint: error: ${outcome.fatal}`);
		return 2;
	}

	const report = formatter(outcome.results, { color: parsed.color });
	if (report.length > 0) console.log(report);

	return computeExitCode(outcome.results, parsed.maxWarnings);
}
