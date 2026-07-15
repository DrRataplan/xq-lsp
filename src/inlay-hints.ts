import { InlayHintKind } from "vscode-languageserver/node.js";
import type { InlayHint, Range } from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { Node, NonTerminal } from "xq-parser";
import type { FileAnalysis, FunctionSymbol, XQueryType } from "./types.ts";
import { qnameKey } from "./types.ts";
import { findAll, isTerminal, directChildOf } from "./analyzer.ts";
import { asFunctionCall, asBinding, asTypedBinding } from "./ast-nodes.ts";
import { parseType, inferExprType, formatType } from "./typechecker.ts";

function allFunctionsFlat(analysis: FileAnalysis, importedAnalyses: Map<string, FileAnalysis>): FunctionSymbol[] {
	const fns = [...analysis.functions];
	for (const a of importedAnalyses.values()) fns.push(...a.functions);
	return fns;
}

function resolveCallee(
	call: { qname: { namespaceUri: string; localName: string } },
	argCount: number,
	allFns: FunctionSymbol[],
): FunctionSymbol | undefined {
	const overloads = allFns.filter(
		(f) => f.qname.namespaceUri === call.qname.namespaceUri && f.qname.localName === call.qname.localName,
	);
	return overloads.find((f) => (f.variadic ? argCount >= f.arity : f.arity === argCount));
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
		const fn = resolveCallee(call, call.args.length, allFns);
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

// ── Inferred type hints on untyped let/for bindings ──────────────────────────

function collectParams(paramList: Node | undefined, text: string, analysis: FileAnalysis, scope: Map<string, XQueryType>): void {
	if (!paramList) return;
	for (const param of findAll(paramList, "Param")) {
		const binding = asTypedBinding(param, text, analysis);
		if (binding?.typeStr) scope.set(qnameKey(binding.qname), parseType(binding.typeStr));
	}
}

function buildModuleVarTypes(ast: Node, text: string, analysis: FileAnalysis): Map<string, XQueryType> {
	const types = new Map<string, XQueryType>();
	for (const node of findAll(ast, "VarDecl")) {
		const binding = asTypedBinding(node, text, analysis);
		if (binding?.typeStr) types.set(qnameKey(binding.qname), parseType(binding.typeStr));
	}
	return types;
}

// Walks the tree tracking in-scope variable types, mirroring typechecker.ts's scope walk,
// but also records the inferred type of untyped let/for bindings so later bindings see it.
function walkForTypeHints(
	node: Node,
	scopeTypes: Map<string, XQueryType>,
	moduleTypes: Map<string, XQueryType>,
	text: string,
	analysis: FileAnalysis,
	allFns: FunctionSymbol[],
	range: { start: number; end: number },
	hints: InlayHint[],
	doc: TextDocument,
): void {
	if (isTerminal(node)) return;
	const nt = node as NonTerminal;

	if (node.type === "InlineFunctionExpr") {
		const innerScope = new Map(moduleTypes);
		collectParams(directChildOf(node, "ParamList"), text, analysis, innerScope);
		const body = directChildOf(node, "FunctionBody");
		if (body) walkForTypeHints(body, innerScope, moduleTypes, text, analysis, allFns, range, hints, doc);
		return;
	}

	if (node.type === "LetBinding" || node.type === "ForBinding") {
		const typed = asTypedBinding(node, text, analysis);
		const binding = asBinding(node, analysis);
		if (typed && binding) {
			if (typed.typeStr) {
				scopeTypes.set(qnameKey(typed.qname), parseType(typed.typeStr));
			} else if (binding.initExpr) {
				const inferred = inferExprType(binding.initExpr, scopeTypes, analysis, allFns);
				scopeTypes.set(qnameKey(typed.qname), inferred);
				const nameEnd = binding.nameNode.end ?? binding.nameNode.start;
				if (inferred.kind !== "unknown" && inRange(nameEnd, range)) {
					hints.push({
						position: doc.positionAt(nameEnd),
						label: `: ${formatType(inferred)}`,
						kind: InlayHintKind.Type,
						paddingLeft: true,
					});
				}
			}
		}
	}

	for (const child of nt.children) {
		walkForTypeHints(child, scopeTypes, moduleTypes, text, analysis, allFns, range, hints, doc);
	}
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function getInlayHints(
	doc: TextDocument,
	ast: Node,
	analysis: FileAnalysis,
	imported: Map<string, FileAnalysis>,
	range: Range,
): InlayHint[] {
	const text = doc.getText();
	const offsetRange = { start: doc.offsetAt(range.start), end: doc.offsetAt(range.end) };
	const allFns = allFunctionsFlat(analysis, imported);
	const hints: InlayHint[] = [];

	collectParameterHints(ast, analysis, allFns, offsetRange, hints, doc);

	const moduleTypes = buildModuleVarTypes(ast, text, analysis);
	walkForTypeHints(ast, new Map(moduleTypes), moduleTypes, text, analysis, allFns, offsetRange, hints, doc);

	return hints;
}
