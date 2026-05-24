import type { Node, NonTerminal } from "xq-parser";
import { isTerminal, directChildOf } from "./analyzer.ts";

export interface ContextItemDiagnostic {
	message: string;
	code: "XPDY0002";
	offset: number;
	length: number;
}

function walk(node: Node, hasContextItem: boolean, out: ContextItemDiagnostic[]): void {
	if (isTerminal(node)) return;
	const nt = node as NonTerminal;

	switch (node.type) {
		case "AnnotatedDecl": {
			// FunctionDecl body and VarDecl binding are the two places where the
			// spec guarantees no context item is available.
			const fnDecl = directChildOf(node, "FunctionDecl");
			if (fnDecl) {
				const body = directChildOf(fnDecl, "FunctionBody");
				if (body) walk(body, false, out);
				return;
			}
			const varDecl = directChildOf(node, "VarDecl");
			if (varDecl) {
				const varValue = directChildOf(varDecl, "VarValue");
				if (varValue) walk(varValue, false, out);
				return;
			}
			return;
		}

		case "InlineFunctionExpr": {
			// Inline function body: no context item, same as declared functions.
			const body = directChildOf(node, "FunctionBody");
			if (body) walk(body, false, out);
			return;
		}

		case "Predicate": {
			// [Expr] — the expression evaluates with CI = the node being filtered.
			for (const child of nt.children) {
				if (!isTerminal(child)) walk(child, true, out);
			}
			return;
		}

		case "PathExpr": {
			// PathExpr = ("/" RelativePathExpr?) | ("//" RelativePathExpr) | RelativePathExpr
			// A leading "/" or "//" means the path starts from the document root,
			// which acts as the context item for all contained steps.
			const firstChild = nt.children[0];
			const absolute =
				firstChild !== undefined &&
				isTerminal(firstChild) &&
				(firstChild.value === "/" || firstChild.value === "//");
			for (const child of nt.children) {
				if (!isTerminal(child)) walk(child, absolute || hasContextItem, out);
			}
			return;
		}

		case "RelativePathExpr": {
			// StepExpr ("/" StepExpr)*
			// The first step uses the parent's context-item availability.
			// Every subsequent step has CI supplied by the preceding step's result.
			let stepIndex = 0;
			for (const child of nt.children) {
				if (isTerminal(child)) continue;
				walk(child, stepIndex === 0 ? hasContextItem : true, out);
				stepIndex++;
			}
			return;
		}

		case "SimpleMapExpr": {
			// PathExpr ("!" PathExpr)*
			// The first operand uses the parent's CI. Each operand after "!" has CI
			// from the preceding operand's result sequence.
			let operandIndex = 0;
			for (const child of nt.children) {
				if (isTerminal(child)) continue;
				walk(child, operandIndex === 0 ? hasContextItem : true, out);
				operandIndex++;
			}
			return;
		}

		case "AxisStep": {
			if (!hasContextItem) {
				out.push({
					message: "No context item in scope: axis steps require a context item",
					code: "XPDY0002",
					offset: node.start,
					length: Math.max(1, (node.end ?? node.start) - node.start),
				});
				return; // predicates on this step would be unreachable
			}
			// Recurse into predicates on this step (they introduce their own CI).
			for (const child of nt.children) {
				if (!isTerminal(child)) walk(child, true, out);
			}
			return;
		}

		case "ContextItemExpr": {
			// The "." expression requires a context item.
			if (!hasContextItem) {
				out.push({
					message: "No context item in scope: '.' requires a context item",
					code: "XPDY0002",
					offset: node.start,
					length: 1,
				});
			}
			return;
		}

		default: {
			for (const child of nt.children) walk(child, hasContextItem, out);
		}
	}
}

/**
 * Walk the AST and report axis steps and context-item expressions (`.`) used
 * where no context item is statically guaranteed to be in scope.
 *
 * Guaranteed-absent scopes: declared function bodies and declare-variable
 * bindings.  CI is re-introduced by predicates `[…]`, path steps after `/`,
 * and the right-hand side of a simple-map `!` expression.
 *
 * The main-module query body is not checked — implementations may supply a
 * context item externally (e.g. when running a query against a document).
 */
export function checkContextItemUsage(ast: Node): ContextItemDiagnostic[] {
	const out: ContextItemDiagnostic[] = [];
	// hasContextItem starts true for the module top level; it is set to false
	// only when entering FunctionBody or VarDecl value expressions.
	walk(ast, true, out);
	return out;
}
