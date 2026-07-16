import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { analyze } from "./analyzer.ts";
import type { FileAnalysis } from "./types.ts";

export { getRuntimePredeclaredNamespaces, withPredeclaredNs } from "./predeclared-namespaces.ts";

const runtimesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "runtimes");

const RUNTIME_FILES: Record<string, string[]> = {
	fonto: [path.join(runtimesDir, "fonto", "fonto.xq")],
	existdb: [
		path.join(runtimesDir, "existdb", "cache.xq"),
		path.join(runtimesDir, "existdb", "compression.xq"),
		path.join(runtimesDir, "existdb", "console.xq"),
		path.join(runtimesDir, "existdb", "contentextraction.xq"),
		path.join(runtimesDir, "existdb", "counter.xq"),
		path.join(runtimesDir, "existdb", "crypto.xq"),
		path.join(runtimesDir, "existdb", "datetime.xq"),
		path.join(runtimesDir, "existdb", "exist.xq"),
		path.join(runtimesDir, "existdb", "file.xq"),
		path.join(runtimesDir, "existdb", "ft.xq"),
		path.join(runtimesDir, "existdb", "httpclient.xq"),
		path.join(runtimesDir, "existdb", "image.xq"),
		path.join(runtimesDir, "existdb", "inspect.xq"),
		path.join(runtimesDir, "existdb", "kwic.xq"),
		path.join(runtimesDir, "existdb", "mail.xq"),
		path.join(runtimesDir, "existdb", "ngram.xq"),
		path.join(runtimesDir, "existdb", "process.xq"),
		path.join(runtimesDir, "existdb", "range.xq"),
		path.join(runtimesDir, "existdb", "repo.xq"),
		path.join(runtimesDir, "existdb", "request.xq"),
		path.join(runtimesDir, "existdb", "response.xq"),
		path.join(runtimesDir, "existdb", "scheduler.xq"),
		path.join(runtimesDir, "existdb", "session.xq"),
		path.join(runtimesDir, "existdb", "sm.xq"),
		path.join(runtimesDir, "existdb", "sort.xq"),
		path.join(runtimesDir, "existdb", "system.xq"),
		path.join(runtimesDir, "existdb", "transform.xq"),
		path.join(runtimesDir, "existdb", "util.xq"),
		path.join(runtimesDir, "existdb", "validation.xq"),
		path.join(runtimesDir, "existdb", "xmldb.xq"),
		path.join(runtimesDir, "existdb", "xmldiff.xq"),
	],
};

const runtimeAnalysisCache = new Map<string, FileAnalysis>();

export function getRuntimeAnalyses(runtimes: string[]): FileAnalysis[] {
	const results: FileAnalysis[] = [];
	for (const runtime of runtimes) {
		const filePaths = RUNTIME_FILES[runtime];
		if (!filePaths) continue;
		for (const filePath of filePaths) {
			const cacheKey = filePath;
			const cached = runtimeAnalysisCache.get(cacheKey);
			if (cached) {
				results.push(cached);
				continue;
			}
			try {
				const text = fs.readFileSync(filePath, "utf-8");
				const analysis = analyze(text, `builtin:${runtime}`);
				runtimeAnalysisCache.set(cacheKey, analysis);
				results.push(analysis);
			} catch {
				// ignore missing or unreadable runtime files
			}
		}
	}
	return results;
}
