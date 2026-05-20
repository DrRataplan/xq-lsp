import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { analyze } from "./analyzer.ts";
import type { FileAnalysis } from "./types.ts";

const runtimesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "runtimes");

const RUNTIME_FILES: Record<string, string> = {
	fonto: path.join(runtimesDir, "fonto.xq"),
};

const runtimeAnalysisCache = new Map<string, FileAnalysis>();

export function getRuntimeAnalyses(runtimes: string[]): FileAnalysis[] {
	const results: FileAnalysis[] = [];
	for (const runtime of runtimes) {
		const cached = runtimeAnalysisCache.get(runtime);
		if (cached) {
			results.push(cached);
			continue;
		}
		const filePath = RUNTIME_FILES[runtime];
		if (!filePath) continue;
		try {
			const text = fs.readFileSync(filePath, "utf-8");
			const analysis = analyze(text, `builtin:${runtime}`);
			runtimeAnalysisCache.set(runtime, analysis);
			results.push(analysis);
		} catch {
			// ignore missing or unreadable runtime files
		}
	}
	return results;
}
