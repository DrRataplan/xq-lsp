import type { Node, NonTerminal } from "xq-parser";
import type { XQueryType, TypeDiagnostic, FileAnalysis, FunctionSymbol } from "./types.ts";
import { formatQName, qnameKey } from "./types.ts";
import {
	findAll,
	isTerminal,
	directChildOf,
	directChildrenOf,
	firstTerminalValue,
	parseEQName,
	resolvePrefix,
	XMLNS_ARRAY,
	XMLNS_FN,
	XMLNS_MAP,
} from "./analyzer.ts";
import { asFunctionCall, asNamedFunctionRef, asVarRef, asVarName, literalKind, isPathExpr, argExpr } from "./ast-nodes.ts";

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
	if (from.kind === "empty") return to.occurrence === "*" || to.occurrence === "?";

	if (from.kind === "atomic" && to.kind === "node") return false;
	if (from.kind === "node" && to.kind === "atomic") return false;

	if (from.kind === "atomic" && to.kind === "atomic") return isAtomicSubtype(from.name ?? "", to.name ?? "");
	if (from.kind === "node" && to.kind === "node") return isNodeSubtype(from.name, to.name);

	return true;
}

// ── Type algebra ──────────────────────────────────────────────────────────────

const EMPTY: XQueryType = { kind: "empty", occurrence: "" };
const BOOLEAN: XQueryType = { kind: "atomic", name: "xs:boolean", occurrence: "" };
const STRING: XQueryType = { kind: "atomic", name: "xs:string", occurrence: "" };
const INTEGER: XQueryType = { kind: "atomic", name: "xs:integer", occurrence: "" };

// Cardinality as [min, max] with max 2 standing for "many". `unknown` types are
// treated as "any number of items" so they never make a combined type look tighter
// than it is.
interface Card {
	min: 0 | 1;
	max: 0 | 1 | 2;
}

const ONE: Card = { min: 1, max: 1 };

function cardOf(t: XQueryType): Card {
	if (t.kind === "empty") return { min: 0, max: 0 };
	if (t.kind === "unknown") return { min: 0, max: 2 };
	switch (t.occurrence) {
		case "?":
			return { min: 0, max: 1 };
		case "+":
			return { min: 1, max: 2 };
		case "*":
			return { min: 0, max: 2 };
		default:
			return ONE;
	}
}

function withCard(t: XQueryType, c: Card): XQueryType {
	if (t.kind === "unknown") return t;
	if (c.max === 0 || t.kind === "empty") return EMPTY;
	const occurrence = c.min === 1 ? (c.max === 1 ? "" : "+") : c.max === 1 ? "?" : "*";
	return { ...t, occurrence };
}

/** Cardinality of evaluating `b` once per item of `a` (FLWOR `for`, `!`, path steps). */
function multiplyCard(a: Card, b: Card): Card {
	const min = a.min === 1 && b.min === 1 ? 1 : 0;
	const max = a.max === 0 || b.max === 0 ? 0 : a.max === 1 && b.max === 1 ? 1 : 2;
	return { min, max };
}

/** The type of a single item of `t` — e.g. what a `for` variable over `t` holds. */
export function itemTypeOf(t: XQueryType): XQueryType {
	if (t.kind === "unknown" || t.kind === "empty") return t;
	return t.occurrence === "" ? t : { ...t, occurrence: "" };
}

function derivesFrom(from: string, to: string): boolean {
	for (let cur: string | undefined = from; cur !== undefined; cur = ATOMIC_TYPE_PARENT[cur]) {
		if (cur === to) return true;
	}
	return false;
}

// Nearest common supertype in the derivation hierarchy (no promotion), falling back to
// xs:numeric for mixed numerics (e.g. `if (…) then 1 else 1e0`) and xs:anyAtomicType otherwise.
function commonAtomicSupertype(a: string, b: string): string {
	for (let cur: string | undefined = a; cur !== undefined && cur !== "xs:anyAtomicType"; cur = ATOMIC_TYPE_PARENT[cur]) {
		if (derivesFrom(b, cur)) return cur;
	}
	if (isAtomicSubtype(a, "xs:numeric") && isAtomicSubtype(b, "xs:numeric")) return "xs:numeric";
	return "xs:anyAtomicType";
}

// Least upper bound of two (non-empty, known) item types, ignoring occurrence.
function itemUnion(a: XQueryType, b: XQueryType): XQueryType {
	if (a.kind === b.kind) {
		switch (a.kind) {
			case "atomic":
				return { kind: "atomic", name: commonAtomicSupertype(a.name ?? "", b.name ?? ""), occurrence: "" };
			case "node":
				return { kind: "node", name: a.name === b.name ? a.name : "node", occurrence: "" };
			case "map":
			case "array":
			case "function":
				return { kind: a.kind, name: a.name === b.name ? a.name : `${a.kind}(*)`, occurrence: "" };
			default:
				return { kind: a.kind, occurrence: "" };
		}
	}
	return { kind: "item", occurrence: "" };
}

/** Type of an expression that yields either `a` or `b` (if/else, switch, typeswitch, try/catch). */
export function choiceType(a: XQueryType, b: XQueryType): XQueryType {
	if (a.kind === "unknown" || b.kind === "unknown") return UNKNOWN;
	if (a.kind === "empty" && b.kind === "empty") return EMPTY;
	const ca = cardOf(a);
	const cb = cardOf(b);
	const card: Card = { min: ca.min === 1 && cb.min === 1 ? 1 : 0, max: ca.max > cb.max ? ca.max : cb.max };
	if (a.kind === "empty") return withCard(b, card);
	if (b.kind === "empty") return withCard(a, card);
	return withCard(itemUnion(a, b), card);
}

/** Type of the sequence `(a, b)`. */
export function concatType(a: XQueryType, b: XQueryType): XQueryType {
	if (a.kind === "unknown" || b.kind === "unknown") return UNKNOWN;
	if (a.kind === "empty") return b;
	if (b.kind === "empty") return a;
	const ca = cardOf(a);
	const cb = cardOf(b);
	return withCard(itemUnion(a, b), { min: 1, max: ca.max + cb.max > 1 ? 2 : 1 });
}

// Splits the parameter list of a parameterized type name, e.g. "map(xs:string, item()*)"
// → ["xs:string", "item()*"], respecting nested parentheses.
function typeArgs(name: string): string[] {
	const open = name.indexOf("(");
	const inner = name.slice(open + 1, name.lastIndexOf(")"));
	const args: string[] = [];
	let depth = 0;
	let startIdx = 0;
	for (let i = 0; i < inner.length; i++) {
		if (inner[i] === "(") depth++;
		else if (inner[i] === ")") depth--;
		else if (inner[i] === "," && depth === 0) {
			args.push(inner.slice(startIdx, i).trim());
			startIdx = i + 1;
		}
	}
	args.push(inner.slice(startIdx).trim());
	return args.filter((a) => a !== "");
}

function typeText(t: XQueryType, fallback: string): string {
	return t.kind === "unknown" ? fallback : formatType(t);
}

// ── Type inference ────────────────────────────────────────────────────────────

const LITERAL_TYPE: Record<string, XQueryType> = {
	string: STRING,
	integer: INTEGER,
	decimal: { kind: "atomic", name: "xs:decimal", occurrence: "" },
	double: { kind: "atomic", name: "xs:double", occurrence: "" },
};

const NODE_STEP: XQueryType = { kind: "node", name: "node", occurrence: "*" };
const RANGE_SEQUENCE: XQueryType = { kind: "atomic", name: "xs:integer", occurrence: "*" };

