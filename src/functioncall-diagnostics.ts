import type { Node, NonTerminal } from "xq-parser";
import type { TypeDiagnostic, FileAnalysis, FunctionSymbol, QName } from "./types.ts";
import { formatQName } from "./types.ts";
import {
	findAll,
	isTerminal,
	directChildrenOf,
	firstTerminalValue,
	parseEQName,
	resolvePrefix,
	XMLNS_LOCAL,
	XMLNS_FN,
	XMLNS_XS,
	XMLNS_MATH,
	XMLNS_MAP,
	XMLNS_ARRAY,
} from "./analyzer.ts";
import { asFunctionCall, asNamedFunctionRef } from "./ast-nodes.ts";

// Namespaces that are always in scope without an explicit import: the
// spec-mandated predeclared ones, plus whatever this file declares of its own
// (local: functions, its own module namespace, and its default function
// namespace) — we have complete, closed-world knowledge of all of these.
function alwaysAccessibleNamespaceUris(analysis: FileAnalysis): Set<string> {
	const uris = new Set([XMLNS_LOCAL, XMLNS_FN, XMLNS_XS, XMLNS_MATH, XMLNS_MAP, XMLNS_ARRAY, analysis.defaultFunctionNamespace]);
	if (analysis.moduleNamespaceUri) uris.add(analysis.moduleNamespaceUri);
	return uris;
}

/**
 * Gather every function symbol this file can legally call, plus the set of
 * imported namespace URIs we couldn't resolve to any analysis (unresolvable
 * "at" path, or an unresolvable bare import — genuinely unknown, so calls
 * into them are left unchecked to avoid false positives).
 *
 * A namespace not covered by any of the above (not declared, not imported,
 * not predeclared) has zero accessible functions by construction: nothing in
 * this module's static scope could have brought a function from it into
 * view, regardless of what happens to be sitting in `importedAnalyses` (the
 * QT4 harness, for instance, loads catalog modules that were never actually
 * imported by the query under test, specifically to verify this isn't enough
 * to make their functions callable).
 */
function accessibleFunctions(
	analysis: FileAnalysis,
	importedAnalyses: Map<string, FileAnalysis>,
): { fns: FunctionSymbol[]; unresolvedImportUris: Set<string> } {
	const fns = [...analysis.functions];
	const alwaysOpen = alwaysAccessibleNamespaceUris(analysis);
	const importedNamespaceUris = new Set(analysis.imports.map((i) => i.namespaceUri));
	// Runtime-predeclared namespaces (e.g. eXist-db's util:, xmldb:) are merged into
	// namespaceDecls with offset -1 — see withPredeclaredNs — marking them as
	// implicitly available without a written import. The QT4 harness uses the same
	// offset -1 convention for <environment><namespace> bindings, which name a
	// namespace without providing (or requiring) any declaration of what's in it.
	const predeclaredUris = new Set(analysis.namespaceDecls.filter((nd) => nd.offset === -1).map((nd) => nd.namespaceUri));
	// Namespaces we might have real knowledge of — but only once we find a matching
	// entry in importedAnalyses below. Until then, stay silent about them rather
	// than treating "no analysis available" as "no such function". Namespaces
	// already in alwaysOpen are excluded: they're already guaranteed accessible
	// (e.g. builtins arrive under a "builtin:" map key, not one matching their own
	// namespace URI), so redundantly re-declaring one — as the QT4 harness's
	// <environment><namespace prefix="map" uri=".../map"/> does — must not make it
	// look unresolved.
	const candidateUris = new Set([...importedNamespaceUris, ...predeclaredUris].filter((u) => !alwaysOpen.has(u)));
	const resolvedUris = new Set<string>();

	for (const [key, a] of importedAnalyses) {
		if (key.startsWith("builtin:") || alwaysOpen.has(key)) {
			fns.push(...a.functions);
			continue;
		}
		if (candidateUris.has(key)) {
			// A %private function/variable is only visible within its own declaring
			// module — filter it out for anything reached through an import.
			fns.push(...a.functions.filter((f) => f.visibility !== "private"));
			resolvedUris.add(key);
		}
	}

	const unresolvedImportUris = new Set([...candidateUris].filter((u) => !resolvedUris.has(u)));
	return { fns, unresolvedImportUris };
}

