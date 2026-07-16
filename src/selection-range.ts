import { SelectionRange } from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { FileAnalysis } from "./types.ts";
import { nodeStackAtOffset } from "./analyzer.ts";

/**
 * Build a SelectionRange linked list for `offset`, from the smallest containing
 * AST node outward to the root. Returns null on the regex-fallback path (no AST)
 * or when `offset` falls outside every node.
 */
export function getSelectionRange(doc: TextDocument, offset: number, analysis: FileAnalysis): SelectionRange | null {
	if (!analysis.ast) return null;
	const stack = nodeStackAtOffset(analysis.ast, offset);
	if (stack.length === 0) return null;

	let range: SelectionRange | undefined;
	let lastStart = -1;
	let lastEnd = -1;
	for (const node of stack) {
		// stack is ordered [root, ..., deepest]; build inner ranges with the outer ones as parent
		if (node.start === undefined || node.end === null) continue;
		if (node.start === lastStart && node.end === lastEnd) continue; // identical span as parent would leave selection "stuck"
		range = SelectionRange.create({ start: doc.positionAt(node.start), end: doc.positionAt(node.end) }, range);
		lastStart = node.start;
		lastEnd = node.end;
	}
	return range ?? null;
}
