import type { Node, NonTerminal } from "xq-parser";
import { Location, DocumentHighlight, DocumentHighlightKind } from "vscode-languageserver/node.js";
import type { FileAnalysis, QName } from "./types.ts";
import { qnameKey } from "./types.ts";
import { isTerminal, directChildOf, directChildrenOf, findAll, firstTerminalValue } from "./analyzer.ts";
import {
	asFunctionCall,
	asNamedFunctionRef,
	asVarRef,
	asVarName,
	asVarDecl,
	asFunctionDecl,
	asFunctionDeclaration,
	asBinding,
	asCatchClause,
} from "./ast-nodes.ts";
import { wordAt } from "./hover-core.ts";

/** A single file to include in a cross-file reference search. */
export interface FileRecord {
	uri: string;
	text: string;
	analysis: FileAnalysis;
}

export function offsetToPosition(text: string, offset: number) {
	const before = text.slice(0, offset);
	const lines = before.split("\n");
	return { line: lines.length - 1, character: lines[lines.length - 1].length };
}

function locAt(uri: string, text: string, start: number, end: number): Location {
	return Location.create(uri, { start: offsetToPosition(text, start), end: offsetToPosition(text, end) });
}

/**
 * Offset where the local-name part of a QName/EQName span begins, skipping any
 * namespace-prefix qualifier (`prefix:`) or URIQualifiedName brace (`Q{uri}`).
 * Used by rename to leave the qualifier untouched and only replace the identifier itself.
 */
function localNameStart(text: string, start: number, end: number): number {
	const slice = text.slice(start, end);
	const braceIdx = slice.lastIndexOf("}");
	if (braceIdx >= 0) return start + braceIdx + 1;
	const colonIdx = slice.indexOf(":");
	return colonIdx >= 0 ? start + colonIdx + 1 : start;
}

// ── Scope stack (tracks which declaration offset is active for each key) ────

class ScopeStack {
	private frames: Array<Map<string, number>> = [];
	push(): void {
		this.frames.push(new Map());
	}
	pop(): void {
		this.frames.pop();
	}
	add(key: string, declOffset: number): void {
		this.frames[this.frames.length - 1]?.set(key, declOffset);
	}
	resolve(key: string): number | undefined {
		for (let i = this.frames.length - 1; i >= 0; i--) {
			const found = this.frames[i].get(key);
			if (found !== undefined) return found;
		}
		return undefined;
	}
}

// ── Variable occurrences ─────────────────────────────────────────────────────

interface VarOccurrence {
	qname: QName;
	start: number;
	end: number;
	isDeclaration: boolean;
	/** Offset identifying the specific local declaration this resolves to; undefined means module-level. */
	declOffset?: number;
}

function addBinding(bindingNode: Node, analysis: FileAnalysis, scope: ScopeStack, out: VarOccurrence[]): void {
	const b = asBinding(bindingNode, analysis);
	if (!b) return;
	if (b.initExpr) walkVariables(b.initExpr, analysis, scope, out);
	const declOffset = b.nameNode.start;
	out.push({ qname: b.qname, start: declOffset, end: b.nameNode.end ?? declOffset, isDeclaration: true, declOffset });
	scope.add(qnameKey(b.qname), declOffset);
	if (b.positionalVar) {
		const pvOffset = b.positionalVar.nameNode.start;
		out.push({
			qname: b.positionalVar.qname,
			start: pvOffset,
			end: b.positionalVar.nameNode.end ?? pvOffset,
			isDeclaration: true,
			declOffset: pvOffset,
		});
		scope.add(qnameKey(b.positionalVar.qname), pvOffset);
	}
}

/**
 * Walk the AST collecting every variable declaration and reference.
 * Usages are scope-resolved against local declarations (let/for/param/etc.) so
 * shadowing is handled correctly; `declOffset` is left undefined when a usage
 * resolves outside any local scope (i.e. a module-level variable).
 */
