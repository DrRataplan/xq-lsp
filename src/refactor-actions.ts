import type { Node, NonTerminal } from "xq-parser";
import type { FileAnalysis, ImportInfo, QName } from "./types.ts";
import { formatQName, qnameKey } from "./types.ts";
import { isTerminal, directChildOf, directChildrenOf, findAll, firstTerminalValue, parseEQName, resolvePrefix } from "./analyzer.ts";
import { asBinding, asVarRef, asVarName } from "./ast-nodes.ts";
import { checkUnused } from "./unused-diagnostics.ts";

export interface OffsetEdit {
	start: number;
	end: number;
	newText: string;
}

// ── source.organizeImports ───────────────────────────────────────────────────

interface ImportSpan {
	start: number;
	end: number; // includes the trailing ';'
	text: string;
	info: ImportInfo;
}

/**
 * Pairs each `Import` prolog node (holding a ModuleImport) with the following
 * `;` Separator sibling so the captured span includes the terminator — the
 * Import node itself stops right before it.
 */
function collectModuleImportSpans(ast: Node, analysis: FileAnalysis, text: string): ImportSpan[] {
	const spans: ImportSpan[] = [];
	let importIndex = 0;
	for (const prolog of findAll(ast, "Prolog")) {
		if (isTerminal(prolog)) continue;
		const children = (prolog as NonTerminal).children;
		for (let i = 0; i < children.length; i++) {
			const child = children[i];
			if (isTerminal(child) || child.type !== "Import") continue;
			if (!directChildOf(child, "ModuleImport")) continue; // skip SchemaImport
			const info = analysis.imports[importIndex++];
			if (!info || child.start === undefined || child.end === null) continue;
			const next = children[i + 1];
			const end = !isTerminal(next) && next?.type === "Separator" && next.end != null ? next.end : child.end;
			spans.push({ start: child.start, end, text: text.slice(child.start, end), info });
		}
	}
	return spans;
}

/**
 * Builds the single edit that sorts `import module` declarations (by prefix,
 * then namespace URI) and drops any already flagged as unused. Returns null
 * when there is nothing to reorder or remove.
 */
export function buildOrganizeImportsEdit(ast: Node, analysis: FileAnalysis, text: string): OffsetEdit | null {
	const spans = collectModuleImportSpans(ast, analysis, text);
	if (spans.length === 0) return null;

	const unusedOffsets = new Set(
		checkUnused(ast, analysis)
			.filter((d) => d.code === "xq-lsp:unused-import")
			.map((d) => d.offset),
	);

	const kept = spans
		.filter((s) => !unusedOffsets.has(s.info.offset))
		.sort(
			(a, b) =>
				a.info.prefix.localeCompare(b.info.prefix) || a.info.namespaceUri.localeCompare(b.info.namespaceUri),
		);

	const start = spans[0].start;
	const end = spans[spans.length - 1].end;
	const newText = kept.map((s) => s.text).join("\n");

	if (newText === text.slice(start, end)) return null; // already organized
	return { start, end, newText };
}

// ── Shared: locate an expression node spanning an exact range ───────────────

/**
 * Ancestor chain (root .. deepest) of nodes whose span fully contains
 * [start, end]. Mirrors analyzer.ts's nodeStackAtOffset but for a range —
 * needed so a selection can be checked against an exact expression span.
 */
function nodeStackForRange(node: Node, start: number, end: number): Node[] {
	if (node.start === undefined || node.end === null) return [];
	if (start < node.start || end > node.end) return [];
	const result: Node[] = [node];
	if (!isTerminal(node)) {
		for (const child of (node as NonTerminal).children) {
			if (child.start === undefined || child.end === null || child.start === child.end) continue;
			if (child.start <= start && end <= child.end) {
				result.push(...nodeStackForRange(child, start, end));
				break;
			}
		}
	}
	return result;
}

/**
 * Resolves a selection to a single expression node only when [start, end]
 * matches some node's span exactly — a partial/misaligned selection (e.g.
 * half of a token) yields null so callers can decline to offer the action
 * rather than emit invalid code.
 */
