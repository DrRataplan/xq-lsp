import * as fs from "fs";
import { fileURLToPath } from "url";
import { SymbolKind } from "vscode-languageserver/node.js";
import type { CallHierarchyItem, CallHierarchyIncomingCall, CallHierarchyOutgoingCall, Position, Range } from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import type { Node } from "xq-parser";
import type { FileAnalysis, FunctionSymbol } from "./types.ts";
import { formatQName, qnameKey } from "./types.ts";
import { findAll, directChildOf, nodeStackAtOffset } from "./analyzer.ts";
import { asFunctionDecl, asFunctionCall } from "./ast-nodes.ts";
import { resolveFunctionAtOffset, allFunctions } from "./hover-core.ts";
import { getReferences } from "./references.ts";
import type { FileRecord } from "./references.ts";

/** Identifies the function a CallHierarchyItem refers to, round-tripped via `item.data`. */
interface CallHierarchyFunctionData {
	namespaceUri: string;
	localName: string;
	arity: number;
}

function toPosition(text: string, offset: number): Position {
	return TextDocument.create("file:///_scratch.xq", "xquery", 0, text).positionAt(offset);
}

function toOffset(text: string, position: Position): number {
	return TextDocument.create("file:///_scratch.xq", "xquery", 0, text).offsetAt(position);
}

/**
 * Offset where the local-name part of a name span begins, skipping any `prefix:`
 * qualifier — mirrors references.ts's localNameStart. Needed so selectionRange
 * (and the offset derived from it for incoming-calls lookup) lands on the
 * function's local name rather than its namespace prefix.
 */
function localNameStart(text: string, start: number, end: number): number {
	const slice = text.slice(start, end);
	const braceIdx = slice.lastIndexOf("}");
	if (braceIdx >= 0) return start + braceIdx + 1;
	const colonIdx = slice.indexOf(":");
	return colonIdx >= 0 ? start + colonIdx + 1 : start;
}

/** Reads the text of `uri`, reusing `currentText` when it's the file already in hand. */
function loadText(uri: string, currentUri: string, currentText: string): string | null {
	if (uri === currentUri) return currentText;
	try {
		return fs.readFileSync(fileURLToPath(uri), "utf-8");
	} catch {
		return null;
	}
}

/** The FileAnalysis whose `.ast` belongs to the same file `fn` was extracted from. */
function findOwningAnalysis(fn: FunctionSymbol, analysis: FileAnalysis, imported: Map<string, FileAnalysis>): FileAnalysis | undefined {
	if (analysis.functions.includes(fn)) return analysis;
	for (const a of imported.values()) if (a.functions.includes(fn)) return a;
	return undefined;
}

function findDeclNode(owner: FileAnalysis, fn: FunctionSymbol): { declNode: Node; fnDeclNode: Node } | null {
	if (!owner.ast || fn.sourceOffset === undefined) return null;
	const declNode = findAll(owner.ast, "AnnotatedDecl").find((a) => a.start === fn.sourceOffset);
	const fnDeclNode = declNode ? directChildOf(declNode, "FunctionDecl") : undefined;
	if (!declNode || !fnDeclNode) return null;
	return { declNode, fnDeclNode };
}

/**
 * Builds a CallHierarchyItem for `fn`, reading the declaring file's text when it
 * differs from `currentUri`/`currentText`. Returns null when the source can't be
 * read (e.g. a builtin/runtime function with a synthetic, non-file `sourceUri`).
 */
function buildItemForFunction(
	fn: FunctionSymbol,
	owner: FileAnalysis,
	currentUri: string,
	currentText: string,
): CallHierarchyItem | null {
	const text = loadText(fn.sourceUri, currentUri, currentText);
	if (text === null) return null;

	const found = findDeclNode(owner, fn);
	const shape = found ? asFunctionDecl(found.fnDeclNode, owner) : null;

	const declStart = found?.declNode.start ?? fn.sourceOffset ?? 0;
	const declEnd = found?.declNode.end ?? declStart;
	const rawNameEnd = shape?.nameNode.end ?? declStart;
	// Trim to the local-name part, excluding any "prefix:" qualifier (see localNameStart).
	const nameStart = shape?.nameNode.start !== undefined ? localNameStart(text, shape.nameNode.start, rawNameEnd) : declStart;
	const nameEnd = rawNameEnd;

	return {
		name: formatQName(fn.qname),
		kind: SymbolKind.Function,
		uri: fn.sourceUri,
		range: { start: toPosition(text, declStart), end: toPosition(text, declEnd) },
		selectionRange: { start: toPosition(text, nameStart), end: toPosition(text, nameEnd) },
		data: { namespaceUri: fn.qname.namespaceUri, localName: fn.qname.localName, arity: fn.arity } satisfies CallHierarchyFunctionData,
	};
}

/**
 * Resolve the function under the cursor (declaration name or call-site name) to a
 * `CallHierarchyItem[]`, the same way `getDefinition` resolves go-to-definition targets.
 */
