import {
	SignatureInformation,
	ParameterInformation,
	SymbolKind,
	Location,
	MarkupKind,
} from "vscode-languageserver/node.js";
import type { Hover, SignatureHelp, DocumentSymbol, Range, Position } from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import * as fs from "fs";
import { fileURLToPath } from "url";
import type { FileAnalysis, FunctionSymbol } from "./types.ts";
import { resolvePrefix } from "./analyzer.ts";

// ── Shared helpers ───────────────────────────────────────────────────────────

/**
 * Resolve a qualified-name word (e.g. "fn:true", "m:sin", "true") to a FunctionSymbol
 * using proper namespace URI resolution against the current file's namespace context.
 */
function resolveFunction(
	word: string,
	currentAnalysis: FileAnalysis,
	fns: FunctionSymbol[],
): FunctionSymbol | undefined {
	const colonIdx = word.indexOf(":");
	const prefix = colonIdx >= 0 ? word.slice(0, colonIdx) : "";
	const localName = colonIdx >= 0 ? word.slice(colonIdx + 1) : word;
	const uri = resolvePrefix(prefix, currentAnalysis);
	return fns.find((f) => f.namespaceUri === uri && f.localName === localName);
}

function wordAt(text: string, offset: number): { word: string; start: number; end: number } {
	let start = offset;
	let end = offset;
	while (start > 0 && /[\w:\-]/.test(text[start - 1])) start--;
	while (end < text.length && /[\w:\-]/.test(text[end])) end++;
	return { word: text.slice(start, end), start, end };
}

function functionSignature(fn: FunctionSymbol): string {
	const params = fn.params.map((p) => `$${p.name}${p.type ? " as " + p.type : ""}`).join(", ");
	const ret = fn.returnType ? ` as ${fn.returnType}` : "";
	return `declare function ${fn.name}(${params})${ret}`;
}

function allFunctions(current: FileAnalysis, imported: Map<string, FileAnalysis>): FunctionSymbol[] {
	const fns = [...current.functions];
	for (const a of imported.values()) fns.push(...a.functions);
	return fns;
}

function positionInText(text: string, offset: number): Position {
	const before = text.slice(0, offset);
	const lines = before.split("\n");
	return { line: lines.length - 1, character: lines[lines.length - 1].length };
}

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
		const varName = word;
		const allVars = [
			...current.moduleVariables,
			...current.localBindings,
			...[...imported.values()].flatMap((a) => a.moduleVariables),
		];
		const v = allVars.find((v) => v.name === varName);
		if (v) {
			return {
				contents: { kind: MarkupKind.Markdown, value: `\`$${v.name}\`` },
				range: rangeFromOffset(doc, start - 1, end),
			};
		}
		return null;
	}

	// Check if hovering over a function name
	const fn = resolveFunction(word, current, allFunctions(current, imported));
	if (fn) {
		return {
			contents: {
				kind: MarkupKind.Markdown,
				value: "```xquery\n" + functionSignature(fn) + "\n```",
			},
			range: rangeFromOffset(doc, start, end),
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

export function getSignatureHelp(
	doc: TextDocument,
	offset: number,
	current: FileAnalysis,
	imported: Map<string, FileAnalysis>,
): SignatureHelp | null {
	const text = doc.getText();
	const call = findEnclosingCall(text, offset);
	if (!call) return null;

	const fn = resolveFunction(call.name, current, allFunctions(current, imported));
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
		activeParameter: Math.min(call.activeParam, fn.params.length - 1),
	};
}

// ── Document symbols ─────────────────────────────────────────────────────────

export function getDocumentSymbols(doc: TextDocument, current: FileAnalysis): DocumentSymbol[] {
	const symbols: DocumentSymbol[] = [];

	for (const fn of current.functions) {
		const pos = doc.positionAt(fn.sourceOffset ?? 0);
		const range: Range = { start: pos, end: pos };
		symbols.push({
			name: fn.name,
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
			name: `$${v.name}`,
			kind: SymbolKind.Variable,
			range,
			selectionRange: range,
		});
	}

	return symbols;
}

// ── Go to definition ─────────────────────────────────────────────────────────

export function getDefinition(
	doc: TextDocument,
	offset: number,
	current: FileAnalysis,
	imported: Map<string, FileAnalysis>,
	resolveUri: (atPath: string) => string,
): Location | null {
	const text = doc.getText();
	const { word, start } = wordAt(text, offset);
	if (!word) return null;

	const hasDollar = start > 0 && text[start - 1] === "$";

	if (hasDollar) {
		// Variable definition — search current file only
		const allVars = [...current.moduleVariables, ...current.localBindings];
		const v = allVars.find((v) => v.name === word);
		if (!v) return null;
		const pos = doc.positionAt(v.offset);
		return Location.create(doc.uri, { start: pos, end: pos });
	}

	// Function definition — resolve by namespace URI, search current file then all imports
	const colonIdx = word.indexOf(":");
	const wordPrefix = colonIdx >= 0 ? word.slice(0, colonIdx) : "";
	const wordLocalName = colonIdx >= 0 ? word.slice(colonIdx + 1) : word;
	const targetUri = resolvePrefix(wordPrefix, current);

	const localFn = current.functions.find((f) => f.namespaceUri === targetUri && f.localName === wordLocalName);
	if (localFn) {
		const pos = doc.positionAt(localFn.sourceOffset ?? 0);
		return Location.create(doc.uri, { start: pos, end: pos });
	}

	// Search imported files: find which atPath contains the function, then navigate there
	for (const imp of current.imports) {
		const analysis = imported.get(imp.atPath);
		if (!analysis) continue;
		const fn = analysis.functions.find((f) => f.namespaceUri === targetUri && f.localName === wordLocalName);
		if (!fn) continue;
		const uri = resolveUri(imp.atPath);
		let pos: Position = { line: 0, character: 0 };
		if (fn.sourceOffset !== undefined) {
			try {
				const filePath = fileURLToPath(uri);
				const srcText = fs.readFileSync(filePath, "utf-8");
				pos = positionInText(srcText, fn.sourceOffset);
			} catch {
				/* file not readable, use line 0 */
			}
		}
		return Location.create(uri, { start: pos, end: pos });
	}

	return null;
}
