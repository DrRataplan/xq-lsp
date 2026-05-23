import type { Node, NonTerminal } from "xq-parser";
import type { XQueryType, TypeDiagnostic, FileAnalysis, FunctionSymbol } from "./types.ts";
import { formatQName, qnameKey } from "./types.ts";
import { findAll, isTerminal, directChildOf } from "./analyzer.ts";
import { asFunctionCall, asVarRef, asTypedBinding, literalKind, isPathExpr, argExpr } from "./ast-nodes.ts";

// ── Type constants ───────────────────────────────────────────────────────────

const UNKNOWN: XQueryType = { kind: "unknown", occurrence: "" };

// ── Type parsing ─────────────────────────────────────────────────────────────

const NODE_KIND_PREFIXES = [
	"node(",
	"element(",
	"attribute(",
	"text(",
	"comment(",
	"document-node(",
	"processing-instruction(",
	"schema-element(",
	"schema-attribute(",
];

export function parseType(typeStr: string): XQueryType {
	const trimmed = typeStr.trim();
	if (!trimmed) return UNKNOWN;

	let occurrence: XQueryType["occurrence"] = "";
	let base = trimmed;
	const last = trimmed[trimmed.length - 1];
	if (last === "*") {
		occurrence = "*";
		base = trimmed.slice(0, -1).trim();
	} else if (last === "+") {
		occurrence = "+";
		base = trimmed.slice(0, -1).trim();
	} else if (last === "?") {
		occurrence = "?";
		base = trimmed.slice(0, -1).trim();
	}

	if (base === "item()") return { kind: "item", occurrence };
	if (base === "empty-sequence()") return { kind: "empty", occurrence: "" };

	if (NODE_KIND_PREFIXES.some((p) => base === p.slice(0, -1) + ")" || base.startsWith(p))) {
		const name = base.replace(/\(.*/, "");
		return { kind: "node", name, occurrence };
	}

	if (base.startsWith("map(")) return { kind: "map", name: base, occurrence };
	if (base.startsWith("array(")) return { kind: "array", name: base, occurrence };
	if (base.startsWith("function(")) return { kind: "function", name: base, occurrence };

	if (base.includes(":")) return { kind: "atomic", name: base, occurrence };

	return UNKNOWN;
}

// ── Type compatibility ────────────────────────────────────────────────────────

const ATOMIC_SUBTYPES: Record<string, string[]> = {
	"xs:anyAtomicType": [
		"xs:string",
		"xs:boolean",
		"xs:integer",
		"xs:decimal",
		"xs:float",
		"xs:double",
		"xs:duration",
		"xs:dateTime",
		"xs:date",
		"xs:time",
		"xs:anyURI",
		"xs:QName",
		"xs:NOTATION",
		"xs:hexBinary",
		"xs:base64Binary",
	],
	"xs:numeric": ["xs:integer", "xs:decimal", "xs:float", "xs:double"],
	"xs:decimal": ["xs:integer"],
	// Numeric type promotion per XPath 3.1 §B.1: integer/decimal/float promote to double; integer/decimal promote to float
	"xs:double": ["xs:float", "xs:decimal", "xs:integer"],
	"xs:float": ["xs:decimal", "xs:integer"],
	// xs:anyURI promotes to xs:string in function-call context per XPath 3.1 §2.6.5
	"xs:string": ["xs:normalizedString", "xs:token", "xs:language", "xs:Name", "xs:NCName", "xs:NMTOKEN", "xs:anyURI"],
};

function isAtomicSubtype(from: string, to: string): boolean {
	if (from === to) return true;
	const subs = ATOMIC_SUBTYPES[to];
	return subs !== undefined && subs.includes(from);
}

function isNodeSubtype(from: string | undefined, to: string | undefined): boolean {
	if (!from || !to) return true;
	if (to === "node") return true;
	return from === to;
}

export function isAssignable(from: XQueryType, to: XQueryType): boolean {
	if (from.kind === "unknown" || to.kind === "unknown") return true;
	if (to.kind === "item") return true;
	if (from.kind === "empty") return to.occurrence === "*" || to.occurrence === "?";

	if (from.kind === "atomic" && to.kind === "node") return false;
	if (from.kind === "node" && to.kind === "atomic") return false;

	if (from.kind === "atomic" && to.kind === "atomic") return isAtomicSubtype(from.name ?? "", to.name ?? "");
	if (from.kind === "node" && to.kind === "node") return isNodeSubtype(from.name, to.name);

	return true;
}

// ── Type inference ────────────────────────────────────────────────────────────

const LITERAL_TYPE: Record<string, XQueryType> = {
	string: { kind: "atomic", name: "xs:string", occurrence: "" },
	integer: { kind: "atomic", name: "xs:integer", occurrence: "" },
	decimal: { kind: "atomic", name: "xs:decimal", occurrence: "" },
	double: { kind: "atomic", name: "xs:double", occurrence: "" },
};

const NODE_STEP: XQueryType = { kind: "node", name: "node", occurrence: "*" };

function allFunctionsFlat(analysis: FileAnalysis, importedAnalyses: Map<string, FileAnalysis>): FunctionSymbol[] {
	const fns = [...analysis.functions];
	for (const a of importedAnalyses.values()) fns.push(...a.functions);
	return fns;
}

function inferFunctionReturn(node: Node, analysis: FileAnalysis, allFns: FunctionSymbol[]): XQueryType {
	const call = asFunctionCall(node, analysis);
	if (!call) return UNKNOWN;
	const fn = allFns.find(
		(f) =>
			f.qname.namespaceUri === call.qname.namespaceUri &&
			f.qname.localName === call.qname.localName &&
			f.arity === call.args.length,
	);
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
		case "Literal":
		case "NumericLiteral": {
			for (const c of nt.children) {
				const t = inferExprType(c, varTypes, analysis, allFns);
				if (t.kind !== "unknown") return t;
			}
			break;
		}
		case "VarRef": {
			const qname = asVarRef(node, analysis);
			return qname ? (varTypes.get(qnameKey(qname)) ?? UNKNOWN) : UNKNOWN;
		}
		case "FunctionCall":
			return inferFunctionReturn(node, analysis, allFns);
		case "PathExpr":
		case "RelativePathExpr":
			if (isPathExpr(node)) return NODE_STEP;
			break;
		case "AxisStep":
		case "ForwardStep":
		case "ReverseStep":
		case "AbbrevForwardStep":
		case "AbbrevReverseStep":
			return NODE_STEP;
	}

	const ntChildren = nt.children.filter((c) => !isTerminal(c));
	if (ntChildren.length === 1) return inferExprType(ntChildren[0], varTypes, analysis, allFns);

	return UNKNOWN;
}