function walkVariables(node: Node, analysis: FileAnalysis, scope: ScopeStack, out: VarOccurrence[]): void {
	if (isTerminal(node)) return;
	const { children } = node as NonTerminal;

	switch (node.type) {
		case "AnnotatedDecl": {
			const fnDeclNode = directChildOf(node, "FunctionDecl");
			const fn = fnDeclNode ? asFunctionDecl(fnDeclNode, analysis) : null;
			if (fn) {
				scope.push();
				for (const p of fn.params) {
					const declOffset = p.nameNode.start;
					out.push({
						qname: p.qname,
						start: declOffset,
						end: p.nameNode.end ?? declOffset,
						isDeclaration: true,
						declOffset,
					});
					scope.add(qnameKey(p.qname), declOffset);
				}
				if (fn.body) walkVariables(fn.body, analysis, scope, out);
				scope.pop();
				return;
			}
			const varDeclNode = directChildOf(node, "VarDecl");
			if (varDeclNode) {
				const v = asVarDecl(varDeclNode, analysis);
				if (v) out.push({ qname: v.qname, start: v.nameNode.start, end: v.nameNode.end ?? v.nameNode.start, isDeclaration: true });
				if (!isTerminal(varDeclNode)) for (const c of (varDeclNode as NonTerminal).children) walkVariables(c, analysis, scope, out);
				return;
			}
			return;
		}

		case "FLWORExpr": {
			// Each binding clause extends scope sequentially
			scope.push();
			for (const child of children) {
				if (isTerminal(child)) continue;
				const clause =
					child.type === "InitialClause" || child.type === "IntermediateClause"
						? ((child as NonTerminal).children.find((c) => !isTerminal(c)) ?? child)
						: child;
				switch (clause.type) {
					case "ForClause":
						for (const b of directChildrenOf(clause, "ForBinding")) addBinding(b, analysis, scope, out);
						break;
					case "LetClause":
						for (const b of directChildrenOf(clause, "LetBinding")) addBinding(b, analysis, scope, out);
						break;
					case "CountClause":
						addBinding(clause, analysis, scope, out);
						break;
					case "GroupByClause": {
						const specList = directChildOf(clause, "GroupingSpecList");
						for (const spec of specList ? directChildrenOf(specList, "GroupingSpec") : [])
							addBinding(spec, analysis, scope, out);
						break;
					}
					case "WindowClause": {
						const inner = directChildOf(clause, "TumblingWindowClause") ?? directChildOf(clause, "SlidingWindowClause");
						if (inner) addBinding(inner, analysis, scope, out);
						// Walk start/end conditions; window-vars bindings not yet scope-tracked
						for (const c of (clause as NonTerminal).children) if (!isTerminal(c)) walkVariables(c, analysis, scope, out);
						break;
					}
					default:
						walkVariables(clause, analysis, scope, out);
				}
			}
			scope.pop();
			return;
		}

		case "QuantifiedExpr": {
			// "some"/"every" $x in e1, $y in e2 satisfies e3 — flat child structure
			scope.push();
			for (const child of children) {
				if (isTerminal(child)) continue;
				if (child.type === "VarName") {
					const qname = asVarName(child, analysis);
					if (qname) {
						const declOffset = child.start;
						out.push({ qname, start: declOffset, end: child.end ?? declOffset, isDeclaration: true, declOffset });
						scope.add(qnameKey(qname), declOffset);
					}
				} else {
					walkVariables(child, analysis, scope, out);
				}
			}
			scope.pop();
			return;
		}

		case "CatchClause": {
			const cc = asCatchClause(node);
			if (cc) walkVariables(cc.body, analysis, scope, out);
			return;
		}

		case "VarRef": {
			const qname = asVarRef(node, analysis);
			const varNameNode = directChildOf(node, "VarName");
			if (qname && varNameNode) {
				out.push({
					qname,
					start: varNameNode.start,
					end: varNameNode.end ?? varNameNode.start,
					isDeclaration: false,
					declOffset: scope.resolve(qnameKey(qname)),
				});
			}
			return;
		}

		default:
			for (const child of children) walkVariables(child, analysis, scope, out);
	}
}