/** Scope key under which the context item's type (`.`) is tracked, e.g. inside `!` and predicates. */
const CONTEXT_ITEM_KEY = ".";

// Reuses the existing xs:numeric union check and subtype/promotion chain (isAtomicSubtype)
// rather than a separate hardcoded numeric ordering.
function numericAtomicName(t: XQueryType): string | null {
	return t.kind === "atomic" && t.name && isAtomicSubtype(t.name, "xs:numeric") ? t.name : null;
}

function widenNumeric(a: string, b: string): string {
	if (isAtomicSubtype(a, b)) return b;
	if (isAtomicSubtype(b, a)) return a;
	return "xs:double"; // neither promotes to the other — fall back to the widest common type
}

const UNTYPED_ATOMIC = "xs:untypedAtomic";

// Atomized item type of `t`, keeping its cardinality. Nodes are assumed untyped (not
// schema-validated), so element/attribute/text/document values atomize to xs:untypedAtomic;
// comments and processing instructions atomize to xs:string.
function atomize(t: XQueryType): XQueryType {
	if (t.kind === "atomic" || t.kind === "empty") return t;
	if (t.kind === "node") {
		const name = t.name === "comment" || t.name === "processing-instruction" ? "xs:string" : UNTYPED_ATOMIC;
		return { kind: "atomic", name, occurrence: t.occurrence };
	}
	return UNKNOWN;
}

/** Arithmetic and aggregate functions cast xs:untypedAtomic operands to xs:double. */
function arithmeticOperandName(t: XQueryType): string | undefined {
	return t.name === UNTYPED_ATOMIC ? "xs:double" : t.name;
}

const YEAR_MONTH = "xs:yearMonthDuration";
const DAY_TIME = "xs:dayTimeDuration";
const isDuration = (n: string) => n === YEAR_MONTH || n === DAY_TIME;
const isDateOrDateTime = (n: string) => n === "xs:date" || n === "xs:dateTime";

// Item type of `a op b` for single atomic operands, per the XPath 3.1 operator mapping table
// (numeric arithmetic, date/time subtraction, date/time ± duration, duration scaling).
function arithmeticItemName(op: string, a: string, b: string): string | null {
	const aNum = isAtomicSubtype(a, "xs:numeric");
	const bNum = isAtomicSubtype(b, "xs:numeric");
	if (aNum && bNum) {
		if (op === "idiv") return "xs:integer";
		if (op === "div" && isAtomicSubtype(a, "xs:decimal") && isAtomicSubtype(b, "xs:decimal")) {
			return widenNumeric(widenNumeric(a, b), "xs:decimal"); // integer div integer is never exact
		}
		return widenNumeric(a, b);
	}
	const additive = op === "+" || op === "-";
	if (op === "-" && a === b && (isDateOrDateTime(a) || a === "xs:time")) return DAY_TIME;
	if (additive && isDateOrDateTime(a) && isDuration(b)) return a;
	if (additive && a === "xs:time" && b === DAY_TIME) return a;
	if (op === "+" && isDuration(a) && (isDateOrDateTime(b) || (b === "xs:time" && a === DAY_TIME))) return b;
	if (additive && isDuration(a) && a === b) return a;
	if ((op === "*" || op === "div") && isDuration(a) && bNum) return a;
	if (op === "*" && aNum && isDuration(b)) return b;
	if (op === "div" && isDuration(a) && a === b) return "xs:decimal";
	return null;
}

// Result type of a `+`/`-`/`*`/`div`/`idiv`/`mod` operator: operands are atomized, an empty
// operand gives (), an optional one makes the result optional, and more than one item is a
// type error (so we don't guess).
function arithmeticResult(op: string, a: XQueryType, b: XQueryType): XQueryType {
	const ta = atomize(a);
	const tb = atomize(b);
	if (ta.kind === "unknown" || tb.kind === "unknown") return UNKNOWN;
	if (ta.kind === "empty" || tb.kind === "empty") return EMPTY;
	const ca = cardOf(ta);
	const cb = cardOf(tb);
	if (ca.max > 1 || cb.max > 1) return UNKNOWN;
	const aName = arithmeticOperandName(ta);
	const bName = arithmeticOperandName(tb);
	const name = aName && bName ? arithmeticItemName(op, aName, bName) : null;
	if (!name) return UNKNOWN;
	return { kind: "atomic", name, occurrence: ca.min === 1 && cb.min === 1 ? "" : "?" };
}

function allFunctionsFlat(analysis: FileAnalysis, importedAnalyses: Map<string, FileAnalysis>): FunctionSymbol[] {
	const fns = [...analysis.functions];
	for (const a of importedAnalyses.values()) fns.push(...a.functions);
	return fns;
}

/** Finds the declaration a call with `argCount` arguments resolves to, honouring variadic functions. */
export function resolveFunction(
	qname: { namespaceUri: string; localName: string },
	argCount: number,
	allFns: FunctionSymbol[],
): FunctionSymbol | undefined {
	return allFns.find(
		(f) =>
			f.qname.namespaceUri === qname.namespaceUri &&
			f.qname.localName === qname.localName &&
			(f.variadic ? argCount >= f.arity : f.arity === argCount),
	);
}

/** Concatenated terminal text of a node — enough to reconstruct a SequenceType for `parseType`. */
function nodeText(node: Node): string {
	if (isTerminal(node)) return node.value;
	return (node as NonTerminal).children.map(nodeText).join("");
}

function sequenceTypeOf(node: Node | undefined): XQueryType | undefined {
	if (!node) return undefined;
	const text = nodeText(node);
	// Typeswitch case unions (`case xs:integer | xs:string`) are a choice of their members.
	if (text.includes("|")) return text.split("|").map(parseType).reduce(choiceType);
	return parseType(text);
}

/** The declared `as SequenceType` of a binding, parameter or variable declaration, if any. */
function declaredTypeOf(node: Node): XQueryType | undefined {
	const typeDecl = directChildOf(node, "TypeDeclaration");
	return typeDecl ? sequenceTypeOf(directChildOf(typeDecl, "SequenceType")) : undefined;
}

// Generic built-ins whose declared signature (item()*) loses the argument's item type.
// Maps local name → the cardinality of the result relative to the first argument's item type.
const FN_SEQUENCE_PRESERVING: Record<string, Card | "same"> = {
	head: { min: 0, max: 1 },
	"exactly-one": ONE,
	"zero-or-one": { min: 0, max: 1 },
	"one-or-more": { min: 1, max: 2 },
	tail: { min: 0, max: 2 },
	subsequence: { min: 0, max: 2 },
	remove: { min: 0, max: 2 },
	filter: { min: 0, max: 2 },
	reverse: "same",
	unordered: "same",
	sort: "same",
	foot: { min: 0, max: 1 },
	trunk: { min: 0, max: 2 },
};

/** `R` of a single `function(…) as R` item, if known. */
function functionResultType(f: XQueryType): XQueryType | undefined {
	if (f.kind !== "function" || f.occurrence !== "" || !f.name?.includes(" as ")) return undefined;
	const r = parseType(f.name.slice(f.name.lastIndexOf(" as ") + 4));
	return r.kind === "unknown" ? undefined : r;
}

