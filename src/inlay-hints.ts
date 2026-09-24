import { InlayHintKind } from "vscode-languageserver/node.js";
import type { InlayHint, Range } from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { Node } from "xq-parser";
import type { FileAnalysis, FunctionSymbol, XQueryType } from "./types.ts";
import { findAll } from "./analyzer.ts";
import { asFunctionCall } from "./ast-nodes.ts";
import {
	externalVariableTypes,
	formatType,
	resolveFunction,
	walkModuleScopes,
	withInferredReturnTypes,
} from "./typechecker.ts";

function allFunctionsFlat(analysis: FileAnalysis, importedAnalyses: Map<string, FileAnalysis>): FunctionSymbol[] {
	const fns = [...analysis.functions];
	for (const a of importedAnalyses.values()) fns.push(...a.functions);
	return fns;
}

function inRange(offset: number, range: { start: number; end: number }): boolean {
	return offset >= range.start && offset <= range.end;
}

// ── Parameter name hints ─────────────────────────────────────────────────────

function collectParameterHints(
	ast: Node,
	analysis: FileAnalysis,
	allFns: FunctionSymbol[],
	range: { start: number; end: number },
	hints: InlayHint[],
	doc: TextDocument,
): void {
	for (const callNode of findAll(ast, "FunctionCall")) {
		const call = asFunctionCall(callNode, analysis);
		if (!call || call.args.length === 0) continue;
		const fn = resolveFunction(call.qname, call.args.length, allFns);
		if (!fn) continue;

		for (let i = 0; i < call.args.length && i < fn.params.length; i++) {
			const argNode = call.args[i];
			if (!inRange(argNode.start, range)) continue;
			hints.push({
				position: doc.positionAt(argNode.start),
				label: `${fn.params[i].name}:`,
				kind: InlayHintKind.Parameter,
				paddingRight: true,
			});
		}
	}
}

// ── Inferred type hints on untyped bindings ──────────────────────────────────

// Shows the inferred type after the name of every binding without a declared type:
// let/for/group-by variables and module-level `declare variable`s. The scope walk is the
// same one the type checker uses, so hints reflect exactly what diagnostics see.
function collectTypeHints(
	ast: Node,
	analysis: FileAnalysis,
	allFns: FunctionSymbol[],
	range: { start: number; end: number },
	hints: InlayHint[],
	doc: TextDocument,
	outerScope: Map<string, XQueryType>,
): void {
	const seen = new Set<number>();
	walkModuleScopes(
		ast,
		analysis,
		allFns,
		{
			onBinding: (nameNode, type) => {
				const nameEnd = nameNode.end ?? nameNode.start;
				if (type.kind === "unknown" || !inRange(nameEnd, range) || seen.has(nameEnd)) return;
				seen.add(nameEnd);
				hints.push({
					position: doc.positionAt(nameEnd),
					label: `: ${formatType(type)}`,
					kind: InlayHintKind.Type,
					paddingLeft: true,
				});
			},
		},
		outerScope,
	);
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function getInlayHints(
	doc: TextDocument,
	ast: Node,
	analysis: FileAnalysis,
	imported: Map<string, FileAnalysis>,
	range: Range,
): InlayHint[] {
	const offsetRange = { start: doc.offsetAt(range.start), end: doc.offsetAt(range.end) };
	const declaredFns = allFunctionsFlat(analysis, imported);
	const outerScope = externalVariableTypes(analysis, imported.values(), declaredFns);
	const allFns = withInferredReturnTypes(ast, analysis, declaredFns, outerScope);
	const hints: InlayHint[] = [];

	collectParameterHints(ast, analysis, allFns, offsetRange, hints, doc);

	collectTypeHints(ast, analysis, allFns, offsetRange, hints, doc, outerScope);

	return hints;
}
