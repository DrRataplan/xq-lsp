import type { FileAnalysis, FunctionSymbol, VariableSymbol, ParamInfo } from "./types.ts";
import { formatQName } from "./types.ts";
import { resolvePrefix, nodeStackAtOffset, findAll } from "./analyzer.ts";

export interface CompletionContext {
	/** Text from start of document up to (and including) the cursor position */
	textBeforeCursor: string;
	/** Character offset of the cursor in the document */
	cursorOffset: number;
}

/** Carries enough information for the LSP adapter to build the additionalTextEdit. */
export interface AdditionalEdit {
	kind: "import-module" | "declare-namespace";
	prefix: string;
	namespaceUri: string;
	/** Source URI of the module file, used to compute the relative `at` path. */
	sourceUri?: string;
}

export interface CompletionEntry {
	label: string;
	kind: "function" | "variable" | "namespace";
	detail?: string;
	documentation?: string; // markdown
	insertText: string;
	isSnippet: boolean;
	additionalEdit?: AdditionalEdit;
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
	return { label, kind: "variable", documentation: v.doc, insertText: label, isSnippet: false };
}

function buildParamEntry(p: ParamInfo, filter: string): CompletionEntry | null {
	if (filter && !p.name.toLowerCase().startsWith(filter.toLowerCase())) return null;
	return {
		label: `$${p.name}`,
		kind: "variable",
		detail: p.type ? `as ${p.type}` : undefined,
		insertText: `$${p.name}`,
		isSnippet: false,
	};
}

