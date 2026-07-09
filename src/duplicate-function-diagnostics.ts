import type { Node } from "xq-parser";
import type { TypeDiagnostic, FileAnalysis } from "./types.ts";
import { qnameKey, formatQName } from "./types.ts";
import { findAll } from "./analyzer.ts";
import { asFunctionDeclaration } from "./ast-nodes.ts";

export interface DuplicateFunctionDiagnostic extends TypeDiagnostic {
	code: "XQST0034";
}

/**
 * Walk the AST and report every function declaration whose expanded QName and
 * arity (parameter count) collide with another declaration — either another
 * declaration in this file, or one already provided by an imported module.
 * Per XQST0034, return type, parameter types, and parameter names are
 * irrelevant to the clash: only the expanded QName and arity matter.
 *
 * All declarations that share a colliding key are reported (not just the
 * later ones), since the file only stops erroring once every collision is
 * resolved.
 */
export function checkDuplicateFunctions(
	ast: Node,
	analysis: FileAnalysis,
	importedAnalyses: Map<string, FileAnalysis>,
): DuplicateFunctionDiagnostic[] {
	const importedKeys = new Set<string>();
	for (const imported of importedAnalyses.values())
		for (const f of imported.functions) importedKeys.add(`${qnameKey(f.qname)}#${f.arity}`);

	const groups = new Map<string, Array<{ nameNode: Node; displayName: string; arity: number }>>();
	for (const annotated of findAll(ast, "AnnotatedDecl")) {
		const fn = asFunctionDeclaration(annotated, analysis);
		if (!fn) continue;
		const key = `${qnameKey(fn.qname)}#${fn.arity}`;
		const entry = { nameNode: fn.nameNode, displayName: formatQName(fn.qname), arity: fn.arity };
		const group = groups.get(key);
		if (group) group.push(entry);
		else groups.set(key, [entry]);
	}

	const out: DuplicateFunctionDiagnostic[] = [];
	for (const [key, decls] of groups) {
		if (decls.length <= 1 && !importedKeys.has(key)) continue;
		for (const { nameNode, displayName, arity } of decls) {
			out.push({
				message: `Function '${displayName}' is declared more than once (${arity} parameter${arity === 1 ? "" : "s"})`,
				code: "XQST0034",
				offset: nameNode.start ?? 0,
				length: displayName.length,
			});
		}
	}
	return out;
}
