import type { Node } from "xq-parser";
import type { QName, FileAnalysis } from "./types.ts";
import {
	isTerminal,
	directChildOf,
	directChildrenOf,
	firstTerminalValue,
	sequenceTypeText,
	parseEQName,
	resolvePrefix,
} from "./analyzer.ts";

// Typed narrowing functions for xq-parser AST nodes.
// Each returns a typed shape or null if the node is not the expected type.

// ── Internal helpers ──────────────────────────────────────────────────────────

function annotationNames(annotatedDecl: Node): string[] {
	const names: string[] = [];
	for (const ann of directChildrenOf(annotatedDecl, "Annotation")) {
		const eqname = directChildOf(ann, "EQName");
		const name = eqname ? firstTerminalValue(eqname) : null;
		if (!name) continue;
		names.push(parseEQName(name).localName);
	}
	return names;
}

function resolveQName(raw: string, analysis: FileAnalysis, defaultNs: string): QName {
	const { prefix, localName, uri } = parseEQName(raw);
	const namespaceUri = uri ?? resolvePrefix(prefix, analysis);
	return { prefix, localName, namespaceUri };
}

/** Resolves a variable QName from a node whose first descendant terminal is the bare name (no "$"). */
function qnameFromRawTerminal(node: Node, analysis: FileAnalysis): QName | null {
	const rawName = firstTerminalValue(node);
	if (!rawName) return null;
	const { prefix, localName, uri } = parseEQName(rawName);
	return { prefix, localName, namespaceUri: uri ?? (prefix ? resolvePrefix(prefix, analysis) : "") };
}

function extractParamsFromParamList(
	paramList: Node | undefined,
	analysis: FileAnalysis,
): Array<{ nameNode: Node; qname: QName }> {
	const paramNodes = paramList ? directChildrenOf(paramList, "Param") : [];
	return paramNodes.flatMap((p) => {
		const pNameNode = directChildOf(p, "EQName");
		if (!pNameNode) return [];
		const qname = qnameFromRawTerminal(pNameNode, analysis);
		if (!qname) return [];
		return [{ nameNode: pNameNode, qname }];
	});
}

// ── FunctionCall ──────────────────────────────────────────────────────────────

export interface FunctionCallShape {
	qname: QName;
	args: Node[];
}

export function asFunctionCall(node: Node, analysis: FileAnalysis): FunctionCallShape | null {
	if (node.type !== "FunctionCall") return null;
	const fnEqname = directChildOf(node, "FunctionEQName");
	if (!fnEqname) return null;
	const name = firstTerminalValue(fnEqname);
	if (!name) return null;
	const { prefix, localName, uri } = parseEQName(name);
	const namespaceUri = uri ?? resolvePrefix(prefix, analysis);
	const argList = directChildOf(node, "ArgumentList");
	const args = argList ? directChildrenOf(argList, "Argument") : [];
	return { qname: { prefix, localName, namespaceUri }, args };
}

// ── NamedFunctionRef ──────────────────────────────────────────────────────────

export interface NamedFunctionRefShape {
	qname: QName;
	arity: number;
}

export function asNamedFunctionRef(node: Node, analysis: FileAnalysis): NamedFunctionRefShape | null {
	if (node.type !== "NamedFunctionRef") return null;
	const eqname = directChildOf(node, "EQName");
	if (!eqname) return null;
	const name = firstTerminalValue(eqname);
	if (!name) return null;
	const { prefix, localName, uri } = parseEQName(name);
	const namespaceUri = uri ?? resolvePrefix(prefix, analysis);
	const arityNode = directChildOf(node, "IntegerLiteral");
	const arity = arityNode ? parseInt(firstTerminalValue(arityNode) ?? "0", 10) : 0;
	return { qname: { prefix, localName, namespaceUri }, arity };
}

// ── VarRef ────────────────────────────────────────────────────────────────────

export function asVarRef(node: Node, analysis: FileAnalysis): QName | null {
	if (node.type !== "VarRef") return null;
	const varNameNode = directChildOf(node, "VarName");
	if (!varNameNode) return null;
	const rawName = firstTerminalValue(varNameNode);
	if (!rawName) return null;
	const { prefix, localName, uri } = parseEQName(rawName);
	// Variables don't use the default function namespace — unqualified vars have empty URI
	const namespaceUri = uri ?? (prefix ? resolvePrefix(prefix, analysis) : "");
	return { prefix, localName, namespaceUri };
}

// ── VarDecl ───────────────────────────────────────────────────────────────────

