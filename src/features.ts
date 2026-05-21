import {
	SignatureInformation,
	ParameterInformation,
	SymbolKind,
	MarkupKind,
} from "vscode-languageserver/node.js";
import type { Hover, SignatureHelp, DocumentSymbol, Range } from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
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

// ── Shared helpers ───────────────────────────────────────────────────────────

/**
 * Resolve a qualified-name word (e.g. "fn:true", "m:sin", "true") to a FunctionSymbol
 * using proper namespace URI resolution against the current file's namespace context.
 */
function resolveFunction(
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

function wordAt(text: string, offset: number): { word: string; start: number; end: number } {
	let start = offset;
	let end = offset;
	while (start > 0 && /[\w:\-]/.test(text[start - 1])) start--;
	while (end < text.length && /[\w:\-]/.test(text[end])) end++;
	return { word: text.slice(start, end), start, end };
}

export function functionSignature(fn: FunctionSymbol): string {
	const params = fn.params.map((p) => `$${p.name}${p.type ? " as " + p.type : ""}`).join(", ");
	const ret = fn.returnType ? ` as ${fn.returnType}` : "";
	return `declare function ${formatQName(fn.qname)}(${params})${ret}`;
}

function allFunctions(current: FileAnalysis, imported: Map<string, FileAnalysis>): FunctionSymbol[] {
	const fns = [...current.functions];
	for (const a of imported.values()) fns.push(...a.functions);
	return fns;
}

function rangeFromOffset(doc: TextDocument, start: number, end: number): Range {
	return { start: doc.positionAt(start), end: doc.positionAt(end) };
}

// ── AST-based call context ───────────────────────────────────────────────────

/**
 * Walk the node stack at `offset` looking for the innermost FunctionCall that
 * contains `offset` (either in its name or its argument list).
 * Returns the function's lexical name, total arity, and active parameter index.
 */
function callContextFromAst(
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
		// Active param = number of args whose span ends at or before the cursor
		const activeParam = args.filter((a) => a.end !== null && a.end <= offset).length;
		return { name, arity, activeParam };
	}
	return null;
}

// ── Hover ────────────────────────────────────────────────────────────────────

/**
 * Resolve the function being hovered at `offset` in `text`.
 * Returns the matched symbol and its word span, or null.
 * Usable without LSP types — shared with the playground.
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

export function getHover(
	doc: TextDocument,
	offset: number,
	current: FileAnalysis,
	imported: Map<string, FileAnalysis>,
): Hover | null {
	const text = doc.getText();
	const { word, start, end } = wordAt(text, offset);
	if (!word) return null;

	// Check if hovering over a $ variable
	const hasDollar = start > 0 && text[start - 1] === "$";
	if (hasDollar) {
		const colonIdx = word.indexOf(":");
		const varPrefix = colonIdx >= 0 ? word.slice(0, colonIdx) : "";
		const varLocalName = colonIdx >= 0 ? word.slice(colonIdx + 1) : word;
		const varNsUri = varPrefix ? resolvePrefix(varPrefix, current) : "";
		const allVars = [
			...current.moduleVariables,
			...current.localBindings,
			...[...imported.values()].flatMap((a) => a.moduleVariables),
		];
		const v = allVars.find((v) => v.qname.namespaceUri === varNsUri && v.qname.localName === varLocalName);
		if (v) {
			return {
				contents: { kind: MarkupKind.Markdown, value: `\`$${formatQName(v.qname)}\`` },
				range: rangeFromOffset(doc, start - 1, end),
			};
		}
		return null;
	}

	const result = resolveFunctionAtOffset(text, offset, current, imported);
	if (result) {
		return {
			contents: {
				kind: MarkupKind.Markdown,
				value: "```xquery\n" + functionSignature(result.fn) + "\n```",
			},
			range: rangeFromOffset(doc, result.start, result.end),
		};
	}

	return null;
}

// ── Signature help ───────────────────────────────────────────────────────────

/**
 * Scan left from cursor to find the function call we're inside.
 * Returns { name, activeParam } or null.
 */
