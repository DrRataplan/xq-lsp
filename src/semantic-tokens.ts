import type { Node, NonTerminal, Terminal } from "xq-parser";
import type { FileAnalysis, FunctionSymbol, QName } from "./types.ts";
import { isTerminal, directChildOf, directChildrenOf, firstTerminalValue, BUILTIN_PREFIXES } from "./analyzer.ts";
import { asFunctionCall, asNamedFunctionRef, asFunctionDecl, asVarDecl } from "./ast-nodes.ts";
import { allFunctionsFlat } from "./functioncall-diagnostics.ts";
import { checkUnused } from "./unused-diagnostics.ts";

// ── Legend ────────────────────────────────────────────────────────────────────

export const TOKEN_TYPES = ["namespace", "function", "parameter", "variable", "string", "keyword"] as const;
export const TOKEN_MODIFIERS = ["defaultLibrary", "readonly", "unused"] as const;

export type SemanticTokenType = (typeof TOKEN_TYPES)[number];
export type SemanticTokenModifier = (typeof TOKEN_MODIFIERS)[number];

export const SEMANTIC_TOKENS_LEGEND = {
	tokenTypes: [...TOKEN_TYPES],
	tokenModifiers: [...TOKEN_MODIFIERS],
};

const TOKEN_TYPE_INDEX = Object.fromEntries(TOKEN_TYPES.map((t, i) => [t, i])) as Record<SemanticTokenType, number>;
const TOKEN_MODIFIER_BIT = Object.fromEntries(TOKEN_MODIFIERS.map((m, i) => [m, 1 << i])) as Record<SemanticTokenModifier, number>;

function modifierBitmask(mods: SemanticTokenModifier[]): number {
	return mods.reduce((acc, m) => acc | TOKEN_MODIFIER_BIT[m], 0);
}

// ── Delta encoding ────────────────────────────────────────────────────────────

export interface EncodedToken {
	line: number;
	character: number;
	length: number;
	tokenType: number;
	tokenModifiers: number;
}

/**
 * Delta-encode already-positioned tokens into the flat array required by
 * `SemanticTokens.data` (see the LSP spec's `textDocument/semanticTokens/full`).
 * Tokens are sorted by (line, character) first since the format is cumulative.
 */
export function encodeSemanticTokens(tokens: EncodedToken[]): number[] {
	const sorted = [...tokens].sort((a, b) => a.line - b.line || a.character - b.character);
	const data: number[] = [];
	let prevLine = 0;
	let prevChar = 0;
	for (const t of sorted) {
		const deltaLine = t.line - prevLine;
		const deltaChar = deltaLine === 0 ? t.character - prevChar : t.character;
		data.push(deltaLine, deltaChar, t.length, t.tokenType, t.tokenModifiers);
		prevLine = t.line;
		prevChar = t.character;
	}
	return data;
}

// ── Offset → line/character ──────────────────────────────────────────────────

function computeLineStarts(text: string): number[] {
	const starts = [0];
	for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1);
	return starts;
}

function offsetToPosition(lineStarts: number[], offset: number): { line: number; character: number } {
	let lo = 0;
	let hi = lineStarts.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (lineStarts[mid] <= offset) lo = mid;
		else hi = mid - 1;
	}
	return { line: lo, character: offset - lineStarts[lo] };
}

// ── Classification helpers ────────────────────────────────────────────────────

interface RawToken {
	offset: number;
	length: number;
	type: SemanticTokenType;
	modifiers: SemanticTokenModifier[];
}

/** Mirrors resolvePrefix's precedence order (analyzer.ts) without re-resolving the URI. */
function isDefaultLibraryPrefix(prefix: string, analysis: FileAnalysis): boolean {
	if (analysis.imports.some((i) => i.prefix === prefix)) return false;
	if (prefix === analysis.modulePrefix && analysis.moduleNamespaceUri) return false;
	const nd = analysis.namespaceDecls.find((n) => n.prefix === prefix);
	if (nd) return nd.offset === -1; // runtime-injected predeclared namespace, e.g. eXist-db
	return prefix in BUILTIN_PREFIXES;
}

function isDefaultLibraryFunction(qname: QName, allFns: FunctionSymbol[]): boolean {
	return allFns.some(
		(f) => f.qname.namespaceUri === qname.namespaceUri && f.qname.localName === qname.localName && f.sourceUri.startsWith("builtin:"),
	);
}

