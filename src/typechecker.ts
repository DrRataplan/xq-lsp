import type { Node, NonTerminal } from "xq-parser";
import type { XQueryType, TypeDiagnostic, FileAnalysis, FunctionSymbol } from "./types.ts";
import { findAll, directChildOf, directChildrenOf, firstTerminalValue, isTerminal, sequenceTypeText, resolvePrefix } from "./analyzer.ts";

// ── Type constants ───────────────────────────────────────────────────────────

const UNKNOWN: XQueryType = { kind: 'unknown', occurrence: '' };

// ── Type parsing ─────────────────────────────────────────────────────────────

const NODE_KIND_PREFIXES = [
	'node(', 'element(', 'attribute(', 'text(', 'comment(',
	'document-node(', 'processing-instruction(', 'schema-element(', 'schema-attribute(',
];

export function parseType(typeStr: string): XQueryType {
	const trimmed = typeStr.trim();
	if (!trimmed) return UNKNOWN;

	let occurrence: XQueryType['occurrence'] = '';
	let base = trimmed;
	const last = trimmed[trimmed.length - 1];
	if (last === '*') { occurrence = '*'; base = trimmed.slice(0, -1).trim(); }
	else if (last === '+') { occurrence = '+'; base = trimmed.slice(0, -1).trim(); }
	else if (last === '?') { occurrence = '?'; base = trimmed.slice(0, -1).trim(); }

	if (base === 'item()') return { kind: 'item', occurrence };
	if (base === 'empty-sequence()') return { kind: 'empty', occurrence: '' };

	if (NODE_KIND_PREFIXES.some(p => base === p.slice(0, -1) + ')' || base.startsWith(p))) {
		const name = base.replace(/\(.*/, '');
		return { kind: 'node', name, occurrence };
	}

	if (base.startsWith('map(')) return { kind: 'map', occurrence };
	if (base.startsWith('array(')) return { kind: 'array', occurrence };
	if (base.startsWith('function(')) return { kind: 'function', occurrence };

	if (base.includes(':')) return { kind: 'atomic', name: base, occurrence };

	return UNKNOWN;
}

// ── Type compatibility ────────────────────────────────────────────────────────

const ATOMIC_SUBTYPES: Record<string, string[]> = {
	'xs:anyAtomicType': [
		'xs:string', 'xs:boolean', 'xs:integer', 'xs:decimal', 'xs:float', 'xs:double',
		'xs:duration', 'xs:dateTime', 'xs:date', 'xs:time', 'xs:anyURI', 'xs:QName',
		'xs:NOTATION', 'xs:hexBinary', 'xs:base64Binary',
	],
	'xs:numeric': ['xs:integer', 'xs:decimal', 'xs:float', 'xs:double'],
	'xs:decimal': ['xs:integer'],
	'xs:string': ['xs:normalizedString', 'xs:token', 'xs:language', 'xs:Name', 'xs:NCName', 'xs:NMTOKEN'],
};

function isAtomicSubtype(from: string, to: string): boolean {
	if (from === to) return true;
	const subs = ATOMIC_SUBTYPES[to];
	return subs !== undefined && subs.includes(from);
}

function isNodeSubtype(from: string | undefined, to: string | undefined): boolean {
	if (!from || !to) return true;
	if (to === 'node') return true; // node() accepts all node kinds
	return from === to;
}

export function isAssignable(from: XQueryType, to: XQueryType): boolean {
	if (from.kind === 'unknown' || to.kind === 'unknown') return true;
	if (to.kind === 'item') return true;
	if (from.kind === 'empty') return to.occurrence === '*' || to.occurrence === '?';

	// Atomic ↔ node mismatch is always wrong
	if (from.kind === 'atomic' && to.kind === 'node') return false;
	if (from.kind === 'node' && to.kind === 'atomic') return false;

	if (from.kind === 'atomic' && to.kind === 'atomic') {
		return isAtomicSubtype(from.name ?? '', to.name ?? '');
	}

	if (from.kind === 'node' && to.kind === 'node') {
		return isNodeSubtype(from.name, to.name);
	}

	return true;
}

// ── Type inference ────────────────────────────────────────────────────────────

function allFunctionsFlat(analysis: FileAnalysis, importedAnalyses: Map<string, FileAnalysis>): FunctionSymbol[] {
	const fns = [...analysis.functions];
	for (const a of importedAnalyses.values()) fns.push(...a.functions);
	return fns;
}

function inferFunctionReturn(
	callNode: NonTerminal,
	analysis: FileAnalysis,
	allFns: FunctionSymbol[],
): XQueryType {
	const fnEqname = directChildOf(callNode, 'FunctionEQName');
	if (!fnEqname) return UNKNOWN;
	const fnName = firstTerminalValue(fnEqname);
	if (!fnName) return UNKNOWN;
	const colonIdx = fnName.indexOf(':');
	const prefix = colonIdx >= 0 ? fnName.slice(0, colonIdx) : '';
	const localName = colonIdx >= 0 ? fnName.slice(colonIdx + 1) : fnName;
	const nsUri = resolvePrefix(prefix, analysis);
	const argList = directChildOf(callNode, 'ArgumentList');
	const arity = argList ? directChildrenOf(argList, 'Argument').length : 0;
	const fn = allFns.find(f => f.namespaceUri === nsUri && f.localName === localName && f.arity === arity);
	if (!fn?.returnType) return UNKNOWN;
	return parseType(fn.returnType);
}

export function inferExprType(
	node: Node,
	varTypes: Map<string, XQueryType>,
	analysis: FileAnalysis,
	allFns: FunctionSymbol[],
): XQueryType {
	if (isTerminal(node)) {
		switch (node.type) {
			case 'StringLiteral': return { kind: 'atomic', name: 'xs:string', occurrence: '' };
			case 'IntegerLiteral': return { kind: 'atomic', name: 'xs:integer', occurrence: '' };
			case 'DecimalLiteral': return { kind: 'atomic', name: 'xs:decimal', occurrence: '' };
			case 'DoubleLiteral': return { kind: 'atomic', name: 'xs:double', occurrence: '' };
			default: return UNKNOWN;
		}
	}

	const nt = node as NonTerminal;

	switch (node.type) {
		case 'Literal':
		case 'NumericLiteral': {
			for (const c of nt.children) {
				const t = inferExprType(c, varTypes, analysis, allFns);
				if (t.kind !== 'unknown') return t;
			}
			break;
		}

		case 'VarRef': {
			const varNameNode = nt.children.find(c => !isTerminal(c) && c.type === 'VarName');
			if (!varNameNode) return UNKNOWN;
			const name = firstTerminalValue(varNameNode);
			if (!name) return UNKNOWN;
			return varTypes.get(name) ?? UNKNOWN;
		}

		case 'FunctionCall':
			return inferFunctionReturn(nt, analysis, allFns);

		case 'PathExpr':
		case 'RelativePathExpr': {
			const hasSlash = nt.children.some(c => isTerminal(c) && (c.value === '/' || c.value === '//'));
			if (hasSlash) return { kind: 'node', name: 'node', occurrence: '*' };
			break;
		}

		case 'AxisStep':
		case 'ForwardStep':
		case 'ReverseStep':
		case 'AbbrevForwardStep':
		case 'AbbrevReverseStep':
			return { kind: 'node', name: 'node', occurrence: '*' };
	}

	// Unwrap single-child wrapper nodes (the long chain of OrExpr, AndExpr, etc.)
	const ntChildren = nt.children.filter(c => !isTerminal(c));
	if (ntChildren.length === 1) {
		return inferExprType(ntChildren[0], varTypes, analysis, allFns);
	}

	return UNKNOWN;
}

// ── Variable type context ─────────────────────────────────────────────────────

export function buildVarTypes(ast: Node, text: string): Map<string, XQueryType> {
	const types = new Map<string, XQueryType>();

	function extractTypeDecl(container: Node): XQueryType | undefined {
		const typeDecl = directChildOf(container, 'TypeDeclaration');
		if (!typeDecl) return undefined;
		const seqType = directChildOf(typeDecl, 'SequenceType');
		if (!seqType) return undefined;
		const typeStr = sequenceTypeText(text, seqType);
		return typeStr ? parseType(typeStr) : undefined;
	}

	for (const binding of [...findAll(ast, 'LetBinding'), ...findAll(ast, 'ForBinding')]) {
		const varName = directChildOf(binding, 'VarName');
		const name = varName ? firstTerminalValue(varName) : null;
		if (!name) continue;
		const t = extractTypeDecl(binding);
		if (t) types.set(name, t);
	}

	for (const param of findAll(ast, 'Param')) {
		const eqname = directChildOf(param, 'EQName');
		const name = eqname ? firstTerminalValue(eqname) : null;
		if (!name) continue;
		const t = extractTypeDecl(param);
		if (t) types.set(name, t);
	}

	for (const varDecl of findAll(ast, 'VarDecl')) {
		const varName = directChildOf(varDecl, 'VarName');
		const name = varName ? firstTerminalValue(varName) : null;
		if (!name) continue;
		const t = extractTypeDecl(varDecl);
		if (t) types.set(name, t);
	}

	return types;
}

// ── Type name formatting ──────────────────────────────────────────────────────

export function formatType(t: XQueryType): string {
	if (t.kind === 'unknown') return 'unknown';
	if (t.kind === 'empty') return 'empty-sequence()';
	if (t.kind === 'item') return `item()${t.occurrence}`;
	if (t.kind === 'node') return `${t.name ?? 'node'}()${t.occurrence}`;
	return `${t.name ?? t.kind}${t.occurrence}`;
}

// ── Main entry point ─────────────────────────────────────────────────────────

export function checkTypes(
	ast: Node,
	text: string,
	analysis: FileAnalysis,
	importedAnalyses: Map<string, FileAnalysis>,
): TypeDiagnostic[] {
	const errors: TypeDiagnostic[] = [];
	const allFns = allFunctionsFlat(analysis, importedAnalyses);
	const varTypes = buildVarTypes(ast, text);

	for (const callNode of findAll(ast, 'FunctionCall')) {
		const nt = callNode as NonTerminal;
		const fnEqname = directChildOf(callNode, 'FunctionEQName');
		if (!fnEqname) continue;
		const fnName = firstTerminalValue(fnEqname);
		if (!fnName) continue;

		const colonIdx = fnName.indexOf(':');
		const prefix = colonIdx >= 0 ? fnName.slice(0, colonIdx) : '';
		const localName = colonIdx >= 0 ? fnName.slice(colonIdx + 1) : fnName;
		const nsUri = resolvePrefix(prefix, analysis);

		const argList = directChildOf(nt, 'ArgumentList');
		if (!argList) continue;
		const args = directChildrenOf(argList, 'Argument');

		const fn = allFns.find(f => f.namespaceUri === nsUri && f.localName === localName && f.arity === args.length);
		if (!fn) continue;

		for (let i = 0; i < args.length; i++) {
			const param = fn.params[i];
			if (!param?.type) continue;

			const declaredType = parseType(param.type);
			if (declaredType.kind === 'unknown') continue;

			const argNode = args[i];
			const exprSingle = directChildOf(argNode, 'ExprSingle');
			if (!exprSingle) continue;

			const inferredType = inferExprType(exprSingle, varTypes, analysis, allFns);
			if (inferredType.kind === 'unknown') continue;

			if (!isAssignable(inferredType, declaredType)) {
				errors.push({
					message: `Argument ${i + 1} of ${fnName}: expected ${param.type}, got ${formatType(inferredType)}`,
					offset: argNode.start,
					length: (argNode.end ?? argNode.start + 1) - argNode.start,
				});
			}
		}
	}

	return errors;
}
