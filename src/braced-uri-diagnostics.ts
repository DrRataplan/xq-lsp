import type { Node } from "xq-parser";
import { findAll, firstTerminalValue } from "./analyzer.ts";

export interface BracedUriDiagnostic {
	message: string;
	code: "xq-lsp:braced-uri-whitespace";
	offset: number;
	length: number;
}

/**
 * Flag whitespace inside a `Q{uri}local` URIQualifiedName. The grammar treats it
 * as insignificant (trimmed and collapsed to single spaces), so two literals that
 * look different can name the same URI, and vice versa — easy to typo unnoticed.
 */
export function checkBracedUriWhitespace(ast: Node): BracedUriDiagnostic[] {
	const out: BracedUriDiagnostic[] = [];

	for (const node of findAll(ast, "URIQualifiedName")) {
		const raw = firstTerminalValue(node);
		if (!raw) continue;
		const close = raw.indexOf("}");
		if (close < 2) continue;
		const uri = raw.slice(2, close);
		if (!/\s/.test(uri)) continue;
		out.push({
			message: "Whitespace inside 'Q{...}' is insignificant (trimmed/collapsed by the grammar) and easy to misread — remove it to avoid ambiguity.",
			code: "xq-lsp:braced-uri-whitespace",
			offset: (node.start ?? 0) + 2,
			length: close - 2,
		});
	}

	return out;
}
