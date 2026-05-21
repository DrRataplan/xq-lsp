import type { Node } from "xq-parser";
import type { FileAnalysis } from "./types.ts";
import { qnameKey } from "./types.ts";
import { findAll, directChildOf, firstTerminalValue, resolvePrefix } from "./analyzer.ts";
import { asFunctionCall, asVarRef } from "./ast-nodes.ts";

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
		const decl = directChildOf(annotated, "FunctionDecl");
		if (!decl) continue;

		const eqname = directChildOf(decl, "EQName");
		if (!eqname) continue;
		const name = firstTerminalValue(eqname);
		if (!name) continue;

		const colonIdx = name.indexOf(":");
		const localName = colonIdx >= 0 ? name.slice(colonIdx + 1) : name;

		if (localName.startsWith("_")) continue;

		// Find the corresponding FunctionSymbol to get the resolved qname key
		const sym = analysis.functions.find((f) => f.qname.localName === localName);
		if (!sym) continue;
		const key = qnameKey(sym.qname);

		if (usedFunctions.has(key)) continue;

		out.push({
			message: `Function '${name}' is declared but never used`,
			code: "xq-lsp:unused-function",
			offset: eqname.start ?? 0,
			length: firstTerminalValue(eqname)?.length ?? 0,
		});
	}

	// ── Check declared module variables ─────────────────────────────────────

	for (const varDecl of findAll(ast, "VarDecl")) {
		const varNameNode = directChildOf(varDecl, "VarName");
		if (!varNameNode) continue;
		const name = firstTerminalValue(varNameNode);
		if (!name) continue;

		const colonIdx = name.indexOf(":");
		const localName = colonIdx >= 0 ? name.slice(colonIdx + 1) : name;

		if (localName.startsWith("_")) continue;

		const sym = analysis.moduleVariables.find((v) => v.qname.localName === localName);
		if (!sym) continue;
		const key = qnameKey(sym.qname);

		if (usedVariables.has(key)) continue;

		out.push({
			message: `Variable '$${name}' is declared but never used`,
			code: "xq-lsp:unused-variable",
			offset: varNameNode.start ?? 0,
			length: name.length,
		});
	}

	return out;
}
