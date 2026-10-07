import type { Node, NonTerminal } from "xq-parser";
import { findAll, isTerminal } from "./analyzer.ts";
import { asDefaultNamespaceDecl, asDirElemXmlnsAttrs } from "./ast-nodes.ts";

export interface RedundantXmlnsDiagnostic {
	message: string;
	code: "xq-lsp:redundant-xmlns";
	offset: number;
	length: number;
}

/** In-scope namespaces keyed by prefix; "" is the default element namespace. */
type Scope = Map<string, string>;

function walk(node: Node, scope: Scope, out: RedundantXmlnsDiagnostic[]): void {
	if (isTerminal(node)) return;
	let inner = scope;

	const attrs = asDirElemXmlnsAttrs(node);
	if (attrs?.length) {
		inner = new Map(scope);
		for (const { prefix, uri, nameNode, valueNode } of attrs) {
			if (uri === null) continue;
			if (scope.get(prefix) === uri) {
				const offset = nameNode.start ?? 0;
				out.push({
					message: prefix === ""
						? `Redundant 'xmlns' declaration: the default element namespace is already "${uri}" here.`
						: `Redundant 'xmlns:${prefix}' declaration: the prefix is already bound to "${uri}" here.`,
					code: "xq-lsp:redundant-xmlns",
					offset,
					length: (valueNode.end ?? 0) - offset,
				});
			}
			inner.set(prefix, uri);
		}
	}

	for (const c of (node as NonTerminal).children) walk(c, inner, out);
}

/**
 * Flag `xmlns` / `xmlns:p` attributes on direct element constructors that re-declare
 * a namespace already in scope: the prolog's `declare default element namespace`
 * or an enclosing element's declaration of the same value.
 */
export function checkRedundantXmlns(ast: Node): RedundantXmlnsDiagnostic[] {
	const prologDefault = findAll(ast, "DefaultNamespaceDecl")
		.map((decl) => asDefaultNamespaceDecl(decl))
		.findLast((decl) => decl?.kind === "element");
	const out: RedundantXmlnsDiagnostic[] = [];
	walk(ast, new Map([["", prologDefault?.uri ?? ""]]), out);
	return out;
}

/** Offset range to delete for the attribute a diagnostic covers, including the whitespace before it. */
export function redundantXmlnsRemovalRange(text: string, diag: { offset: number; length: number }): { start: number; end: number } {
	let start = diag.offset;
	while (start > 0 && /\s/.test(text[start - 1])) start--;
	return { start, end: diag.offset + diag.length };
}
