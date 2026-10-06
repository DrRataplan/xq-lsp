import type { Node, NonTerminal, Terminal } from "xq-parser";
import type { FileAnalysis } from "./types.ts";
import {
	XMLNS_FN,
	XMLNS_XS,
	isTerminal,
	directChildOf,
	findAll,
	firstTerminalValue,
	parseEQName,
	resolvePrefix,
} from "./analyzer.ts";
import { asFunctionCall } from "./ast-nodes.ts";

export type NamespaceUsageKind = "function" | "variable" | "element";

export interface NamespaceDiagnostic {
	message: string;
	code: "XQST0081" | "FONS0004";
	offset: number; // offset of the prefix start in source
	length: number; // length of the prefix (not including the colon)
	prefix: string;
	usageKind: NamespaceUsageKind;
}

/** Unwraps single-child grammar wrappers down to a StringLiteral terminal; null for anything more complex. */
function asStringLiteral(node: Node | undefined): Terminal | null {
	let cur: Node | undefined = node;
	while (cur && !isTerminal(cur)) {
		const children = (cur as NonTerminal).children;
		if (children.length !== 1) return null;
		cur = children[0];
	}
	return cur && cur.type === "StringLiteral" ? (cur as Terminal) : null;
}

export interface DynamicPrefixUse {
	/** The prefix text. */
	prefix: string;
	/** Source offset of the prefix (inside the string literal). */
	offset: number;
	/** True when an unbound prefix is an error (xs:QName / xs:NOTATION); false for namespace-uri-for-prefix, which just returns (). */
	required: boolean;
}

/**
 * Prefixes taken from a string literal and resolved against the static
 * in-scope namespaces at runtime: `xs:QName("p:l")`, `"p:l" cast as xs:QName`
 * (also `castable as`, `xs:NOTATION`) and `fn:namespace-uri-for-prefix("p", …)`.
 * Only literal operands are detected.
 */
export function findDynamicPrefixUses(ast: Node, analysis: FileAnalysis): DynamicPrefixUse[] {
	const out: DynamicPrefixUse[] = [];
	const fromQNameLiteral = (lit: Terminal | null, required: boolean): void => {
		if (!lit) return;
		const text = lit.value.slice(1, -1);
		const trimmedStart = text.length - text.trimStart().length;
		const t = text.trim();
		const c = t.indexOf(":");
		if (c <= 0) return;
		out.push({ prefix: t.slice(0, c), offset: lit.start + 1 + trimmedStart, required });
	};

	for (const call of findAll(ast, "FunctionCall")) {
		const fc = asFunctionCall(call, analysis);
		if (!fc) continue;
		const { namespaceUri, localName } = fc.qname;
		const lit = asStringLiteral(fc.args[0]);
		if (!lit) continue;
		if (namespaceUri === XMLNS_XS && (localName === "QName" || localName === "NOTATION")) {
			fromQNameLiteral(lit, true);
		} else if (namespaceUri === XMLNS_FN && localName === "namespace-uri-for-prefix") {
			const prefix = lit.value.slice(1, -1);
			if (prefix.length > 0) out.push({ prefix, offset: lit.start + 1, required: false });
		}
	}

	// castable as never raises an error for an unbound prefix; it just yields false.
	for (const type of ["CastExpr", "CastableExpr"]) {
		for (const node of findAll(ast, type)) {
			const single = directChildOf(node, "SingleType");
			const typeNode = single && findAll(single, "QName")[0];
			const typeName = typeNode && firstTerminalValue(typeNode);
			if (!typeName) continue;
			const { prefix, localName, uri } = parseEQName(typeName);
			if ((uri ?? resolvePrefix(prefix, analysis)) !== XMLNS_XS) continue;
			if (localName !== "QName" && localName !== "NOTATION") continue;
			fromQNameLiteral(asStringLiteral((node as NonTerminal).children[0]), type === "CastExpr");
		}
	}
	return out;
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

function inlineXmlnsPrefixes(elem: Node): Set<string> {
	const local = new Set<string>();
	const attrList = directChildOf(elem, "DirAttributeList");
	if (attrList && !isTerminal(attrList)) {
		for (const c of (attrList as { children: Node[] }).children) {
			if (c.type !== "QName") continue;
			const attrName = firstTerminalValue(c);
			if (attrName?.startsWith("xmlns:")) local.add(attrName.slice(6));
		}
	}
	return local;
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
		const local = inlineXmlnsPrefixes(node);
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

	// Prefixes inside string literals resolve against the in-scope namespaces, which
	// include xmlns:prefix declarations of enclosing direct element constructors.
	const dirElems = findAll(ast, "DirElemConstructor").map((el) => ({
		start: el.start ?? 0,
		end: el.end ?? 0,
		prefixes: inlineXmlnsPrefixes(el),
	}));
	for (const use of findDynamicPrefixUses(ast, analysis)) {
		if (!use.required) continue;
		if (dirElems.some((el) => el.start <= use.offset && use.offset < el.end && el.prefixes.has(use.prefix))) continue;
		if (!resolvePrefix(use.prefix, analysis).startsWith("urn:xq-lsp:undeclared:")) continue;
		out.push({
			message: `Namespace prefix '${use.prefix}' is not declared`,
			code: "FONS0004",
			offset: use.offset,
			length: use.prefix.length,
			prefix: use.prefix,
			usageKind: "element",
		});
	}
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
