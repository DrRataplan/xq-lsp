import {
	SignatureInformation,
	ParameterInformation,
	SymbolKind,
	MarkupKind,
} from "vscode-languageserver/node.js";
import type { Hover, SignatureHelp, DocumentSymbol, Range } from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { FileAnalysis } from "./types.ts";
import { formatQName } from "./types.ts";
import { resolvePrefix } from "./analyzer.ts";
import {
	wordAt,
	allFunctions,
	resolveFunction,
	functionSignature,
	callContextFromAst,
	resolveFunctionAtOffset,
} from "./hover-core.ts";

export { functionSignature, resolveFunctionAtOffset } from "./hover-core.ts";

function rangeFromOffset(doc: TextDocument, start: number, end: number): Range {
	return { start: doc.positionAt(start), end: doc.positionAt(end) };
}

// ── Hover ────────────────────────────────────────────────────────────────────

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
			let nameEnd = i;
			while (nameEnd > 0 && /\s/.test(text[nameEnd - 1])) nameEnd--;
			const { word, start } = wordAt(text, nameEnd - 1);
			if (!word) return null;
			return { name: word, activeParam: commas };
		}
		if (ch === "," && depth === 0) commas++;
		if ((ch === ";" || ch === "{") && depth === 0) return null;
	}
	return null;
}

function countCallArity(text: string, offset: number): number | undefined {
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
