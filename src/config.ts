import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import fontoxpath from "fontoxpath";
const { evaluateXPathToStrings, evaluateXPathToMap } = fontoxpath;

export interface LspConfig {
	globs: string[];
	/** When false, auto-import code actions omit the `at "path"` location hint. Default: true. */
	generateLocationHints: boolean;
	lib: string[];
	/** Maps prefix names to namespace URIs, from the `prefixes` key in lsp-config.xq. Default: {}. */
	prefixes: Record<string, string>;
	/**
	 * XQuery language version for parsing and diagnostics.
	 * "3.1" (default) uses the XQuery 3.1 parser.
	 * "4.0" enables the XQuery 4.0 parser and the XQuery 4.0 built-in function library.
	 * Example: map { "xqueryVersion": "4.0" }
	 */
	xqueryVersion: "3.1" | "4.0";
}

function parseConfig(text: string): { globs: string[]; generateLocationHints: boolean } {
	// Evaluate the config as an XPath 3.1 expression.
	// The config file should contain a map expression, e.g.:
	//   map { "glob": "src/**/*.xq" }
	// or with options:
	//   map { "glob": "src/**/*.xq", "import": map { "generateLocationHints": false() } }
	const trimmed = text.trim();
	try {
		const globs = evaluateXPathToStrings(`(${trimmed})?glob`, null, null, {});
		// Check for opt-out: import?generateLocationHints defaults to true when absent.
		const hints = evaluateXPathToStrings(`string((${trimmed})?import?generateLocationHints)`, null, null, {});
		const generateLocationHints = hints.length === 0 || hints[0] !== "false";
		return { globs, generateLocationHints };
	} catch {
		return { globs: [], generateLocationHints: true };
	}
}

function parseLib(text: string): string[] {
	// Evaluate the config and look up the "lib" key.
	// Can be a single string or a sequence:
	//   map { "lib": "fonto" }
	//   map { "lib": ("fonto", "basex") }
	try {
		return evaluateXPathToStrings(`(${text.trim()})?lib`, null, null, {});
	} catch {
		return [];
	}
}

function parsePrefixes(text: string): Record<string, string> {
	// Evaluate the config and look up the "prefixes" key, which should be a map
	// from prefix names to namespace URIs:
	//   map { "prefixes": map { "tei": "http://www.tei-c.org/ns/1.0" } }
	try {
		const map = evaluateXPathToMap(`(${text.trim()})?prefixes`, null, null, {});
		// evaluateXPathToMap returns a plain JS object with string values
		const result: Record<string, string> = {};
		for (const [k, v] of Object.entries(map)) {
			if (typeof v === "string") result[k] = v;
		}
		return result;
	} catch {
		return {};
	}
}

function parseXQueryVersion(text: string): "3.1" | "4.0" {
	try {
		const versions = evaluateXPathToStrings(`(${text.trim()})?xqueryVersion`, null, null, {});
		if (versions[0] === "4.0") return "4.0";
	} catch {
		// ignore
	}
	return "3.1";
}

export function findConfig(fromUri: string): { config: LspConfig; configDir: string } | null {
	let dir: string;
	try {
		dir = path.dirname(fileURLToPath(fromUri));
	} catch {
		return null;
	}

	for (let i = 0; i < 20; i++) {
		const configPath = path.join(dir, "lsp-config.xq");
		try {
			const text = fs.readFileSync(configPath, "utf-8");
			const parsed = parseConfig(text);
			return {
				config: {
					...parsed,
					lib: parseLib(text),
					prefixes: parsePrefixes(text),
					xqueryVersion: parseXQueryVersion(text),
				},
				configDir: dir,
			};
		} catch {
			/* not found here, try parent */
		}
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}

	return null;
}

export function expandGlobs(globs: string[], baseDir: string): string[] {
	return globs.flatMap((pattern) => fs.globSync(pattern, { cwd: baseDir }).map((f) => path.resolve(baseDir, f)));
}