function findEnclosingCall(text: string, offset: number): { name: string; activeParam: number } | null {
	let depth = 0;
	let commas = 0;

	for (let i = offset - 1; i >= 0; i--) {
		const ch = text[i];
		if (ch === ")") {
			depth++;
			continue;
		}
		if (ch === "(") {
			if (depth > 0) {
				depth--;
				continue;
			}
			// Found the opening paren of our call — scan left for the function name
			let nameEnd = i;
			while (nameEnd > 0 && /\s/.test(text[nameEnd - 1])) nameEnd--;
			const { word, start } = wordAt(text, nameEnd - 1);
			if (!word) return null;
			return { name: word, activeParam: commas };
		}
		if (ch === "," && depth === 0) commas++;
		// Stop at statement boundaries
		if ((ch === ";" || ch === "{") && depth === 0) return null;
	}
	return null;
}

/** Count arguments in the call enclosing `offset` by scanning forward from the opening paren. */
function countCallArity(text: string, offset: number): number | undefined {
	// Scan back to find the opening paren
	let depth = 0;
	let openParen = -1;
	for (let i = offset - 1; i >= 0; i--) {
		const ch = text[i];
		if (ch === ")") {
			depth++;
			continue;
		}
		if (ch === "(") {
			if (depth > 0) {
				depth--;
				continue;
			}
			openParen = i;
			break;
		}
	}
	if (openParen < 0) return undefined;
	// Scan forward from openParen to matching close paren, count top-level commas
	let commas = 0;
	depth = 0;
	for (let i = openParen + 1; i < text.length; i++) {
		const ch = text[i];
		if (ch === "(" || ch === "[") {
			depth++;
			continue;
		}
		if (ch === "]") {
			depth--;
			continue;
		}
		if (ch === ")") {
			if (depth > 0) {
				depth--;
				continue;
			}
			// Empty argument list
			const inner = text.slice(openParen + 1, i).trim();
			return inner ? commas + 1 : 0;
		}
		if (ch === "," && depth === 0) commas++;
	}
	return undefined;
}

export function getSignatureHelp(
	doc: TextDocument,
	offset: number,
	current: FileAnalysis,
	imported: Map<string, FileAnalysis>,
): SignatureHelp | null {
	const text = doc.getText();

	let callName: string;
	let activeParam: number;
	let arity: number | undefined;

	if (current.ast) {
		const ctx = callContextFromAst(current.ast, offset);
		if (!ctx) return null;
		callName = ctx.name;
		activeParam = ctx.activeParam;
		arity = ctx.arity;
	} else {
		const call = findEnclosingCall(text, offset);
		if (!call) return null;
		callName = call.name;
		activeParam = call.activeParam;
		arity = countCallArity(text, offset);
	}

	const fn = resolveFunction(callName, current, allFunctions(current, imported), arity);
	if (!fn) return null;

	const sig: SignatureInformation = {
		label: functionSignature(fn),
		parameters: fn.params.map((p) => {
			const label = `$${p.name}${p.type ? " as " + p.type : ""}`;
			return ParameterInformation.create(label);
		}),
	};

	return {
		signatures: [sig],
		activeSignature: 0,
		activeParameter: Math.min(activeParam, fn.params.length - 1),
	};
}

// ── Document symbols ─────────────────────────────────────────────────────────

export function getDocumentSymbols(doc: TextDocument, current: FileAnalysis): DocumentSymbol[] {
	const symbols: DocumentSymbol[] = [];

	for (const fn of current.functions) {
		const pos = doc.positionAt(fn.sourceOffset ?? 0);
		const range: Range = { start: pos, end: pos };
		symbols.push({
			name: formatQName(fn.qname),
			kind: SymbolKind.Function,
			range,
			selectionRange: range,
			detail: `#${fn.arity}`,
		});
	}

	for (const v of current.moduleVariables) {
		const pos = doc.positionAt(v.offset);
		const range: Range = { start: pos, end: pos };
		symbols.push({
			name: `$${formatQName(v.qname)}`,
			kind: SymbolKind.Variable,
			range,
			selectionRange: range,
		});
	}

	return symbols;
}

