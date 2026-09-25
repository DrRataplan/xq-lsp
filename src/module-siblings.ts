import type { FileAnalysis } from "./types.ts";

/**
 * The declarations that *other* files contribute to a module namespace. XQuery lets one module be
 * implemented by several module files sharing a target namespace, and some runtimes (e.g. Fonto)
 * merge them, so a file can call a function declared in a sibling without importing it.
 *
 * `merged` is the glob index entry for the namespace, which may include the current file's own
 * on-disk declarations. Those are dropped so they aren't reported as duplicates of the (possibly
 * edited) in-memory versions, nor resolved to stale positions. Returns null when nothing is left.
 */
export function siblingModuleAnalysis(merged: FileAnalysis, currentUri: string): FileAnalysis | null {
	const functions = merged.functions.filter((f) => f.sourceUri !== currentUri);
	const moduleVariables = merged.moduleVariables.filter((v) => v.sourceUri !== currentUri);
	if (functions.length === 0 && moduleVariables.length === 0) return null;
	return { ...merged, functions, moduleVariables };
}
