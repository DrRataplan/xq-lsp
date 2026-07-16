import type { FileAnalysis, NamespaceDecl } from "./types.ts";

// Pure, dependency-free namespace data and helpers — no fs/path/url imports —
// so this module can be bundled for the browser demo as well as the Node LSP server.

function toNamespaceDecls(raw: Record<string, string>): NamespaceDecl[] {
	// offset: -1 marks these as runtime-injected rather than written in the user's
	// source — checkUnused skips them so it never flags a "declaration" the user
	// can't actually see or remove.
	return Object.entries(raw).map(([prefix, namespaceUri]) => ({ prefix, namespaceUri, offset: -1 }));
}

const EXISTDB_PREDECLARED_NAMESPACES: Record<string, string> = {
	util: "http://exist-db.org/xquery/util",
	xmldb: "http://exist-db.org/xquery/xmldb",
	system: "http://exist-db.org/xquery/system",
	request: "http://exist-db.org/xquery/request",
	response: "http://exist-db.org/xquery/response",
	session: "http://exist-db.org/xquery/session",
	process: "http://exist-db.org/xquery/process",
	sm: "http://exist-db.org/xquery/securitymanager",
	inspect: "http://exist-db.org/xquery/inspection",
	ft: "http://exist-db.org/xquery/lucene",
	ngram: "http://exist-db.org/xquery/ngram",
	range: "http://exist-db.org/xquery/range",
	sort: "http://exist-db.org/xquery/sort",
	file: "http://exist-db.org/xquery/file",
	compression: "http://exist-db.org/xquery/compression",
	cache: "http://exist-db.org/xquery/cache",
	transform: "http://exist-db.org/xquery/transform",
	scheduler: "http://exist-db.org/xquery/scheduler",
	validation: "http://exist-db.org/xquery/validation",
	image: "http://exist-db.org/xquery/image",
	repo: "http://exist-db.org/xquery/repo",
	mail: "http://exist-db.org/xquery/mail",
	xmldiff: "http://exist-db.org/xquery/xmldiff",
	contentextraction: "http://exist-db.org/xquery/contentextraction",
	counter: "http://exist-db.org/xquery/counter",
	exist: "http://exist.sourceforge.net/NS/exist",
	xsi: "http://www.w3.org/2001/XMLSchema-instance",
	xdt: "http://www.w3.org/2003/05/xpath-datatypes",
	err: "http://www.w3.org/2005/xqt-errors",
	exerr: "http://www.exist-db.org/xqt-errors/",
	java: "http://exist.sourceforge.net/NS/exist/java-binding",
	dbgp: "http://www.xdebug.org/",
};

function loadExistdbPredeclared(): NamespaceDecl[] {
	return toNamespaceDecls(EXISTDB_PREDECLARED_NAMESPACES);
}

/**
 * Returns all namespace declarations that are in scope without any explicit
 * `import module namespace` or `declare namespace` statement. Includes the
 * standard XQuery 3.1 predeclared namespaces (math, map, array) and any
 * runtime-specific additions (e.g. eXist-db's util, xmldb, …).
 */
export function getRuntimePredeclaredNamespaces(runtimes: string[]): NamespaceDecl[] {
	if (!runtimes.includes("existdb")) return [];
	return loadExistdbPredeclared();
}

/**
 * Return a copy of `analysis` with the given predeclared namespace declarations
 * merged into `namespaceDecls`. Prefixes already visible via imports, the
 * module's own prefix, or an existing `declare namespace` are skipped.
 */
export function withPredeclaredNs(analysis: FileAnalysis, predeclaredNs: NamespaceDecl[]): FileAnalysis {
	if (predeclaredNs.length === 0) return analysis;
	const known = new Set<string>([
		...analysis.imports.map((i) => i.prefix),
		...analysis.namespaceDecls.map((nd) => nd.prefix),
		...(analysis.modulePrefix ? [analysis.modulePrefix] : []),
	]);
	const toAdd = predeclaredNs.filter((nd) => !known.has(nd.prefix));
	if (toAdd.length === 0) return analysis;
	return { ...analysis, namespaceDecls: [...analysis.namespaceDecls, ...toAdd] };
}
