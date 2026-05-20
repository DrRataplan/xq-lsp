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

	for (const node of findAll(ast, 'FunctionCall'))
		checkQNameNode(directChildOf(node, 'FunctionEQName'), 'function', analysis, out);

	for (const node of findAll(ast, 'NamedFunctionRef'))
		checkQNameNode(directChildOf(node, 'EQName'), 'function', analysis, out);

	for (const node of findAll(ast, 'VarRef'))
		checkQNameNode(directChildOf(node, 'VarName'), 'variable', analysis, out);

	// Direct element constructor: <ns:foo ...>
	for (const node of findAll(ast, 'DirElemConstructor'))
		checkQNameNode(directChildOf(node, 'QName'), 'element', analysis, out);

	// Computed element constructor: element ns:foo { ... }
	for (const node of findAll(ast, 'CompElemConstructor'))
		checkQNameNode(directChildOf(node, 'EQName'), 'element', analysis, out);

	// Computed attribute constructor: attribute ns:attr { ... }
	for (const node of findAll(ast, 'CompAttrConstructor'))
		checkQNameNode(directChildOf(node, 'EQName'), 'element', analysis, out);

	return out;
}

// ── Insertion-position helpers (used by the code action handler) ─────────────

/** Position at which to insert a new `import module namespace` statement. */
export function findImportInsertPosition(_text: string): { line: number; character: number } {
	return { line: 0, character: 0 };
}

/** Position at which to insert a new `declare namespace` statement. */
export function findDeclareNsInsertPosition(_text: string): { line: number; character: number } {
	return { line: 0, character: 0 };
}
