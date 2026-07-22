/**
 * Central registry of all diagnostic checkers.
 *
 * Add every new checker here so qt4-worker, server, and the playground
 * all stay in sync automatically.
 */
import type { Node } from "xq-parser";
import type { TypeDiagnostic, FileAnalysis } from "./types.ts";
import { checkTypes } from "./typechecker.ts";
import { checkFunctionCalls } from "./functioncall-diagnostics.ts";
import { findUndeclaredPrefixUsages } from "./namespace-diagnostics.ts";
import { checkContextItemUsage } from "./context-item-diagnostics.ts";
import { checkUndeclaredVariables } from "./variable-diagnostics.ts";
import { checkDuplicateFunctions } from "./duplicate-function-diagnostics.ts";
import { checkModuleImportTargets } from "./module-import-diagnostics.ts";
import { checkUnused } from "./unused-diagnostics.ts";
import { checkBracedUriWhitespace } from "./braced-uri-diagnostics.ts";

/**
 * Run all error-level diagnostics (XQuery static/dynamic error codes).
 * Safe to use in QT4 test coverage checks.
 *
 * @param imports  Merged map of imported module analyses and built-in function libraries.
 */
export function runDiagnostics(
	ast: Node,
	text: string,
	analysis: FileAnalysis,
	imports: Map<string, FileAnalysis>,
): TypeDiagnostic[] {
	return [
		...checkTypes(ast, text, analysis, imports),
		...checkFunctionCalls(ast, analysis, imports),
		...findUndeclaredPrefixUsages(ast, analysis),
		...checkContextItemUsage(ast),
		...checkUndeclaredVariables(ast, analysis, imports),
		...checkDuplicateFunctions(ast, analysis, imports),
		...checkModuleImportTargets(analysis, imports),
	];
}

/**
 * Run hint-level diagnostics (unused functions/variables).
 * Produces xq-lsp:* codes — kept separate to avoid false-positives in QT4 tests.
 */
export function runHints(ast: Node, analysis: FileAnalysis): TypeDiagnostic[] {
	return [...checkUnused(ast, analysis), ...checkBracedUriWhitespace(ast)];
}
