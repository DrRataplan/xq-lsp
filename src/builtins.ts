import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";
import { analyze, XMLNS_FN } from "./analyzer.ts";
import type { FileAnalysis } from "./types.ts";

const baseDir = dirname(fileURLToPath(import.meta.url));

const BUILTIN_FILES = [
	"builtins/builtins-fn.xq",
	"builtins/builtins-math.xq",
	"builtins/builtins-map.xq",
	"builtins/builtins-array.xq",
];

let _builtins: FileAnalysis | null = null;

export function getBuiltins(): FileAnalysis {
	if (!_builtins) {
		const analyses = BUILTIN_FILES.map((f) => {
			const text = readFileSync(join(baseDir, "..", f), "utf-8");
			return analyze(text, `builtin:${f}`);
		});
		_builtins = {
			functions: analyses.flatMap((a) => a.functions),
			moduleVariables: [],
			localBindings: [],
			imports: [],
			defaultFunctionNamespace: XMLNS_FN,
			usedAstPath: false,
		};
	}
	return _builtins;
}