// ── Function occurrences ─────────────────────────────────────────────────────

interface FnOccurrence {
	qname: QName;
	arity: number;
	start: number;
	end: number;
	isDeclaration: boolean;
}

function walkFunctions(node: Node, analysis: FileAnalysis, out: FnOccurrence[]): void {
	if (isTerminal(node)) return;
	const { children } = node as NonTerminal;

	if (node.type === "AnnotatedDecl") {
		const fnDeclNode = directChildOf(node, "FunctionDecl");
		const fn = fnDeclNode ? asFunctionDeclaration(node, analysis) : null;
		if (fn) out.push({ qname: fn.qname, arity: fn.arity, start: fn.nameNode.start, end: fn.nameNode.end ?? fn.nameNode.start, isDeclaration: true });
	} else if (node.type === "FunctionCall") {
		const shape = asFunctionCall(node, analysis);
		const fnEqname = directChildOf(node, "FunctionEQName");
		if (shape && fnEqname)
			out.push({
				qname: shape.qname,
				arity: shape.args.length,
				start: fnEqname.start,
				end: fnEqname.end ?? fnEqname.start,
				isDeclaration: false,
			});
	} else if (node.type === "NamedFunctionRef") {
		const ref = asNamedFunctionRef(node, analysis);
		const eqname = directChildOf(node, "EQName");
		if (ref && eqname)
			out.push({ qname: ref.qname, arity: ref.arity, start: eqname.start, end: eqname.end ?? eqname.start, isDeclaration: false });
	}

	for (const child of children) walkFunctions(child, analysis, out);
}

// ── Namespace-prefix occurrences (same file only — prefixes are file-scoped) ─

function collectPrefixOccurrences(ast: Node, prefix: string): Array<{ start: number; end: number }> {
	const out: Array<{ start: number; end: number }> = [];

	// EQName expands (via the grammar) as EQName → QName → FunctionName → QName(terminal),
	// so a plain findAll(ast, "QName") would visit both the wrapper and the leaf for anything
	// that goes through EQName (declarations, variable refs). Restrict to terminals — there is
	// always exactly one per real name occurrence, regardless of how many non-terminal wrappers
	// surround it — to avoid double-counting.
	for (const node of findAll(ast, "QName")) {
		if (!isTerminal(node)) continue;
		const value = node.value;
		if (!value || value.startsWith("xmlns") || value.startsWith("Q{")) continue;
		const ci = value.indexOf(":");
		if (ci <= 0 || value.slice(0, ci) !== prefix) continue;
		out.push({ start: node.start, end: node.start + ci });
	}

	for (const node of findAll(ast, "Wildcard")) {
		if (!isTerminal(node)) continue;
		const value = node.value;
		if (!value) continue;
		const ci = value.indexOf(":");
		if (ci <= 0 || value.slice(0, ci) !== prefix) continue;
		out.push({ start: node.start, end: node.start + ci });
	}

	return out;
}

function getPrefixReferences(
	currentUri: string,
	currentText: string,
	ast: Node,
	analysis: FileAnalysis,
	prefix: string,
	includeDeclaration: boolean,
): Location[] {
	const locs = collectPrefixOccurrences(ast, prefix).map((o) => locAt(currentUri, currentText, o.start, o.end));

	if (includeDeclaration) {
		for (const imp of analysis.imports) {
			if (imp.prefix === prefix) locs.push(locAt(currentUri, currentText, imp.offset, imp.offset + prefix.length));
		}
		for (const nd of analysis.namespaceDecls) {
			if (nd.prefix === prefix && nd.offset >= 0) locs.push(locAt(currentUri, currentText, nd.offset, nd.offset + prefix.length));
		}
	}

	return locs;
}

// ── Cross-file orchestration ──────────────────────────────────────────────────

