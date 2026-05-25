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
	"builtins/builtins-xs.xq",
];

const XQ4_BUILTIN_FILES = ["builtins/xq4/fn.xq", "builtins/xq4/array.xq"];

let _builtins31: FileAnalysis | null = null;
let _builtins40: FileAnalysis | null = null;

function loadBuiltins(extraFiles: string[]): FileAnalysis {
	const allFiles = [...BUILTIN_FILES, ...extraFiles];
	const analyses = allFiles.map((f) => {
		const text = readFileSync(join(baseDir, "..", f), "utf-8");
		return analyze(text, `builtin:${f}`);
	});
	return {
		functions: analyses.flatMap((a) => a.functions),
		moduleVariables: [],
		localBindings: [],
		imports: [],
		namespaceDecls: [],
		defaultFunctionNamespace: XMLNS_FN,
		usedAstPath: false,
	};
}

export function getBuiltins(xqueryVersion: "3.1" | "4.0" = "3.1"): FileAnalysis {
	if (xqueryVersion === "4.0") {
		if (!_builtins40) _builtins40 = loadBuiltins(XQ4_BUILTIN_FILES);
		return _builtins40;
	}
	if (!_builtins31) _builtins31 = loadBuiltins([]);
	return _builtins31;
}
