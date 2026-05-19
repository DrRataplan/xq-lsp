import type { Node, NonTerminal } from "xq-parser";
import type { XQueryType, TypeDiagnostic, FileAnalysis, FunctionSymbol } from "./types.ts";
import { findAll, isTerminal, resolvePrefix } from "./analyzer.ts";
import { asFunctionCall, asVarRef, asTypedBinding, literalKind, isPathExpr, argExpr } from "./ast-nodes.ts";

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
	if (to === 'node') return true;
	return from === to;
}

export function isAssignable(from: XQueryType, to: XQueryType): boolean {
	if (from.kind === 'unknown' || to.kind === 'unknown') return true;
	if (to.kind === 'item') return true;
	if (from.kind === 'empty') return to.occurrence === '*' || to.occurrence === '?';

	if (from.kind === 'atomic' && to.kind === 'node') return false;
	if (from.kind === 'node' && to.kind === 'atomic') return false;

	if (from.kind === 'atomic' && to.kind === 'atomic') return isAtomicSubtype(from.name ?? '', to.name ?? '');
	if (from.kind === 'node' && to.kind === 'node') return isNodeSubtype(from.name, to.name);

	return true;
}

// ── Type inference ────────────────────────────────────────────────────────────

const LITERAL_TYPE: Record<string, XQueryType> = {
	string:  { kind: 'atomic', name: 'xs:string',  occurrence: '' },
	integer: { kind: 'atomic', name: 'xs:integer', occurrence: '' },
	decimal: { kind: 'atomic', name: 'xs:decimal', occurrence: '' },
	double:  { kind: 'atomic', name: 'xs:double',  occurrence: '' },
};

const NODE_STEP: XQueryType = { kind: 'node', name: 'node', occurrence: '*' };

function allFunctionsFlat(analysis: FileAnalysis, importedAnalyses: Map<string, FileAnalysis>): FunctionSymbol[] {
	const fns = [...analysis.functions];
	for (const a of importedAnalyses.values()) fns.push(...a.functions);
	return fns;
}

function inferFunctionReturn(node: Node, analysis: FileAnalysis, allFns: FunctionSymbol[]): XQueryType {
	const call = asFunctionCall(node);
	if (!call) return UNKNOWN;
	const nsUri = resolvePrefix(call.prefix, analysis);
	const fn = allFns.find(f => f.namespaceUri === nsUri && f.localName === call.localName && f.arity === call.args.length);
	return fn?.returnType ? parseType(fn.returnType) : UNKNOWN;
}

export function inferExprType(
	node: Node,
	varTypes: Map<string, XQueryType>,
	analysis: FileAnalysis,
	allFns: FunctionSymbol[],
): XQueryType {
	const lit = literalKind(node);
	if (lit) return LITERAL_TYPE[lit];
	if (isTerminal(node)) return UNKNOWN;

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
			const ref = asVarRef(node);
			return ref ? (varTypes.get(ref.varName) ?? UNKNOWN) : UNKNOWN;
		}
		case 'FunctionCall':
			return inferFunctionReturn(node, analysis, allFns);
		case 'PathExpr':
		case 'RelativePathExpr':
			if (isPathExpr(node)) return NODE_STEP;
			break;
		case 'AxisStep':
		case 'ForwardStep':
		case 'ReverseStep':
		case 'AbbrevForwardStep':
		case 'AbbrevReverseStep':
			return NODE_STEP;
	}

	const ntChildren = nt.children.filter(c => !isTerminal(c));
	if (ntChildren.length === 1) return inferExprType(ntChildren[0], varTypes, analysis, allFns);

	return UNKNOWN;
}

// ── Variable type context ─────────────────────────────────────────────────────

export function buildVarTypes(ast: Node, text: string): Map<string, XQueryType> {
	const types = new Map<string, XQueryType>();
	const nodeTypes = ['LetBinding', 'ForBinding', 'Param', 'VarDecl'];
	for (const node of nodeTypes.flatMap(t => findAll(ast, t))) {
		const binding = asTypedBinding(node, text);
		if (binding?.typeStr) types.set(binding.varName, parseType(binding.typeStr));
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
		const call = asFunctionCall(callNode);
		if (!call) continue;
		const nsUri = resolvePrefix(call.prefix, analysis);
		const fn = allFns.find(f => f.namespaceUri === nsUri && f.localName === call.localName && f.arity === call.args.length);
		if (!fn) continue;

		for (let i = 0; i < call.args.length; i++) {
			const param = fn.params[i];
			if (!param?.type) continue;
			const declaredType = parseType(param.type);
			if (declaredType.kind === 'unknown') continue;

			const expr = argExpr(call.args[i]);
			if (!expr) continue;
			const inferredType = inferExprType(expr, varTypes, analysis, allFns);
			if (inferredType.kind === 'unknown') continue;

			if (!isAssignable(inferredType, declaredType)) {
				errors.push({
					message: `Argument ${i + 1} of ${call.name}: expected ${param.type}, got ${formatType(inferredType)}`,
					offset: call.args[i].start,
					length: (call.args[i].end ?? call.args[i].start + 1) - call.args[i].start,
				});
			}
		}
	}

	return errors;
}
