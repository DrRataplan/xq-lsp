import type { FileAnalysis, FunctionSymbol, VariableSymbol } from "./types.ts";
import { formatQName } from "./types.ts";
import { resolvePrefix } from "./analyzer.ts";

export interface CompletionContext {
	/** Text from start of document up to (and including) the cursor position */
	textBeforeCursor: string;
	/** Character offset of the cursor in the document */
	cursorOffset: number;
}

export interface CompletionEntry {
	label: string;
	kind: "function" | "variable";
	detail?: string;
	documentation?: string; // markdown
	insertText: string;
	isSnippet: boolean;
}

interface TokenInfo {
	kind: "variable" | "qualified-name" | "name";
	prefix: string;
	nsPrefix?: string;
}

function parseToken(textBefore: string): TokenInfo {
	const match = textBefore.match(/\$([\w:\-]*)$|(?:([\w\-]+):)([\w\-]*)$|([\w\-]+)$/);
	if (!match) return { kind: "name", prefix: "" };
	if (match[0].startsWith("$")) return { kind: "variable", prefix: match[1] ?? "" };
	if (match[2] !== undefined) return { kind: "qualified-name", nsPrefix: match[2], prefix: match[3] ?? "" };
	return { kind: "name", prefix: match[4] ?? "" };
}

export function functionDoc(fn: FunctionSymbol): string {
	const name = formatQName(fn.qname);
	const paramStr = fn.params.map((p) => `$${p.name}${p.type ? " as " + p.type : ""}`).join(", ");
	const ret = fn.returnType ? ` as ${fn.returnType}` : "";
	const sig = `\`\`\`xquery\ndeclare function ${name}(${paramStr})${ret}\n\`\`\``;
	if (!fn.doc) return sig;
	const parts: string[] = [sig];
	if (fn.doc.description) parts.push(fn.doc.description);
	const paramDocs = fn.params.filter((p) => p.description);
	if (paramDocs.length > 0)
		parts.push(paramDocs.map((p) => `- \`$${p.name}\` — ${p.description}`).join("\n"));
	if (fn.doc.returns) parts.push(`**Returns:** ${fn.doc.returns}`);
	return parts.join("\n\n");
}

function insertText(fn: FunctionSymbol, snippets: boolean, fullName: string): string {
	if (fn.params.length === 0) return fullName + "()";
	const args = snippets
		? fn.params.map((p, i) => `\${${i + 1}:\\$${p.name}}`).join(", ")
		: fn.params.map((p) => `$${p.name}`).join(", ");
	return `${fullName}(${args})`;
}

function buildVariableEntry(v: VariableSymbol, filter: string): CompletionEntry | null {
	const label = `$${formatQName(v.qname)}`;
	if (filter && !formatQName(v.qname).toLowerCase().startsWith(filter.toLowerCase())) return null;
	return { label, kind: "variable", insertText: label, isSnippet: false };
}

function buildFunctionEntry(fn: FunctionSymbol, label: string, snippets: boolean): CompletionEntry {
	return {
		label,
		kind: "function",
		detail: `${label}#${fn.arity}`,
		documentation: functionDoc(fn),
		insertText: insertText(fn, snippets, label),
		isSnippet: snippets && fn.params.length > 0,
	};
}

export function getCompletions(
	ctx: CompletionContext,
	currentAnalysis: FileAnalysis,
	importedAnalyses: Map<string, FileAnalysis>,
	snippets = false,
): CompletionEntry[] {
	const token = parseToken(ctx.textBeforeCursor);
	const items: CompletionEntry[] = [];

	if (token.kind === "variable") {
		const filter = token.prefix;
		for (const v of currentAnalysis.moduleVariables) {
			const e = buildVariableEntry(v, filter);
			if (e) items.push(e);
		}
		for (const v of currentAnalysis.localBindings) {
			if (v.offset < ctx.cursorOffset) {
				const e = buildVariableEntry(v, filter);
				if (e) items.push(e);
			}
		}
		for (const analysis of importedAnalyses.values()) {
			for (const v of analysis.moduleVariables) {
				const e = buildVariableEntry(v, filter);
				if (e) items.push(e);
			}
		}
		return items;
	}

	if (token.kind === "qualified-name" && token.nsPrefix) {
		const targetUri = resolvePrefix(token.nsPrefix, currentAnalysis);
		const filter = token.prefix.toLowerCase();
		const allFns = [
			...currentAnalysis.functions,
			...[...importedAnalyses.values()].flatMap((a) => a.functions),
		];
		for (const fn of allFns) {
			if (fn.qname.namespaceUri !== targetUri) continue;
			if (filter && !fn.qname.localName.toLowerCase().includes(filter)) continue;
			items.push(buildFunctionEntry(fn, fn.qname.localName, snippets));
		}
		return items;
	}

	const filter = token.prefix.toLowerCase();
	const defaultUri = currentAnalysis.defaultFunctionNamespace;

	for (const fn of currentAnalysis.functions) {
		const label = formatQName(fn.qname);
		if (filter && !label.toLowerCase().includes(filter)) continue;
		items.push(buildFunctionEntry(fn, label, snippets));
	}

	for (const analysis of importedAnalyses.values()) {
		for (const fn of analysis.functions) {
			const label =
				fn.qname.namespaceUri === defaultUri ? fn.qname.localName : formatQName(fn.qname);
			if (filter && !label.toLowerCase().includes(filter)) continue;
			items.push(buildFunctionEntry(fn, label, snippets));
		}
	}

	return items;
}