export function prepareCallHierarchy(
	uri: string,
	text: string,
	offset: number,
	analysis: FileAnalysis,
	imported: Map<string, FileAnalysis>,
): CallHierarchyItem[] {
	const resolved = resolveFunctionAtOffset(text, offset, analysis, imported);
	if (!resolved) return [];
	const owner = findOwningAnalysis(resolved.fn, analysis, imported);
	if (!owner) return [];
	const item = buildItemForFunction(resolved.fn, owner, uri, text);
	return item ? [item] : [];
}

/**
 * Outgoing calls: every FunctionCall inside `item`'s function body, resolved to its
 * declared callee the same way `checkFunctionCalls` (functioncall-diagnostics.ts)
 * resolves overloads, grouped by target function.
 */
export function getOutgoingCalls(
	item: CallHierarchyItem,
	text: string,
	analysis: FileAnalysis,
	imported: Map<string, FileAnalysis>,
): CallHierarchyOutgoingCall[] {
	const data = item.data as CallHierarchyFunctionData | undefined;
	if (!data || !analysis.ast) return [];

	const fn = analysis.functions.find(
		(f) => f.qname.namespaceUri === data.namespaceUri && f.qname.localName === data.localName && f.arity === data.arity,
	);
	if (!fn) return [];

	const found = findDeclNode(analysis, fn);
	const shape = found ? asFunctionDecl(found.fnDeclNode, analysis) : null;
	if (!shape?.body) return []; // external function (no body) — nothing to walk

	const allFns = allFunctions(analysis, imported);
	const groups = new Map<string, { to: CallHierarchyItem; ranges: Range[] }>();

	for (const callNode of findAll(shape.body, "FunctionCall")) {
		const call = asFunctionCall(callNode, analysis);
		const fnEqname = directChildOf(callNode, "FunctionEQName");
		if (!call || !fnEqname) continue;

		const overloads = allFns.filter((f) => f.qname.namespaceUri === call.qname.namespaceUri && f.qname.localName === call.qname.localName);
		const target = overloads.find((f) => (f.variadic ? call.args.length >= f.arity : f.arity === call.args.length)) ?? overloads[0];
		if (!target) continue; // unresolved callee (unknown namespace/builtin we have no analysis for)

		const owner = findOwningAnalysis(target, analysis, imported);
		if (!owner) continue;

		const key = `${qnameKey(target.qname)}#${target.arity}`;
		let group = groups.get(key);
		if (!group) {
			const to = buildItemForFunction(target, owner, item.uri, text);
			if (!to) continue;
			group = { to, ranges: [] };
			groups.set(key, group);
		}
		group.ranges.push({ start: toPosition(text, fnEqname.start), end: toPosition(text, fnEqname.end ?? fnEqname.start) });
	}

	return [...groups.values()].map((g) => ({ to: g.to, fromRanges: g.ranges }));
}

/**
 * Incoming calls: every call site found by `getReferences` (cross-file, matched by
 * namespace + local name + arity), grouped by each call site's enclosing
 * `declare function` — found by walking up the AST from the call-site offset.
 */
export function getIncomingCalls(
	item: CallHierarchyItem,
	itemText: string,
	itemAnalysis: FileAnalysis,
	getOtherFiles: () => FileRecord[],
): CallHierarchyIncomingCall[] {
	const offset = toOffset(itemText, item.selectionRange.start);
	// includeDeclaration:false — we only want actual call sites, not the declaration itself.
	const callSites = getReferences(item.uri, itemText, offset, itemAnalysis, false, getOtherFiles);
	if (callSites.length === 0) return [];

	const fileByUri = new Map<string, FileRecord>(getOtherFiles().map((f) => [f.uri, f]));
	if (!fileByUri.has(item.uri)) fileByUri.set(item.uri, { uri: item.uri, text: itemText, analysis: itemAnalysis });

	const groups = new Map<string, { from: CallHierarchyItem; ranges: Range[] }>();

	for (const loc of callSites) {
		const record = fileByUri.get(loc.uri);
		if (!record?.analysis.ast) continue;

		const callOffset = toOffset(record.text, loc.range.start);
		const stack = nodeStackAtOffset(record.analysis.ast, callOffset);
		// Function declarations can't nest in XQuery, so at most one AnnotatedDecl/FunctionDecl
		// pair appears in the stack; a call at module level (no enclosing function) has none.
		const enclosingDecl = stack.find((n) => n.type === "AnnotatedDecl" && directChildOf(n, "FunctionDecl"));
		if (!enclosingDecl) continue;
		const enclosingFn = record.analysis.functions.find((f) => f.sourceOffset === enclosingDecl.start);
		if (!enclosingFn) continue;

		const key = `${qnameKey(enclosingFn.qname)}#${enclosingFn.arity}@${loc.uri}`;
		let group = groups.get(key);
		if (!group) {
			const from = buildItemForFunction(enclosingFn, record.analysis, loc.uri, record.text);
			if (!from) continue;
			group = { from, ranges: [] };
			groups.set(key, group);
		}
		group.ranges.push(loc.range);
	}

	return [...groups.values()].map((g) => ({ from: g.from, fromRanges: g.ranges }));
}
