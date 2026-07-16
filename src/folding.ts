import type { Node, NonTerminal } from "xq-parser";
import { FoldingRangeKind } from "vscode-languageserver/node.js";
import type { FoldingRange } from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { FileAnalysis } from "./types.ts";
import { isTerminal } from "./analyzer.ts";

// Nodes whose span becomes a plain "region" fold when it crosses multiple lines.
const FOLDABLE_TYPES = new Set(["FunctionBody", "FLWORExpr", "DirElemConstructor"]);

function addRange(doc: TextDocument, node: Node, kind: string | undefined, out: FoldingRange[]): void {
	if (node.start === undefined || node.end === undefined || node.end === null) return;
	const start = doc.positionAt(node.start);
	const end = doc.positionAt(node.end);
	if (start.line === end.line) return; // single-line constructs aren't foldable
	out.push(kind ? { startLine: start.line, endLine: end.line, kind } : { startLine: start.line, endLine: end.line });
}

function walk(node: Node, doc: TextDocument, out: FoldingRange[]): void {
	if (isTerminal(node)) return;
	if (FOLDABLE_TYPES.has(node.type)) addRange(doc, node, undefined, out);
	for (const child of (node as NonTerminal).children) walk(child, doc, out);
}

/**
 * Folding ranges for function bodies, FLWOR expressions, direct element
 * constructors, and comments. Returns [] when `ast` is null — the
 * regex-fallback path carries no node spans to fold.
 */
export function getFoldingRanges(ast: Node | null | undefined, analysis: FileAnalysis, doc: TextDocument): FoldingRange[] {
	if (!ast) return [];
	const out: FoldingRange[] = [];
	walk(ast, doc, out);
	for (const comment of analysis.comments ?? []) addRange(doc, comment, FoldingRangeKind.Comment, out);
	return out;
}
