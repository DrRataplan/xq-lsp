import { CompletionItem, CompletionItemKind, InsertTextFormat, MarkupKind } from "vscode-languageserver/node.js";
import type { FileAnalysis, FunctionSymbol, VariableSymbol } from "./types.ts";
import { resolvePrefix } from "./analyzer.ts";

export interface CompletionContext {
	/** Text from start of document up to (and including) the cursor position */
	textBeforeCursor: string;
	/** Character offset of the cursor in the document */
	cursorOffset: number;
}

interface TokenInfo {
	kind: "variable" | "qualified-name" | "name";
	/** Prefix typed so far — used to filter completions */
	prefix: string;
	/** For qualified names, the namespace prefix before the colon */
	nsPrefix?: string;
}

type SyntaxContext =
	| { kind: "after-declare" }
	| { kind: "after-import" }
	| { kind: "after-for-in" }
	| { kind: "after-let-assign" }
	| { kind: "after-return" }
	| { kind: "after-then" }
	| { kind: "after-else" }
	| { kind: "after-satisfies" }
	| { kind: "after-operator" }
	| { kind: "top-level" }
	| { kind: "expression" };

function detectContext(textBefore: string): SyntaxContext {
	const tail = textBefore.slice(-200);

	if (/\bdeclare\s+%[\w:]+(?:\([^)]*\))?\s+$/i.test(tail)) return { kind: "after-declare" };
	if (/\bdeclare\s+$/i.test(tail)) return { kind: "after-declare" };
	if (/\bimport\s+$/i.test(tail)) return { kind: "after-import" };
	if (/\bfor\s+\$[\w:\-]+(?:\s+as\s+\S+)?\s+$/i.test(tail)) return { kind: "after-for-in" };
	if (/\blet\s+\$[\w:\-]+\s*:=\s+$/.test(tail)) return { kind: "after-let-assign" };
	if (/\breturn\s+$/i.test(tail)) return { kind: "after-return" };
	if (/\bthen\s+$/i.test(tail)) return { kind: "after-then" };
	if (/\belse\s+$/i.test(tail)) return { kind: "after-else" };
	if (/\bsatisfies\s+$/i.test(tail)) return { kind: "after-satisfies" };
	if (/(?:[+\-*]|div|idiv|mod|and|or|eq|ne|lt|le|gt|ge|=|!=|<=|>=|,|\()\s*$/.test(tail)) return { kind: "after-operator" };
	return { kind: "expression" };
}

const DECLARE_KEYWORDS = ["function", "variable", "namespace", "option", "default"];
const IMPORT_KEYWORDS = ["module", "schema"];

function buildKeywordItem(word: string): CompletionItem {
	return {
		label: word,
		kind: CompletionItemKind.Keyword,
		insertText: word,
		insertTextFormat: InsertTextFormat.PlainText,
	};
}

function parseToken(textBefore: string): TokenInfo {
	const match = textBefore.match(/\$([\w:\-]*)$|(?:([\w\-]+):)([\w\-]*)$|([\w\-]+)$/);
	if (!match) return { kind: "name", prefix: "" };

	if (match[0].startsWith("$")) {
		return { kind: "variable", prefix: match[1] ?? "" };
	}
	if (match[2] !== undefined) {
		return { kind: "qualified-name", nsPrefix: match[2], prefix: match[3] ?? "" };
	}
	return { kind: "name", prefix: match[4] ?? "" };
}

function functionDoc(fn: FunctionSymbol): string {
	const paramStr = fn.params.map((p) => `$${p.name}${p.type ? " as " + p.type : ""}`).join(", ");
	const ret = fn.returnType ? ` as ${fn.returnType}` : "";
	const sig = `\`\`\`xquery\ndeclare function ${fn.name}(${paramStr})${ret}\n\`\`\``;

	if (!fn.doc) return sig;

	const parts: string[] = [sig];
	if (fn.doc.description) parts.push(fn.doc.description);

	const paramDocs = fn.params.filter((p) => p.description);
	if (paramDocs.length > 0) {
		parts.push(paramDocs.map((p) => `- \`$${p.name}\` — ${p.description}`).join("\n"));
	}
	if (fn.doc.returns) parts.push(`**Returns:** ${fn.doc.returns}`);

	return parts.join("\n\n");
}

function localInsertText(fn: FunctionSymbol, snippets: boolean): string {
	if (fn.params.length === 0) return fn.localName + "()";
	const args = snippets
		? fn.params.map((p, i) => `\${${i + 1}:\\$${p.name}}`).join(", ")
		: fn.params.map((p) => `$${p.name}`).join(", ");
	return `${fn.localName}(${args})`;
}

function buildVariableItem(v: VariableSymbol, filter: string): CompletionItem | null {
	if (filter && !v.name.toLowerCase().startsWith(filter.toLowerCase())) return null;
	return {
		label: `$${v.name}`,
		kind: CompletionItemKind.Variable,
		insertText: `$${v.name}`,
		insertTextFormat: InsertTextFormat.PlainText,
	};
}