function arityDescription(overloads: FunctionSymbol[]): string {
	const arities = [...new Set(overloads.map((f) => f.arity))].sort((a, b) => a - b);
	return overloads.some((f) => f.variadic) ? `${arities[0]} or more` : arities.length === 1 ? `${arities[0]}` : arities.join(" or ");
}

function checkArity(
	qname: QName,
	arity: number,
	nodeStart: number,
	allFns: FunctionSymbol[],
	unresolvedImportUris: Set<string>,
	errors: TypeDiagnostic[],
): void {
	const { namespaceUri, localName } = qname;
	// A prefix that resolves to nothing at all is a separate diagnostic's
	// concern (findUndeclaredPrefixUsages) — don't pile on here.
	if (namespaceUri.startsWith("urn:xq-lsp:undeclared:")) return;
	// An import we couldn't resolve to any analysis: genuinely unknown, stay silent.
	if (unresolvedImportUris.has(namespaceUri)) return;

	const overloads = allFns.filter((f) => f.qname.namespaceUri === namespaceUri && f.qname.localName === localName);
	const name = formatQName(qname);

	if (overloads.length === 0) {
		errors.push({ message: `${name} is not declared`, code: "XPST0017", offset: nodeStart, length: name.length });
		return;
	}

	const arityMatch = overloads.some((f) => (f.variadic ? arity >= f.arity : f.arity === arity));
	if (arityMatch) return;

	errors.push({
		message: `${name} expects ${arityDescription(overloads)} argument(s), got ${arity}`,
		code: "XPST0017",
		offset: nodeStart,
		length: name.length,
	});
}

/**
 * Walk all FunctionCall, NamedFunctionRef, and ArrowExpr nodes in the AST
 * and report XPST0017 for any call where the argument count does not match
 * any known overload, or where the function name is not declared in a
 * namespace this file can call into.
 *
 * A namespace is only skipped (left unchecked) when it's the target of an
 * import we couldn't resolve to any analysis, or when the prefix itself is
 * undeclared (that's findUndeclaredPrefixUsages's concern) — see
 * accessibleFunctions and checkArity. Every other namespace is closed-world:
 * not finding a matching declaration there means one doesn't exist.
 */
export function checkFunctionCalls(
	ast: Node,
	analysis: FileAnalysis,
	importedAnalyses: Map<string, FileAnalysis>,
): TypeDiagnostic[] {
	const errors: TypeDiagnostic[] = [];
	const { fns: allFns, unresolvedImportUris } = accessibleFunctions(analysis, importedAnalyses);

	// ── FunctionCall ─────────────────────────────────────────────────────────────

	for (const callNode of findAll(ast, "FunctionCall")) {
		const call = asFunctionCall(callNode, analysis);
		if (!call) continue;
		checkArity(call.qname, call.args.length, callNode.start, allFns, unresolvedImportUris, errors);
	}

	// ── NamedFunctionRef ─────────────────────────────────────────────────────────

	for (const refNode of findAll(ast, "NamedFunctionRef")) {
		const ref = asNamedFunctionRef(refNode, analysis);
		if (!ref) continue;
		checkArity(ref.qname, ref.arity, refNode.start, allFns, unresolvedImportUris, errors);
	}

	// ── ArrowExpr ────────────────────────────────────────────────────────────────
	// "$x => f($y)" is syntax sugar for "f($x, $y)"; the arrow provides one extra
	// implicit argument so effective arity = 1 + explicit ArgumentList args.

	for (const arrowNode of findAll(ast, "ArrowExpr")) {
		const nt = arrowNode as NonTerminal;
		for (let i = 0; i < nt.children.length; i++) {
			const child = nt.children[i];
			if (!isTerminal(child) || child.value !== "=>") continue;

			// Parser always emits ArrowFunctionSpecifier + ArgumentList after "=>".
			const specifier = nt.children[i + 1] as NonTerminal;
			const argList = nt.children[i + 2] as NonTerminal;

			const eqnameNode = directChildrenOf(specifier, "EQName")[0];
			if (!eqnameNode) continue;
			const rawName = firstTerminalValue(eqnameNode);
			if (!rawName) continue;

			const { prefix, localName, uri } = parseEQName(rawName);
			const namespaceUri = uri ?? resolvePrefix(prefix, analysis);
			const explicitArgs = directChildrenOf(argList, "Argument").length;

			checkArity({ prefix, localName, namespaceUri }, 1 + explicitArgs, arrowNode.start, allFns, unresolvedImportUris, errors);
		}
	}

	return errors;
}
