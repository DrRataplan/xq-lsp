// Tree-sitter integration for XQuery parsing.
//
// Provides a faster parse path for syntactically valid XQuery files using the
// `tree-sitter` (^0.20.x) and `tree-sitter-xquery` (^0.1.x) native packages.
// Both packages are loaded lazily via createRequire so that the module degrades
// gracefully when the native binaries are absent or incompatible.
//
// To activate this path, ensure `tree-sitter` and `tree-sitter-xquery` are installed
// and their native bindings are compiled (they are npm dependencies of this package).
//
// Node-type reference (tree-sitter-xquery grammar.js / src/node-types.json, ABI 14):
//   module                — root node
//   comment               — `(: ... :)` extra node (includes doc comments `(:~ ... :)`)
//   function_declaration  — `declare function <prefix>:<local>(<params>) as <type> { ... }`
//     named children in order: identifier (prefix), ":" (anon), identifier (local),
//                               param_list?, type_declaration?, enclosed_expr
//   param_list            — params separated by commas; each param: `$<id> [type_declaration]`
//     children in order per param: "$" (anon), identifier, optional type_declaration
//   type_declaration      — `as <sequence_type>`
//   sequence_type         — text of the type; may contain nested atomic_or_union_type
//   variable_declaration  — `declare variable $<name> := <expr>`
//     named child `variable`: "$" (anon), identifier (prefix?), ":", identifier (local)
//   module_import         — `import module namespace <prefix>="<uri>" [at "<path>"]`
//     children: identifier (prefix), string_literal (uri), source_at?
//   source_at             — `at "<path>"`
//     named child: string_literal
//   let_binding           — `$<name> := <expr>`; direct child of let_clause
//   for_binding           — `$<name> in <expr>`; direct child of for_clause

import { createRequire } from "module";
import type { FileAnalysis, FunctionSymbol, VariableSymbol, ImportInfo, ParamInfo, DocComment } from "./types.ts";

// Default function namespace (matches XMLNS_FN in analyzer.ts)
const XMLNS_FN = "http://www.w3.org/2005/xpath-functions";

// ── Lazy-load tree-sitter ────────────────────────────────────────────────────

let _parser: any = null;

function getParser(): any | null {
	if (_parser !== null) return _parser;
	try {
		const require = createRequire(import.meta.url);
		const Parser = require("tree-sitter") as new () => any;
		const XQuery = require("tree-sitter-xquery");
		const p = new Parser();
		p.setLanguage(XQuery);
		_parser = p;
		return _parser;
	} catch {
		// Native bindings unavailable or ABI mismatch — tree-sitter path disabled
		return null;
	}
}

// ── AST helpers ──────────────────────────────────────────────────────────────

/** Named children of `node`. */
function namedChildren(node: any): any[] {
	const out: any[] = [];
	for (let i = 0; i < node.namedChildCount; i++) out.push(node.namedChild(i));
	return out;
}

/** All children (named + anonymous) of `node`. */
function allChildren(node: any): any[] {
	const out: any[] = [];
	for (let i = 0; i < node.childCount; i++) out.push(node.child(i));
	return out;
}

/** Recursively find all nodes of a given type under root. */
function collectAll(root: any, type: string, out: any[] = []): any[] {
	if (root.type === type) out.push(root);
	for (let i = 0; i < root.childCount; i++) collectAll(root.child(i), type, out);
	return out;
}

