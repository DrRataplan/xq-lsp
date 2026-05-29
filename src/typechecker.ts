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

// Parent pointer for each xs:* type in the XSD / XPath 3.1 type hierarchy.
// xs:numeric is a union type (decimal|float|double) handled separately below.
// Promotion rules (§3.1.5) are also encoded here: anyURI→string, float→double,
// decimal/integer→float, decimal/integer→double.
const ATOMIC_TYPE_PARENT: Record<string, string> = {
	// xs:anyAtomicType subtypes
	"xs:untypedAtomic":      "xs:anyAtomicType",
	"xs:boolean":            "xs:anyAtomicType",
	"xs:float":              "xs:anyAtomicType",
	"xs:double":             "xs:anyAtomicType",
	"xs:decimal":            "xs:anyAtomicType",
	"xs:duration":           "xs:anyAtomicType",
	"xs:dateTime":           "xs:anyAtomicType",
	"xs:date":               "xs:anyAtomicType",
	"xs:time":               "xs:anyAtomicType",
	"xs:gYearMonth":         "xs:anyAtomicType",
	"xs:gYear":              "xs:anyAtomicType",
	"xs:gMonthDay":          "xs:anyAtomicType",
	"xs:gDay":               "xs:anyAtomicType",
	"xs:gMonth":             "xs:anyAtomicType",
	"xs:hexBinary":          "xs:anyAtomicType",
	"xs:base64Binary":       "xs:anyAtomicType",
	"xs:anyURI":             "xs:anyAtomicType",
	"xs:QName":              "xs:anyAtomicType",
	"xs:NOTATION":           "xs:anyAtomicType",
	"xs:string":             "xs:anyAtomicType",
	// xs:string subtypes
	"xs:normalizedString":   "xs:string",
	"xs:token":              "xs:normalizedString",
	"xs:language":           "xs:token",
	"xs:NMTOKEN":            "xs:token",
	"xs:Name":               "xs:token",
	"xs:NCName":             "xs:Name",
	"xs:ID":                 "xs:NCName",
	"xs:IDREF":              "xs:NCName",
	"xs:ENTITY":             "xs:NCName",
	// xs:decimal subtypes
	"xs:integer":            "xs:decimal",
	"xs:long":               "xs:integer",
	"xs:int":                "xs:long",
	"xs:short":              "xs:int",
	"xs:byte":               "xs:short",
	"xs:nonPositiveInteger": "xs:integer",
	"xs:negativeInteger":    "xs:nonPositiveInteger",
	"xs:nonNegativeInteger": "xs:integer",
	"xs:positiveInteger":    "xs:nonNegativeInteger",
	"xs:unsignedLong":       "xs:nonNegativeInteger",
	"xs:unsignedInt":        "xs:unsignedLong",
	"xs:unsignedShort":      "xs:unsignedInt",
	"xs:unsignedByte":       "xs:unsignedShort",
	// xs:duration subtypes
	"xs:yearMonthDuration":  "xs:duration",
	"xs:dayTimeDuration":    "xs:duration",
	// xs:dateTime subtypes (XSD 1.1 / XPath 3.1)
	"xs:dateTimeStamp":      "xs:dateTime",
};

// Type promotion rules from XPath 3.1 §3.1.5: in function-call context a value
// of one type may be promoted to another.  Listed as direct promotions only;
// transitive cases fall out of the parent-walk in isAtomicSubtype.
const ATOMIC_PROMOTION: Record<string, string> = {
	"xs:anyURI": "xs:string",  // anyURI promotes to string
	"xs:float":  "xs:double",  // float promotes to double
	"xs:decimal": "xs:float",  // decimal (and integer) promote to float …
	// … and further to double via the float→double entry above
};

function isAtomicSubtype(from: string, to: string): boolean {
	if (from === to) return true;
	// xs:anyAtomicType accepts any atomic type.
	if (to === "xs:anyAtomicType") return from in ATOMIC_TYPE_PARENT || from === "xs:anyAtomicType";
	// xs:numeric is a union type equivalent to xs:decimal | xs:float | xs:double.
	if (to === "xs:numeric") {
		return isAtomicSubtype(from, "xs:decimal") || isAtomicSubtype(from, "xs:float") || isAtomicSubtype(from, "xs:double");
	}
	// Walk up the parent chain (subtype substitution).
	let cur: string | undefined = ATOMIC_TYPE_PARENT[from];
	while (cur !== undefined) {
		if (cur === to) return true;
		cur = ATOMIC_TYPE_PARENT[cur];
	}
	// Type promotion: check if `from` (or any ancestor) promotes to something
	// that is a subtype-or-equal to `to`.
	let probe: string | undefined = from;
	while (probe !== undefined) {
		const promoted = ATOMIC_PROMOTION[probe];
		if (promoted !== undefined && isAtomicSubtype(promoted, to)) return true;
		probe = ATOMIC_TYPE_PARENT[probe];
	}
	return false;
}

function isNodeSubtype(from: string | undefined, to: string | undefined): boolean {
	if (!from || !to) return true;
	if (to === "node") return true;
	// Generic node() (produced by path expressions) could be any specific kind at runtime;
	// only flag when we can prove it's definitely incompatible.
	if (from === "node") return true;
	return from === to;
}

export function isAssignable(from: XQueryType, to: XQueryType): boolean {
	if (from.kind === "unknown" || to.kind === "unknown") return true;
	if (to.kind === "item") return true;
	// xs:error is the XPath bottom type — no value is an instance of it; the only way
	// to "supply" it is via fn:error() which raises an error before returning.
	// Treat xs:error parameters as always-compatible to avoid false XPTY0004 reports.
	if (to.kind === "atomic" && to.name === "xs:error") return true;
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
		case "FunctionCall": {
			// Partial application — one or more ArgumentPlaceholder nodes ('?') are present.
			// The result is a function type we don't fully infer yet; return UNKNOWN to avoid
			// misidentifying it as the function's plain return type.
			const argList = directChildOf(node, "ArgumentList");
			if (argList && findAll(argList, "ArgumentPlaceholder").length > 0) return UNKNOWN;
			return inferFunctionReturn(node, analysis, allFns);
		}
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
		case "CompDocConstructor":
			return { kind: "node", name: "document-node", occurrence: "" };
		case "CompElemConstructor":
		case "DirElemConstructor":
			return { kind: "node", name: "element", occurrence: "" };
		case "CompAttrConstructor":
			return { kind: "node", name: "attribute", occurrence: "" };
		case "CompTextConstructor":
			return { kind: "node", name: "text", occurrence: "" };
		case "CompCommentConstructor":
			return { kind: "node", name: "comment", occurrence: "" };
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
		// Atomic-to-atomic: XQuery allows implicit conversions between atomic types at
		// runtime (e.g. string→numeric coercion), so we don't raise XPTY0004 statically
		// for these — they are dynamic errors, not static ones.
		// TODO: it should be possible to detect clear errors here (e.g. passing a string
		// literal where xs:numeric is expected with no applicable conversion), but that
		// requires modeling which conversions are actually allowed per §3.1.5 without
		// generating false positives for legitimate implicit coercions.
		if (inferredType.kind === "atomic" && declaredType.kind === "atomic") continue;
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
