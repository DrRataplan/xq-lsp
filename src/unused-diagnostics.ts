import type { Node, NonTerminal } from "xq-parser";
import type { FileAnalysis } from "./types.ts";
import { qnameKey, formatQName } from "./types.ts";
import { isTerminal, directChildOf, directChildrenOf, findAll, firstTerminalValue } from "./analyzer.ts";
import {
	asFunctionCall,
	asNamedFunctionRef,
	asVarRef,
	asVarName,
	asFunctionDecl,
	asFunctionDeclaration,
	asVariableDeclaration,
	asBinding,
	asCatchClause,
} from "./ast-nodes.ts";

export interface UnusedDiagnostic {
	message: string;
	code: "xq-lsp:unused-function" | "xq-lsp:unused-variable" | "xq-lsp:unused-import" | "xq-lsp:unused-namespace";
	offset: number;
	length: number;
}

// ── Scope stack ───────────────────────────────────────────────────────────────

class ScopeStack {
	private frames: Array<Set<string>> = [];
	push(): void { this.frames.push(new Set()); }
	pop(): void { this.frames.pop(); }
	add(key: string): void { this.frames[this.frames.length - 1]?.add(key); }
	has(key: string): boolean { return this.frames.some((f) => f.has(key)); }
}

// ── Scope-aware AST walker ────────────────────────────────────────────────────

function addBinding(
	bindingNode: Node,
	scope: ScopeStack,
	analysis: FileAnalysis,
	usedFns: Set<string>,
	usedVars: Set<string>,
): void {
	const b = asBinding(bindingNode, analysis);
	if (!b) return;
	if (b.initExpr) walk(b.initExpr, scope, analysis, usedFns, usedVars);
	scope.add(qnameKey(b.qname));
	if (b.positionalVar) scope.add(qnameKey(b.positionalVar.qname));
}

function walk(
	node: Node,
	scope: ScopeStack,
	analysis: FileAnalysis,
	usedFns: Set<string>,
	usedVars: Set<string>,
): void {
	if (isTerminal(node)) return;
	const { children } = node as NonTerminal;

	switch (node.type) {
		case "AnnotatedDecl": {
			const fnDeclNode = directChildOf(node, "FunctionDecl");
			const fn = fnDeclNode ? asFunctionDecl(fnDeclNode, analysis) : null;
			if (fn) {
				scope.push();
				for (const p of fn.params) scope.add(qnameKey(p.qname));
				if (fn.body) walk(fn.body, scope, analysis, usedFns, usedVars);
				scope.pop();
				return;
			}
			const varDecl = directChildOf(node, "VarDecl");
			if (varDecl && !isTerminal(varDecl)) {
				for (const child of (varDecl as NonTerminal).children)
					walk(child, scope, analysis, usedFns, usedVars);
			}
			return;
		}

		case "FLWORExpr": {
			// Each binding clause extends scope sequentially
			scope.push();
			for (const child of children) {
				if (isTerminal(child)) continue;
				// Unwrap InitialClause / IntermediateClause wrappers
				const clause =
					child.type === "InitialClause" || child.type === "IntermediateClause"
						? ((child as NonTerminal).children.find((c) => !isTerminal(c)) ?? child)
						: child;
				switch (clause.type) {
					case "ForClause":
						for (const b of directChildrenOf(clause, "ForBinding"))
							addBinding(b, scope, analysis, usedFns, usedVars);
						break;
					case "LetClause":
						for (const b of directChildrenOf(clause, "LetBinding"))
							addBinding(b, scope, analysis, usedFns, usedVars);
						break;
					case "CountClause":
						addBinding(clause, scope, analysis, usedFns, usedVars);
						break;
					case "GroupByClause": {
						const specList = directChildOf(clause, "GroupingSpecList");
						for (const spec of specList ? directChildrenOf(specList, "GroupingSpec") : [])
							addBinding(spec, scope, analysis, usedFns, usedVars);
						break;
					}
					case "WindowClause": {
						const inner = directChildOf(clause, "TumblingWindowClause")
							?? directChildOf(clause, "SlidingWindowClause");
						if (inner) addBinding(inner, scope, analysis, usedFns, usedVars);
						// Walk start/end conditions; window-vars bindings not yet scope-tracked
						for (const c of (clause as NonTerminal).children)
							if (!isTerminal(c)) walk(c, scope, analysis, usedFns, usedVars);
						break;
					}
					default:
						walk(clause, scope, analysis, usedFns, usedVars);
				}
			}
			scope.pop();
			return;
		}

		case "QuantifiedExpr": {
			// "some"/"every" $x in e1, $y in e2 satisfies e3 — flat child structure
			// Approximation: all bound VarNames enter scope before any ExprSingle is walked
			scope.push();
			for (const child of children) {
				if (isTerminal(child)) continue;
				if (child.type === "VarName") {
					const qname = asVarName(child, analysis);
					if (qname) scope.add(qnameKey(qname));
				} else {
					walk(child, scope, analysis, usedFns, usedVars);
				}
			}
			scope.pop();
			return;
		}

		case "CatchClause": {
			// CatchClause has no explicit binding; $err:* vars are implicit
			const cc = asCatchClause(node);
			if (cc) walk(cc.body, scope, analysis, usedFns, usedVars);
			return;
		}

		case "VarRef": {
			const qname = asVarRef(node, analysis);
			if (qname) {
				const key = qnameKey(qname);
				if (!scope.has(key)) usedVars.add(key);
			}
			return;
		}

		case "FunctionCall": {
			const shape = asFunctionCall(node, analysis);
			if (shape) usedFns.add(`${qnameKey(shape.qname)}#${shape.args.length}`);
			for (const child of children) walk(child, scope, analysis, usedFns, usedVars);
			return;
		}

		case "NamedFunctionRef": {
			const ref = asNamedFunctionRef(node, analysis);
			if (ref) usedFns.add(`${qnameKey(ref.qname)}#${ref.arity}`);
			return;
		}

		default:
			for (const child of children) walk(child, scope, analysis, usedFns, usedVars);
	}
}