/** Resolved QName and the name node (for offset/length) for a VarDecl, or null. */
export function asVarDecl(node: Node, analysis: FileAnalysis): { qname: QName; nameNode: Node } | null {
	if (node.type !== "VarDecl") return null;
	const nameNode = directChildOf(node, "VarName");
	if (!nameNode) return null;
	const rawName = firstTerminalValue(nameNode);
	if (!rawName) return null;
	const { prefix, localName, uri } = parseEQName(rawName);
	const namespaceUri = uri ?? (prefix ? resolvePrefix(prefix, analysis) : "");
	return { qname: { prefix, localName, namespaceUri }, nameNode };
}

// ── FunctionDecl ──────────────────────────────────────────────────────────────

export interface FunctionDeclShape {
	nameNode: Node;
	qname: QName;
	params: Array<{ nameNode: Node; qname: QName }>;
	body: Node | null; // FunctionBody node; null for external functions
}

/** Extract a param's name node and QName from either a XQ31 Param or XQ4 ParamWithDefault node. */
function paramNameNode(p: Node, analysis: FileAnalysis): { nameNode: Node; qname: QName } | null {
	// XQ31: Param has EQName as direct child
	// XQ4: ParamWithDefault has VarNameAndType → EQName
	const directEqname = directChildOf(p, "EQName");
	const eqnameNode = directEqname ?? (() => {
		const vnt = directChildOf(p, "VarNameAndType");
		return vnt ? directChildOf(vnt, "EQName") : undefined;
	})();
	if (!eqnameNode) return null;
	const pName = firstTerminalValue(eqnameNode);
	if (!pName) return null;
	const { prefix, localName, uri } = parseEQName(pName);
	const namespaceUri = uri ?? (prefix ? resolvePrefix(prefix, analysis) : "");
	return { nameNode: eqnameNode, qname: { prefix, localName, namespaceUri } };
}

/** Inner shape of a FunctionDecl node: name, resolved params, and function body. */
export function asFunctionDecl(node: Node, analysis: FileAnalysis): FunctionDeclShape | null {
	if (node.type !== "FunctionDecl") return null;
	// XQ31 uses EQName; XQ4 uses UnreservedFunctionEQName for function names.
	const nameNode = directChildOf(node, "EQName") ?? directChildOf(node, "UnreservedFunctionEQName");
	if (!nameNode) return null;
	const rawName = firstTerminalValue(nameNode);
	if (!rawName) return null;
	const { prefix, localName, uri } = parseEQName(rawName);
	const namespaceUri = uri ?? resolvePrefix(prefix, analysis);
	// XQ31: ParamList → Param; XQ4: ParamListWithDefaults → ParamWithDefault
	const xq31List = directChildOf(node, "ParamList");
	const xq4List = directChildOf(node, "ParamListWithDefaults");
	const rawParams = xq31List
		? directChildrenOf(xq31List, "Param")
		: xq4List
			? directChildrenOf(xq4List, "ParamWithDefault")
			: [];
	const params = rawParams.flatMap((p) => {
		const r = paramNameNode(p, analysis);
		return r ? [r] : [];
	});
	return { nameNode, qname: { prefix, localName, namespaceUri }, params, body: directChildOf(node, "FunctionBody") ?? null };
}

// ── InlineFunctionExpr ────────────────────────────────────────────────────────

export interface InlineFunctionExprShape {
	params: Array<{ nameNode: Node; qname: QName }>;
	body: Node | null; // FunctionBody node
}

export function asInlineFunctionExpr(node: Node, analysis: FileAnalysis): InlineFunctionExprShape | null {
	if (node.type !== "InlineFunctionExpr") return null;
	const params = extractParamsFromParamList(directChildOf(node, "ParamList"), analysis);
	return { params, body: directChildOf(node, "FunctionBody") ?? null };
}

// ── WindowVars (window-clause start/end condition bindings) ─────────────────────

export interface WindowVarsShape {
	currentItem?: QName;
	positionalVar?: { nameNode: Node; qname: QName };
	previousItem?: QName;
	nextItem?: QName;
}