function findExprNodeForRange(ast: Node, start: number, end: number): { node: Node; stack: Node[] } | null {
	if (start >= end) return null;
	const stack = nodeStackForRange(ast, start, end);
	const deepest = stack[stack.length - 1];
	if (!deepest || deepest.start !== start || deepest.end !== end) return null;
	return { node: deepest, stack };
}

function pickName(base: string, taken: Set<string>): string {
	if (!taken.has(base)) return base;
	let i = 2;
	while (taken.has(`${base}${i}`)) i++;
	return `${base}${i}`;
}

// ── refactor.extract (extract to variable) ───────────────────────────────────

export interface ExtractVariableResult {
	variableName: string;
	edits: OffsetEdit[];
}

/**
 * Builds the edits for "extract to variable": introduces `let $name := <expr>`
 * either as a new clause right before the FLWOR clause containing the
 * selection (so bindings the expression depends on stay in scope), or — when
 * there is no enclosing FLWOR — by wrapping the smallest enclosing statement
 * body (function body, main module body, …) in a synthetic `let ... return`.
 * Returns null when the selection doesn't resolve to a single expression node,
 * or no safe insertion point can be found.
 */
export function buildExtractVariableEdit(
	ast: Node,
	analysis: FileAnalysis,
	text: string,
	start: number,
	end: number,
): ExtractVariableResult | null {
	const found = findExprNodeForRange(ast, start, end);
	if (!found) return null;
	const { node: exprNode, stack } = found;

	const selectionText = text.slice(start, end);
	const takenNames = new Set(
		[...analysis.localBindings, ...analysis.moduleVariables].map((v) => v.qname.localName),
	);
	const variableName = pickName("value", takenNames);

	// Innermost enclosing FLWORExpr, if any (search ancestors, excluding exprNode itself).
	let flworIndex = -1;
	for (let i = stack.length - 2; i >= 0; i--) {
		if (stack[i].type === "FLWORExpr") {
			flworIndex = i;
			break;
		}
	}

	if (flworIndex >= 0) {
		const clauseNode = stack[flworIndex + 1];
		if (clauseNode?.start === undefined) return null;
		return {
			variableName,
			edits: [
				{ start: clauseNode.start, end: clauseNode.start, newText: `let $${variableName} := ${selectionText} ` },
				{ start, end, newText: `$${variableName}` },
			],
		};
	}

	// No FLWOR: find the nearest enclosing statement body to wrap in a synthetic let/return.
	let enclosingIndex = -1;
	for (let i = stack.length - 2; i >= 0; i--) {
		if (stack[i].type === "QueryBody" || stack[i].type === "EnclosedExpr") {
			enclosingIndex = i;
			break;
		}
	}
	if (enclosingIndex < 0) return null;
	const enclosing = stack[enclosingIndex];
	const innerExpr = directChildOf(enclosing, "Expr");
	if (!innerExpr || innerExpr.start === undefined || innerExpr.end === null) return null;

	const before = text.slice(innerExpr.start, exprNode.start);
	const after = text.slice(exprNode.end ?? exprNode.start, innerExpr.end);
	const newText = `let $${variableName} := ${selectionText} return (${before}$${variableName}${after})`;

	return {
		variableName,
		edits: [{ start: innerExpr.start, end: innerExpr.end, newText }],
	};
}

// ── refactor.extract (extract to function) ───────────────────────────────────

class ScopeStack {
	private frames: Array<Set<string>> = [];
	push(): void {
		this.frames.push(new Set());
	}
	pop(): void {
		this.frames.pop();
	}
	add(key: string): void {
		this.frames[this.frames.length - 1]?.add(key);
	}
	has(key: string): boolean {
		return this.frames.some((f) => f.has(key));
	}
}

function addBinding(bindingNode: Node, scope: ScopeStack, analysis: FileAnalysis, free: Map<string, QName>): void {
	const b = asBinding(bindingNode, analysis);
	if (!b) return;
	if (b.initExpr) collectFreeVars(b.initExpr, scope, analysis, free);
	scope.add(qnameKey(b.qname));
	if (b.positionalVar) scope.add(qnameKey(b.positionalVar.qname));
}

