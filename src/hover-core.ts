import type { Node } from "xq-parser";
import type { FileAnalysis, FunctionSymbol } from "./types.ts";
import { formatQName } from "./types.ts";
import {
	resolvePrefix,
	nodeStackAtOffset,
	directChildOf,
	directChildrenOf,
	firstTerminalValue,
	isTerminal,
} from "./analyzer.ts";

// ── Shared helpers ────────────────────────────────────────────────────────────

export function functionSignature(fn: FunctionSymbol): string {
	const params = fn.params.map((p) => `$${p.name}${p.type ? " as " + p.type : ""}`).join(", ");
	const ret = fn.returnType ? ` as ${fn.returnType}` : "";
	return `declare function ${formatQName(fn.qname)}(${params})${ret}`;
}

export function wordAt(text: string, offset: number): { word: string; start: number; end: number } {
	let start = offset;
	let end = offset;
	while (start > 0 && /[\w:\-]/.test(text[start - 1])) start--;
	while (end < text.length && /[\w:\-]/.test(text[end])) end++;
	return { word: text.slice(start, end), start, end };
}

export function allFunctions(current: FileAnalysis, imported: Map<string, FileAnalysis>): FunctionSymbol[] {
	const fns = [...current.functions];
	for (const a of imported.values()) fns.push(...a.functions);
	return fns;
}

export function resolveFunction(
	word: string,
	currentAnalysis: FileAnalysis,
	fns: FunctionSymbol[],
	arity?: number,
): FunctionSymbol | undefined {
	const colonIdx = word.indexOf(":");
	const prefix = colonIdx >= 0 ? word.slice(0, colonIdx) : "";
	const localName = colonIdx >= 0 ? word.slice(colonIdx + 1) : word;
	const uri = resolvePrefix(prefix, currentAnalysis);
	const matches = fns.filter((f) => f.qname.namespaceUri === uri && f.qname.localName === localName);
	if (arity !== undefined) return matches.find((f) => f.arity === arity) ?? matches[0];
	return matches[0];
}

// ── AST-based call context ────────────────────────────────────────────────────

/**
 * Walk the node stack at `offset` looking for the innermost FunctionCall that
 * contains `offset` (either in its name or its argument list).
 * Returns the function's lexical name, total arity, and active parameter index.
 */
export function callContextFromAst(
	ast: Node,
	offset: number,
): { name: string; arity: number; activeParam: number } | null {
	const stack = nodeStackAtOffset(ast, offset);
	for (let i = stack.length - 1; i >= 0; i--) {
		if (stack[i].type !== "FunctionCall") continue;
		const fc = stack[i];
		const argList = directChildOf(fc, "ArgumentList");
		if (!argList || isTerminal(argList)) continue;
		const fnEqName = directChildOf(fc, "FunctionEQName");
		const name = fnEqName ? firstTerminalValue(fnEqName) : null;
		if (!name) continue;
		const args = directChildrenOf(argList, "Argument");
		const arity = args.length;
		const activeParam = args.filter((a) => a.end !== null && a.end <= offset).length;
		return { name, arity, activeParam };
	}
	return null;
}

// ── Hover core ────────────────────────────────────────────────────────────────

/**
 * Resolve the function being hovered at `offset` in `text`.
 * Returns the matched symbol and its word span, or null.
 * Browser-safe — no LSP or Node.js imports.
 */
export function resolveFunctionAtOffset(
	text: string,
	offset: number,
	current: FileAnalysis,
	imported: Map<string, FileAnalysis>,
): { fn: FunctionSymbol; start: number; end: number } | null {
	const { word, start, end } = wordAt(text, offset);
	if (!word || (start > 0 && text[start - 1] === "$")) return null;
	const ctx = current.ast ? callContextFromAst(current.ast, offset) : null;
	const fn = resolveFunction(word, current, allFunctions(current, imported), ctx?.arity);
	return fn ? { fn, start, end } : null;
}

/**
 * Resolve signature help for the call enclosing `offset`.
 * Returns the matched function and the index of the active parameter, or null.
 * Requires a valid AST (returns null on the regex-fallback path).
 */
export function resolveSignatureAtOffset(
	text: string,
	offset: number,
	current: FileAnalysis,
	imported: Map<string, FileAnalysis>,
): { fn: FunctionSymbol; activeParam: number } | null {
	if (!current.ast) return null;
	const ctx = callContextFromAst(current.ast, offset);
	if (!ctx) return null;
	const fn = resolveFunction(ctx.name, current, allFunctions(current, imported), ctx.arity);
	if (!fn) return null;
	return { fn, activeParam: ctx.activeParam };
}