/** Member types of a single map(K, V) / array(T): `[K, V]` or `[T]`, or undefined for `map(*)` etc. */
function containerArgs(t: XQueryType, kind: "map" | "array"): XQueryType[] | undefined {
	if (t.kind !== kind || t.occurrence !== "" || !t.name) return undefined;
	const args = typeArgs(t.name).map(parseType);
	if (args.length !== (kind === "map" ? 2 : 1) || args.some((a) => a.kind === "unknown")) return undefined;
	return args;
}

// Aggregates (sum/avg/min/max): the atomized item name with untypedAtomic cast to xs:double,
// or undefined when it isn't numeric or a duration (or, for min/max, another comparable type).
function aggregateItemName(t: XQueryType, allowAnyAtomic: boolean): string | undefined {
	const atomized = atomize(t);
	if (atomized.kind !== "atomic") return undefined;
	const name = arithmeticOperandName(atomized);
	if (!name) return undefined;
	if (isAtomicSubtype(name, "xs:numeric") || isDuration(name) || allowAnyAtomic) return name;
	return undefined;
}

// Built-ins whose declared signature (item()*, xs:anyAtomicType*, …) loses information the
// arguments carry: aggregates, atomization, higher-order functions, and map/array accessors.
function inferPolymorphicBuiltin(ns: string, name: string, args: XQueryType[]): XQueryType | undefined {
	const [first, second, third] = args;
	if (!first || first.kind === "unknown") return undefined;
	const card = cardOf(first);
	if (ns === XMLNS_FN) {
		if (name in FN_SEQUENCE_PRESERVING) {
			const rule = FN_SEQUENCE_PRESERVING[name];
			return rule === "same" ? first : withCard(first, rule);
		}
		switch (name) {
			case "data":
				return args.length === 1 ? atomize(first) : undefined;
			case "distinct-values": {
				const atomized = atomize(first);
				return atomized.kind === "unknown" ? undefined : withCard(atomized, { min: card.min, max: card.max });
			}
			case "sum": {
				if (first.kind === "empty") return args.length === 1 ? INTEGER : second;
				const item = aggregateItemName(first, false);
				if (!item) return undefined;
				const t: XQueryType = { kind: "atomic", name: item, occurrence: "" };
				// sum(()) is 0, or the explicit zero value when one is given.
				return card.min === 1 || args.length === 1 ? t : second && choiceType(t, second);
			}
			case "avg":
			case "min":
			case "max": {
				if (first.kind === "empty") return EMPTY;
				const item = aggregateItemName(first, name !== "avg");
				if (!item) return undefined;
				const avgName = isAtomicSubtype(item, "xs:decimal") ? "xs:decimal" : item;
				return { kind: "atomic", name: name === "avg" ? avgName : item, occurrence: card.min === 1 ? "" : "?" };
			}
			case "for-each": {
				const r = second && functionResultType(second);
				return r && withCard(r, multiplyCard(card, cardOf(r)));
			}
			case "for-each-pair": {
				const r = third && functionResultType(third);
				if (!r || !second || second.kind === "unknown") return undefined;
				const other = cardOf(second);
				const pairs: Card = { min: card.min === 1 && other.min === 1 ? 1 : 0, max: card.max < other.max ? card.max : other.max };
				return withCard(r, multiplyCard(pairs, cardOf(r)));
			}
		}
		return undefined;
	}
	if (ns === XMLNS_MAP) {
		switch (name) {
			case "entry": {
				const key = atomize(first);
				if (key.kind !== "atomic" || !second || second.kind === "unknown") return undefined;
				return { kind: "map", name: `map(${formatType(itemTypeOf(key))}, ${formatType(second)})`, occurrence: "" };
			}
		}
		const kv = containerArgs(first, "map");
		if (!kv) return undefined;
		const [key, value] = kv;
		switch (name) {
			case "get":
				return withCard(value, { min: 0, max: cardOf(value).max });
			case "keys":
				return withCard(key, { min: 0, max: 2 });
			case "remove":
				return first;
			case "put": {
				if (!second || !third || second.kind === "unknown" || third.kind === "unknown") return undefined;
				const newKey = atomize(itemTypeOf(second));
				if (newKey.kind !== "atomic") return undefined;
				return { kind: "map", name: `map(${formatType(itemUnion(key, newKey))}, ${formatType(choiceType(value, third))})`, occurrence: "" };
			}
			case "for-each": {
				const r = second && functionResultType(second);
				return r && withCard(r, multiplyCard({ min: 0, max: 2 }, cardOf(r)));
			}
		}
		return undefined;
	}
	if (ns === XMLNS_ARRAY) {
		const members = containerArgs(first, "array");
		if (!members) return undefined;
		const [member] = members;
		switch (name) {
			case "get":
			case "head":
			case "foot":
				return member;
			case "tail":
			case "trunk":
			case "reverse":
			case "subarray":
			case "remove":
			case "filter":
			case "sort":
				return first;
			case "append":
				return second && second.kind !== "unknown" ? { kind: "array", name: `array(${formatType(choiceType(member, second))})`, occurrence: "" } : undefined;
			case "for-each": {
				const r = second && functionResultType(second);
				return r && { kind: "array", name: `array(${formatType(r)})`, occurrence: "" };
			}
		}
	}
	return undefined;
}

function inferCallResult(
	qname: { namespaceUri: string; localName: string },
	argTypes: () => XQueryType[],
	argCount: number,
	allFns: FunctionSymbol[],
): XQueryType {
	if (argCount >= 1 && (qname.namespaceUri === XMLNS_FN || qname.namespaceUri === XMLNS_MAP || qname.namespaceUri === XMLNS_ARRAY)) {
		const special = inferPolymorphicBuiltin(qname.namespaceUri, qname.localName, argTypes());
		if (special) return special;
	}
	const fn = resolveFunction(qname, argCount, allFns);
	return fn?.returnType ? parseType(fn.returnType) : UNKNOWN;
}

function functionTypeOf(fn: FunctionSymbol): XQueryType {
	const params = fn.params.map((p) => p.type ?? "item()*").join(", ");
	return { kind: "function", name: `function(${params}) as ${fn.returnType ?? "item()*"}`, occurrence: "" };
}