/** Resolves the `$current at $pos previous $prev next $next` bindings of a WindowVars node. */
export function asWindowVars(node: Node, analysis: FileAnalysis): WindowVarsShape | null {
	if (node.type !== "WindowVars") return null;
	const result: WindowVarsShape = {};
	const currentItemNode = directChildOf(node, "CurrentItem");
	if (currentItemNode) result.currentItem = qnameFromRawTerminal(currentItemNode, analysis) ?? undefined;
	const posVarNode = directChildOf(node, "PositionalVar");
	if (posVarNode) result.positionalVar = asPositionalVar(posVarNode, analysis) ?? undefined;
	const prevNode = directChildOf(node, "PreviousItem");
	if (prevNode) result.previousItem = qnameFromRawTerminal(prevNode, analysis) ?? undefined;
	const nextNode = directChildOf(node, "NextItem");
	if (nextNode) result.nextItem = qnameFromRawTerminal(nextNode, analysis) ?? undefined;
	return result;
}

// ── XQUF_TransformExpr (`copy $c := expr modify expr return expr`) ──────────────

export interface CopyBindingShape {
	qname: QName;
	initExpr: Node;
}

export interface TransformExprShape {
	copyBindings: CopyBindingShape[];
	modifyExpr: Node | null;
	returnExpr: Node | null;
}

export function asTransformExpr(node: Node, analysis: FileAnalysis): TransformExprShape | null {
	if (node.type !== "XQUF_TransformExpr") return null;
	const bindingList = directChildOf(node, "XQUF_CopyBindingList");
	const bindingNodes = bindingList ? directChildrenOf(bindingList, "XQUF_CopyBinding") : [];
	const copyBindings = bindingNodes.flatMap((b) => {
		const nameNode = directChildOf(b, "VarName");
		const initExpr = directChildOf(b, "ExprSingle");
		if (!nameNode || !initExpr) return [];
		const qname = qnameFromRawTerminal(nameNode, analysis);
		if (!qname) return [];
		return [{ qname, initExpr }];
	});
	const [modifyExpr, returnExpr] = directChildrenOf(node, "ExprSingle");
	return { copyBindings, modifyExpr: modifyExpr ?? null, returnExpr: returnExpr ?? null };
}

// ── AnnotatedDecl wrappers ────────────────────────────────────────────────────

/** QName, name node, arity, minArity, and annotation local-names for an AnnotatedDecl containing a FunctionDecl, or null. */
export function asFunctionDeclaration(
	node: Node,
	analysis: FileAnalysis,
): { qname: QName; nameNode: Node; arity: number; minArity?: number; annotations: string[] } | null {
	if (node.type !== "AnnotatedDecl") return null;
	const fnDeclNode = directChildOf(node, "FunctionDecl");
	if (!fnDeclNode) return null;
	const fn = asFunctionDecl(fnDeclNode, analysis);
	if (!fn) return null;
	// Compute minArity: count ParamWithDefault nodes that have no ':=' terminal (required params).
	const xq4List = directChildOf(fnDeclNode, "ParamListWithDefaults");
	let minArity: number | undefined;
	if (xq4List) {
		const required = directChildrenOf(xq4List, "ParamWithDefault").filter(
			(p) => !(p as import("xq-parser").NonTerminal).children.some((c) => isTerminal(c) && c.value === ":="),
		).length;
		if (required < fn.params.length) minArity = required;
	}
	return { qname: fn.qname, nameNode: fn.nameNode, arity: fn.params.length, minArity, annotations: annotationNames(node) };
}

/** Resolved QName, name node, and annotation local-names for an AnnotatedDecl containing a VarDecl, or null. */
export function asVariableDeclaration(
	node: Node,
	analysis: FileAnalysis,
): { qname: QName; nameNode: Node; annotations: string[] } | null {
	if (node.type !== "AnnotatedDecl") return null;
	const varDeclNode = directChildOf(node, "VarDecl");
	if (!varDeclNode) return null;
	const inner = asVarDecl(varDeclNode, analysis);
	if (!inner) return null;
	return { ...inner, annotations: annotationNames(node) };
}

// ── PositionalVar ─────────────────────────────────────────────────────────────

/** Resolved QName and name node for a PositionalVar ("at $pos") node, or null. */
export function asPositionalVar(node: Node, analysis: FileAnalysis): { nameNode: Node; qname: QName } | null {
	if (node.type !== "PositionalVar") return null;
	const nameNode = directChildOf(node, "VarName");
	if (!nameNode) return null;
	const rawName = firstTerminalValue(nameNode);
	if (!rawName) return null;
	const { prefix, localName, uri } = parseEQName(rawName);
	const namespaceUri = uri ?? (prefix ? resolvePrefix(prefix, analysis) : "");
	return { nameNode, qname: { prefix, localName, namespaceUri } };
}

// ── Variable-binding clauses ──────────────────────────────────────────────────