/** Find the function symbol enclosing the cursor using the AST. */
function findEnclosingFunction(
	ast: NonNullable<FileAnalysis["ast"]>,
	cursorOffset: number,
	functions: FunctionSymbol[],
): { fn: FunctionSymbol; bodyStart: number; bodyEnd: number } | null {
	const stack = nodeStackAtOffset(ast, cursorOffset);
	const bodyNode = stack.slice().reverse().find((n) => n.type === "FunctionBody");
	if (!bodyNode || bodyNode.start === undefined || bodyNode.end == null) return null;
	const annotatedNode = stack.find((n) => n.type === "AnnotatedDecl");
	if (!annotatedNode || annotatedNode.start === undefined) return null;
	const fn = functions.find((f) => f.sourceOffset === annotatedNode.start);
	if (!fn) return null;
	return { fn, bodyStart: bodyNode.start, bodyEnd: bodyNode.end };
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

/** Return the source URI for a module's analysis (taken from the first known symbol). */
function moduleSourceUri(analysis: FileAnalysis): string | undefined {
	return analysis.functions[0]?.sourceUri ?? analysis.moduleVariables[0]?.sourceUri;
}

export function getCompletions(
	ctx: CompletionContext,
	currentAnalysis: FileAnalysis,
	importedAnalyses: Map<string, FileAnalysis>,
	snippets = false,
	lastValidAnalysis?: FileAnalysis,
	/** Modules available in the workspace but not yet imported in the current file. Keyed by namespace URI. */
	availableAnalyses?: Map<string, FileAnalysis>,
	/** Known namespace prefix → URI mappings (from config / glob scans) for pure XML namespaces. */
	knownNamespaces?: Map<string, string>,
): CompletionEntry[] {
	const token = parseToken(ctx.textBeforeCursor);
	const items: CompletionEntry[] = [];

	if (token.kind === "variable") {
		const filter = token.prefix;

		// Module-level variables are always visible
		for (const v of currentAnalysis.moduleVariables) {
			const e = buildVariableEntry(v, filter);
			if (e) items.push(e);
		}

		// Prefer the current AST; fall back to the last successfully-parsed one for scope analysis
		const scopeAst = currentAnalysis.ast ?? lastValidAnalysis?.ast;
		if (scopeAst) {
			const enclosing = findEnclosingFunction(scopeAst, ctx.cursorOffset, currentAnalysis.functions);
			if (enclosing) {
				// Inside a function body: params + local bindings within this body before cursor
				for (const p of enclosing.fn.params) {
					const e = buildParamEntry(p, filter);
					if (e) items.push(e);
				}
				for (const v of currentAnalysis.localBindings) {
					if (v.offset > enclosing.bodyStart && v.offset < ctx.cursorOffset && v.offset < enclosing.bodyEnd) {
						const e = buildVariableEntry(v, filter);
						if (e) items.push(e);
					}
				}
			} else {
				// In query body: exclude local bindings that live inside function bodies
				const functionBodyRanges = findAll(scopeAst, "FunctionBody")
					.filter((b) => b.start !== undefined && b.end != null)
					.map((b) => ({ start: b.start as number, end: b.end as number }));
				for (const v of currentAnalysis.localBindings) {
					if (v.offset >= ctx.cursorOffset) continue;
					if (functionBodyRanges.some((r) => v.offset >= r.start && v.offset <= r.end)) continue;
					const e = buildVariableEntry(v, filter);
					if (e) items.push(e);
				}
			}
		} else {
			// No AST ever available: simple offset-based filter, no function-param completions
			for (const v of currentAnalysis.localBindings) {
				if (v.offset < ctx.cursorOffset) {
					const e = buildVariableEntry(v, filter);
					if (e) items.push(e);
				}
			}
		}

		// Imported module-level variables — rewrite prefix to the one used in the current module
		for (const analysis of importedAnalyses.values()) {
			for (const v of analysis.moduleVariables) {
				const localPrefix = currentAnalysis.imports.find(
					(i) => i.namespaceUri === v.qname.namespaceUri,
				)?.prefix;
				const displayVar =
					localPrefix !== undefined && localPrefix !== v.qname.prefix
						? { ...v, qname: { ...v.qname, prefix: localPrefix } }
						: v;
				const e = buildVariableEntry(displayVar, filter);
				if (e) items.push(e);
			}
		}

		// Variables from modules available in the workspace but not yet imported
		if (availableAnalyses) {
			const colonIdx = filter.indexOf(":");
			if (colonIdx >= 0) {
				const nsPrefix = filter.slice(0, colonIdx);
				const localFilter = filter.slice(colonIdx + 1).toLowerCase();
				const nsUri = resolvePrefix(nsPrefix, currentAnalysis);
				if (nsUri.startsWith("urn:xq-lsp:undeclared:")) {
					for (const [moduleNsUri, analysis] of availableAnalyses) {
						if (analysis.modulePrefix !== nsPrefix) continue;
						const sourceUri = moduleSourceUri(analysis);
						for (const v of analysis.moduleVariables) {
							if (localFilter && !v.qname.localName.toLowerCase().startsWith(localFilter)) continue;
							const displayQName = { ...v.qname, prefix: nsPrefix };
							items.push({
								label: `$${formatQName(displayQName)}`,
								kind: "variable",
								insertText: `$${formatQName(displayQName)}`,
								isSnippet: false,
								additionalEdit: { kind: "import-module", prefix: nsPrefix, namespaceUri: moduleNsUri, sourceUri },
							});
						}
					}
				}
			}
		}

		return items;
	}

	if (token.kind === "qualified-name" && token.nsPrefix) {
		const targetUri = resolvePrefix(token.nsPrefix, currentAnalysis);
		const filter = token.prefix.toLowerCase();

		if (!targetUri.startsWith("urn:xq-lsp:undeclared:")) {
			// Prefix is declared — show functions from current + imported analyses (no additionalEdit needed)
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

		// Prefix is undeclared — look for matching modules in the workspace
		let foundModule = false;
		if (availableAnalyses) {
			for (const [moduleNsUri, analysis] of availableAnalyses) {
				if (analysis.modulePrefix !== token.nsPrefix) continue;
				foundModule = true;
				const sourceUri = moduleSourceUri(analysis);
				for (const fn of analysis.functions) {
					if (filter && !fn.qname.localName.toLowerCase().includes(filter)) continue;
					items.push({
						...buildFunctionEntry(fn, fn.qname.localName, snippets),
						additionalEdit: { kind: "import-module", prefix: token.nsPrefix, namespaceUri: moduleNsUri, sourceUri },
					});
				}
			}
		}

		// Pure XML namespace (no module functions): offer a declare-namespace item if prefix is known
		if (!foundModule && knownNamespaces?.has(token.nsPrefix)) {
			const nsUri = knownNamespaces.get(token.nsPrefix)!;
			items.push({
				label: `declare namespace ${token.nsPrefix} = "${nsUri}"`,
				kind: "namespace",
				insertText: token.prefix,
				isSnippet: false,
				additionalEdit: { kind: "declare-namespace", prefix: token.nsPrefix, namespaceUri: nsUri },
			});
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