// Kind of node selected by an axis step: `@x`/`attribute::x` → attribute, a plain name test on
// any other axis → element, a kind test → that kind, `..` → any node.
function axisStepType(step: Node): XQueryType {
	const text = nodeText(step);
	if (text.startsWith("..")) return NODE_STEP;
	const kindTests = findAll(step, "KindTest");
	if (kindTests.length > 0) {
		const kind = nodeText(kindTests[0]).replace(/\(.*$/s, "");
		const name = kind === "schema-element" ? "element" : kind === "schema-attribute" ? "attribute" : kind;
		return { kind: "node", name, occurrence: "*" };
	}
	const isAttributeAxis = text.startsWith("@") || text.startsWith("attribute::");
	return { kind: "node", name: isAttributeAxis ? "attribute" : "element", occurrence: "*" };
}

function inferPathExpr(nt: NonTerminal, varTypes: Map<string, XQueryType>, analysis: FileAnalysis, allFns: FunctionSymbol[]): XQueryType {
	const steps = nt.children.filter((c) => !isTerminal(c));
	if (steps.length === 0) return { kind: "node", name: "document-node", occurrence: "" }; // lone "/"
	// Every step before the last feeds the path's navigation — if one provably isn't a node
	// (a literal, an atomic function result, …) the path is a type error; don't guess.
	const definitelyNotNodes = steps.slice(0, -1).some((step) => {
		const stepType = inferExprType(step, varTypes, analysis, allFns);
		return stepType.kind !== "unknown" && stepType.kind !== "node" && stepType.kind !== "item";
	});
	if (definitelyNotNodes) return UNKNOWN;
	const last = inferExprType(steps[steps.length - 1], varTypes, analysis, allFns);
	if (last.kind === "node" || last.kind === "atomic") return withCard(last, { min: 0, max: 2 });
	return NODE_STEP;
}

function inferPostfixExpr(
	nt: NonTerminal,
	varTypes: Map<string, XQueryType>,
	analysis: FileAnalysis,
	allFns: FunctionSymbol[],
): XQueryType {
	const [base, ...postfixes] = nt.children.filter((c) => !isTerminal(c));
	let t = inferExprType(base, varTypes, analysis, allFns);
	for (const postfix of postfixes) {
		if (t.kind === "unknown") return UNKNOWN;
		const card = cardOf(t);
		if (postfix.type === "Predicate") {
			const expr = directChildOf(postfix, "Expr");
			const predScope = new Map(varTypes);
			predScope.set(CONTEXT_ITEM_KEY, itemTypeOf(t));
			const predType = expr ? inferExprType(expr, predScope, analysis, allFns) : UNKNOWN;
			// A single numeric predicate (`$seq[1]`, `$seq[$i]`) selects at most one item.
			const positional = predType.occurrence === "" && numericAtomicName(predType) !== null;
			t = withCard(t, { min: 0, max: positional && card.max > 1 ? 1 : card.max });
		} else if (postfix.type === "Lookup") {
			t = lookupType(t, postfix);
		} else if (postfix.type === "ArgumentList" && t.kind === "function" && t.occurrence === "" && t.name?.includes(" as ")) {
			t = parseType(t.name.slice(t.name.lastIndexOf(" as ") + 4));
		} else {
			return UNKNOWN;
		}
	}
	return t;
}

// `$m?key` / `$a?1` / `$x?*` on a map(K, V) or array(T).
function lookupType(t: XQueryType, lookup: Node): XQueryType {
	if ((t.kind !== "map" && t.kind !== "array") || !t.name) return UNKNOWN;
	const args = typeArgs(t.name);
	const memberText = t.kind === "map" ? args[1] : args[0];
	if (!memberText || memberText === "*") return UNKNOWN;
	const member = parseType(memberText);
	if (member.kind === "unknown") return UNKNOWN;
	const wildcard = nodeText(lookup).endsWith("*");
	// A map lookup of a missing key yields (); an array lookup out of bounds is an error.
	const perLookup: Card = wildcard ? { min: 0, max: 2 } : t.kind === "map" ? { min: 0, max: cardOf(member).max } : cardOf(member);
	const each = wildcard || t.kind === "map" ? multiplyCard(perLookup, cardOf(member)) : perLookup;
	return withCard(member, multiplyCard(cardOf(t), each));
}

function inferMapConstructor(nt: NonTerminal, varTypes: Map<string, XQueryType>, analysis: FileAnalysis, allFns: FunctionSymbol[]): XQueryType {
	const entries = directChildrenOf(nt, "MapConstructorEntry");
	if (entries.length === 0) return { kind: "map", name: "map(*)", occurrence: "" };
	let key: XQueryType | undefined;
	let value: XQueryType | undefined;
	for (const entry of entries) {
		const k = directChildOf(entry, "MapKeyExpr");
		const v = directChildOf(entry, "MapValueExpr");
		const kt = k ? itemTypeOf(inferExprType(k, varTypes, analysis, allFns)) : UNKNOWN;
		const vt = v ? inferExprType(v, varTypes, analysis, allFns) : UNKNOWN;
		key = key === undefined ? kt : kt.kind === "unknown" || key.kind === "unknown" ? UNKNOWN : itemUnion(key, kt);
		value = value === undefined ? vt : choiceType(value, vt);
	}
	const keyText = key && key.kind === "atomic" ? formatType(key) : "xs:anyAtomicType";
	return { kind: "map", name: `map(${keyText}, ${typeText(value ?? UNKNOWN, "item()*")})`, occurrence: "" };
}

function inferArrayConstructor(nt: NonTerminal, varTypes: Map<string, XQueryType>, analysis: FileAnalysis, allFns: FunctionSymbol[]): XQueryType {
	let member: XQueryType | undefined;
	if (nt.type === "SquareArrayConstructor") {
		for (const m of directChildrenOf(nt, "ExprSingle")) {
			const mt = inferExprType(m, varTypes, analysis, allFns);
			member = member === undefined ? mt : choiceType(member, mt);
		}
	} else {
		// array { E } has one member per item of E.
		const enclosed = directChildOf(nt, "EnclosedExpr");
		const et = enclosed ? inferExprType(enclosed, varTypes, analysis, allFns) : EMPTY;
		if (et.kind !== "empty") member = itemTypeOf(et);
	}
	if (member === undefined || member.kind === "empty") return { kind: "array", name: "array(*)", occurrence: "" };
	return { kind: "array", name: `array(${typeText(member, "item()*")})`, occurrence: "" };
}

function inferArrowExpr(nt: NonTerminal, varTypes: Map<string, XQueryType>, analysis: FileAnalysis, allFns: FunctionSymbol[]): XQueryType {
	let t: XQueryType | undefined;
	let op: string | undefined;
	for (let i = 0; i < nt.children.length; i++) {
		const c = nt.children[i];
		if (t === undefined) {
			t = inferExprType(c, varTypes, analysis, allFns);
			continue;
		}
		if (isTerminal(c)) {
			op = c.value;
			continue;
		}
		if (c.type !== "ArrowFunctionSpecifier") continue;
		const eqname = directChildOf(c, "EQName");
		const argList = nt.children[i + 1];
		if (op !== "=>" || !eqname || argList?.type !== "ArgumentList") return UNKNOWN;
		const raw = firstTerminalValue(eqname);
		if (!raw) return UNKNOWN;
		const { prefix, localName, uri } = parseEQName(raw);
		const qname = { localName, namespaceUri: uri ?? resolvePrefix(prefix, analysis) };
		const args = directChildrenOf(argList, "Argument");
		const piped = t;
		t = inferCallResult(
			qname,
			() => [piped, ...args.map((a) => inferExprType(a, varTypes, analysis, allFns))],
			args.length + 1,
			allFns,
		);
		i++; // skip the ArgumentList we just consumed
	}
	return t ?? UNKNOWN;
}

// ── Scoped constructs (shared by inference and the scope walker) ─────────────

/**
 * Lets callers observe the sub-expressions a scoped construct evaluates (with the scope
 * they're evaluated in) and the bindings it introduces. `binding` fires only for bindings
 * without a declared type — those are the ones whose type is inferred.
 */
export interface ScopeVisitor {
	expr?(node: Node, scope: Map<string, XQueryType>): void;
	binding?(nameNode: Node, type: XQueryType): void;
}

function flworClauses(flwor: Node): Node[] {
	const out: Node[] = [];
	const unwrap = (n: Node) => {
		if (isTerminal(n)) return;
		if (n.type === "InitialClause" || n.type === "IntermediateClause") {
			for (const c of (n as NonTerminal).children) unwrap(c);
		} else {
			out.push(n);
		}
	};
	for (const c of (flwor as NonTerminal).children) unwrap(c);
	return out;
}

function bindVarName(nameNode: Node | undefined, analysis: FileAnalysis, t: XQueryType, scope: Map<string, XQueryType>): string | null {
	if (!nameNode) return null;
	const raw = firstTerminalValue(nameNode);
	if (!raw) return null;
	const { prefix, localName, uri } = parseEQName(raw);
	const key = qnameKey({ prefix, localName, namespaceUri: uri ?? (prefix ? resolvePrefix(prefix, analysis) : "") });
	scope.set(key, t);
	return key;
}

function processFLWOR(
	flwor: Node,
	outer: Map<string, XQueryType>,
	analysis: FileAnalysis,
	allFns: FunctionSymbol[],
	visitor: ScopeVisitor = {},
): XQueryType {
	const scope = new Map(outer);
	const boundHere: string[] = [];
	let card: Card = ONE;
	let result: XQueryType = UNKNOWN;

	const evaluate = (expr: Node | undefined): XQueryType => {
		if (!expr) return UNKNOWN;
		visitor.expr?.(expr, scope);
		return inferExprType(expr, scope, analysis, allFns);
	};
	const bind = (nameNode: Node | undefined, declared: XQueryType | undefined, inferred: XQueryType) => {
		const key = bindVarName(nameNode, analysis, declared ?? inferred, scope);
		if (key) boundHere.push(key);
		if (!declared && nameNode) visitor.binding?.(nameNode, inferred);
	};

	for (const clause of flworClauses(flwor)) {
		switch (clause.type) {
			case "ForClause":
				for (const b of directChildrenOf(clause, "ForBinding")) {
					const seq = evaluate(directChildOf(b, "ExprSingle"));
					const allowingEmpty = (b as NonTerminal).children.some((c) => isTerminal(c) && c.value === "allowing");
					let item = itemTypeOf(seq);
					let seqCard = cardOf(seq);
					if (allowingEmpty) {
						item = seqCard.min === 1 ? item : withCard(item, { min: 0, max: 1 });
						seqCard = { min: 1, max: seqCard.max === 0 ? 1 : seqCard.max };
					}
					card = multiplyCard(card, seqCard);
					bind(directChildOf(b, "VarName"), declaredTypeOf(b), item);
					const pos = directChildOf(b, "PositionalVar");
					if (pos) bindVarName(directChildOf(pos, "VarName"), analysis, INTEGER, scope);
				}
				break;
			case "LetClause":
				for (const b of directChildrenOf(clause, "LetBinding")) {
					const t = evaluate(directChildOf(b, "ExprSingle"));
					bind(directChildOf(b, "VarName"), declaredTypeOf(b), t);
				}
				break;
			case "WindowClause":
				for (const w of (clause as NonTerminal).children) {
					if (isTerminal(w)) continue;
					const seq = evaluate(directChildOf(w, "ExprSingle"));
					const item = itemTypeOf(seq);
					bind(directChildOf(w, "VarName"), declaredTypeOf(w), withCard(item, { min: 1, max: 2 }));
					for (const cond of [directChildOf(w, "WindowStartCondition"), directChildOf(w, "WindowEndCondition")]) {
						if (!cond) continue;
						const vars = directChildOf(cond, "WindowVars");
						if (vars) {
							bindVarName(directChildOf(vars, "CurrentItem"), analysis, item, scope);
							const pos = directChildOf(vars, "PositionalVar");
							if (pos) bindVarName(directChildOf(pos, "VarName"), analysis, INTEGER, scope);
							bindVarName(directChildOf(vars, "PreviousItem"), analysis, withCard(item, { min: 0, max: 1 }), scope);
							bindVarName(directChildOf(vars, "NextItem"), analysis, withCard(item, { min: 0, max: 1 }), scope);
						}
						evaluate(directChildOf(cond, "ExprSingle"));
					}
				}
				card = multiplyCard(card, { min: 0, max: 2 });
				break;
			case "WhereClause": {
				const cond = directChildOf(clause, "ExprSingle");
				evaluate(cond);
				// Later clauses only see tuples for which the condition held.
				if (cond) for (const [k, t] of narrowScope(cond, scope, true, analysis)) scope.set(k, t);
				card = { min: 0, max: card.max };
				break;
			}
			case "CountClause":
				bindVarName(directChildOf(clause, "VarName"), analysis, INTEGER, scope);
				break;
			case "GroupByClause": {
				const keys = new Set<string>();
				for (const spec of findAll(clause, "GroupingSpec")) {
					const groupVar = directChildOf(spec, "GroupingVariable");
					const nameNode = groupVar ? directChildOf(groupVar, "VarName") : undefined;
					const init = directChildOf(spec, "ExprSingle");
					let key: string | null;
					if (init) {
						const t = itemTypeOf(evaluate(init));
						const declared = declaredTypeOf(spec);
						key = bindVarName(nameNode, analysis, declared ?? t, scope);
						if (!declared && nameNode) visitor.binding?.(nameNode, t);
					} else {
						const existing = nameNode ? asVarName(nameNode, analysis) : null;
						key = existing ? qnameKey(existing) : null;
						if (key && scope.has(key)) scope.set(key, itemTypeOf(scope.get(key)!));
					}
					if (key) keys.add(key);
				}
				// Every other variable bound so far now holds the whole group's values.
				for (const key of boundHere) {
					if (keys.has(key)) continue;
					const t = scope.get(key);
					if (t) scope.set(key, withCard(t, { min: cardOf(t).min, max: cardOf(t).max === 0 ? 0 : 2 }));
				}
				break;
			}
			case "ReturnClause":
				result = evaluate(directChildOf(clause, "ExprSingle"));
				break;
			default:
				// order by, and anything we don't model: just evaluate its sub-expressions in scope.
				visitor.expr?.(clause, scope);
		}
	}

	if (result.kind === "unknown") return UNKNOWN;
	return withCard(result, multiplyCard(card, cardOf(result)));
}

function processQuantified(
	node: NonTerminal,
	outer: Map<string, XQueryType>,
	analysis: FileAnalysis,
	allFns: FunctionSymbol[],
	visitor: ScopeVisitor = {},
): XQueryType {
	const scope = new Map(outer);
	let pendingName: Node | undefined;
	let pendingDeclared: XQueryType | undefined;
	for (const c of node.children) {
		if (c.type === "VarName") {
			pendingName = c;
			pendingDeclared = undefined;
		} else if (c.type === "TypeDeclaration") {
			pendingDeclared = sequenceTypeOf(directChildOf(c, "SequenceType"));
		} else if (c.type === "ExprSingle") {
			visitor.expr?.(c, scope);
			if (pendingName) {
				const t = inferExprType(c, scope, analysis, allFns);
				bindVarName(pendingName, analysis, pendingDeclared ?? itemTypeOf(t), scope);
				pendingName = undefined;
			}
		}
	}
	return BOOLEAN;
}

function processTypeswitch(
	node: NonTerminal,
	outer: Map<string, XQueryType>,
	analysis: FileAnalysis,
	allFns: FunctionSymbol[],
	visitor: ScopeVisitor = {},
): XQueryType {
	const operand = directChildOf(node, "Expr");
	if (operand) visitor.expr?.(operand, outer);
	const operandType = operand ? inferExprType(operand, outer, analysis, allFns) : UNKNOWN;

	let result: XQueryType | undefined;
	const branch = (varName: Node | undefined, varType: XQueryType, expr: Node | undefined) => {
		const scope = new Map(outer);
		bindVarName(varName, analysis, varType, scope);
		if (!expr) return;
		visitor.expr?.(expr, scope);
		const t = inferExprType(expr, scope, analysis, allFns);
		result = result === undefined ? t : choiceType(result, t);
	};
	for (const clause of directChildrenOf(node, "CaseClause")) {
		branch(directChildOf(clause, "VarName"), sequenceTypeOf(directChildOf(clause, "SequenceTypeUnion")) ?? UNKNOWN, directChildOf(clause, "ExprSingle"));
	}
	branch(directChildOf(node, "VarName"), operandType, directChildOf(node, "ExprSingle"));
	return result ?? UNKNOWN;
}

function collectParamTypes(paramList: Node | undefined, analysis: FileAnalysis, scope: Map<string, XQueryType>): string[] {
	const texts: string[] = [];
	for (const param of paramList ? directChildrenOf(paramList, "Param") : []) {
		const declared = declaredTypeOf(param);
		bindVarName(directChildOf(param, "EQName"), analysis, declared ?? UNKNOWN, scope);
		texts.push(declared ? formatType(declared) : "item()*");
	}
	return texts;
}

function processInlineFunction(
	node: NonTerminal,
	outer: Map<string, XQueryType>,
	analysis: FileAnalysis,
	allFns: FunctionSymbol[],
	visitor: ScopeVisitor = {},
): XQueryType {
	// Inline functions close over the variables in scope, but have no context item.
	const scope = new Map(outer);
	scope.delete(CONTEXT_ITEM_KEY);
	const params = collectParamTypes(directChildOf(node, "ParamList"), analysis, scope);
	const body = directChildOf(node, "FunctionBody");
	if (body) visitor.expr?.(body, scope);
	const declared = sequenceTypeOf(directChildOf(node, "SequenceType"));
	const ret = declared ?? (body ? inferExprType(body, scope, analysis, allFns) : EMPTY);
	return { kind: "function", name: `function(${params.join(", ")}) as ${typeText(ret, "item()*")}`, occurrence: "" };
}

// Unwraps the grammar's single-child precedence chain down to the node that does something.
function coreExpr(node: Node): Node {
	let n = node;
	while (!isTerminal(n) && n.type !== "VarRef") {
		const ops = nonTerminalChildren(n as NonTerminal);
		if (ops.length !== 1) break;
		n = ops[0];
	}
	return n;
}

function varKeyOf(node: Node, analysis: FileAnalysis): string | null {
	const core = coreExpr(node);
	const qname = core.type === "VarRef" ? asVarRef(core, analysis) : null;
	return qname ? qnameKey(qname) : null;
}

/**
 * Variable types that hold where `cond` is known to be true (`positive`) or false.
 * Understands `$x instance of T`, `exists($x)`, `empty($x)`, a bare `$x` (its effective
 * boolean value is false for ()), `not(…)`, and conjunctions / disjunctions of those.
 */
function narrowScope(cond: Node, scope: Map<string, XQueryType>, positive: boolean, analysis: FileAnalysis): Map<string, XQueryType> {
	const core = coreExpr(cond);
	const ops = isTerminal(core) ? [] : nonTerminalChildren(core as NonTerminal);
	const nonEmpty = (key: string | null, out: Map<string, XQueryType>) => {
		const t = key ? out.get(key) : undefined;
		if (!key || !t || t.kind === "unknown" || t.kind === "empty") return out;
		const c = cardOf(t);
		if (c.min === 0) out.set(key, withCard(t, { min: 1, max: c.max }));
		return out;
	};

	if ((core.type === "AndExpr" && positive) || (core.type === "OrExpr" && !positive)) {
		return ops.reduce((s, op) => narrowScope(op, s, positive, analysis), scope);
	}
	if (core.type === "VarRef" && positive) return nonEmpty(varKeyOf(core, analysis), new Map(scope));
	if (core.type === "InstanceofExpr" && positive && ops.length === 2) {
		const key = varKeyOf(ops[0], analysis);
		const narrowed = sequenceTypeOf(directChildOf(core, "SequenceType"));
		const current = key ? scope.get(key) : undefined;
		if (!key || !narrowed || narrowed.kind === "unknown") return scope;
		// Only ever make a type more specific: `$int instance of xs:decimal` tells us nothing new.
		if (current && current.kind !== "unknown" && !isAssignable(narrowed, current)) return scope;
		return new Map(scope).set(key, narrowed);
	}
	if (core.type === "FunctionCall") {
		const call = asFunctionCall(core, analysis);
		if (!call || call.qname.namespaceUri !== XMLNS_FN || call.args.length !== 1) return scope;
		const arg = argExpr(call.args[0]);
		if (!arg) return scope;
		const name = call.qname.localName;
		if (name === "not") return narrowScope(arg, scope, !positive, analysis);
		if ((name === "exists" && positive) || (name === "empty" && !positive) || (name === "boolean" && positive)) {
			return nonEmpty(varKeyOf(arg, analysis), new Map(scope));
		}
	}
	return scope;
}

function processIf(
	node: NonTerminal,
	scope: Map<string, XQueryType>,
	analysis: FileAnalysis,
	allFns: FunctionSymbol[],
	visitor: ScopeVisitor = {},
): XQueryType {
	const cond = directChildOf(node, "Expr");
	if (cond) visitor.expr?.(cond, scope);
	// `then`/`else` are ExprSingle; XQuery 4's braced `if (c) { … }` has one EnclosedExpr.
	const branches = [...directChildrenOf(node, "ExprSingle"), ...directChildrenOf(node, "EnclosedExpr")];
	const types = branches.map((branch, i) => {
		const branchScope = cond ? narrowScope(cond, scope, i === 0, analysis) : scope;
		visitor.expr?.(branch, branchScope);
		return inferExprType(branch, branchScope, analysis, allFns);
	});
	if (types.length === 0) return UNKNOWN;
	return types.length === 1 ? choiceType(types[0], EMPTY) : types.reduce(choiceType);
}

// `copy $c := E modify U return R` — `$c` is a copy of E, so it has E's type.
function processTransform(
	node: NonTerminal,
	outer: Map<string, XQueryType>,
	analysis: FileAnalysis,
	allFns: FunctionSymbol[],
	visitor: ScopeVisitor = {},
): XQueryType {
	const scope = new Map(outer);
	const bindingList = directChildOf(node, "XQUF_CopyBindingList");
	for (const b of bindingList ? directChildrenOf(bindingList, "XQUF_CopyBinding") : []) {
		const init = directChildOf(b, "ExprSingle");
		if (init) visitor.expr?.(init, scope);
		const t = init ? inferExprType(init, scope, analysis, allFns) : UNKNOWN;
		const nameNode = directChildOf(b, "VarName");
		bindVarName(nameNode, analysis, t, scope);
		if (nameNode) visitor.binding?.(nameNode, t);
	}
	const [modifyExpr, returnExpr] = directChildrenOf(node, "ExprSingle");
	if (modifyExpr) visitor.expr?.(modifyExpr, scope);
	if (!returnExpr) return UNKNOWN;
	visitor.expr?.(returnExpr, scope);
	return inferExprType(returnExpr, scope, analysis, allFns);
}

// ── Expression inference ──────────────────────────────────────────────────────

function nonTerminalChildren(nt: NonTerminal): Node[] {
	return nt.children.filter((c) => !isTerminal(c));
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
	const operands = nonTerminalChildren(nt);

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
		case "ContextItemExpr":
			return varTypes.get(CONTEXT_ITEM_KEY) ?? UNKNOWN;
		case "ParenthesizedExpr":
			if (operands.length === 0) return EMPTY;
			break;
		case "Expr":
			// Comma operator: `(a, b, c)`.
			if (operands.length > 1) {
				return operands.map((o) => inferExprType(o, varTypes, analysis, allFns)).reduce(concatType);
			}
			break;
		case "IfExpr":
			return processIf(nt, varTypes, analysis, allFns);
		case "XQUF_TransformExpr":
			return processTransform(nt, varTypes, analysis, allFns);
		case "SwitchExpr": {
			const results = [
				...directChildrenOf(node, "SwitchCaseClause").map((c) => directChildOf(c, "ExprSingle")),
				...directChildrenOf(node, "ExprSingle"),
			];
			if (results.some((r) => !r)) return UNKNOWN;
			return results.map((r) => inferExprType(r!, varTypes, analysis, allFns)).reduce(choiceType);
		}
		case "TypeswitchExpr":
			return processTypeswitch(nt, varTypes, analysis, allFns);
		case "TryCatchExpr": {
			const bodies = [...findAll(node, "EnclosedTryTargetExpr"), ...directChildrenOf(node, "CatchClause").map((c) => directChildOf(c, "EnclosedExpr"))];
			if (bodies.some((b) => !b)) return UNKNOWN;
			return bodies.map((b) => inferExprType(b!, varTypes, analysis, allFns)).reduce(choiceType);
		}
		case "FLWORExpr":
			return processFLWOR(node, varTypes, analysis, allFns);
		case "QuantifiedExpr":
			return processQuantified(nt, varTypes, analysis, allFns);
		case "InlineFunctionExpr":
			return processInlineFunction(nt, varTypes, analysis, allFns);
		case "NamedFunctionRef": {
			const ref = asNamedFunctionRef(node, analysis);
			const fn = ref ? resolveFunction(ref.qname, ref.arity, allFns) : undefined;
			return fn ? functionTypeOf(fn) : { kind: "function", name: "function(*)", occurrence: "" };
		}
		case "ComparisonExpr": {
			if (operands.length < 3) break;
			// General comparisons (=, <, …) are always a boolean. Value and node comparisons
			// (eq, is, <<, …) yield () for an empty operand.
			if (operands[1].type === "GeneralComp") return BOOLEAN;
			const [a, b] = [operands[0], operands[2]].map((o) => inferExprType(o, varTypes, analysis, allFns));
			if (a.kind === "unknown" || b.kind === "unknown") return withCard(BOOLEAN, { min: 0, max: 1 });
			if (a.kind === "empty" || b.kind === "empty") return EMPTY;
			return cardOf(a).min === 1 && cardOf(b).min === 1 ? BOOLEAN : withCard(BOOLEAN, { min: 0, max: 1 });
		}
		case "OrExpr":
		case "AndExpr":
		case "InstanceofExpr":
		case "CastableExpr":
			if (operands.length > 1) return BOOLEAN;
			break;
		case "StringConcatExpr":
			if (operands.length > 1) return STRING;
			break;
		case "StringConstructor":
			return STRING;
		case "CastExpr":
			if (operands.length > 1) return sequenceTypeOf(directChildOf(node, "SingleType")) ?? UNKNOWN;
			break;
		case "TreatExpr":
			if (operands.length > 1) return sequenceTypeOf(directChildOf(node, "SequenceType")) ?? UNKNOWN;
			break;
		case "UnaryExpr": {
			// Every expression passes through UnaryExpr; only a leading +/- makes it arithmetic.
			const operand = directChildOf(node, "ValueExpr");
			if (!operand || !nt.children.some(isTerminal)) break;
			// Same operand rules as binary arithmetic: `-$x` behaves like `0 - $x` type-wise.
			return arithmeticResult("*", inferExprType(operand, varTypes, analysis, allFns), INTEGER);
		}
		case "AdditiveExpr":
		case "MultiplicativeExpr": {
			// Grammar produces a flat, left-associative chain: operand (op operand)*.
			let result: XQueryType | undefined;
			let pendingOp: string | undefined;
			for (const c of nt.children) {
				if (isTerminal(c)) {
					pendingOp = c.value;
					continue;
				}
				const t = inferExprType(c, varTypes, analysis, allFns);
				if (result === undefined) {
					result = t;
				} else if (pendingOp) {
					result = arithmeticResult(pendingOp, result, t);
					pendingOp = undefined;
				}
			}
			return result ?? UNKNOWN;
		}
		case "IntersectExceptExpr":
			// `a intersect b` / `a except b` select a subset of `a`.
			if (operands.length > 1) {
				const left = inferExprType(operands[0], varTypes, analysis, allFns);
				return left.kind === "node" ? withCard(left, { min: 0, max: cardOf(left).max }) : NODE_STEP;
			}
			break;
		case "UnionExpr":
			if (operands.length > 1) {
				const types = operands.map((o) => inferExprType(o, varTypes, analysis, allFns));
				const nodes = types.filter((t) => t.kind === "node");
				if (nodes.length !== types.length) return NODE_STEP;
				return withCard(nodes.reduce((a, b) => itemUnion(a, b)), { min: 0, max: 2 });
			}
			break;
		case "SimpleMapExpr": {
			if (operands.length < 2) break;
			let t = inferExprType(operands[0], varTypes, analysis, allFns);
			let card = cardOf(t);
			for (const next of operands.slice(1)) {
				if (t.kind === "unknown") return UNKNOWN;
				const scope = new Map(varTypes);
				scope.set(CONTEXT_ITEM_KEY, itemTypeOf(t));
				t = inferExprType(next, scope, analysis, allFns);
				card = multiplyCard(card, cardOf(t));
			}
			return withCard(t, card);
		}
		case "ArrowExpr":
			if (operands.length > 1) return inferArrowExpr(nt, varTypes, analysis, allFns);
			break;
		case "PostfixExpr":
			if (operands.length > 1) return inferPostfixExpr(nt, varTypes, analysis, allFns);
			break;
		case "MapConstructor":
			return inferMapConstructor(nt, varTypes, analysis, allFns);
		case "SquareArrayConstructor":
		case "CurlyArrayConstructor":
			return inferArrayConstructor(nt, varTypes, analysis, allFns);
		case "FunctionCall": {
			const call = asFunctionCall(node, analysis);
			if (!call) return UNKNOWN;
			// Partial application — one or more `?` placeholders: a function over the missing arguments.
			const placeholders = call.args.map((a) => directChildOf(a, "ArgumentPlaceholder") !== undefined);
			if (placeholders.some(Boolean)) {
				const fn = resolveFunction(call.qname, call.args.length, allFns);
				if (!fn || fn.variadic) return { kind: "function", name: "function(*)", occurrence: "" };
				const params = fn.params.filter((_, i) => placeholders[i]).map((p) => p.type ?? "item()*");
				return { kind: "function", name: `function(${params.join(", ")}) as ${fn.returnType ?? "item()*"}`, occurrence: "" };
			}
			return inferCallResult(
				call.qname,
				() => call.args.map((a) => inferExprType(a, varTypes, analysis, allFns)),
				call.args.length,
				allFns,
			);
		}
		case "PathExpr":
		case "RelativePathExpr":
			if (!isPathExpr(node)) break;
			return inferPathExpr(nt, varTypes, analysis, allFns);
		case "AxisStep":
			return axisStepType(node);
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
		case "DirCommentConstructor":
			return { kind: "node", name: "comment", occurrence: "" };
		case "CompPIConstructor":
		case "DirPIConstructor":
			return { kind: "node", name: "processing-instruction", occurrence: "" };
		case "RangeExpr": {
			// `e1 to e2` — only a genuine range (two operands) produces xs:integer*;
			// with no "to" present the grammar still wraps a single child, which
			// falls through to the generic single-child unwrap below.
			if (operands.length === 2) return RANGE_SEQUENCE;
			break;
		}
	}

	if (operands.length === 1) return inferExprType(operands[0], varTypes, analysis, allFns);

	return UNKNOWN;
}