/** Splits a raw EQName/VarName/FunctionEQName node's text into its prefix and local-name spans. */
function splitPrefixedName(node: Node): { prefix?: { offset: number; length: number }; local: { offset: number; length: number } } | null {
	const raw = firstTerminalValue(node);
	if (!raw) return null;
	if (raw.startsWith("Q{")) {
		const close = raw.indexOf("}");
		if (close < 0) return null;
		return { local: { offset: node.start + close + 1, length: raw.length - close - 1 } };
	}
	const colon = raw.indexOf(":");
	if (colon <= 0) return { local: { offset: node.start, length: raw.length } };
	return {
		prefix: { offset: node.start, length: colon },
		local: { offset: node.start + colon + 1, length: raw.length - colon - 1 },
	};
}

function pushNameTokens(
	node: Node,
	kind: SemanticTokenType,
	analysis: FileAnalysis,
	modifiers: SemanticTokenModifier[],
	out: RawToken[],
): void {
	const split = splitPrefixedName(node);
	if (!split) return;
	if (split.prefix) {
		const raw = firstTerminalValue(node) ?? "";
		const prefixText = raw.slice(0, split.prefix.length);
		const nsModifiers: SemanticTokenModifier[] = isDefaultLibraryPrefix(prefixText, analysis) ? ["defaultLibrary"] : [];
		out.push({ offset: split.prefix.offset, length: split.prefix.length, type: "namespace", modifiers: nsModifiers });
	}
	out.push({ offset: split.local.offset, length: split.local.length, type: kind, modifiers });
}

/** Element/attribute constructors: only the namespace-prefix part is classifiable (no "element" token type). */
function pushNamespaceOnly(node: Node | undefined, analysis: FileAnalysis, out: RawToken[]): void {
	if (!node) return;
	const raw = firstTerminalValue(node);
	if (!raw || raw.startsWith("Q{") || raw.startsWith("xmlns")) return;
	const colon = raw.indexOf(":");
	if (colon <= 0) return;
	const modifiers: SemanticTokenModifier[] = isDefaultLibraryPrefix(raw.slice(0, colon), analysis) ? ["defaultLibrary"] : [];
	out.push({ offset: node.start, length: colon, type: "namespace", modifiers });
}

const KEYWORD_TERMINAL_RE = /^'[A-Za-z]+'$/;

function isKeywordTerminal(node: Terminal): boolean {
	return KEYWORD_TERMINAL_RE.test(node.type) && /^[A-Za-z]+$/.test(node.value);
}

function buildUnusedOffsets(ast: Node, analysis: FileAnalysis): Set<number> {
	const offsets = new Set<number>();
	for (const d of checkUnused(ast, analysis))
		if (d.code === "xq-lsp:unused-function" || d.code === "xq-lsp:unused-variable") offsets.add(d.offset);
	return offsets;
}

// ── AST walk ──────────────────────────────────────────────────────────────────