/** Extract string content from a string_literal node (strips surrounding quotes). */
function stringLiteralValue(node: any): string {
	const text: string = node.text;
	return text.replace(/^["']|["']$/g, "");
}

// ── Doc comment helpers ──────────────────────────────────────────────────────

function parseDocComment(raw: string): DocComment {
	const inner = raw
		.replace(/^\(:~?/, "")
		.replace(/:\)$/, "")
		.split("\n")
		.map((l) => l.replace(/^\s*:?\s?/, ""))
		.join("\n")
		.trim();

	const params: Record<string, string> = {};
	let returns: string | undefined;
	const descLines: string[] = [];
	let inDescription = true;

	for (const line of inner.split("\n")) {
		const paramMatch = line.match(/^@param\s+\$?([\w:\-]+)\s*(.*)/);
		const returnMatch = line.match(/^@returns?\s+(.*)/);
		if (paramMatch) {
			inDescription = false;
			params[paramMatch[1]] = paramMatch[2].trim();
		} else if (returnMatch) {
			inDescription = false;
			returns = returnMatch[1].trim();
		} else if (inDescription) {
			descLines.push(line);
		}
	}

	return { description: descLines.join("\n").trim(), params, returns };
}

/**
 * Find the doc comment node (comment extra) immediately preceding `node` in the
 * tree's flat list of children at the module level. In tree-sitter-xquery, comments
 * appear as named children of the root `module` node with extras=true.
 */
function findPrecedingDocComment(rootNode: any, nodeStartIndex: number): DocComment | undefined {
	// Collect all comment nodes in the entire tree
	const comments: any[] = collectAll(rootNode, "comment");
	// Find the comment that ends immediately before nodeStartIndex (only whitespace between)
	const fullText: string = rootNode.text;
	const sorted = comments.filter((c) => c.endIndex <= nodeStartIndex).sort((a, b) => b.endIndex - a.endIndex);
	for (const c of sorted) {
		const between = fullText.slice(c.endIndex, nodeStartIndex);
		if (!/^\s*$/.test(between)) break;
		const raw: string = c.text;
		if (raw.startsWith("(:~") || raw.startsWith("(:")) return parseDocComment(raw);
	}
	return undefined;
}

// ── Namespace helpers ─────────────────────────────────────────────────────────

function extractModuleNamespace(text: string): { prefix: string; uri: string } | undefined {
	const m = text.match(/module\s+namespace\s+([\w\-]+)\s*=\s*["']([^"']*)["']/);
	return m ? { prefix: m[1], uri: m[2] } : undefined;
}

function extractDefaultFunctionNamespace(text: string): string | undefined {
	const m = text.match(/declare\s+default\s+function\s+namespace\s+["']([^"']*)["']/);
	return m ? m[1] : undefined;
}

const BUILTIN_PREFIXES: Record<string, string> = {
	fn: "http://www.w3.org/2005/xpath-functions",
	local: "http://www.w3.org/2005/xquery-local-functions",
	xs: "http://www.w3.org/2001/XMLSchema",
	math: "http://www.w3.org/2005/xpath-functions/math",
	map: "http://www.w3.org/2005/xpath-functions/map",
	array: "http://www.w3.org/2005/xpath-functions/array",
};

function buildPrefixMap(
	moduleNs: { prefix: string; uri: string } | undefined,
	imports: ImportInfo[],
): Map<string, string> {
	const map = new Map(Object.entries(BUILTIN_PREFIXES));
	if (moduleNs) map.set(moduleNs.prefix, moduleNs.uri);
	for (const imp of imports) map.set(imp.prefix, imp.namespaceUri);
	return map;
}

function resolveNamespaceUri(prefix: string, prefixMap: Map<string, string>): string {
	return prefixMap.get(prefix) ?? `urn:xq-lsp:undeclared:${prefix}`;
}

// ── Extraction from tree-sitter AST ──────────────────────────────────────────

/**
 * Extract the qualified name text from a function_declaration or variable node.
 * In tree-sitter-xquery, `local:add` is represented as two identifiers separated
 * by an anonymous ":" child: `[identifier("local"), ":"(anon), identifier("add")]`.
 * An unprefixed name is just `[identifier("name")]`.
 */
function extractQName(node: any): { prefix: string; localName: string; name: string } | null {
	const kids = allChildren(node);
	// Find identifiers (named) and ":" (anonymous) among direct children
	const identifiers: any[] = kids.filter((k) => k.isNamed && k.type === "identifier");
	const hasColon = kids.some((k) => !k.isNamed && k.type === ":");
	if (identifiers.length === 0) return null;
	if (hasColon && identifiers.length >= 2) {
		const prefix = identifiers[0].text as string;
		const localName = identifiers[1].text as string;
		return { prefix, localName, name: `${prefix}:${localName}` };
	}
	const localName = identifiers[0].text as string;
	return { prefix: "", localName, name: localName };
}

function extractImports(rootNode: any): ImportInfo[] {
	const results: ImportInfo[] = [];
	for (const mi of collectAll(rootNode, "module_import")) {
		// Collect named children: identifier (prefix) then string_literals and source_at
		const namedKids = namedChildren(mi);
		// First named child: identifier = prefix
		const prefixNode = namedKids.find((k) => k.type === "identifier");
		if (!prefixNode) continue;
		const prefix = prefixNode.text as string;
		// string_literal = namespace URI
		const stringLiterals = namedKids.filter((k) => k.type === "string_literal");
		if (stringLiterals.length < 1) continue;
		const namespaceUri = stringLiteralValue(stringLiterals[0]);
		// source_at child contains the "at" path
		const sourceAt = namedKids.find((k) => k.type === "source_at");
		let atPath: string | undefined;
		if (sourceAt) {
			const atStrings = namedChildren(sourceAt).filter((k) => k.type === "string_literal");
			if (atStrings.length > 0) atPath = stringLiteralValue(atStrings[0]);
		}
		results.push({ prefix, namespaceUri, atPath });
	}
	return results;
}

function extractFunctions(
	rootNode: any,
	text: string,
	sourceUri: string,
	prefixMap: Map<string, string>,
): FunctionSymbol[] {
	const results: FunctionSymbol[] = [];
	for (const fd of collectAll(rootNode, "function_declaration")) {
		// The function name is two identifiers separated by ":" for prefixed, or one identifier
		const qname = extractQName(fd);
		if (!qname) continue;
		const { prefix, localName, name } = qname;

		// Params: param_list child contains "$", identifier, optional type_declaration per param
		const params: ParamInfo[] = [];
		const paramListNode = namedChildren(fd).find((k) => k.type === "param_list");
		if (paramListNode) {
			// Walk children of param_list; params are grouped as: "$"(anon), identifier, optional type_declaration
			const plKids = allChildren(paramListNode);
			let i = 0;
			while (i < plKids.length) {
				// Skip commas and anonymous non-$ tokens
				const kid = plKids[i];
				if (!kid.isNamed && kid.type === "$") {
					// Next named sibling is the identifier (param name)
					const nameNode = plKids[i + 1];
					if (!nameNode || nameNode.type !== "identifier") { i++; continue; }
					const paramName = nameNode.text as string;
					// Check for type_declaration
					const typeNode = plKids[i + 2];
					let paramType: string | undefined;
					if (typeNode && typeNode.type === "type_declaration") {
						// type_declaration: "as" sequence_type
						const seqType = namedChildren(typeNode).find((k) => k.type === "sequence_type");
						if (seqType) paramType = (seqType.text as string).trim() || undefined;
						i += 3;
					} else {
						i += 2;
					}
					params.push({ name: paramName, type: paramType });
				} else {
					i++;
				}
			}
		}

		// Return type: type_declaration child of function_declaration (not inside param_list)
		const fdChildren = namedChildren(fd);
		const returnTypeNode = fdChildren.filter((k) => k.type === "type_declaration").pop();
		// The last type_declaration on fd (not inside param_list) is the return type
		let returnType: string | undefined;
		if (returnTypeNode) {
			const seqType = namedChildren(returnTypeNode).find((k) => k.type === "sequence_type");
			if (seqType) returnType = (seqType.text as string).trim() || undefined;
		}

		const doc = findPrecedingDocComment(rootNode, fd.startIndex);
		// Attach doc param descriptions
		if (doc) {
			for (const p of params) {
				p.description = doc.params[p.name];
			}
		}

		results.push({
			name,
			prefix,
			localName,
			namespaceUri: resolveNamespaceUri(prefix, prefixMap),
			arity: params.length,
			params,
			returnType,
			doc,
			sourceUri,
			sourceOffset: fd.startIndex,
		});
	}
	return results;
}

function extractModuleVariables(rootNode: any, sourceUri: string): VariableSymbol[] {
	const results: VariableSymbol[] = [];
	for (const vd of collectAll(rootNode, "variable_declaration")) {
		// named child `variable` (the node type is also "variable"): `$local:count` or `$count`
		const varNode = namedChildren(vd).find((k) => k.type === "variable");
		if (!varNode) continue;
		const qname = extractQName(varNode);
		if (!qname) continue;
		const name = qname.prefix ? `${qname.prefix}:${qname.localName}` : qname.localName;
		results.push({ name, offset: vd.startIndex, isModuleLevel: true, sourceUri });
	}
	return results;
}

function extractLocalBindings(rootNode: any, sourceUri: string): VariableSymbol[] {
	const results: VariableSymbol[] = [];
	for (const binding of [
		...collectAll(rootNode, "let_binding"),
		...collectAll(rootNode, "for_binding"),
	]) {
		// children: "$" (anon), identifier, ...
		const kids = allChildren(binding);
		const dollarIdx = kids.findIndex((k) => !k.isNamed && k.type === "$");
		if (dollarIdx < 0) continue;
		const nameNode = kids[dollarIdx + 1];
		if (!nameNode || nameNode.type !== "identifier") continue;
		const name = nameNode.text as string;
		results.push({ name, offset: binding.startIndex, isModuleLevel: false, sourceUri });
	}
	return results;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Return true if the tree contains any ERROR node (i.e., a syntax error). */
function hasErrorNodes(node: any): boolean {
	if (node.type === "ERROR") return true;
	for (let i = 0; i < node.childCount; i++) {
		if (hasErrorNodes(node.child(i))) return true;
	}
	return false;
}

/**
 * Parse `text` with tree-sitter. Returns a `FileAnalysis` if tree-sitter is available
 * and the file parses without syntax errors, otherwise returns `null`.
 *
 * Note: tree-sitter produces a partial tree even for invalid input. We reject trees
 * that contain `ERROR` nodes (hard syntax errors) so that the xq-parser or regex
 * fallback handles syntactically incomplete files (e.g., files being actively edited).
 * We do NOT reject on `hasError()` alone — the XQuery grammar produces harmless
 * "missing" nodes for declaration-only files that lack a trailing query body expression.
 */
export function analyzeWithTreeSitter(text: string, sourceUri: string): FileAnalysis | null {
	const parser = getParser();
	if (!parser) return null;

	let tree: any;
	try {
		tree = parser.parse(text) as any;
	} catch {
		return null;
	}

	const rootNode = tree.rootNode;
	// Reject trees with actual syntax errors — fall through to xq-parser
	if (hasErrorNodes(rootNode)) return null;

	const imports = extractImports(rootNode);
	const moduleNs = extractModuleNamespace(text);
	const defaultFunctionNamespace = extractDefaultFunctionNamespace(text) ?? XMLNS_FN;
	const prefixMap = buildPrefixMap(moduleNs, imports);

	return {
		functions: extractFunctions(rootNode, text, sourceUri, prefixMap),
		moduleVariables: extractModuleVariables(rootNode, sourceUri),
		localBindings: extractLocalBindings(rootNode, sourceUri),
		imports,
		defaultFunctionNamespace,
		moduleNamespaceUri: moduleNs?.uri,
		modulePrefix: moduleNs?.prefix,
	};
}
