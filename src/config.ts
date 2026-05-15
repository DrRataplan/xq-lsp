import * as fs from "fs";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";

export interface LspConfig {
	globs: string[];
}

function parseGlobs(text: string): string[] {
	// Single string: "glob": "pattern"
	const single = text.match(/"glob"\s*:\s*"([^"]+)"/);
	if (single) return [single[1]];

	// Sequence: "glob": ("pattern1", "pattern2")
	const seq = text.match(/"glob"\s*:\s*\(([^)]+)\)/);
	if (seq) return [...seq[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

	return [];
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

function patternToRegex(pattern: string): RegExp {
	const escaped = pattern
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*/g, "[^/]*");
	return new RegExp(`^${escaped}$`);
}

function expandGlob(pattern: string, baseDir: string): string[] {
	const results: string[] = [];
	const starStar = pattern.indexOf("**/");

	if (starStar === -1) {
		// No recursive wildcard — match files in the specified directory only
		const dirPart = path.join(baseDir, path.dirname(pattern));
		const filePat = path.basename(pattern);
		const re = patternToRegex(filePat);
		try {
			for (const entry of fs.readdirSync(dirPart, { withFileTypes: true })) {
				if (entry.isFile() && re.test(entry.name)) {
					results.push(path.join(dirPart, entry.name));
				}
			}
		} catch {
			/* ignore unreadable directories */
		}
	} else {
		// Recursive: descend from the prefix directory and match the suffix pattern
		const prefix = pattern.slice(0, starStar).replace(/\/$/, "");
		const suffix = pattern.slice(starStar + 3);
		const startDir = prefix ? path.join(baseDir, prefix) : baseDir;
		const re = patternToRegex(suffix);

		function walk(dir: string): void {
			let entries: fs.Dirent[];
			try {
				entries = fs.readdirSync(dir, { withFileTypes: true });
			} catch {
				return;
			}
			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name);
				if (entry.isDirectory()) {
					walk(fullPath);
				} else if (entry.isFile() && re.test(entry.name)) {
					results.push(fullPath);
				}
			}
		}
		walk(startDir);
	}

	return results;
}

export function expandGlobs(globs: string[], baseDir: string): string[] {
	return globs.flatMap((g) => expandGlob(g, baseDir));
}
