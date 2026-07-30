import { CompletionItem, CompletionItemKind, InsertTextFormat, MarkupKind } from "vscode-languageserver/node.js";
import type { FileAnalysis } from "./types.ts";
import { getCompletions as getCoreCompletions } from "./completion-core.ts";
import type { CompletionContext } from "./completion-core.ts";
import { findImportInsertPosition, findDeclareNsInsertPosition, computeRelativePath } from "./namespace-diagnostics.ts";
import { offsetToPosition } from "./references.ts";

export type { CompletionContext } from "./completion-core.ts";

export interface EditContext {
	docText: string;
	docUri: string;
	generateLocationHints: boolean;
}

export function getCompletions(
	ctx: CompletionContext,
	currentAnalysis: FileAnalysis,
	importedAnalyses: Map<string, FileAnalysis>,
	snippets?: boolean,
	lastValidAnalysis?: FileAnalysis,
	availableAnalyses?: Map<string, FileAnalysis>,
	knownNamespaces?: Map<string, string>,
	editContext?: EditContext,
): CompletionItem[] {
	return getCoreCompletions(ctx, currentAnalysis, importedAnalyses, snippets, lastValidAnalysis, availableAnalyses, knownNamespaces).map((e) => {
		const item: CompletionItem = {
			label: e.label,
			kind: e.kind === "function"
				? CompletionItemKind.Function
				: e.kind === "namespace"
					? CompletionItemKind.Module
					: CompletionItemKind.Variable,
			detail: e.detail,
			documentation: e.documentation ? { kind: MarkupKind.Markdown, value: e.documentation } : undefined,
			insertText: e.insertText,
			insertTextFormat: e.isSnippet ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
		};

		if (e.additionalEdit && editContext) {
			const { docText, docUri, generateLocationHints } = editContext;
			const insertPos = e.additionalEdit.kind === "import-module"
				? findImportInsertPosition(docText)
				: findDeclareNsInsertPosition(docText);
			let newText: string;
			if (e.additionalEdit.kind === "import-module") {
				const atPath = generateLocationHints && e.additionalEdit.sourceUri
					? computeRelativePath(docUri, e.additionalEdit.sourceUri)
					: undefined;
				newText = atPath
					? `import module namespace ${e.additionalEdit.prefix} = "${e.additionalEdit.namespaceUri}" at "${atPath}";\n`
					: `import module namespace ${e.additionalEdit.prefix} = "${e.additionalEdit.namespaceUri}";\n`;
			} else {
				newText = `declare namespace ${e.additionalEdit.prefix} = "${e.additionalEdit.namespaceUri}";\n`;
			}
			item.additionalTextEdits = [{ range: { start: insertPos, end: insertPos }, newText }];

			// The "declare namespace" entry's own insertText is just an echo of what's already
			// typed after the prefix (often ""). Some clients (e.g. eglot) fall back to inserting
			// the item's label verbatim at the cursor when insertText is empty, which would dump
			// the whole `declare namespace tei = "...";` statement inline. An explicit textEdit
			// with a concrete range forces every spec-compliant client onto the deterministic
			// replace path instead of guessing, so only the additionalTextEdit above lands the text.
			if (e.additionalEdit.kind === "declare-namespace") {
				const start = ctx.cursorOffset - e.insertText.length;
				item.textEdit = {
					range: { start: offsetToPosition(docText, start), end: offsetToPosition(docText, ctx.cursorOffset) },
					newText: e.insertText,
				};
			}
		}

		return item;
	});
}
