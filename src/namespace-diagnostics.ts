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
	if (name.startsWith("Q{")) return; // URIQualifiedName: URI is inline, no prefix needed
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
 * Return the first line index after the mandatory header — xquery version
 * decl, module namespace decl, and any leading block comments (including
 * multi-line docblocks).  This is the safe fallback insertion point when no
 * existing statements of the same kind are present to anchor the insert.
 */
function headerEndLine(text: string): number {
	const lines = text.split("\n");
	let i = 0;
	while (i < lines.length) {
		const t = lines[i].trim();
		if (/^xquery\b/.test(t) || /^module\s+namespace\b/.test(t)) { i++; continue; }
		if (t === "") { i++; continue; }
		if (t.startsWith("(:")) {
			// Scan forward to the line that closes the comment block.
			while (i < lines.length && !lines[i].includes(":)")) i++;
			i++; // move past the closing line
			continue;
		}
		return i;
	}
	return i;
}

/**
 * Position at which to insert a new `import module namespace` statement:
 * after the last existing import (to keep imports grouped), or after the
 * file header (version/module decls and leading comments) when none exist.
 */
export function findImportInsertPosition(text: string): { line: number; character: number } {
	const lines = text.split("\n");
	for (let i = lines.length - 1; i >= 0; i--) {
		if (/^\s*import\s+module\s+namespace\b/.test(lines[i]))
			return { line: i + 1, character: 0 };
	}
	return { line: headerEndLine(text), character: 0 };
}

/** Position at which to insert a new `declare namespace` statement. */
export function findDeclareNsInsertPosition(text: string): { line: number; character: number } {
	return { line: headerEndLine(text), character: 0 };
}

/** Compute a relative file path from one URI to another, always using forward slashes and a leading `./`. */
export function computeRelativePath(fromUri: string, toUri: string): string {
	// Uses only the global URL (Node + browser) so this module stays bundlable for the browser demo.
	const fromSegments = new URL(".", fromUri)
		.pathname.split("/")
		.filter(Boolean)
		.map(decodeURIComponent);
	const toSegments = new URL(toUri).pathname
		.split("/")
		.filter(Boolean)
		.map(decodeURIComponent);

	let common = 0;
	while (
		common < fromSegments.length &&
		common < toSegments.length &&
		fromSegments[common] === toSegments[common]
	)
		common++;

	const ups = fromSegments.length - common;
	const rel = [...Array(ups).fill(".."), ...toSegments.slice(common)].join("/");
	return rel.startsWith(".") ? rel : "./" + rel;
}
