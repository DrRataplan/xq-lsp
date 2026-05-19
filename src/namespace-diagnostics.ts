import type { FileAnalysis } from './types.ts';
import { resolvePrefix } from './analyzer.ts';

export type NamespaceUsageKind = 'function' | 'variable' | 'element';

export interface NamespaceDiagnostic {
	message: string;
	code: 'XQST0081';
	offset: number;  // offset of the prefix start in source
	length: number;  // length of the prefix (not including the colon)
	prefix: string;
	usageKind: NamespaceUsageKind;
}

/** Build ranges of text inside XQuery comments and string literals to skip when scanning. */
function buildSkipRanges(text: string): Array<{ start: number; end: number }> {
	const ranges: Array<{ start: number; end: number }> = [];
	let i = 0;
	while (i < text.length) {
		const ch = text[i];
		if (ch === '(' && i + 1 < text.length && text[i + 1] === ':') {
			const start = i;
			let depth = 1;
			i += 2;
			while (i < text.length - 1 && depth > 0) {
				if (text[i] === '(' && text[i + 1] === ':') { depth++; i += 2; }
				else if (text[i] === ':' && text[i + 1] === ')') { depth--; i += 2; }
				else i++;
			}
			if (depth > 0) i = text.length;
			ranges.push({ start, end: i });
		} else if (ch === '"' || ch === "'") {
			const q = ch;
			const start = i++;
			while (i < text.length) {
				if (text[i] === q && i + 1 < text.length && text[i + 1] === q) i += 2;
				else if (text[i] === q) { i++; break; }
				else i++;
			}
			ranges.push({ start, end: i });
		} else {
			i++;
		}
	}
	return ranges;
}

function isInRanges(offset: number, ranges: Array<{ start: number; end: number }>): boolean {
	for (const r of ranges) {
		if (offset < r.start) break;
		if (offset < r.end) return true;
	}
	return false;
}

/** Walk back (skipping comment/string ranges) to find the start of the current prolog statement. */
function findStatementStart(text: string, offset: number, ranges: Array<{ start: number; end: number }>): number {
	for (let i = offset - 1; i >= 0; i--) {
		if (!isInRanges(i, ranges) && text[i] === ';') return i + 1;
	}
	return 0;
}

/**
 * Return true when the match at `offset` falls inside a prolog declaration
 * (import module, declare namespace, module namespace, etc.) so that the
 * prefix references in those declarations are not flagged.
 */
function isInPrologDeclaration(text: string, offset: number, ranges: Array<{ start: number; end: number }>): boolean {
	const start = findStatementStart(text, offset, ranges);
	const stmtText = text.slice(start, offset + 10).replace(/\s+/g, ' ').trimStart();
	return /^(import\s+module|declare\s+namespace|declare\s+default\s+(function|element|collation)|module\s+namespace|xquery\s+version)/.test(stmtText);
}

/** Determine how the prefixed name is being used from the text context before it. */
function detectUsageKind(text: string, offset: number): NamespaceUsageKind {
	// Scan backward past spaces to find the preceding character
	let j = offset - 1;
	while (j >= 0 && text[j] === ' ') j--;
	if (j >= 0 && text[j] === '$') return 'variable';
	if (j >= 0 && text[j] === '<') return 'element';
	// Computed element/attribute constructor: `element ns:foo` or `attribute ns:foo`
	const contextBefore = text.slice(Math.max(0, offset - 30), offset);
	if (/\b(element|attribute)\s+$/.test(contextBefore)) return 'element';
	return 'function';
}

/**
 * Scan `text` for all `prefix:localName` tokens whose prefix is not declared
 * in `analysis` and return a diagnostic for each one.
 *
 * Works on both syntactically valid and invalid XQuery.
 */
export function findUndeclaredPrefixUsages(
	text: string,
	analysis: FileAnalysis,
): NamespaceDiagnostic[] {
	const diagnostics: NamespaceDiagnostic[] = [];
	const skipRanges = buildSkipRanges(text);

	// Match prefix:localname — require localname to start with letter/underscore
	// so that URI schemes like http:// are not matched (// fails [a-zA-Z_])
	const RE = /\b([a-zA-Z][\w-]*):([a-zA-Z_][\w-]*)/g;
	let m: RegExpExecArray | null;

	while ((m = RE.exec(text)) !== null) {
		const prefix = m[1];
		const offset = m.index;

		if (isInRanges(offset, skipRanges)) continue;
		if (isInPrologDeclaration(text, offset, skipRanges)) continue;

		const uri = resolvePrefix(prefix, analysis);
		if (!uri.startsWith('urn:xq-lsp:undeclared:')) continue;

		diagnostics.push({
			message: `Namespace prefix '${prefix}' is not declared`,
			code: 'XQST0081',
			offset,
			length: prefix.length,
			prefix,
			usageKind: detectUsageKind(text, offset),
		});
	}

	return diagnostics;
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
		// Place after existing namespace-related prolog lines
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