// ── Type name formatting ──────────────────────────────────────────────────────

export function formatType(t: XQueryType): string {
	if (t.kind === "unknown") return "unknown";
	if (t.kind === "empty") return "empty-sequence()";
	if (t.kind === "item") return `item()${t.occurrence}`;
	if (t.kind === "node") return `${t.name ?? "node"}()${t.occurrence}`;
	// `function(…) as T*` would read as a function returning T*; parenthesize the item type.
	if (t.kind === "function" && t.occurrence && t.name?.includes(" as ")) return `(${t.name})${t.occurrence}`;
	return `${t.name ?? t.kind}${t.occurrence}`;
}

// ── Scope-aware walking ───────────────────────────────────────────────────────

export interface ScopeWalkHooks {
	/** Called for every non-terminal, with the variable types in scope at that point. */
	onNode?(node: Node, scope: Map<string, XQueryType>): void;
	/** Called for every variable binding without a declared type, with its inferred type. */
	onBinding?(nameNode: Node, type: XQueryType): void;
}

function walkScoped(
	node: Node,
	scope: Map<string, XQueryType>,
	analysis: FileAnalysis,
	allFns: FunctionSymbol[],
	hooks: ScopeWalkHooks,
): void {
	if (isTerminal(node)) return;
	const nt = node as NonTerminal;
	hooks.onNode?.(node, scope);

	const visitor: ScopeVisitor = {
		expr: (n, s) => walkScoped(n, s, analysis, allFns, hooks),
		binding: hooks.onBinding,
	};
	switch (node.type) {
		case "FLWORExpr":
			processFLWOR(node, scope, analysis, allFns, visitor);
			return;
		case "QuantifiedExpr":
			processQuantified(nt, scope, analysis, allFns, visitor);
			return;
		case "TypeswitchExpr":
			processTypeswitch(nt, scope, analysis, allFns, visitor);
			return;
		case "InlineFunctionExpr":
			processInlineFunction(nt, scope, analysis, allFns, visitor);
			return;
		case "IfExpr":
			processIf(nt, scope, analysis, allFns, visitor);
			return;
		case "XQUF_TransformExpr":
			processTransform(nt, scope, analysis, allFns, visitor);
			return;
	}

	for (const child of nt.children) walkScoped(child, scope, analysis, allFns, hooks);
}

