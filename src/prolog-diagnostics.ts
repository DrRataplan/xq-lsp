import type { Node } from "xq-parser";
import type { TypeDiagnostic, FileAnalysis } from "./types.ts";
import { qnameKey } from "./types.ts";
import { findAll } from "./analyzer.ts";
import {
	asVersionDecl,
	asOptionDecl,
	asNamespaceDecl,
	asDefaultNamespaceDecl,
	asDecimalFormatDecl,
	asFunctionDecl,
	asInlineFunctionExpr,
} from "./ast-nodes.ts";

/** The second and later items sharing a key with an earlier item. */
function repeats<T>(items: T[], key: (item: T) => string): T[] {
	const seen = new Set<string>();
	return items.filter((item) => {
		const k = key(item);
		if (seen.has(k)) return true;
		seen.add(k);
		return false;
	});
}

function diagnostic(node: Node, code: string, message: string): TypeDiagnostic {
	const start = node.start ?? 0;
	return { message, code, offset: start, length: (node.end ?? start) - start };
}

/** Setter declarations that may appear at most once per prolog. */
const SINGLE_USE_DECLS: Array<{ type: string; code: string; what: string }> = [
	{ type: "BaseURIDecl", code: "XQST0032", what: "base URI" },
	{ type: "DefaultCollationDecl", code: "XQST0038", what: "default collation" },
	{ type: "OrderingModeDecl", code: "XQST0065", what: "ordering mode" },
	{ type: "ConstructionDecl", code: "XQST0067", what: "construction mode" },
	{ type: "BoundarySpaceDecl", code: "XQST0068", what: "boundary-space policy" },
	{ type: "EmptyOrderDecl", code: "XQST0069", what: "default empty order" },
];

const XMLNS_OUTPUT = "http://www.w3.org/2010/xslt-xquery-serialization";

/** Serialization parameters that may be set with `declare option output:*` (use-character-maps may not). */
const PROLOG_SERIALIZATION_PARAMS = new Set([
	"allow-duplicate-names",
	"byte-order-mark",
	"cdata-section-elements",
	"doctype-public",
	"doctype-system",
	"encoding",
	"escape-uri-attributes",
	"html-version",
	"include-content-type",
	"indent",
	"item-separator",
	"json-node-output-method",
	"media-type",
	"method",
	"normalization-form",
	"omit-xml-declaration",
	"parameter-document",
	"standalone",
	"suppress-indentation",
	"undeclare-prefixes",
	"version",
]);

const SUPPORTED_XQUERY_VERSIONS = new Set(["1.0", "3.0", "3.1", "4.0"]);

/**
 * Report an unsupported `xquery version` (XQST0031), serialization option
 * misuse (XQST0108/0109/0110) and prolog components that the spec allows only once: setters such as
 * `declare base-uri`, namespace prefixes, default element/function namespaces,
 * decimal formats, and duplicate function parameter names.
 * Only the second and later occurrences are flagged.
 */
export function checkDuplicatePrologDecls(ast: Node, analysis: FileAnalysis): TypeDiagnostic[] {
	const out: TypeDiagnostic[] = [];

	for (const node of findAll(ast, "VersionDecl")) {
		const decl = asVersionDecl(node);
		if (decl && !SUPPORTED_XQUERY_VERSIONS.has(decl.version))
			out.push(diagnostic(decl.versionNode, "XQST0031", `XQuery version '${decl.version}' is not supported`));
	}

	const isLibraryModule = findAll(ast, "LibraryModule").length > 0;
	const outputOptions = findAll(ast, "OptionDecl").flatMap((node) => {
		const decl = asOptionDecl(node, analysis);
		return decl?.qname.namespaceUri === XMLNS_OUTPUT ? [{ node, name: decl.qname.localName }] : [];
	});
	for (const { node, name } of outputOptions) {
		if (isLibraryModule)
			out.push(diagnostic(node, "XQST0108", "Serialization parameters may only be declared in a main module"));
		else if (!PROLOG_SERIALIZATION_PARAMS.has(name))
			out.push(diagnostic(node, "XQST0109", `'${name}' is not a serialization parameter that can be declared in the prolog`));
	}
	for (const { node, name } of repeats(outputOptions, (o) => o.name))
		out.push(diagnostic(node, "XQST0110", `Serialization parameter '${name}' is declared more than once`));

	for (const { type, code, what } of SINGLE_USE_DECLS)
		for (const node of repeats(findAll(ast, type), () => type))
			out.push(diagnostic(node, code, `The ${what} is declared more than once`));

	const namespaceDecls = findAll(ast, "NamespaceDecl").flatMap((node) => {
		const decl = asNamespaceDecl(node);
		return decl ? [{ node, ...decl }] : [];
	});
	for (const { node, prefix } of repeats(namespaceDecls, (d) => d.prefix))
		out.push(diagnostic(node, "XQST0033", `Namespace prefix '${prefix}' is declared more than once`));

	const defaultNsDecls = findAll(ast, "DefaultNamespaceDecl").flatMap((node) => {
		const decl = asDefaultNamespaceDecl(node);
		return decl ? [{ node, ...decl }] : [];
	});
	for (const { node, kind } of repeats(defaultNsDecls, (d) => d.kind))
		out.push(diagnostic(node, "XQST0066", `The default ${kind} namespace is declared more than once`));

	const decimalFormats = findAll(ast, "DecimalFormatDecl").flatMap((node) => {
		const decl = asDecimalFormatDecl(node, analysis);
		return decl ? [{ node, ...decl }] : [];
	});
	for (const { node } of repeats(decimalFormats, (d) => d.key))
		out.push(diagnostic(node, "XQST0111", "This decimal format is declared more than once"));
	for (const { properties } of decimalFormats)
		for (const { nameNode, name } of repeats(properties, (p) => p.name))
			out.push(diagnostic(nameNode, "XQST0114", `Decimal-format property '${name}' is specified more than once`));

	const paramLists = [
		...findAll(ast, "FunctionDecl").map((n) => asFunctionDecl(n, analysis)?.params),
		...findAll(ast, "InlineFunctionExpr").map((n) => asInlineFunctionExpr(n, analysis)?.params),
	];
	for (const params of paramLists)
		for (const { nameNode, qname } of repeats(params ?? [], (p) => qnameKey(p.qname)))
			out.push(diagnostic(nameNode, "XQST0039", `Parameter '$${qname.localName}' is declared more than once`));

	return out;
}
