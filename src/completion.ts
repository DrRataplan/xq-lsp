import { CompletionItem, CompletionItemKind, InsertTextFormat, MarkupKind } from "vscode-languageserver/node.js";
import { getCompletions as getCoreCompletions } from "./completion-core.ts";

export type { CompletionContext } from "./completion-core.ts";

export function getCompletions(
	...args: Parameters<typeof getCoreCompletions>
): CompletionItem[] {
	return getCoreCompletions(...args).map((e) => ({
		label: e.label,
		kind: e.kind === "function" ? CompletionItemKind.Function : CompletionItemKind.Variable,
		detail: e.detail,
		documentation: e.documentation ? { kind: MarkupKind.Markdown, value: e.documentation } : undefined,
		insertText: e.insertText,
		insertTextFormat: e.isSnippet ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
	}));
}
