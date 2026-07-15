import type { Node } from "xq-parser";
import { CodeLens } from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { FileAnalysis } from "./types.ts";
import { findAll } from "./analyzer.ts";
import { asFunctionDeclaration, asVarDecl } from "./ast-nodes.ts";
import { getReferences } from "./references.ts";
import type { FileRecord } from "./references.ts";

/** Carried on each unresolved lens so `resolveCodeLens` can find the declaration again later. */
export interface CodeLensData {
	uri: string;
	kind: "function" | "variable";
	/** `FunctionSymbol.sourceOffset` (AnnotatedDecl start) or `VariableSymbol.offset` (VarDecl start) — re-locates the exact declaration node on resolve. */
	declOffset: number;
}

/**
 * One unresolved `CodeLens` per declared function and module variable in `analysis`,
 * positioned at the declaration. Titles are left for `resolveCodeLens` since counting
 * references can require a cross-file search.
 */
export function buildCodeLenses(doc: TextDocument, analysis: FileAnalysis): CodeLens[] {
	const lenses: CodeLens[] = [];

	for (const fn of analysis.functions) {
		const offset = fn.sourceOffset ?? 0;
		const pos = doc.positionAt(offset);
		lenses.push({
			range: { start: pos, end: pos },
			data: { uri: doc.uri, kind: "function", declOffset: offset } satisfies CodeLensData,
		});
	}

	for (const v of analysis.moduleVariables) {
		const pos = doc.positionAt(v.offset);
		lenses.push({
			range: { start: pos, end: pos },
			data: { uri: doc.uri, kind: "variable", declOffset: v.offset } satisfies CodeLensData,
		});
	}

	return lenses;
}

/**
 * Re-finds the exact name-node offset for a declaration recorded by `buildCodeLenses`,
 * matching the AST node whose start equals `declOffset` (the same offset `FunctionSymbol.sourceOffset`
 * / `VariableSymbol.offset` were derived from in analyzer.ts). The name-node's last character
 * (rather than its start) is used so `getReferences`'s classifier lands past any namespace-prefix
 * qualifier and isn't misread as a prefix reference.
 */
function findNameOffset(ast: Node, analysis: FileAnalysis, data: CodeLensData): number | null {
	if (data.kind === "function") {
		for (const annotated of findAll(ast, "AnnotatedDecl")) {
			if (annotated.start !== data.declOffset) continue;
			const fn = asFunctionDeclaration(annotated, analysis);
			if (fn) return (fn.nameNode.end ?? fn.nameNode.start) - 1;
		}
		return null;
	}

	for (const varDecl of findAll(ast, "VarDecl")) {
		if (varDecl.start !== data.declOffset) continue;
		const v = asVarDecl(varDecl, analysis);
		if (v) return (v.nameNode.end ?? v.nameNode.start) - 1;
	}
	return null;
}

/**
 * Resolves one unresolved lens into its final title, running the same cross-file
 * reference search `textDocument/references` uses. Declarations aren't counted as
 * references. 0 references is reported as-is — it's a useful signal, not hidden.
 */
export function resolveCodeLens(lens: CodeLens, text: string, analysis: FileAnalysis, getOtherFiles: () => FileRecord[]): CodeLens {
	const data = lens.data as CodeLensData | undefined;
	const ast = analysis.ast;
	const offset = data && ast ? findNameOffset(ast, analysis, data) : null;
	const count = data && offset !== null ? getReferences(data.uri, text, offset, analysis, false, getOtherFiles).length : 0;

	return { ...lens, command: { title: `${count} references`, command: "" } };
}
