import type { Node } from "xq-parser";
import type { QName, FileAnalysis } from "./types.ts";
import { isTerminal, directChildOf, directChildrenOf, findAll, firstTerminalValue, sequenceTypeText, resolvePrefix } from "./analyzer.ts";

// Typed narrowing functions for xq-parser AST nodes.
// Each returns a typed shape or null if the node is not the expected type.

// ── FunctionCall ──────────────────────────────────────────────────────────────

export interface FunctionCallShape {
	qname: QName;
	args: Node[];
}

export function asFunctionCall(node: Node, analysis: FileAnalysis): FunctionCallShape | null {
	if (node.type !== 'FunctionCall') return null;
	// XQuery 3.1: FunctionEQName; XQuery 4.0: UnreservedFunctionEQName
	const fnEqname = directChildOf(node, 'FunctionEQName') ?? directChildOf(node, 'UnreservedFunctionEQName');
	if (!fnEqname) return null;
	const name = firstTerminalValue(fnEqname);
	if (!name) return null;
	const colonIdx = name.indexOf(':');
	const prefix = colonIdx >= 0 ? name.slice(0, colonIdx) : '';
	const localName = colonIdx >= 0 ? name.slice(colonIdx + 1) : name;
	const namespaceUri = resolvePrefix(prefix, analysis);
	const argList = directChildOf(node, 'ArgumentList');
	// XQuery 3.1: Argument children are direct children of ArgumentList
	// XQuery 4.0: Argument children are inside PositionalArguments, which is left-recursive
	// for multiple args — use findAll to collect them all regardless of nesting depth
	const args = argList ? findAll(argList, 'Argument') : [];
	return { qname: { prefix, localName, namespaceUri }, args };
}

// ── VarRef ────────────────────────────────────────────────────────────────────

export function asVarRef(node: Node, analysis: FileAnalysis): QName | null {
	if (node.type !== 'VarRef') return null;
	// XQuery 3.1: VarName child; XQuery 4.0: EQName child ($ is a separate terminal)
	const nameNode = directChildOf(node, 'VarName') ?? directChildOf(node, 'EQName');
	if (!nameNode) return null;
	const rawName = firstTerminalValue(nameNode);
	if (!rawName) return null;
	const colonIdx = rawName.indexOf(':');
	const prefix = colonIdx >= 0 ? rawName.slice(0, colonIdx) : '';
	const localName = colonIdx >= 0 ? rawName.slice(colonIdx + 1) : rawName;
	// Variables don't use the default function namespace — unqualified vars have empty URI
	const namespaceUri = prefix ? resolvePrefix(prefix, analysis) : '';
	return { prefix, localName, namespaceUri };
}

// ── Literals ──────────────────────────────────────────────────────────────────

export type LiteralKind = 'string' | 'integer' | 'decimal' | 'double';

export function literalKind(node: Node): LiteralKind | null {
	if (!isTerminal(node)) return null;
	switch (node.type) {
		case 'StringLiteral':  return 'string';
		case 'IntegerLiteral': return 'integer';
		case 'DecimalLiteral': return 'decimal';
		case 'DoubleLiteral':  return 'double';
		default:               return null;
	}
}

// ── Typed variable bindings ───────────────────────────────────────────────────

export interface TypedBindingShape {
	qname: QName;
	typeStr?: string;
}

// Handles LetBinding, ForBinding, VarDecl and Param (XQuery 3.1) or ParamWithDefault (XQuery 4.0).
export function asTypedBinding(node: Node, text: string, analysis: FileAnalysis): TypedBindingShape | null {
	let nameNode: Node | undefined;
	let typeOwner: Node = node; // the node that directly holds TypeDeclaration

	switch (node.type) {
		case 'LetBinding':
		case 'ForBinding': {
			// XQuery 3.1: VarName is a direct child
			// XQuery 4.0: VarNameAndType is inside a sub-binding (LetValueBinding, ForItemBinding, etc.)
			const vnt = directChildOf(node, 'VarNameAndType')
				?? (node as import("xq-parser").NonTerminal).children
					.filter(c => !c.isTerminal)
					.map(c => directChildOf(c, 'VarNameAndType'))
					.find(Boolean);
			if (vnt) {
				nameNode = directChildOf(vnt, 'EQName');
				typeOwner = vnt;
			} else {
				nameNode = directChildOf(node, 'VarName');
			}
			break;
		}
		case 'VarDecl': {
			const vnt = directChildOf(node, 'VarNameAndType');
			if (vnt) {
				nameNode = directChildOf(vnt, 'EQName');
				typeOwner = vnt;
			} else {
				nameNode = directChildOf(node, 'VarName');
			}
			break;
		}
		case 'Param':
			nameNode = directChildOf(node, 'EQName');
			break;
		case 'ParamWithDefault': {
			const vnt = directChildOf(node, 'VarNameAndType');
			if (vnt) {
				nameNode = directChildOf(vnt, 'EQName');
				typeOwner = vnt;
			}
			break;
		}
		default:
			return null;
	}
	const rawName = nameNode ? firstTerminalValue(nameNode) : null;
	if (!rawName) return null;
	const colonIdx = rawName.indexOf(':');
	const prefix = colonIdx >= 0 ? rawName.slice(0, colonIdx) : '';
	const localName = colonIdx >= 0 ? rawName.slice(colonIdx + 1) : rawName;
	const namespaceUri = prefix ? resolvePrefix(prefix, analysis) : '';
	const typeDecl = directChildOf(typeOwner, 'TypeDeclaration');
	const seqType = typeDecl ? directChildOf(typeDecl, 'SequenceType') : null;
	return { qname: { prefix, localName, namespaceUri }, typeStr: seqType ? sequenceTypeText(text, seqType) : undefined };
}

// ── Path expressions ──────────────────────────────────────────────────────────

export function isPathExpr(node: Node): boolean {
	if (node.type !== 'PathExpr' && node.type !== 'RelativePathExpr') return false;
	if (isTerminal(node)) return false;
	const nt = node as import("xq-parser").NonTerminal;
	return nt.children.some(c => isTerminal(c) && (c.value === '/' || c.value === '//'));
}

// ── Argument ──────────────────────────────────────────────────────────────────

export function argExpr(node: Node): Node | null {
	if (node.type !== 'Argument') return null;
	return directChildOf(node, 'ExprSingle') ?? null;
}
