import type { FileAnalysis, TypeDiagnostic } from "./types.ts";

export interface ModuleImportDiagnostic extends TypeDiagnostic {
	code: "XQST0059";
}

/**
 * Report module imports whose target module resolves to a real file but
 * whose target namespace (from that file's own `module namespace` decl)
 * does not match the namespace URI written in the import statement.
 *
 * `importedAnalyses` is keyed by `atPath` when the import has a location
 * hint, and always also by `namespaceUri` — mirroring how `resolveContext`
 * in server.ts populates the map (a resolved import is recorded under both
 * keys). Preferring `atPath` when present and falling back to
 * `namespaceUri` lets this check reuse the same map without caring how the
 * caller resolved it. An import missing from the map entirely means
 * resolution didn't happen at all, which is a different problem and not
 * checked here.
 */
export function checkModuleImportTargets(
	analysis: FileAnalysis,
	importedAnalyses: Map<string, FileAnalysis>,
): ModuleImportDiagnostic[] {
	const out: ModuleImportDiagnostic[] = [];
	for (const imp of analysis.imports) {
		const imported = importedAnalyses.get(imp.atPath ?? imp.namespaceUri);
		if (!imported) continue;
		if (imported.moduleNamespaceUri === imp.namespaceUri) continue;

		const found = imported.moduleNamespaceUri
			? `target namespace '${imported.moduleNamespaceUri}'`
			: "no target namespace";
		const location = imp.atPath ? `at '${imp.atPath}'` : `for namespace '${imp.namespaceUri}'`;
		out.push({
			message: `Module ${location} declares ${found}, which does not match the imported namespace '${imp.namespaceUri}'`,
			code: "XQST0059",
			offset: imp.offset,
			length: imp.prefix.length,
		});
	}
	return out;
}

export interface UnresolvedImportDiagnostic extends TypeDiagnostic {
	code: "xq-lsp:unresolved-import";
}

/**
 * Report imports whose module could not be loaded. Variable and function
 * checks stay silent for such namespaces, so this is where the user learns
 * why. Reported as a warning (not XQST0059) because the module may
 * legitimately live outside the workspace or be generated at install time.
 */
export function checkUnresolvedImports(
	analysis: FileAnalysis,
	importedAnalyses: Map<string, FileAnalysis>,
): UnresolvedImportDiagnostic[] {
	const out: UnresolvedImportDiagnostic[] = [];
	for (const imp of analysis.imports) {
		if (importedAnalyses.has(imp.atPath ?? imp.namespaceUri) || importedAnalyses.has(imp.namespaceUri)) continue;
		const location = imp.atPath ? `at '${imp.atPath}'` : `for namespace '${imp.namespaceUri}'`;
		out.push({
			message: `Module ${location} could not be resolved; its functions and variables are not checked`,
			code: "xq-lsp:unresolved-import",
			offset: imp.offset,
			length: imp.prefix.length,
		});
	}
	return out;
}
