import type { Node, NonTerminal } from "xq-parser";
import type { XQueryType, FileAnalysis, FunctionSymbol } from "./types.ts";
import { formatQName } from "./types.ts";
import { isTerminal } from "./analyzer.ts";

// Persistent memo for type inference, reused across calls (i.e. across edits of a document).
//
// A node's inferred type depends only on (a) the shape of the body it lives in — a function body
// or a variable value, which never influence each other —, and (b) the context that body is
// inferred in: function signatures, namespace declarations and the variable types in scope at
// its start. Both are digested into a key; as long as the key is unchanged after an edit, every
// node of the body keeps its type, even though the re-parse produced new node objects. Nodes are
// addressed by their position in a depth-first walk of the body, which is stable for equal shapes.

const MAX_BODIES = 512;

/** Types of one body's nodes, by depth-first index. */
type BodyMemo = Map<number, XQueryType>;

export interface BodyFrame {
	index: WeakMap<Node, number>;
	memo: BodyMemo;
}

const bodies = new Map<string, BodyMemo>(); // insertion order doubles as LRU order
let active: BodyFrame | undefined;

/** 53-bit string hash (cyrb53) — compact keys without a `node:crypto` dependency. */
function hash(s: string): string {
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;
	for (let i = 0; i < s.length; i++) {
		const c = s.charCodeAt(i);
		h1 = Math.imul(h1 ^ c, 2654435761);
		h2 = Math.imul(h2 ^ c, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// ── Digests ──────────────────────────────────────────────────────────────────

const signatureDigests = new WeakMap<FunctionSymbol, string>();
const signatureListDigests = new WeakMap<FunctionSymbol[], string>();

function asSignatureDigest(fn: FunctionSymbol): string {
	let d = signatureDigests.get(fn);
	if (d === undefined) {
		const params = fn.params.map((p) => p.type ?? "").join(",");
		d = `${formatQName(fn.qname)}#${fn.arity}${fn.variadic ? "+" : ""}(${params})${fn.returnType ?? ""}`;
		signatureDigests.set(fn, d);
	}
	return d;
}

/** Digest of everything about the declared functions that inference can observe. */
function signaturesDigest(allFns: FunctionSymbol[]): string {
	let d = signatureListDigests.get(allFns);
	if (d === undefined) {
		d = hash(allFns.map(asSignatureDigest).join("\n"));
		signatureListDigests.set(allFns, d);
	}
	return d;
}

function namespacesDigest(analysis: FileAnalysis): string {
	return hash(
		JSON.stringify([
			analysis.defaultFunctionNamespace,
			analysis.modulePrefix,
			analysis.moduleNamespaceUri,
			analysis.imports.map((i) => [i.prefix, i.namespaceUri]),
			analysis.namespaceDecls.map((n) => [n.prefix, n.namespaceUri]),
		]),
	);
}

function scopeDigest(scope: Map<string, XQueryType>, formatType: (t: XQueryType) => string): string {
	let s = "";
	for (const [key, t] of scope) s += `${key}=${formatType(t)}\n`;
	return hash(s);
}

/** Shape of a subtree, ignoring offsets and whitespace; also assigns the depth-first indexes. */
function indexBody(root: Node): { index: WeakMap<Node, number>; shape: string } {
	const index = new WeakMap<Node, number>();
	let h = "";
	let count = 0;
	const visit = (node: Node) => {
		index.set(node, count++);
		if (isTerminal(node)) {
			h += `"${node.value}`;
			return;
		}
		h += `(${node.type}`;
		for (const child of (node as NonTerminal).children) visit(child);
		h += ")";
	};
	visit(root);
	return { index, shape: hash(h) };
}

// ── Frames ───────────────────────────────────────────────────────────────────

export interface BodyContext {
	analysis: FileAnalysis;
	allFns: FunctionSymbol[];
	/** Variable types in scope at the start of the body. */
	scope: Map<string, XQueryType>;
	formatType: (t: XQueryType) => string;
}

/**
 * Runs `fn` with `body` as the active inference frame: `inferExprType` calls for nodes inside it
 * read from and write to the persistent memo for this exact body shape and context.
 */
export function withBodyFrame<T>(body: Node, ctx: BodyContext, fn: () => T): T {
	const { index, shape } = indexBody(body);
	const key = `${shape}|${signaturesDigest(ctx.allFns)}|${namespacesDigest(ctx.analysis)}|${scopeDigest(ctx.scope, ctx.formatType)}`;
	let memo = bodies.get(key);
	if (memo) {
		bodies.delete(key); // refresh LRU position
	} else {
		memo = new Map();
		if (bodies.size >= MAX_BODIES) bodies.delete(bodies.keys().next().value!);
	}
	bodies.set(key, memo);

	const previous = active;
	active = { index, memo };
	try {
		return fn();
	} finally {
		active = previous;
	}
}

/** The memoized type of `node` in the active frame, computing it with `compute` on a miss. */
export function asBodyMemoized(node: Node, compute: () => XQueryType): XQueryType | undefined {
	const frame = active;
	const i = frame?.index.get(node);
	if (!frame || i === undefined) return undefined;
	let type = frame.memo.get(i);
	if (!type) frame.memo.set(i, (type = compute()));
	return type;
}

/** Drops all persisted entries (tests, or a workspace-wide invalidation). */
export function clearInferenceCache(): void {
	bodies.clear();
}

/** Number of bodies currently memoized. */
export function inferenceCacheSize(): number {
	return bodies.size;
}