// ── Namespace-prefix usage scan ─────────────────────────────────────────────

/**
 * Every prefixed name in the query — function calls, variable refs, element
 * and attribute names (direct and computed constructors), type names, kind
 * tests, options, and pragmas — bottoms out in a `QName` (or `Wildcard`, for
 * `ns:*`) terminal whose value is the raw "prefix:local" text. Walking those
 * two terminal types catches every usage site without enumerating each
 * grammar production that can carry a prefix.
 */
function collectUsedPrefixes(ast: Node): Set<string> {
	const used = new Set<string>();

	for (const node of findAll(ast, "QName")) {
		const value = firstTerminalValue(node);
		if (!value || value.startsWith("xmlns") || value.startsWith("Q{")) continue;
		const colonIdx = value.indexOf(":");
		if (colonIdx > 0) used.add(value.slice(0, colonIdx));
	}

	for (const node of findAll(ast, "Wildcard")) {
		const value = firstTerminalValue(node);
		if (!value) continue;
		const colonIdx = value.indexOf(":");
		if (colonIdx <= 0) continue;
		const prefix = value.slice(0, colonIdx);
		if (prefix !== "*") used.add(prefix);
	}

	return used;
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Walk the AST and report declared functions and module-level variables that
 * are never referenced within the file.
 *
 * Only `%private` declarations are reported — public ones may be used by
 * other modules that import this one.
 * Names starting with `_` are skipped by convention (intentionally unused).
 * Variable references are scope-tracked so local bindings do not suppress
 * diagnostics on module variables they shadow.
 */
export function checkUnused(ast: Node, analysis: FileAnalysis): UnusedDiagnostic[] {
	const out: UnusedDiagnostic[] = [];

	const usedFunctions = new Set<string>(); // "qnameKey#arity"
	const usedVariables = new Set<string>(); // qnameKey

	walk(ast, new ScopeStack(), analysis, usedFunctions, usedVariables);

	// ── Check declared functions ─────────────────────────────────────────────

	for (const annotated of findAll(ast, "AnnotatedDecl")) {
		const fn = asFunctionDeclaration(annotated, analysis);
		if (!fn) continue;
		if (!fn.annotations.includes("private")) continue;
		if (fn.qname.localName.startsWith("_")) continue;
		if (usedFunctions.has(`${qnameKey(fn.qname)}#${fn.arity}`)) continue;

		const fnName = formatQName(fn.qname);
		out.push({
			message: `Function '${fnName}' is declared but never used`,
			code: "xq-lsp:unused-function",
			offset: fn.nameNode.start ?? 0,
			length: fnName.length,
		});
	}

	// ── Check declared module variables ─────────────────────────────────────

	for (const annotated of findAll(ast, "AnnotatedDecl")) {
		const varDecl = asVariableDeclaration(annotated, analysis);
		if (!varDecl) continue;
		if (!varDecl.annotations.includes("private")) continue;
		if (varDecl.qname.localName.startsWith("_")) continue;
		if (usedVariables.has(qnameKey(varDecl.qname))) continue;

		const varName = formatQName(varDecl.qname);
		out.push({
			message: `Variable '$${varName}' is declared but never used`,
			code: "xq-lsp:unused-variable",
			offset: varDecl.nameNode.start ?? 0,
			length: varName.length,
		});
	}

	// ── Check imports and namespace declarations ─────────────────────────────

	const usedPrefixes = collectUsedPrefixes(ast);

	for (const imp of analysis.imports) {
		if (usedPrefixes.has(imp.prefix)) continue;
		out.push({
			message: `Imported namespace prefix '${imp.prefix}' is never used`,
			code: "xq-lsp:unused-import",
			offset: imp.offset,
			length: imp.prefix.length,
		});
	}

	for (const nd of analysis.namespaceDecls) {
		if (nd.offset < 0) continue; // runtime-injected predeclared namespace, not written in source
		if (usedPrefixes.has(nd.prefix)) continue;
		out.push({
			message: `Namespace prefix '${nd.prefix}' is declared but never used`,
			code: "xq-lsp:unused-namespace",
			offset: nd.offset,
			length: nd.prefix.length,
		});
	}

	return out;
}
