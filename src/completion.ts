import { CompletionItem, CompletionItemKind, InsertTextFormat, MarkupKind } from "vscode-languageserver/node.js";
import type { FileAnalysis } from "./types.ts";
import { getCompletions as getCoreCompletions } from "./completion-core.ts";
import type { CompletionContext } from "./completion-core.ts";
import { findImportInsertPosition, findDeclareNsInsertPosition, computeRelativePath } from "./namespace-diagnostics.ts";

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
		}

		return item;
	});
}
