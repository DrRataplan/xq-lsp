import type { Node, NonTerminal } from "xq-parser";
import type { FileAnalysis, QName } from "./types.ts";
import { qnameKey } from "./types.ts";
import { isTerminal, directChildOf, directChildrenOf, firstTerminalValue, parseEQName, resolvePrefix } from "./analyzer.ts";
import { asFunctionDecl, asVarRef, asVarName, asBinding, asInlineFunctionExpr, asWindowVars, asTransformExpr } from "./ast-nodes.ts";

export interface UndeclaredVariableDiagnostic {
	message: string;
	code: "XPST0008";
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function isKnown(qname: QName, scope: ScopeStack, moduleVarKeys: Set<string>): boolean {
	// Variables with an undeclared-prefix URI are already caught by XQST0081; skip here.
	if (qname.namespaceUri.startsWith("urn:xq-lsp:undeclared:")) return true;
	return scope.has(qnameKey(qname)) || moduleVarKeys.has(qnameKey(qname));
}

function reportVarRef(node: Node, qname: QName, out: UndeclaredVariableDiagnostic[]): void {
	const name = qname.prefix ? `${qname.prefix}:${qname.localName}` : qname.localName;
	out.push({
		message: `Variable '$${name}' is not declared`,
		code: "XPST0008",
		offset: node.start ?? 0,
		length: name.length + 1, // +1 for "$"
	});
}

function addBinding(
	bindingNode: Node,
	scope: ScopeStack,
	analysis: FileAnalysis,
	moduleVarKeys: Set<string>,
	out: UndeclaredVariableDiagnostic[],
): void {
	const b = asBinding(bindingNode, analysis);
	if (!b) return;
	if (b.initExpr) walk(b.initExpr, scope, analysis, moduleVarKeys, out);
	scope.add(qnameKey(b.qname));
	if (b.positionalVar) scope.add(qnameKey(b.positionalVar.qname));
}

// ── Scope-aware AST walker ────────────────────────────────────────────────────

function walk(
	node: Node,
	scope: ScopeStack,
	analysis: FileAnalysis,
	moduleVarKeys: Set<string>,
	out: UndeclaredVariableDiagnostic[],
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
				if (fn.body) walk(fn.body, scope, analysis, moduleVarKeys, out);
				scope.pop();
				return;
			}
			// Module variable declaration: walk the initializer expression only
			const varDecl = directChildOf(node, "VarDecl");
			if (varDecl && !isTerminal(varDecl)) {
				for (const child of (varDecl as NonTerminal).children)
					walk(child, scope, analysis, moduleVarKeys, out);
			}
			return;
		}

		case "FLWORExpr": {
			scope.push();
			for (const child of children) {
				if (isTerminal(child)) continue;
				// Unwrap InitialClause/IntermediateClause wrappers (may be multiply nested)
				let clause: Node = child;
				while (!isTerminal(clause) && (clause.type === "InitialClause" || clause.type === "IntermediateClause")) {
					const inner: Node | undefined = (clause as NonTerminal).children.find((c) => !isTerminal(c));
					if (!inner) break;
					clause = inner;
				}
				switch (clause.type) {
					case "ForClause":
						for (const b of directChildrenOf(clause, "ForBinding"))
							addBinding(b, scope, analysis, moduleVarKeys, out);
						break;
					case "LetClause":
						for (const b of directChildrenOf(clause, "LetBinding"))
							addBinding(b, scope, analysis, moduleVarKeys, out);
						break;
					case "CountClause":
						addBinding(clause, scope, analysis, moduleVarKeys, out);
						break;
					case "GroupByClause": {
						const specList = directChildOf(clause, "GroupingSpecList");
						for (const spec of specList ? directChildrenOf(specList, "GroupingSpec") : [])
							addBinding(spec, scope, analysis, moduleVarKeys, out);
						break;
					}
					case "WindowClause": {
						const inner =
							directChildOf(clause, "TumblingWindowClause") ??
							directChildOf(clause, "SlidingWindowClause");
						const b = inner ? asBinding(inner, analysis) : null;
						if (b) {
							// The "in" source expr is evaluated in the outer scope, before $w exists.
							if (b.initExpr) walk(b.initExpr, scope, analysis, moduleVarKeys, out);
							// Start/end condition vars ($current/$positional/$previous/$next) are visible
							// across both conditions and the return clause — but $w itself is not yet bound
							// while its own boundary conditions are being evaluated.
							for (const condType of ["WindowStartCondition", "WindowEndCondition"] as const) {
								const cond = inner ? directChildOf(inner, condType) : undefined;
								if (!cond) continue;
								const windowVarsNode = directChildOf(cond, "WindowVars");
								const wv = windowVarsNode ? asWindowVars(windowVarsNode, analysis) : null;
								if (wv) {
									if (wv.currentItem) scope.add(qnameKey(wv.currentItem));
									if (wv.positionalVar) scope.add(qnameKey(wv.positionalVar.qname));
									if (wv.previousItem) scope.add(qnameKey(wv.previousItem));
									if (wv.nextItem) scope.add(qnameKey(wv.nextItem));
								}
								const whenExpr = directChildOf(cond, "ExprSingle");
								if (whenExpr) walk(whenExpr, scope, analysis, moduleVarKeys, out);
							}
							scope.add(qnameKey(b.qname));
						}
						break;
					}
					default:
						walk(clause, scope, analysis, moduleVarKeys, out);
				}
			}
			scope.pop();
			return;
		}

		case "QuantifiedExpr": {
			scope.push();
			for (const child of children) {
				if (isTerminal(child)) continue;
				if (child.type === "VarName") {
					const qname = asVarName(child, analysis);
					if (qname) scope.add(qnameKey(qname));
				} else {
					walk(child, scope, analysis, moduleVarKeys, out);
				}
			}
			scope.pop();
			return;
		}

		case "InlineFunctionExpr": {
			scope.push();
			const paramList = directChildOf(node, "ParamList");
			for (const param of paramList ? (paramList as NonTerminal).children.filter((c) => c.type === "Param") : []) {
				const nameNode = directChildOf(param, "EQName");
				const rawName = nameNode ? firstTerminalValue(nameNode) : null;
				if (!rawName) continue;
				const { prefix, localName, uri } = parseEQName(rawName);
				scope.add(qnameKey({ prefix, localName, namespaceUri: uri ?? (prefix ? resolvePrefix(prefix, analysis) : "") }));
			}
			const body = directChildOf(node, "FunctionBody");
			if (body) walk(body, scope, analysis, moduleVarKeys, out);
			scope.pop();
			return;
		}

		case "CatchClause":
			// Skip: implicit $err:* variables inside catch clauses are not tracked in the AST.
			return;

		case "InlineFunctionExpr": {
			const fn = asInlineFunctionExpr(node, analysis);
			if (!fn) break;
			scope.push();
			for (const p of fn.params) scope.add(qnameKey(p.qname));
			if (fn.body) walk(fn.body, scope, analysis, moduleVarKeys, out);
			scope.pop();
			return;
		}

		case "XQUF_TransformExpr": {
			const tx = asTransformExpr(node, analysis);
			if (!tx) break;
			scope.push();
			for (const b of tx.copyBindings) {
				walk(b.initExpr, scope, analysis, moduleVarKeys, out);
				scope.add(qnameKey(b.qname));
			}
			if (tx.modifyExpr) walk(tx.modifyExpr, scope, analysis, moduleVarKeys, out);
			if (tx.returnExpr) walk(tx.returnExpr, scope, analysis, moduleVarKeys, out);
			scope.pop();
			return;
		}

		case "VarRef": {
			const qname = asVarRef(node, analysis);
			if (qname && !isKnown(qname, scope, moduleVarKeys))
				reportVarRef(node, qname, out);
			return;
		}

		default:
			for (const child of children) walk(child, scope, analysis, moduleVarKeys, out);
	}
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Walk the AST and report every variable reference that cannot be resolved
 * to a declared variable: function parameter, let/for binding, module-level
 * `declare variable`, or an imported module variable.
 *
 * Variables whose namespace prefix is undeclared are skipped — XQST0081
 * already fires for those, and adding XPST0008 on top would be noisy.
 * Variables inside catch clauses are also skipped since the implicit
 * `$err:*` bindings are not represented in the AST.
 */
export function checkUndeclaredVariables(
	ast: Node,
	analysis: FileAnalysis,
	importedAnalyses: Map<string, FileAnalysis>,
): UndeclaredVariableDiagnostic[] {
	const moduleVarKeys = new Set<string>();
	for (const v of analysis.moduleVariables) moduleVarKeys.add(qnameKey(v.qname));
	for (const imported of importedAnalyses.values())
		for (const v of imported.moduleVariables) moduleVarKeys.add(qnameKey(v.qname));

	const out: UndeclaredVariableDiagnostic[] = [];
	walk(ast, new ScopeStack(), analysis, moduleVarKeys, out);
	return out;
}