export interface BindingShape {
	nameNode: Node;
	qname: QName;
	/** Expression evaluated before this binding enters scope (the "in" / ":=" expr). */
	initExpr?: Node;
	/** For ForBinding: the positional variable from the "at $pos" clause, if present. */
	positionalVar?: { nameNode: Node; qname: QName };
}

/**
 * Extracts the variable binding from a clause node.  Handles:
 *   ForBinding, LetBinding — core FLWOR bindings
 *   CountClause            — `count $i`
 *   GroupingSpec           — `group by $x := expr` (only when `:=` is present)
 *   TumblingWindowClause, SlidingWindowClause — main window variable `$w`
 * Returns null for unrecognised nodes or GroupingSpec without `:=`.
 */
export function asBinding(node: Node, analysis: FileAnalysis): BindingShape | null {
	function varFromName(nameNode: Node): { nameNode: Node; qname: QName } | null {
		const rawName = firstTerminalValue(nameNode);
		if (!rawName) return null;
		const { prefix, localName, uri } = parseEQName(rawName);
		const namespaceUri = uri ?? (prefix ? resolvePrefix(prefix, analysis) : "");
		return { nameNode, qname: { prefix, localName, namespaceUri } };
	}

	switch (node.type) {
		case "ForBinding": {
			// XQ31: VarName is direct child. XQ4: ForItemBinding → VarNameAndType → EQName.
			let nameNode = directChildOf(node, "VarName");
			let initExpr = directChildOf(node, "ExprSingle");
			if (!nameNode) {
				const fib = directChildOf(node, "ForItemBinding");
				if (fib) {
					const vnt = directChildOf(fib, "VarNameAndType");
					nameNode = vnt ? directChildOf(vnt, "EQName") : undefined;
					initExpr = directChildOf(fib, "ExprSingle");
				}
			}
			if (!nameNode) return null;
			const v = varFromName(nameNode);
			if (!v) return null;
			const posVarNode = directChildOf(node, "PositionalVar");
			const positionalVar = posVarNode ? asPositionalVar(posVarNode, analysis) ?? undefined : undefined;
			return { ...v, initExpr: initExpr ?? undefined, positionalVar };
		}
		case "LetBinding": {
			// XQ31: VarName is direct child. XQ4: LetValueBinding → VarNameAndType → EQName.
			let nameNode = directChildOf(node, "VarName");
			let initExpr = directChildOf(node, "ExprSingle");
			if (!nameNode) {
				const lvb = directChildOf(node, "LetValueBinding");
				if (lvb) {
					const vnt = directChildOf(lvb, "VarNameAndType");
					nameNode = vnt ? directChildOf(vnt, "EQName") : undefined;
					initExpr = directChildOf(lvb, "ExprSingle");
				}
			}
			if (!nameNode) return null;
			const v = varFromName(nameNode);
			if (!v) return null;
			return { ...v, initExpr: initExpr ?? undefined };
		}
		case "CountClause": {
			const nameNode = directChildOf(node, "VarName");
			if (!nameNode) return null;
			const v = varFromName(nameNode);
			return v ?? null;
		}
		case "GroupingSpec": {
			// Only a new binding when the spec has its own ":= expr"
			const initExpr = directChildOf(node, "ExprSingle");
			if (!initExpr) return null;
			const groupVar = directChildOf(node, "GroupingVariable");
			const nameNode = groupVar ? directChildOf(groupVar, "VarName") : null;
			if (!nameNode) return null;
			const v = varFromName(nameNode);
			if (!v) return null;
			return { ...v, initExpr };
		}
		case "TumblingWindowClause":
		case "SlidingWindowClause": {
			const nameNode = directChildOf(node, "VarName");
			if (!nameNode) return null;
			const v = varFromName(nameNode);
			if (!v) return null;
			return { ...v, initExpr: directChildOf(node, "ExprSingle") ?? undefined };
		}
		default:
			return null;
	}
}

// ── VarName ───────────────────────────────────────────────────────────────────

/**
 * Resolves the QName for a raw VarName node.
 * Use this when a VarName appears directly in a parent (e.g. QuantifiedExpr)
 * rather than inside a VarRef, ForBinding, or LetBinding.
 */
export function asVarName(node: Node, analysis: FileAnalysis): QName | null {
	if (node.type !== "VarName") return null;
	const rawName = firstTerminalValue(node);
	if (!rawName) return null;
	const { prefix, localName, uri } = parseEQName(rawName);
	return { prefix, localName, namespaceUri: uri ?? (prefix ? resolvePrefix(prefix, analysis) : "") };
}

