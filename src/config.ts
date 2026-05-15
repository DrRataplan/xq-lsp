import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import fontoxpath from "fontoxpath";
const { evaluateXPathToStrings } = fontoxpath;

export interface LspConfig {
	globs: string[];
}

function parseGlobs(text: string): string[] {
	// Evaluate the config as an XPath 3.1 expression and look up the "glob" key.
	// The config file should contain a map expression, e.g.:
	//   map { "glob": "src/**/*.xq" }
	// or with multiple patterns:
	//   map { "glob": ("src/**/*.xq", "lib/**/*.xq") }
	try {
		return evaluateXPathToStrings(`(${text.trim()})?glob`, null, null, {});
	} catch {
		return [];
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
			return { config: { globs: parseGlobs(text) }, configDir: dir };
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
