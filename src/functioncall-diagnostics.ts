import type { Node, NonTerminal } from "xq-parser";
import type { TypeDiagnostic, FileAnalysis, FunctionSymbol } from "./types.ts";
import { formatQName } from "./types.ts";
import { findAll, isTerminal, directChildrenOf, firstTerminalValue, parseEQName, resolvePrefix } from "./analyzer.ts";
import { asFunctionCall, asNamedFunctionRef } from "./ast-nodes.ts";

function allFunctionsFlat(analysis: FileAnalysis, importedAnalyses: Map<string, FileAnalysis>): FunctionSymbol[] {
	const fns = [...analysis.functions];
	for (const a of importedAnalyses.values()) fns.push(...a.functions);
	return fns;
}

function arityDescription(overloads: FunctionSymbol[]): string {
	const arities = [...new Set(overloads.map((f) => f.arity))].sort((a, b) => a - b);
	return overloads.some((f) => f.variadic) ? `${arities[0]} or more` : arities.length === 1 ? `${arities[0]}` : arities.join(" or ");
}

type QNameLike = { namespaceUri?: string; localName: string; prefix?: string };

function checkArity(
	qname: QNameLike,
	arity: number,
	nodeStart: number,
	allFns: FunctionSymbol[],
	knownNamespaceUris: Set<string>,
	errors: TypeDiagnostic[],
): void {
	const ns = qname.namespaceUri ?? "";
	const overloads = allFns.filter((f) => f.qname.namespaceUri === ns && f.qname.localName === qname.localName);
	const name = formatQName({ prefix: qname.prefix ?? "", localName: qname.localName, namespaceUri: ns });

	if (overloads.length === 0) {
		if (!knownNamespaceUris.has(ns)) return;
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
 * namespace we have analysis for.
 *
 * If the function's namespace is entirely unknown (no analysis loaded for it),
 * the call is silently skipped — it could be a runtime-only library.
 */
export function checkFunctionCalls(
	ast: Node,
	analysis: FileAnalysis,
	importedAnalyses: Map<string, FileAnalysis>,
): TypeDiagnostic[] {
	const errors: TypeDiagnostic[] = [];
	const allFns = allFunctionsFlat(analysis, importedAnalyses);
	// Namespaces we have at least one function declaration for.
	const knownNamespaceUris = new Set(allFns.map((f) => f.qname.namespaceUri));

	// ── FunctionCall ─────────────────────────────────────────────────────────────

	for (const callNode of findAll(ast, "FunctionCall")) {
		const call = asFunctionCall(callNode, analysis);
		if (!call) continue;
		checkArity(call.qname, call.args.length, callNode.start ?? 0, allFns, knownNamespaceUris, errors);
	}

	// ── NamedFunctionRef ─────────────────────────────────────────────────────────

	for (const refNode of findAll(ast, "NamedFunctionRef")) {
		const ref = asNamedFunctionRef(refNode, analysis);
		if (!ref) continue;
		checkArity(ref.qname, ref.arity, refNode.start ?? 0, allFns, knownNamespaceUris, errors);
	}

	// ── ArrowExpr ────────────────────────────────────────────────────────────────
	// "$x => f($y)" is syntax sugar for "f($x, $y)"; the arrow provides one extra
	// implicit argument so effective arity = 1 + explicit ArgumentList args.

	for (const arrowNode of findAll(ast, "ArrowExpr")) {
		if (isTerminal(arrowNode)) continue;
		const nt = arrowNode as NonTerminal;
		for (let i = 0; i < nt.children.length; i++) {
			const child = nt.children[i];
			if (!isTerminal(child) || child.value !== "=>") continue;
			const specifier = nt.children[i + 1];
			const argList = nt.children[i + 2];
			if (!specifier || isTerminal(specifier) || specifier.type !== "ArrowFunctionSpecifier") continue;
			if (!argList || isTerminal(argList) || argList.type !== "ArgumentList") continue;

			const eqname = directChildrenOf(specifier as NonTerminal, "EQName")[0];
			if (!eqname || isTerminal(eqname)) continue;
			const rawName = firstTerminalValue(eqname as NonTerminal);
			if (!rawName) continue;

			const { prefix, localName, uri } = parseEQName(rawName);
			const namespaceUri = uri ?? resolvePrefix(prefix, analysis);
			const explicitArgs = directChildrenOf(argList as NonTerminal, "Argument").length;

			checkArity({ prefix, localName, namespaceUri }, 1 + explicitArgs, arrowNode.start ?? 0, allFns, knownNamespaceUris, errors);
		}
	}

	return errors;
}
