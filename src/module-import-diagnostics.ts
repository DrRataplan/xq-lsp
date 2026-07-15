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