// ── CatchClause ───────────────────────────────────────────────────────────────

/**
 * Returns the catch body for a CatchClause node, or null.
 * XQuery 3.1 catch clauses have no explicit variable binding — the implicit
 * $err:* variables are pre-declared and do not appear in the AST as bindings.
 */
export function asCatchClause(node: Node): { body: Node } | null {
	if (node.type !== "CatchClause") return null;
	const body = directChildOf(node, "EnclosedExpr");
	if (!body) return null;
	return { body };
}

// ── Literals ──────────────────────────────────────────────────────────────────

export type LiteralKind = "string" | "integer" | "decimal" | "double";

export function literalKind(node: Node): LiteralKind | null {
	if (!isTerminal(node)) return null;
	switch (node.type) {
		case "StringLiteral":
			return "string";
		case "IntegerLiteral":
			return "integer";
		case "DecimalLiteral":
			return "decimal";
		case "DoubleLiteral":
			return "double";
		default:
			return null;
	}
}

// ── Typed variable bindings ───────────────────────────────────────────────────

export interface TypedBindingShape {
	qname: QName;
	typeStr?: string;
}

/**
 * Extracts name and optional declared type from a variable-binding or parameter node.
 * Handles both XQuery 3.1 and XQuery 4.0 AST shapes.
 */
export function asTypedBinding(node: Node, text: string, analysis: FileAnalysis): TypedBindingShape | null {
	let nameNode: Node | undefined;
	let typeDecl: Node | undefined;

	switch (node.type) {
		case "VarDecl":
			nameNode = directChildOf(node, "VarName");
			typeDecl = directChildOf(node, "TypeDeclaration");
			break;
		case "Param":
			nameNode = directChildOf(node, "EQName");
			typeDecl = directChildOf(node, "TypeDeclaration");
			break;
		case "ParamWithDefault": {
			// XQuery 4.0: parameter with optional default value
			const vnt = directChildOf(node, "VarNameAndType");
			if (!vnt) return null;
			nameNode = directChildOf(vnt, "EQName");
			typeDecl = directChildOf(vnt, "TypeDeclaration");
			break;
		}
		case "LetBinding": {
			// XQ31: VarName is direct child; XQ4: LetValueBinding → VarNameAndType → EQName
			nameNode = directChildOf(node, "VarName");
			typeDecl = directChildOf(node, "TypeDeclaration");
			if (!nameNode) {
				const lvb = directChildOf(node, "LetValueBinding");
				if (lvb) {
					const vnt = directChildOf(lvb, "VarNameAndType");
					if (vnt) { nameNode = directChildOf(vnt, "EQName"); typeDecl = directChildOf(vnt, "TypeDeclaration"); }
				}
			}
			break;
		}
		case "ForBinding": {
			// XQ31: VarName is direct child; XQ4: ForItemBinding → VarNameAndType → EQName
			nameNode = directChildOf(node, "VarName");
			typeDecl = directChildOf(node, "TypeDeclaration");
			if (!nameNode) {
				const fib = directChildOf(node, "ForItemBinding");
				if (fib) {
					const vnt = directChildOf(fib, "VarNameAndType");
					if (vnt) { nameNode = directChildOf(vnt, "EQName"); typeDecl = directChildOf(vnt, "TypeDeclaration"); }
				}
			}
			break;
		}
		default:
			return null;
	}

	const rawName = nameNode ? firstTerminalValue(nameNode) : null;
	if (!rawName) return null;
	const { prefix, localName, uri } = parseEQName(rawName);
	const namespaceUri = uri ?? (prefix ? resolvePrefix(prefix, analysis) : "");
	const seqType = typeDecl ? directChildOf(typeDecl, "SequenceType") : null;
	return {
		qname: { prefix, localName, namespaceUri },
		typeStr: seqType ? sequenceTypeText(text, seqType) : undefined,
	};
}

// ── Path expressions ──────────────────────────────────────────────────────────

export function isPathExpr(node: Node): boolean {
	if (node.type !== "PathExpr" && node.type !== "RelativePathExpr") return false;
	if (isTerminal(node)) return false;
	const nt = node as import("xq-parser").NonTerminal;
	return nt.children.some((c) => isTerminal(c) && (c.value === "/" || c.value === "//"));
}

// ── Argument ──────────────────────────────────────────────────────────────────

export function argExpr(node: Node): Node | null {
	if (node.type !== "Argument") return null;
	return directChildOf(node, "ExprSingle") ?? null;
}