export function getCompletions(
	ctx: CompletionContext,
	currentAnalysis: FileAnalysis,
	importedAnalyses: Map<string, FileAnalysis>,
	snippets = false,
): CompletionItem[] {
	const token = parseToken(ctx.textBeforeCursor);
	const items: CompletionItem[] = [];

	// ── Variable completions ─────────────────────────────────────────────────

	if (token.kind === "variable") {
		for (const v of currentAnalysis.moduleVariables) {
			const item = buildVariableItem(v, token.prefix);
			if (item) items.push(item);
		}
		for (const v of currentAnalysis.localBindings) {
			if (v.offset < ctx.cursorOffset) {
				const item = buildVariableItem(v, token.prefix);
				if (item) items.push(item);
			}
		}
		for (const analysis of importedAnalyses.values()) {
			for (const v of analysis.moduleVariables) {
				const item = buildVariableItem(v, token.prefix);
				if (item) items.push(item);
			}
		}
		return items;
	}

	// ── Qualified-name completions (user typed "ns:partial") ─────────────────

	if (token.kind === "qualified-name" && token.nsPrefix) {
		const targetUri = resolvePrefix(token.nsPrefix, currentAnalysis);
		const filter = token.prefix.toLowerCase();

		const allFns = [...currentAnalysis.functions, ...[...importedAnalyses.values()].flatMap((a) => a.functions)];

		for (const fn of allFns) {
			if (fn.namespaceUri !== targetUri) continue;
			if (filter && !fn.localName.toLowerCase().includes(filter)) continue;
			items.push({
				label: fn.localName,
				kind: CompletionItemKind.Function,
				detail: `${fn.localName}#${fn.arity}`,
				documentation: { kind: MarkupKind.Markdown, value: functionDoc(fn) },
				insertText: localInsertText(fn, snippets),
				insertTextFormat: snippets ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
			});
		}
		return items;
	}

	// ── Plain-name completions ───────────────────────────────────────────────

	const filter = token.prefix.toLowerCase();
	const defaultUri = currentAnalysis.defaultFunctionNamespace;
	const syntaxCtx = detectContext(ctx.textBeforeCursor);

	// Context-restricted completions
	if (syntaxCtx.kind === "after-declare") {
		for (const kw of DECLARE_KEYWORDS) {
			if (!filter || kw.startsWith(filter)) items.push(buildKeywordItem(kw));
		}
		return items;
	}

	if (syntaxCtx.kind === "after-import") {
		for (const kw of IMPORT_KEYWORDS) {
			if (!filter || kw.startsWith(filter)) items.push(buildKeywordItem(kw));
		}
		return items;
	}

	if (syntaxCtx.kind === "after-for-in") {
		if (!filter || "in".startsWith(filter)) items.push(buildKeywordItem("in"));
		return items;
	}

	// Functions declared in the current file (full qualified name)
	for (const fn of currentAnalysis.functions) {
		if (filter && !fn.name.toLowerCase().includes(filter)) continue;
		items.push({
			label: fn.name,
			kind: CompletionItemKind.Function,
			detail: `${fn.name}#${fn.arity}`,
			documentation: { kind: MarkupKind.Markdown, value: functionDoc(fn) },
			insertText: snippets
				? fn.params.length === 0
					? fn.name + "()"
					: fn.name + "(" + fn.params.map((p, i) => `\${${i + 1}:\\$${p.name}}`).join(", ") + ")"
				: fn.name + "(" + fn.params.map((p) => `$${p.name}`).join(", ") + ")",
			insertTextFormat: snippets ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
		});
	}

	// Imported functions: those in the default function namespace are offered
	// without prefix (since they can be called unqualified); others with full name.
	for (const analysis of importedAnalyses.values()) {
		for (const fn of analysis.functions) {
			if (fn.namespaceUri === defaultUri) {
				if (filter && !fn.localName.toLowerCase().includes(filter)) continue;
				items.push({
					label: fn.localName,
					kind: CompletionItemKind.Function,
					detail: `${fn.localName}#${fn.arity}`,
					documentation: { kind: MarkupKind.Markdown, value: functionDoc(fn) },
					insertText: localInsertText(fn, snippets),
					insertTextFormat: snippets ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
				});
			} else {
				if (filter && !fn.name.toLowerCase().includes(filter)) continue;
				items.push({
					label: fn.name,
					kind: CompletionItemKind.Function,
					detail: `${fn.name}#${fn.arity}`,
					documentation: { kind: MarkupKind.Markdown, value: functionDoc(fn) },
					insertText: snippets
						? fn.params.length === 0
							? fn.name + "()"
							: fn.name + "(" + fn.params.map((p, i) => `\${${i + 1}:\\$${p.name}}`).join(", ") + ")"
						: fn.name + "(" + fn.params.map((p) => `$${p.name}`).join(", ") + ")",
					insertTextFormat: snippets ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
				});
			}
		}
	}

	return items;
}