/**
 * Fills in `returnType` for functions in this module declared without `as …`, inferred from
 * their bodies. Iterates to a fixpoint (bounded) so functions calling other untyped functions,
 * declared before or after them, resolve too; directly recursive functions stay unknown unless
 * a non-recursive branch alone determines the type. Callers use the returned list in place of
 * `allFns` so every call site — hints and type checks alike — sees the inferred types.
 */
export function withInferredReturnTypes(ast: Node, analysis: FileAnalysis, allFns: FunctionSymbol[]): FunctionSymbol[] {
	const bodies = new Map<number, { decl: Node; body: Node }>();
	for (const annotated of findAll(ast, "AnnotatedDecl")) {
		const decl = directChildOf(annotated, "FunctionDecl");
		const body = decl ? directChildOf(decl, "FunctionBody") : undefined;
		if (decl && body && !directChildOf(decl, "SequenceType")) bodies.set(annotated.start, { decl, body });
	}
	const untyped = analysis.functions.filter((f) => !f.returnType && f.sourceOffset !== undefined && bodies.has(f.sourceOffset));
	if (untyped.length === 0) return allFns;

	const inferred = new Map<FunctionSymbol, string>();
	let fns = allFns;
	for (let pass = 0; pass < 4; pass++) {
		let changed = false;
		const moduleTypes = new Map<string, XQueryType>();
		walkModuleVariables(ast, moduleTypes, analysis, fns, {});
		for (const fn of untyped) {
			const { decl, body } = bodies.get(fn.sourceOffset!)!;
			const scope = new Map(moduleTypes);
			collectParamTypes(directChildOf(decl, "ParamList"), analysis, scope);
			const t = inferExprType(body, scope, analysis, fns);
			const text = formatType(t);
			// Only keep types that round-trip through the signature parser the call sites use.
			if (t.kind === "unknown" || parseType(text).kind === "unknown" || inferred.get(fn) === text) continue;
			inferred.set(fn, text);
			changed = true;
		}
		if (!changed) break;
		fns = allFns.map((f) => (inferred.has(f) ? { ...f, returnType: inferred.get(f) } : f));
	}
	return fns;
}

