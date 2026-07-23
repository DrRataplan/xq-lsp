import type { FileAnalysis, NamespaceDecl, VariableSymbol } from "./types.ts";
import { qnameKey } from "./types.ts";

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

// ── eXist-db package-install script variables ────────────────────────────────

const EXISTDB_REPO_DOC_URL = "https://exist-db.org/exist/apps/doc/repo";

// eXist-db's package manager runs these scripts (referenced from repo.xml's <prepare>/
// <finish> elements) with $home/$dir/$target bound as external variables — they're never
// written as `declare variable ... external;` anywhere the user can see, so they'd
// otherwise look undeclared. Both the docs' "pre-install.xql"/"post-install.xql" spelling
// and the "preinstall.xql"/"postinstall.xql" variant (also seen in the wild) are recognized,
// with either the .xq or .xql extension.
const EXISTDB_INSTALL_SCRIPT_FILENAMES = new Set([
	"pre-install.xql",
	"pre-install.xq",
	"preinstall.xql",
	"preinstall.xq",
	"post-install.xql",
	"post-install.xq",
	"postinstall.xql",
	"postinstall.xq",
]);

const EXISTDB_INSTALL_VARIABLES: Array<{ localName: string; doc: string }> = [
	{
		localName: "home",
		doc: `Absolute file system path to the eXist-db installation directory (\`$EXIST_HOME\`).\n\n[eXist-db: Package Repository](${EXISTDB_REPO_DOC_URL})`,
	},
	{
		localName: "dir",
		doc: `Absolute file system path to the directory holding the unpacked contents of the \`.xar\` package currently being installed.\n\n[eXist-db: Package Repository](${EXISTDB_REPO_DOC_URL})`,
	},
	{
		localName: "target",
		doc: `The target collection in the database that the app is being deployed into.\n\n[eXist-db: Package Repository](${EXISTDB_REPO_DOC_URL})`,
	},
];

function basename(sourceUri: string): string {
	const withoutQuery = sourceUri.split(/[?#]/)[0];
	const slash = Math.max(withoutQuery.lastIndexOf("/"), withoutQuery.lastIndexOf("\\"));
	return withoutQuery.slice(slash + 1);
}

/**
 * Returns the external variables eXist-db's package manager binds when running a
 * pre-/post-install script ($home, $dir, $target) — present only when the existdb
 * runtime is active and `sourceUri`'s filename matches one of the recognized script names.
 */
export function getRuntimePredeclaredVariables(runtimes: string[], sourceUri: string): VariableSymbol[] {
	if (!runtimes.includes("existdb")) return [];
	if (!EXISTDB_INSTALL_SCRIPT_FILENAMES.has(basename(sourceUri).toLowerCase())) return [];
	return EXISTDB_INSTALL_VARIABLES.map(({ localName, doc }) => ({
		qname: { prefix: "", localName, namespaceUri: "" },
		offset: -1, // runtime-injected, not written in the user's source — see withPredeclaredNs above
		isModuleLevel: true,
		sourceUri,
		doc,
	}));
}

/**
 * Return a copy of `analysis` with the given predeclared variables merged into
 * `moduleVariables`. Variables already declared explicitly in the file are skipped.
 */
export function withPredeclaredVariables(analysis: FileAnalysis, predeclaredVars: VariableSymbol[]): FileAnalysis {
	if (predeclaredVars.length === 0) return analysis;
	const known = new Set(analysis.moduleVariables.map((v) => qnameKey(v.qname)));
	const toAdd = predeclaredVars.filter((v) => !known.has(qnameKey(v.qname)));
	if (toAdd.length === 0) return analysis;
	return { ...analysis, moduleVariables: [...analysis.moduleVariables, ...toAdd] };
}
