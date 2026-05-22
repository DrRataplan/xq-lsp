import type { Node } from "xq-parser";
import type { FileAnalysis } from "./types.ts";
import { qnameKey, formatQName } from "./types.ts";
import { findAll, directChildOf, firstTerminalValue, resolvePrefix } from "./analyzer.ts";
import { asFunctionCall, asVarRef, asVarDecl, asFunctionDeclaration } from "./ast-nodes.ts";

export interface UnusedDiagnostic {
	message: string;
	code: "xq-lsp:unused-function" | "xq-lsp:unused-variable";
	offset: number;
	length: number;
}


/**
 * Walk the AST and report declared functions and module-level variables that
 * are never referenced within the file.
 *
 * For functions, only `%private` declarations are reported — functions without
 * an explicit visibility annotation (or marked `%public`) may be called by
 * external modules that import this one.
 * Names starting with `_` are skipped by convention (intentionally unused).
 * Only works when a valid AST is available.
 */
export function checkUnused(ast: Node, analysis: FileAnalysis): UnusedDiagnostic[] {
	const out: UnusedDiagnostic[] = [];

	// ── Collect used function keys ───────────────────────────────────────────

	const usedFunctions = new Set<string>();

	for (const node of findAll(ast, "FunctionCall")) {
		const shape = asFunctionCall(node, analysis);
		if (shape) usedFunctions.add(qnameKey(shape.qname));
	}

	for (const node of findAll(ast, "NamedFunctionRef")) {
		const eqname = directChildOf(node, "EQName");
		if (!eqname) continue;
		const name = firstTerminalValue(eqname);
		if (!name) continue;
		const colonIdx = name.indexOf(":");
		const prefix = colonIdx >= 0 ? name.slice(0, colonIdx) : "";
		const localName = colonIdx >= 0 ? name.slice(colonIdx + 1) : name;
		const namespaceUri = resolvePrefix(prefix, analysis);
		usedFunctions.add(qnameKey({ prefix, localName, namespaceUri }));
	}

	// ── Collect used variable keys ───────────────────────────────────────────

	const usedVariables = new Set<string>();

	for (const node of findAll(ast, "VarRef")) {
		const qname = asVarRef(node, analysis);
		if (qname) usedVariables.add(qnameKey(qname));
	}

	// ── Check declared functions ─────────────────────────────────────────────

	for (const annotated of findAll(ast, "AnnotatedDecl")) {
		const fn = asFunctionDeclaration(annotated, analysis);
		if (!fn) continue;

		// Only %private functions are local to the module; public ones may be
		// called by other modules that import this one.
		if (!fn.annotations.includes("private")) continue;

		if (fn.qname.localName.startsWith("_")) continue;

		// Find the corresponding FunctionSymbol to get the resolved qname key
		const sym = analysis.functions.find((f) => f.qname.localName === fn.qname.localName);
		if (!sym) continue;

		if (usedFunctions.has(qnameKey(sym.qname))) continue;

		const fnName = formatQName(fn.qname);
		out.push({
			message: `Function '${fnName}' is declared but never used`,
			code: "xq-lsp:unused-function",
			offset: fn.nameNode.start ?? 0,
			length: fnName.length,
		});
	}

	// ── Check declared module variables ─────────────────────────────────────

	for (const varDecl of findAll(ast, "VarDecl")) {
		const decl = asVarDecl(varDecl, analysis);
		if (!decl) continue;
		const { qname, nameNode } = decl;

		if (qname.localName.startsWith("_")) continue;
		if (usedVariables.has(qnameKey(qname))) continue;

		const varName = formatQName(qname);
		out.push({
			message: `Variable '$${varName}' is declared but never used`,
			code: "xq-lsp:unused-variable",
			offset: nameNode.start ?? 0,
			length: varName.length,
		});
	}

	return out;
}