function walk(node: Node, analysis: FileAnalysis, allFns: FunctionSymbol[], unusedOffsets: Set<number>, out: RawToken[]): void {
	if (isTerminal(node)) {
		if (node.type === "StringLiteral") out.push({ offset: node.start, length: node.value.length, type: "string", modifiers: [] });
		else if (isKeywordTerminal(node)) out.push({ offset: node.start, length: node.value.length, type: "keyword", modifiers: [] });
		return;
	}

	const { children } = node as NonTerminal;

	switch (node.type) {
		case "FunctionCall": {
			const call = asFunctionCall(node, analysis);
			const eqname = directChildOf(node, "FunctionEQName");
			if (call && eqname) {
				const mods: SemanticTokenModifier[] = isDefaultLibraryFunction(call.qname, allFns) ? ["defaultLibrary"] : [];
				pushNameTokens(eqname, "function", analysis, mods, out);
			}
			for (const c of children) walk(c, analysis, allFns, unusedOffsets, out);
			return;
		}

		case "NamedFunctionRef": {
			const ref = asNamedFunctionRef(node, analysis);
			const eqname = directChildOf(node, "EQName");
			if (ref && eqname) {
				const mods: SemanticTokenModifier[] = isDefaultLibraryFunction(ref.qname, allFns) ? ["defaultLibrary"] : [];
				pushNameTokens(eqname, "function", analysis, mods, out);
			}
			return;
		}

		case "VarRef": {
			const varNameNode = directChildOf(node, "VarName");
			if (varNameNode) pushNameTokens(varNameNode, "variable", analysis, ["readonly"], out);
			return;
		}

		case "AnnotatedDecl": {
			const fnDeclNode = directChildOf(node, "FunctionDecl");
			if (fnDeclNode) {
				const fn = asFunctionDecl(fnDeclNode, analysis);
				if (fn) {
					const mods: SemanticTokenModifier[] = unusedOffsets.has(fn.nameNode.start) ? ["unused"] : [];
					pushNameTokens(fn.nameNode, "function", analysis, mods, out);
					const paramList = directChildOf(fnDeclNode, "ParamList");
					for (const p of paramList ? directChildrenOf(paramList, "Param") : []) {
						const peq = directChildOf(p, "EQName");
						if (peq) pushNameTokens(peq, "parameter", analysis, ["readonly"], out);
					}
					if (fn.body) walk(fn.body, analysis, allFns, unusedOffsets, out);
				}
				return;
			}
			const varDeclNode = directChildOf(node, "VarDecl");
			if (varDeclNode) {
				const v = asVarDecl(varDeclNode, analysis);
				if (v) {
					const mods: SemanticTokenModifier[] = ["readonly"];
					if (unusedOffsets.has(v.nameNode.start)) mods.push("unused");
					pushNameTokens(v.nameNode, "variable", analysis, mods, out);
				}
				for (const c of (varDeclNode as NonTerminal).children) walk(c, analysis, allFns, unusedOffsets, out);
				return;
			}
			for (const c of children) walk(c, analysis, allFns, unusedOffsets, out);
			return;
		}

		case "LetBinding":
		case "ForBinding": {
			const varNameNode = directChildOf(node, "VarName");
			if (varNameNode) pushNameTokens(varNameNode, "variable", analysis, ["readonly"], out);
			for (const c of children) if (c !== varNameNode) walk(c, analysis, allFns, unusedOffsets, out);
			return;
		}

		case "InlineFunctionExpr": {
			const paramList = directChildOf(node, "ParamList");
			for (const p of paramList ? directChildrenOf(paramList, "Param") : []) {
				const peq = directChildOf(p, "EQName");
				if (peq) pushNameTokens(peq, "parameter", analysis, ["readonly"], out);
			}
			const body = directChildOf(node, "FunctionBody");
			if (body) walk(body, analysis, allFns, unusedOffsets, out);
			return;
		}

		case "DirElemConstructor":
			pushNamespaceOnly(directChildOf(node, "QName"), analysis, out);
			for (const c of children) walk(c, analysis, allFns, unusedOffsets, out);
			return;

		case "CompElemConstructor":
		case "CompAttrConstructor":
			pushNamespaceOnly(directChildOf(node, "EQName"), analysis, out);
			for (const c of children) walk(c, analysis, allFns, unusedOffsets, out);
			return;

		default:
			for (const c of children) walk(c, analysis, allFns, unusedOffsets, out);
	}
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Walk the AST once and produce the delta-encoded `data` array for
 * `textDocument/semanticTokens/full`. Returns `[]` when `ast` is null
 * (the file failed to parse — the regex-fallback analysis has no AST to walk).
 */
export function getSemanticTokensData(
	ast: Node | null,
	text: string,
	analysis: FileAnalysis,
	importedAnalyses: Map<string, FileAnalysis>,
): number[] {
	if (!ast) return [];

	const allFns = allFunctionsFlat(analysis, importedAnalyses);
	const unusedOffsets = buildUnusedOffsets(ast, analysis);
	const rawTokens: RawToken[] = [];
	walk(ast, analysis, allFns, unusedOffsets, rawTokens);

	const lineStarts = computeLineStarts(text);
	const encoded: EncodedToken[] = rawTokens.map((t) => {
		const pos = offsetToPosition(lineStarts, t.offset);
		return {
			line: pos.line,
			character: pos.character,
			length: t.length,
			tokenType: TOKEN_TYPE_INDEX[t.type],
			tokenModifiers: modifierBitmask(t.modifiers),
		};
	});

	return encodeSemanticTokens(encoded);
}