// ── Type name formatting ──────────────────────────────────────────────────────

export function formatType(t: XQueryType): string {
	if (t.kind === "unknown") return "unknown";
	if (t.kind === "empty") return "empty-sequence()";
	if (t.kind === "item") return `item()${t.occurrence}`;
	if (t.kind === "node") return `${t.name ?? "node"}()${t.occurrence}`;
	return `${t.name ?? t.kind}${t.occurrence}`;
}

// ── Scope-aware type checking ─────────────────────────────────────────────────

// Collect module-level VarDecl types — visible throughout the whole module.
function buildModuleVarTypes(ast: Node, text: string, analysis: FileAnalysis): Map<string, XQueryType> {
	const types = new Map<string, XQueryType>();
	for (const node of findAll(ast, "VarDecl")) {
		const binding = asTypedBinding(node, text, analysis);
		if (binding?.typeStr) types.set(qnameKey(binding.qname), parseType(binding.typeStr));
	}
	return types;
}

// Collect typed param bindings from a ParamList into `scope`.
function collectParams(paramList: Node | undefined, text: string, analysis: FileAnalysis, scope: Map<string, XQueryType>): void {
	if (!paramList) return;
	for (const param of findAll(paramList, "Param")) {
		const binding = asTypedBinding(param, text, analysis);
		if (binding?.typeStr) scope.set(qnameKey(binding.qname), parseType(binding.typeStr));
	}
}

