import type { Node } from "xq-parser";
import type { QName, FileAnalysis } from "./types.ts";
import { isTerminal, directChildOf, directChildrenOf, firstTerminalValue, sequenceTypeText, resolvePrefix } from "./analyzer.ts";

// Typed narrowing functions for xq-parser AST nodes.
// Each returns a typed shape or null if the node is not the expected type.

// ── FunctionCall ──────────────────────────────────────────────────────────────

export interface FunctionCallShape {
	qname: QName;
	args: Node[];
}

export function asFunctionCall(node: Node, analysis: FileAnalysis): FunctionCallShape | null {
	if (node.type !== 'FunctionCall') return null;
	const fnEqname = directChildOf(node, 'FunctionEQName');
	if (!fnEqname) return null;
	const name = firstTerminalValue(fnEqname);
	if (!name) return null;
	const colonIdx = name.indexOf(':');
	const prefix = colonIdx >= 0 ? name.slice(0, colonIdx) : '';
	const localName = colonIdx >= 0 ? name.slice(colonIdx + 1) : name;
	const namespaceUri = resolvePrefix(prefix, analysis);
	const argList = directChildOf(node, 'ArgumentList');
	const args = argList ? directChildrenOf(argList, 'Argument') : [];
	return { qname: { prefix, localName, namespaceUri }, args };
}

// ── VarRef ────────────────────────────────────────────────────────────────────

export function asVarRef(node: Node, analysis: FileAnalysis): QName | null {
	if (node.type !== 'VarRef') return null;
	const varNameNode = directChildOf(node, 'VarName');
	if (!varNameNode) return null;
	const rawName = firstTerminalValue(varNameNode);
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

// Handles LetBinding, ForBinding, VarDecl (VarName child) and Param (EQName child).
export function asTypedBinding(node: Node, text: string, analysis: FileAnalysis): TypedBindingShape | null {
	let nameNode: Node | undefined;
	switch (node.type) {
		case 'LetBinding':
		case 'ForBinding':
		case 'VarDecl':
			nameNode = directChildOf(node, 'VarName');
			break;
		case 'Param':
			nameNode = directChildOf(node, 'EQName');
			break;
		default:
			return null;
	}
	const rawName = nameNode ? firstTerminalValue(nameNode) : null;
	if (!rawName) return null;
	const colonIdx = rawName.indexOf(':');
	const prefix = colonIdx >= 0 ? rawName.slice(0, colonIdx) : '';
	const localName = colonIdx >= 0 ? rawName.slice(colonIdx + 1) : rawName;
	const namespaceUri = prefix ? resolvePrefix(prefix, analysis) : '';
	const typeDecl = directChildOf(node, 'TypeDeclaration');
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
