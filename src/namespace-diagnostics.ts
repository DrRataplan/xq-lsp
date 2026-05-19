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

/** Find the LSP Position at which to insert a new `import module namespace` statement. */
export function findImportInsertPosition(text: string): { line: number; character: number } {
	const lines = text.split('\n');
	let insertAfterLine = -1;
	let inMultiLine = false;

	for (let i = 0; i < lines.length; i++) {
		const trimmed = lines[i].trim();
		if (/^import\s+module\s+namespace/.test(trimmed)) inMultiLine = true;
		if (inMultiLine && trimmed.includes(';')) {
			insertAfterLine = i;
			inMultiLine = false;
		}
	}

	if (insertAfterLine >= 0) return { line: insertAfterLine + 1, character: 0 };

	// No imports: insert before first declare function/variable
	for (let i = 0; i < lines.length; i++) {
		if (/^\s*declare\s+(function|variable|%|default)/.test(lines[i])) {
			return { line: i, character: 0 };
		}
	}

	// Fall back: insert after module namespace or xquery version declaration
	for (let i = 0; i < lines.length; i++) {
		const trimmed = lines[i].trim();
		if ((/^module\s+namespace/.test(trimmed) || /^xquery\s+version/.test(trimmed)) && lines[i].includes(';')) {
			return { line: i + 1, character: 0 };
		}
	}

	return { line: 0, character: 0 };
}

/** Find the LSP Position at which to insert a new `declare namespace` statement. */
export function findDeclareNsInsertPosition(text: string): { line: number; character: number } {
	const lines = text.split('\n');
	let insertAfterLine = -1;

	for (let i = 0; i < lines.length; i++) {
		const trimmed = lines[i].trim();
		if (
			/^(import\s+module\s+namespace|declare\s+namespace)/.test(trimmed) &&
			lines[i].includes(';')
		) {
			insertAfterLine = i;
		}
	}

	if (insertAfterLine >= 0) return { line: insertAfterLine + 1, character: 0 };

	// Before first function/variable declaration
	for (let i = 0; i < lines.length; i++) {
		if (/^\s*declare\s+(function|variable|%|default)/.test(lines[i])) {
			return { line: i, character: 0 };
		}
	}

	// After module namespace or xquery version
	for (let i = 0; i < lines.length; i++) {
		const trimmed = lines[i].trim();
		if ((/^module\s+namespace/.test(trimmed) || /^xquery\s+version/.test(trimmed)) && lines[i].includes(';')) {
			return { line: i + 1, character: 0 };
		}
	}

	return { line: 0, character: 0 };
}
