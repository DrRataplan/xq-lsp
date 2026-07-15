import { SymbolInformation, SymbolKind } from "vscode-languageserver/node.js";
import type { FileRecord } from "./references.ts";
import { offsetToPosition } from "./references.ts";
import { formatQName } from "./types.ts";

/**
 * Fuzzy (case-insensitive substring) search for functions and module variables
 * across every glob-matched file, for `workspace/symbol`. An empty query matches
 * everything, per the LSP spec.
 */
export function getWorkspaceSymbols(files: FileRecord[], query: string): SymbolInformation[] {
	const q = query.toLowerCase();
	const symbols: SymbolInformation[] = [];

	for (const file of files) {
		for (const fn of file.analysis.functions) {
			const name = formatQName(fn.qname);
			if (q && !name.toLowerCase().includes(q)) continue;
			const pos = offsetToPosition(file.text, fn.sourceOffset ?? 0);
			symbols.push(SymbolInformation.create(name, SymbolKind.Function, { start: pos, end: pos }, file.uri));
		}

		for (const v of file.analysis.moduleVariables) {
			const name = `$${formatQName(v.qname)}`;
			if (q && !name.toLowerCase().includes(q)) continue;
			const pos = offsetToPosition(file.text, v.offset);
			symbols.push(SymbolInformation.create(name, SymbolKind.Variable, { start: pos, end: pos }, file.uri));
		}
	}

	return symbols;
}
