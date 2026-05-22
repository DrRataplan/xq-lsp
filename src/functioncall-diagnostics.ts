import type { Node } from "xq-parser";
import type { TypeDiagnostic, FileAnalysis, FunctionSymbol } from "./types.ts";
import { formatQName } from "./types.ts";
import { findAll } from "./analyzer.ts";
import { asFunctionCall } from "./ast-nodes.ts";

function allFunctionsFlat(analysis: FileAnalysis, importedAnalyses: Map<string, FileAnalysis>): FunctionSymbol[] {
	const fns = [...analysis.functions];
	for (const a of importedAnalyses.values()) fns.push(...a.functions);
	return fns;
}

/**
 * Walk all FunctionCall nodes in the AST and report XPST0017 for any call
 * where the argument count does not match any known overload of that function,
 * or where the function name is not declared in a namespace we have analysis for.
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

	for (const callNode of findAll(ast, "FunctionCall")) {
		const call = asFunctionCall(callNode, analysis);
		if (!call) continue;

		// Find all overloads with matching namespaceUri + localName
		const overloads = allFns.filter(
			(f) => f.qname.namespaceUri === call.qname.namespaceUri && f.qname.localName === call.qname.localName,
		);

		if (overloads.length === 0) {
			// Namespace is unknown — could be a runtime-only library; skip silently.
			if (!knownNamespaceUris.has(call.qname.namespaceUri)) continue;
			// Namespace is known but this function name is not declared.
			const name = formatQName(call.qname);
			errors.push({
				message: `${name} is not declared`,
				code: "XPST0017",
				offset: callNode.start ?? 0,
				length: name.length,
			});
			continue;
		}

		// Check if any overload accepts the given number of arguments.
		// Variadic overloads accept any arg count >= their declared arity.
		const arityMatch = overloads.some((f) => (f.variadic ? call.args.length >= f.arity : f.arity === call.args.length));
		if (arityMatch) continue;

		// Build the expected arities description
		const arities = [...new Set(overloads.map((f) => f.arity))].sort((a, b) => a - b);
		const isVariadic = overloads.some((f) => f.variadic);
		const expected =
			isVariadic
				? `${arities[0]} or more`
				: arities.length === 1
					? `${arities[0]}`
					: arities.join(" or ");

		const name = formatQName(call.qname);
		errors.push({
			message: `${name} expects ${expected} argument(s), got ${call.args.length}`,
			code: "XPST0017",
			offset: callNode.start ?? 0,
			length: name.length,
		});
	}

	return errors;
}