// Module variables in declaration order: declared type, else inferred from the initializer.
function walkModuleVariables(
	ast: Node,
	moduleTypes: Map<string, XQueryType>,
	analysis: FileAnalysis,
	allFns: FunctionSymbol[],
	hooks: ScopeWalkHooks,
): void {
	for (const decl of findAll(ast, "VarDecl")) {
		const value = directChildOf(decl, "VarValue");
		if (value && (hooks.onNode || hooks.onBinding)) walkScoped(value, moduleTypes, analysis, allFns, hooks);
		const declared = declaredTypeOf(decl);
		const inferred = value ? inferExprType(value, moduleTypes, analysis, allFns) : UNKNOWN;
		const nameNode = directChildOf(decl, "VarName");
		bindVarName(nameNode, analysis, declared ?? inferred, moduleTypes);
		if (!declared && value && nameNode) hooks.onBinding?.(nameNode, inferred);
	}
}

/**
 * Walks a whole module with lexically correct variable scopes: module variables (declared or
 * inferred, in declaration order), function parameters inside each function body, and
 * FLWOR / quantified / typeswitch / inline-function bindings within their own sub-trees.
 */
export function walkModuleScopes(
	ast: Node,
	analysis: FileAnalysis,
	allFns: FunctionSymbol[],
	hooks: ScopeWalkHooks,
): void {
	const moduleTypes = new Map<string, XQueryType>();
	walkModuleVariables(ast, moduleTypes, analysis, allFns, hooks);

	for (const annotated of findAll(ast, "AnnotatedDecl")) {
		const decl = directChildOf(annotated, "FunctionDecl");
		const body = decl ? directChildOf(decl, "FunctionBody") : undefined;
		if (!decl || !body) continue; // external function — nothing to walk
		const scope = new Map(moduleTypes);
		collectParamTypes(directChildOf(decl, "ParamList"), analysis, scope);
		walkScoped(body, scope, analysis, allFns, hooks);
	}

	// Top-level query body (present in main modules, absent in library modules).
	for (const queryBody of findAll(ast, "QueryBody")) {
		walkScoped(queryBody, new Map(moduleTypes), analysis, allFns, hooks);
	}
}

// ── Type checking ─────────────────────────────────────────────────────────────

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

// ── Main entry point ─────────────────────────────────────────────────────────

export function checkTypes(
	ast: Node,
	_text: string,
	analysis: FileAnalysis,
	importedAnalyses: Map<string, FileAnalysis>,
): TypeDiagnostic[] {
	const errors: TypeDiagnostic[] = [];
	const allFns = withInferredReturnTypes(ast, analysis, allFunctionsFlat(analysis, importedAnalyses));
	walkModuleScopes(ast, analysis, allFns, {
		onNode: (node, scope) => {
			if (node.type === "FunctionCall") typeCheckCall(node, scope, analysis, allFns, errors);
		},
	});
	return errors;
}