function getVariableReferences(
	currentUri: string,
	currentText: string,
	ast: Node,
	analysis: FileAnalysis,
	offset: number,
	includeDeclaration: boolean,
	getOtherFiles: () => FileRecord[],
	trimToLocalName = false,
): Location[] {
	const occurrences: VarOccurrence[] = [];
	walkVariables(ast, analysis, new ScopeStack(), occurrences);

	const target = occurrences.find((o) => offset >= o.start && offset <= o.end);
	if (!target) return [];

	const toLoc = (uri: string, text: string, o: VarOccurrence) =>
		locAt(uri, text, trimToLocalName ? localNameStart(text, o.start, o.end) : o.start, o.end);

	if (target.declOffset !== undefined) {
		// Local binding — scope is file-local, no cross-file search needed. Always has a
		// declaration by construction, so no renameability check is needed here.
		return occurrences
			.filter((o) => o.declOffset === target.declOffset && (includeDeclaration || !o.isDeclaration))
			.map((o) => toLoc(currentUri, currentText, o));
	}

	// Module-level variable — search current file plus every other file in the glob.
	const { namespaceUri, localName } = target.qname;
	const matches = (occs: VarOccurrence[]) =>
		occs.filter((o) => o.declOffset === undefined && o.qname.namespaceUri === namespaceUri && o.qname.localName === localName);

	const all: Array<{ uri: string; text: string; o: VarOccurrence }> = matches(occurrences).map((o) => ({
		uri: currentUri,
		text: currentText,
		o,
	}));

	for (const file of getOtherFiles()) {
		if (file.uri === currentUri || !file.analysis.ast) continue;
		const fileOccs: VarOccurrence[] = [];
		walkVariables(file.analysis.ast, file.analysis, new ScopeStack(), fileOccs);
		for (const o of matches(fileOccs)) all.push({ uri: file.uri, text: file.text, o });
	}

	// Renaming requires a resolvable declaration somewhere (rejects builtins/predeclared symbols).
	if (trimToLocalName && !all.some((m) => m.o.isDeclaration)) return [];

	return all.filter((m) => includeDeclaration || !m.o.isDeclaration).map((m) => toLoc(m.uri, m.text, m.o));
}

function getFunctionReferences(
	currentUri: string,
	currentText: string,
	ast: Node,
	analysis: FileAnalysis,
	offset: number,
	includeDeclaration: boolean,
	getOtherFiles: () => FileRecord[],
	trimToLocalName = false,
): Location[] {
	const occurrences: FnOccurrence[] = [];
	walkFunctions(ast, analysis, occurrences);

	const target = occurrences.find((o) => offset >= o.start && offset <= o.end);
	if (!target) return [];

	const { namespaceUri, localName } = target.qname;
	const { arity } = target;
	const matches = (occs: FnOccurrence[]) =>
		occs.filter((o) => o.qname.namespaceUri === namespaceUri && o.qname.localName === localName && o.arity === arity);

	const all: Array<{ uri: string; text: string; o: FnOccurrence }> = matches(occurrences).map((o) => ({
		uri: currentUri,
		text: currentText,
		o,
	}));

	for (const file of getOtherFiles()) {
		if (file.uri === currentUri || !file.analysis.ast) continue;
		const fileOccs: FnOccurrence[] = [];
		walkFunctions(file.analysis.ast, file.analysis, fileOccs);
		for (const o of matches(fileOccs)) all.push({ uri: file.uri, text: file.text, o });
	}

	// Renaming requires a resolvable declaration somewhere (rejects builtins/predeclared symbols).
	if (trimToLocalName && !all.some((m) => m.o.isDeclaration)) return [];

	return all
		.filter((m) => includeDeclaration || !m.o.isDeclaration)
		.map((m) => locAt(m.uri, m.text, trimToLocalName ? localNameStart(m.text, m.o.start, m.o.end) : m.o.start, m.o.end));
}

// ── Symbol classification (shared by find-references and rename) ────────────

type SymbolClassification = { kind: "prefix"; prefix: string } | { kind: "variable" } | { kind: "function" };

/**
 * Determine what kind of symbol sits at `offset` — a namespace prefix (clicking
 * the part of a name before the `:`, or the bare NCName on its own `import
 * module namespace` / `declare namespace` statement), a `$variable`, or a
 * function name — without resolving its occurrences yet.
 */
