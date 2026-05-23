import type { Node } from "xq-parser";
import type { FileAnalysis } from "./types.ts";
import { isTerminal, directChildOf, firstTerminalValue, resolvePrefix } from "./analyzer.ts";

export type NamespaceUsageKind = "function" | "variable" | "element";

export interface NamespaceDiagnostic {
	message: string;
	code: "XQST0081";
	offset: number; // offset of the prefix start in source
	length: number; // length of the prefix (not including the colon)
	prefix: string;
	usageKind: NamespaceUsageKind;
}

function checkQName(
	node: Node | undefined,
	kind: NamespaceUsageKind,
	analysis: FileAnalysis,
	inlineStack: Set<string>[],
	out: NamespaceDiagnostic[],
): void {
	if (!node) return;
	const name = firstTerminalValue(node);
	if (!name) return;
	const colonIdx = name.indexOf(":");
	if (colonIdx <= 0) return;
	const prefix = name.slice(0, colonIdx);
	const uri = resolvePrefix(prefix, analysis);
	if (uri.startsWith("urn:xq-lsp:undeclared:") && !inlineStack.some((s) => s.has(prefix))) {
		out.push({
			message: `Namespace prefix '${prefix}' is not declared`,
			code: "XQST0081",
			offset: node.start ?? 0,
			length: prefix.length,
			prefix,
			usageKind: kind,
		});
	}
}

function walk(
	node: Node,
	analysis: FileAnalysis,
	inlineStack: Set<string>[],
	out: NamespaceDiagnostic[],
): void {
	if (isTerminal(node)) return;
	const children = (node as { children: Node[] }).children;

	if (node.type === "DirElemConstructor") {
		// Collect xmlns:prefix declarations from this element's attribute list,
		// then push them onto the scope stack for the duration of this subtree.
		const local = new Set<string>();
		const attrList = directChildOf(node, "DirAttributeList");
		if (attrList && !isTerminal(attrList)) {
			for (const c of (attrList as { children: Node[] }).children) {
				if (c.type !== "QName") continue;
				const attrName = firstTerminalValue(c);
				if (attrName?.startsWith("xmlns:")) local.add(attrName.slice(6));
			}
		}
		inlineStack.push(local);
		checkQName(directChildOf(node, "QName"), "element", analysis, inlineStack, out);
		for (const c of children) walk(c, analysis, inlineStack, out);
		inlineStack.pop();
		return;
	}

	if (node.type === "FunctionCall")
		checkQName(directChildOf(node, "FunctionEQName"), "function", analysis, inlineStack, out);
	else if (node.type === "NamedFunctionRef")
		checkQName(directChildOf(node, "EQName"), "function", analysis, inlineStack, out);
	else if (node.type === "VarRef")
		checkQName(directChildOf(node, "VarName"), "variable", analysis, inlineStack, out);
	else if (node.type === "CompElemConstructor")
		checkQName(directChildOf(node, "EQName"), "element", analysis, inlineStack, out);
	else if (node.type === "CompAttrConstructor")
		checkQName(directChildOf(node, "EQName"), "element", analysis, inlineStack, out);

	for (const c of children) walk(c, analysis, inlineStack, out);
}

/**
 * Walk the AST and report every prefixed name reference whose prefix is not
 * declared in `analysis` (via import module namespace, declare namespace,
 * module namespace, or a built-in prefix).
 *
 * Inline xmlns:prefix="..." declarations on DirElemConstructor nodes are
 * tracked with a scope stack — a prefix is in scope from the opening tag
 * through to the closing tag of the declaring element.
 *
 * Returns an empty array when `ast` is null (parse failure).
 */
export function findUndeclaredPrefixUsages(
	ast: Node | null,
	analysis: FileAnalysis,
): NamespaceDiagnostic[] {
	if (!ast) return [];
	const out: NamespaceDiagnostic[] = [];
	walk(ast, analysis, [], out);
	return out;
}

// ── Insertion-position helpers (used by the code action handler) ─────────────

/**
 * Find the first line in the prolog that is safe to insert a new statement
 * before — i.e. after any leading VersionDecl and ModuleDecl, which the
 * grammar requires to come first.  Everything else can be reordered by
 * xquery-prettier.
 */
function firstPrologLine(text: string): number {
	const lines = text.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const t = lines[i].trim();
		if (/^xquery\b/.test(t) || /^module\s+namespace\b/.test(t)) continue;
		if (t === "" || t.startsWith("(:")) continue; // leading whitespace / comments
		return i;
	}
	return 0;
}

/** Position at which to insert a new `import module namespace` statement. */
export function findImportInsertPosition(text: string): { line: number; character: number } {
	return { line: firstPrologLine(text), character: 0 };
}

/** Position at which to insert a new `declare namespace` statement. */
export function findDeclareNsInsertPosition(text: string): { line: number; character: number } {
	return { line: firstPrologLine(text), character: 0 };
}