/**
 * Collects variables referenced within `node` that are not bound by any
 * binder inside `node` itself — the free variables of the selected
 * expression, which become the extracted function's parameters. Mirrors the
 * scope-walking pattern in unused-diagnostics.ts / variable-diagnostics.ts.
 */
function collectFreeVars(node: Node, scope: ScopeStack, analysis: FileAnalysis, free: Map<string, QName>): void {
	if (isTerminal(node)) return;
	const { children } = node as NonTerminal;

	switch (node.type) {
		case "FLWORExpr": {
			scope.push();
			for (const child of children) {
				if (isTerminal(child)) continue;
				const clause =
					child.type === "InitialClause" || child.type === "IntermediateClause"
						? ((child as NonTerminal).children.find((c) => !isTerminal(c)) ?? child)
						: child;
				switch (clause.type) {
					case "ForClause":
						for (const b of directChildrenOf(clause, "ForBinding")) addBinding(b, scope, analysis, free);
						break;
					case "LetClause":
						for (const b of directChildrenOf(clause, "LetBinding")) addBinding(b, scope, analysis, free);
						break;
					case "CountClause":
						addBinding(clause, scope, analysis, free);
						break;
					case "GroupByClause": {
						const specList = directChildOf(clause, "GroupingSpecList");
						for (const spec of specList ? directChildrenOf(specList, "GroupingSpec") : [])
							addBinding(spec, scope, analysis, free);
						break;
					}
					case "WindowClause": {
						const inner = directChildOf(clause, "TumblingWindowClause") ?? directChildOf(clause, "SlidingWindowClause");
						if (inner) addBinding(inner, scope, analysis, free);
						for (const c of (clause as NonTerminal).children) if (!isTerminal(c)) collectFreeVars(c, scope, analysis, free);
						break;
					}
					default:
						collectFreeVars(clause, scope, analysis, free);
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
					collectFreeVars(child, scope, analysis, free);
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
			if (body) collectFreeVars(body, scope, analysis, free);
			scope.pop();
			return;
		}

		case "CatchClause":
			return; // implicit $err:* vars are not tracked in the AST

		case "VarRef": {
			const qname = asVarRef(node, analysis);
			if (qname) {
				const key = qnameKey(qname);
				if (!scope.has(key) && !free.has(key)) free.set(key, qname);
			}
			return;
		}

		default:
			for (const child of children) collectFreeVars(child, scope, analysis, free);
	}
}

export interface ExtractFunctionResult {
	functionName: string;
	edits: OffsetEdit[];
}

/**
 * Builds the edits for "extract to function": wraps the selection in a new
 * `declare function local:name(...) { <expr> }`, inferring parameters from
 * free variable references, and replaces the selection with a call. Returns
 * null when the selection isn't a single expression node or there's no
 * Prolog to attach the new declaration to.
 */
export function buildExtractFunctionEdit(
	ast: Node,
	analysis: FileAnalysis,
	text: string,
	start: number,
	end: number,
): ExtractFunctionResult | null {
	const found = findExprNodeForRange(ast, start, end);
	if (!found) return null;
	const { node: exprNode } = found;

	const prolog = findAll(ast, "Prolog")[0];
	if (!prolog || prolog.start === undefined || prolog.end === null) return null;

	const free = new Map<string, QName>();
	collectFreeVars(exprNode, new ScopeStack(), analysis, free);
	const params = [...free.values()];

	const takenFnNames = new Set(analysis.functions.map((f) => f.qname.localName));
	const functionName = pickName("extracted", takenFnNames);

	const selectionText = text.slice(start, end);
	const paramList = params.map((p) => `$${formatQName(p)}`).join(", ");
	const argList = params.map((p) => `$${formatQName(p)}`).join(", ");

	const declarationText = `\ndeclare function local:${functionName}(${paramList}) {\n\t${selectionText}\n};\n`;
	const callText = `local:${functionName}(${argList})`;

	return {
		functionName,
		edits: [
			{ start: prolog.end, end: prolog.end, newText: declarationText },
			{ start, end, newText: callText },
		],
	};
}