function classifySymbolAt(currentText: string, offset: number, analysis: FileAnalysis): SymbolClassification | null {
	const { word, start } = wordAt(currentText, offset);
	if (!word) return null;

	const colonIdx = word.indexOf(":");
	const onPrefixPart = colonIdx > 0 && offset <= start + colonIdx;
	if (onPrefixPart) return { kind: "prefix", prefix: word.slice(0, colonIdx) };

	// Clicking the bare NCName of an `import module namespace` or `declare namespace`
	// statement itself (no colon there — it's the prefix's declaration, not a usage).
	const onPrefixDecl =
		analysis.imports.some((i) => i.prefix === word && offset >= i.offset && offset <= i.offset + word.length) ||
		analysis.namespaceDecls.some(
			(nd) => nd.offset >= 0 && nd.prefix === word && offset >= nd.offset && offset <= nd.offset + word.length,
		);
	if (onPrefixDecl) return { kind: "prefix", prefix: word };

	const hasDollar = start > 0 && currentText[start - 1] === "$";
	return hasDollar ? { kind: "variable" } : { kind: "function" };
}

function prefixHasDeclaration(analysis: FileAnalysis, prefix: string): boolean {
	return analysis.imports.some((i) => i.prefix === prefix) || analysis.namespaceDecls.some((nd) => nd.prefix === prefix && nd.offset >= 0);
}

// ── Public entry points ───────────────────────────────────────────────────────

/**
 * Find all references to the symbol at `offset` in the current file.
 *
 * - `$var` — local bindings (let/for/param/etc.) are resolved scope-aware and
 *   searched within the current file only; module-level variables are searched
 *   across every file returned by `getOtherFiles`.
 * - function names — searched across every file returned by `getOtherFiles`,
 *   matched by namespace URI, local name, and arity.
 * - namespace prefixes — clicking the part of a name before the `:`, or the
 *   bare prefix NCName on its own `import module namespace` / `declare namespace`
 *   statement — searched within the current file only, since a prefix binding
 *   is file-scoped.
 *
 * Requires a valid AST (returns `[]` on the regex-fallback path, since parse
 * failures don't produce reliable node positions).
 * `getOtherFiles` is only invoked for symbol kinds that need a cross-file
 * search, so callers can make it lazy.
 */
export function getReferences(
	currentUri: string,
	currentText: string,
	offset: number,
	analysis: FileAnalysis,
	includeDeclaration: boolean,
	getOtherFiles: () => FileRecord[],
): Location[] {
	const ast = analysis.ast;
	if (!ast) return [];

	const target = classifySymbolAt(currentText, offset, analysis);
	if (!target) return [];

	if (target.kind === "prefix") return getPrefixReferences(currentUri, currentText, ast, analysis, target.prefix, includeDeclaration);
	if (target.kind === "variable") return getVariableReferences(currentUri, currentText, ast, analysis, offset, includeDeclaration, getOtherFiles);
	return getFunctionReferences(currentUri, currentText, ast, analysis, offset, includeDeclaration, getOtherFiles);
}

/**
 * Range of the renameable identifier at `offset`, trimmed to the local-name part
 * (namespace-prefix qualifiers are left untouched) or the bare prefix NCName for
 * a namespace-prefix rename. Returns `null` when there's nothing renameable at
 * `offset` (no word, or a prefix with no local declaration to update). Used by
 * `textDocument/prepareRename`.
 */
export function getRenameRangeAtOffset(currentText: string, offset: number, analysis: FileAnalysis): { start: number; end: number } | null {
	if (!analysis.ast) return null;
	const target = classifySymbolAt(currentText, offset, analysis);
	if (!target) return null;

	const { word, start } = wordAt(currentText, offset);
	if (target.kind === "prefix") {
		if (!prefixHasDeclaration(analysis, target.prefix)) return null;
		return { start, end: start + target.prefix.length };
	}

	const colonIdx = word.indexOf(":");
	return { start: colonIdx > 0 ? start + colonIdx + 1 : start, end: start + word.length };
}

