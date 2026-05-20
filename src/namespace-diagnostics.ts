import type { Node } from 'xq-parser';
import type { FileAnalysis } from './types.ts';
import { findAll, directChildOf, firstTerminalValue, resolvePrefix } from './analyzer.ts';

export type NamespaceUsageKind = 'function' | 'variable' | 'element';

export interface NamespaceDiagnostic {
	message: string;
	code: 'XQST0081';
	offset: number;  // offset of the prefix start in source
	length: number;  // length of the prefix (not including the colon)
	prefix: string;
	usageKind: NamespaceUsageKind;
}

function checkQNameNode(
	node: Node | undefined,
	kind: NamespaceUsageKind,
	analysis: FileAnalysis,
	out: NamespaceDiagnostic[],
): void {
	if (!node) return;
	const name = firstTerminalValue(node);
	if (!name) return;
	const colonIdx = name.indexOf(':');
	if (colonIdx <= 0) return;
	const prefix = name.slice(0, colonIdx);
	const uri = resolvePrefix(prefix, analysis);
	if (uri.startsWith('urn:xq-lsp:undeclared:')) {
		out.push({
			message: `Namespace prefix '${prefix}' is not declared`,
			code: 'XQST0081',
			offset: node.start ?? 0,
			length: prefix.length,
			prefix,
			usageKind: kind,
		});
	}
}

/**
 * Walk the AST and report every prefixed name reference whose prefix is not
 * declared in `analysis` (via import module namespace, declare namespace,
 * module namespace, or a built-in prefix).
 *
 * Returns an empty array when `ast` is null (parse failure).
 */
export function findUndeclaredPrefixUsages(
	ast: Node | null,
	analysis: FileAnalysis,
): NamespaceDiagnostic[] {
	if (!ast) return [];
	const out: NamespaceDiagnostic[] = [];

	// XQuery 3.1 uses FunctionEQName; XQuery 4.0 uses UnreservedFunctionEQName
	for (const node of findAll(ast, 'FunctionCall'))
		checkQNameNode(directChildOf(node, 'FunctionEQName') ?? directChildOf(node, 'UnreservedFunctionEQName'), 'function', analysis, out);

	// XQuery 3.1 uses EQName; XQuery 4.0 uses UnreservedFunctionEQName
	for (const node of findAll(ast, 'NamedFunctionRef'))
		checkQNameNode(directChildOf(node, 'EQName') ?? directChildOf(node, 'UnreservedFunctionEQName'), 'function', analysis, out);

	// XQuery 3.1 uses VarName; XQuery 4.0 uses EQName
	for (const node of findAll(ast, 'VarRef'))
		checkQNameNode(directChildOf(node, 'VarName') ?? directChildOf(node, 'EQName'), 'variable', analysis, out);

	// Direct element constructor: <ns:foo ...>
	for (const node of findAll(ast, 'DirElemConstructor'))
		checkQNameNode(directChildOf(node, 'QName'), 'element', analysis, out);

	// Computed element/attribute constructor: XQuery 3.1 uses EQName; XQuery 4.0 uses CompNodeName
	for (const node of findAll(ast, 'CompElemConstructor'))
		checkQNameNode(directChildOf(node, 'EQName') ?? directChildOf(node, 'CompNodeName'), 'element', analysis, out);

	for (const node of findAll(ast, 'CompAttrConstructor'))
		checkQNameNode(directChildOf(node, 'EQName') ?? directChildOf(node, 'CompNodeName'), 'element', analysis, out);

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
	const lines = text.split('\n');
	for (let i = 0; i < lines.length; i++) {
		const t = lines[i].trim();
		if (/^xquery\b/.test(t) || /^module\s+namespace\b/.test(t)) continue;
		if (t === '' || t.startsWith('(:')) continue; // leading whitespace / comments
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
