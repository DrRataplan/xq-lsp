import type { Node } from "xq-parser";
import type { TypeDiagnostic, FileAnalysis } from "./types.ts";
import { formatQName } from "./types.ts";
import { findAll } from "./analyzer.ts";
import { asFunctionDeclaration, asVariableDeclaration } from "./ast-nodes.ts";

export interface ModuleNamespaceDiagnostic extends TypeDiagnostic {
	code: "XQST0048";
}

/**
 * XQST0048: in a library module, every declared function and variable must be
 * in the module's target namespace (e.g. a `local:` function is an error).
 * Main modules have no target namespace and are not checked.
 */
export function checkModuleNamespaceDecls(ast: Node, analysis: FileAnalysis): ModuleNamespaceDiagnostic[] {
	const target = analysis.moduleNamespaceUri;
	if (!target) return [];
	const out: ModuleNamespaceDiagnostic[] = [];
	for (const annotated of findAll(ast, "AnnotatedDecl")) {
		const decl = asFunctionDeclaration(annotated, analysis);
		const isFn = !!decl;
		const d = decl ?? asVariableDeclaration(annotated, analysis);
		if (!d || d.qname.namespaceUri === target) continue;
		const name = formatQName(d.qname);
		out.push({
			message: `${isFn ? "Function" : "Variable"} '${name}' must use the module's target namespace (expected prefix: '${analysis.modulePrefix}')`,
			code: "XQST0048",
			offset: d.nameNode.start ?? 0,
			length: name.length,
		});
	}
	return out;
}