/**
 * Locations to rewrite when renaming the symbol at `offset` (declaration plus
 * every reference, across files for module-scoped symbols), with each range
 * trimmed to just the identifier being renamed — any namespace-prefix qualifier
 * is left in place. Returns `null` when the symbol isn't renameable: nothing
 * recognizable at `offset`, or no resolvable local declaration (e.g. a builtin
 * function or a predeclared runtime namespace prefix).
 */
export function getRenameLocations(
	currentUri: string,
	currentText: string,
	offset: number,
	analysis: FileAnalysis,
	getOtherFiles: () => FileRecord[],
): Location[] | null {
	const ast = analysis.ast;
	if (!ast) return null;

	const target = classifySymbolAt(currentText, offset, analysis);
	if (!target) return null;

	if (target.kind === "prefix") {
		if (!prefixHasDeclaration(analysis, target.prefix)) return null;
		return getPrefixReferences(currentUri, currentText, ast, analysis, target.prefix, true);
	}

	const locs =
		target.kind === "variable"
			? getVariableReferences(currentUri, currentText, ast, analysis, offset, true, getOtherFiles, true)
			: getFunctionReferences(currentUri, currentText, ast, analysis, offset, true, getOtherFiles, true);

	return locs.length > 0 ? locs : null;
}

/**
 * Highlight every occurrence of the symbol at `offset` within the current
 * document only (`textDocument/documentHighlight` is file-scoped by spec, even
 * for module-level variables and functions that `getReferences` would otherwise
 * search for across files). Declaration sites are tagged `Write`, usages `Read`.
 * Spans are left untrimmed — a full `prefix:localName` highlights as one span,
 * matching how `getReferences` reports occurrences.
 */
export function getDocumentHighlights(currentText: string, offset: number, analysis: FileAnalysis): DocumentHighlight[] | null {
	const ast = analysis.ast;
	if (!ast) return null;

	const target = classifySymbolAt(currentText, offset, analysis);
	if (!target) return null;

	const toHighlight = (start: number, end: number, isDeclaration: boolean): DocumentHighlight =>
		DocumentHighlight.create(
			{ start: offsetToPosition(currentText, start), end: offsetToPosition(currentText, end) },
			isDeclaration ? DocumentHighlightKind.Write : DocumentHighlightKind.Read,
		);

	if (target.kind === "prefix") {
		const highlights = collectPrefixOccurrences(ast, target.prefix).map((o) => toHighlight(o.start, o.end, false));
		for (const imp of analysis.imports) {
			if (imp.prefix === target.prefix) highlights.push(toHighlight(imp.offset, imp.offset + target.prefix.length, true));
		}
		for (const nd of analysis.namespaceDecls) {
			if (nd.prefix === target.prefix && nd.offset >= 0) highlights.push(toHighlight(nd.offset, nd.offset + target.prefix.length, true));
		}
		return highlights.length > 0 ? highlights : null;
	}

	if (target.kind === "variable") {
		const occurrences: VarOccurrence[] = [];
		walkVariables(ast, analysis, new ScopeStack(), occurrences);
		const t = occurrences.find((o) => offset >= o.start && offset <= o.end);
		if (!t) return null;

		const matches =
			t.declOffset !== undefined
				? occurrences.filter((o) => o.declOffset === t.declOffset)
				: occurrences.filter(
						(o) => o.declOffset === undefined && o.qname.namespaceUri === t.qname.namespaceUri && o.qname.localName === t.qname.localName,
					);
		return matches.map((o) => toHighlight(o.start, o.end, o.isDeclaration));
	}

	const occurrences: FnOccurrence[] = [];
	walkFunctions(ast, analysis, occurrences);
	const t = occurrences.find((o) => offset >= o.start && offset <= o.end);
	if (!t) return null;

	const matches = occurrences.filter(
		(o) => o.qname.namespaceUri === t.qname.namespaceUri && o.qname.localName === t.qname.localName && o.arity === t.arity,
	);
	return matches.map((o) => toHighlight(o.start, o.end, o.isDeclaration));
}