// Check a single FunctionCall node against the known function signatures.
function typeCheckCall(
	callNode: Node,
	varTypes: Map<string, XQueryType>,
	analysis: FileAnalysis,
	allFns: FunctionSymbol[],
	errors: TypeDiagnostic[],
): void {
	const call = asFunctionCall(callNode, analysis);
	if (!call) return;
	const fn = allFns.find(
		(f) =>
			f.qname.namespaceUri === call.qname.namespaceUri &&
			f.qname.localName === call.qname.localName &&
			f.arity === call.args.length,
	);
	if (!fn) return;
	for (let i = 0; i < call.args.length; i++) {
		const param = fn.params[i];
		if (!param?.type) continue;
		const declaredType = parseType(param.type);
		if (declaredType.kind === "unknown") continue;
		const expr = argExpr(call.args[i]);
		if (!expr) continue;
		const inferredType = inferExprType(expr, varTypes, analysis, allFns);
		if (inferredType.kind === "unknown") continue;
		// XQuery function conversion rules (§3.1.5): nodes are atomized to atomic values,
		// so a node argument where an atomic type is expected is not a static error.
		if (inferredType.kind === "node" && declaredType.kind === "atomic") continue;
		if (!isAssignable(inferredType, declaredType)) {
			errors.push({
				message: `Argument ${i + 1} of ${formatQName(call.qname)}: expected ${param.type}, got ${formatType(inferredType)} [XPTY0004]`,
				code: "XPTY0004",
				offset: call.args[i].start,
				length: (call.args[i].end ?? call.args[i].start + 1) - call.args[i].start,
			});
		}
	}
}

// Walk `node` checking function calls with `scopeTypes` as the variable context.
// `moduleTypes` is passed separately so InlineFunctionExpr can start a fresh isolated scope.
// LetBinding/ForBinding nodes extend `scopeTypes` in place as the walk proceeds.
// InlineFunctionExpr nodes receive a new isolated scope (their own params + module vars).
function walkScope(
	node: Node,
	scopeTypes: Map<string, XQueryType>,
	moduleTypes: Map<string, XQueryType>,
	text: string,
	analysis: FileAnalysis,
	allFns: FunctionSymbol[],
	errors: TypeDiagnostic[],
): void {
	if (isTerminal(node)) return;
	const nt = node as NonTerminal;

	if (node.type === "InlineFunctionExpr") {
		// New isolated scope: module vars + this inline function's own params.
		const innerScope = new Map(moduleTypes);
		collectParams(directChildOf(node, "ParamList"), text, analysis, innerScope);
		const body = directChildOf(node, "FunctionBody");
		if (body) walkScope(body, innerScope, moduleTypes, text, analysis, allFns, errors);
		return;
	}

	if (node.type === "LetBinding" || node.type === "ForBinding") {
		const binding = asTypedBinding(node, text, analysis);
		if (binding?.typeStr) scopeTypes.set(qnameKey(binding.qname), parseType(binding.typeStr));
	}

	if (node.type === "FunctionCall") {
		typeCheckCall(node, scopeTypes, analysis, allFns, errors);
	}

	for (const child of nt.children) {
		walkScope(child, scopeTypes, moduleTypes, text, analysis, allFns, errors);
	}
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
	const moduleTypes = buildModuleVarTypes(ast, text, analysis);

	// Each named function declaration gets its own isolated scope (params + module vars).
	for (const annotated of findAll(ast, "AnnotatedDecl")) {
		const decl = directChildOf(annotated, "FunctionDecl");
		if (!decl) continue;
		const body = directChildOf(decl, "FunctionBody");
		if (!body) continue; // external function — nothing to check

		const scopeTypes = new Map(moduleTypes);
		collectParams(directChildOf(decl, "ParamList"), text, analysis, scopeTypes);
		walkScope(body, scopeTypes, moduleTypes, text, analysis, allFns, errors);
	}

	// Top-level query body (present in main modules, absent in library modules).
	for (const queryBody of findAll(ast, "QueryBody")) {
		walkScope(queryBody, new Map(moduleTypes), moduleTypes, text, analysis, allFns, errors);
	}

	return errors;
}
