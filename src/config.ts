import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import fontoxpath from "fontoxpath";
const { evaluateXPathToStrings } = fontoxpath;

export interface LspConfig {
	globs: string[];
	/** When false, auto-import code actions omit the `at "path"` location hint. Default: true. */
	generateLocationHints: boolean;
}

function parseConfig(text: string): LspConfig {
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
		const generateLocationHints = hints.length === 0 || hints[0] !== 'false';
		return { globs, generateLocationHints };
	} catch {
		return { globs: [], generateLocationHints: true };
	}
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
			return { config: parseConfig(text), configDir: dir };
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
	return globs.flatMap((pattern) =>
		fs.globSync(pattern, { cwd: baseDir }).map((f) => path.resolve(baseDir, f)),
	);
}
