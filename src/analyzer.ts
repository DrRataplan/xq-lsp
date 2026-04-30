import { XQuery31Full } from "xq-parser";
import type { Node, NonTerminal, Terminal } from "xq-parser";
import type { FileAnalysis, FunctionSymbol, VariableSymbol, ImportInfo, ParamInfo, DocComment } from "./types.ts";

// ── Well-known namespace URIs ────────────────────────────────────────────────

export const XMLNS_FN    = "http://www.w3.org/2005/xpath-functions";
export const XMLNS_LOCAL = "http://www.w3.org/2005/xquery-local-functions";
export const XMLNS_XS    = "http://www.w3.org/2001/XMLSchema";
export const XMLNS_MATH  = "http://www.w3.org/2005/xpath-functions/math";
export const XMLNS_MAP   = "http://www.w3.org/2005/xpath-functions/map";
export const XMLNS_ARRAY = "http://www.w3.org/2005/xpath-functions/array";

const BUILTIN_PREFIXES: Record<string, string> = {
	fn:    XMLNS_FN,
	local: XMLNS_LOCAL,
	xs:    XMLNS_XS,
	math:  XMLNS_MATH,
	map:   XMLNS_MAP,
	array: XMLNS_ARRAY,
};

/**
 * Resolve a namespace prefix to its URI given the namespace context of a file.
 * Unprefixed calls (prefix="") resolve to the file's default function namespace.
 * Unknown prefixes fall back to a stable synthetic URI so within-file matches still work.
 */
export function resolvePrefix(prefix: string, analysis: FileAnalysis): string {
	if (!prefix) return analysis.defaultFunctionNamespace;
	const imp = analysis.imports.find((i) => i.prefix === prefix);
	if (imp) return imp.namespaceUri;
	if (prefix === analysis.modulePrefix && analysis.moduleNamespaceUri) return analysis.moduleNamespaceUri;
	return BUILTIN_PREFIXES[prefix] ?? `urn:xq-lsp:undeclared:${prefix}`;
}

// ── AST helpers ─────────────────────────────────────────────────────────────

function isTerminal(node: Node): node is Terminal {
	return node.isTerminal;
}

function asNonTerminal(node: Node): NonTerminal {
	return node as NonTerminal;
}

function firstTerminalValue(node: Node): string | null {
	if (isTerminal(node)) return node.value;
	for (const child of asNonTerminal(node).children) {
		const v = firstTerminalValue(child);
		if (v !== null) return v;
	}
	return null;
}

function findAll(node: Node, type: string, out: Node[] = []): Node[] {
	if (node.type === type) out.push(node);
	if (!isTerminal(node)) {
		for (const child of asNonTerminal(node).children) {
			findAll(child, type, out);
		}
	}
	return out;
}

function directChildOf(node: Node, type: string): Node | undefined {
	if (isTerminal(node)) return undefined;
	return asNonTerminal(node).children.find((c) => c.type === type);
}

function directChildrenOf(node: Node, type: string): Node[] {
	if (isTerminal(node)) return [];
	return asNonTerminal(node).children.filter((c) => c.type === type);
}

// ── Doc comment parsing ──────────────────────────────────────────────────────

function parseDocComment(raw: string): DocComment {
	// Strip (: / (:~ opening and :) closing, then strip leading " : " per line
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

/** Find a doc comment immediately preceding `offset` in raw text (regex fallback path). */
function findPrecedingDocInText(text: string, offset: number): DocComment | undefined {
	const before = text.slice(0, offset);
	const match = before.match(/\(:~?[\s\S]*?:\)\s*$/);
	if (!match) return undefined;
	return parseDocComment(match[0]);
}

/** Find the xqDoc comment immediately preceding `offset` (only whitespace between). */
function findPrecedingDoc(comments: Terminal[], text: string, offset: number): DocComment | undefined {
	// Walk backwards through comments sorted by end position
	const before = comments.filter((c) => c.end <= offset).sort((a, b) => b.end - a.end);

	for (const c of before) {
		const between = text.slice(c.end, offset);
		if (!/^\s*$/.test(between)) break; // something other than whitespace — stop
		if (c.value.startsWith("(:~") || c.value.startsWith("(:")) {
			return parseDocComment(c.value);
		}
	}
	return undefined;
}

// ── Namespace helpers ────────────────────────────────────────────────────────

function extractModuleNamespace(text: string): { prefix: string; uri: string } | undefined {
	const m = text.match(/module\s+namespace\s+([\w\-]+)\s*=\s*["']([^"']*)["']/);
	return m ? { prefix: m[1], uri: m[2] } : undefined;
}

function extractDefaultFunctionNamespace(text: string): string | undefined {
	const m = text.match(/declare\s+default\s+function\s+namespace\s+["']([^"']*)["']/);
	return m ? m[1] : undefined;
}

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

// ── Extract from valid AST ───────────────────────────────────────────────────

function sequenceTypeText(text: string, node: Node): string | undefined {
	if (node.start === undefined || node.end === null) return undefined;
	return text.slice(node.start, node.end ?? undefined).trim() || undefined;
}

function extractFunctions(
	ast: Node,
	sourceUri: string,
	comments: Terminal[],
	text: string,
	prefixMap: Map<string, string>,
): FunctionSymbol[] {
	const results: FunctionSymbol[] = [];
	// Use AnnotatedDecl (starts at 'declare') so the comment lookup clears the 'declare' keyword
	for (const annotated of findAll(ast, "AnnotatedDecl")) {
		const decl = directChildOf(annotated, "FunctionDecl");
		if (!decl) continue;

		const eqname = directChildOf(decl, "EQName");
		const name = eqname ? firstTerminalValue(eqname) : null;
		if (!name) continue;

		const colonIdx = name.indexOf(":");
		const prefix = colonIdx >= 0 ? name.slice(0, colonIdx) : "";
		const localName = colonIdx >= 0 ? name.slice(colonIdx + 1) : name;

		const doc = findPrecedingDoc(comments, text, annotated.start);

		const params: ParamInfo[] = [];
		const paramList = directChildOf(decl, "ParamList");
		if (paramList) {
			for (const param of findAll(paramList, "Param")) {
				const paramEqname = directChildOf(param, "EQName");
				const paramName = paramEqname ? firstTerminalValue(paramEqname) : null;
				if (!paramName) continue;
				const typeDecl = directChildOf(param, "TypeDeclaration");
				const seqTypeNode = typeDecl && directChildOf(typeDecl, "SequenceType");
				const paramType = seqTypeNode ? sequenceTypeText(text, seqTypeNode) : undefined;
				params.push({
					name: paramName,
					type: paramType,
					description: doc?.params[paramName],
				});
			}
		}

		// Return type: 'as' followed by SequenceType (direct child of FunctionDecl)
		const seqType = directChildOf(decl, "SequenceType");
		const returnType = seqType ? sequenceTypeText(text, seqType) : undefined;

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
			sourceOffset: annotated.start,
		});
	}
	return results;
}

function extractModuleVariables(ast: Node, sourceUri: string): VariableSymbol[] {
	const results: VariableSymbol[] = [];
	for (const varDecl of findAll(ast, "VarDecl")) {
		const varName = directChildOf(varDecl, "VarName");
		const name = varName ? firstTerminalValue(varName) : null;
		if (!name) continue;
		results.push({
			name,
			offset: varDecl.start,
			isModuleLevel: true,
			sourceUri,
		});
	}
	return results;
}

function extractLocalBindings(ast: Node, sourceUri: string): VariableSymbol[] {
	const results: VariableSymbol[] = [];
	for (const binding of [...findAll(ast, "LetBinding"), ...findAll(ast, "ForBinding")]) {
		const varName = directChildOf(binding, "VarName");
		const name = varName ? firstTerminalValue(varName) : null;
		if (!name) continue;
		results.push({
			name,
			offset: binding.start,
			isModuleLevel: false,
			sourceUri,
		});
	}
	return results;
}

function extractImports(ast: Node): ImportInfo[] {
	const results: ImportInfo[] = [];
	for (const mi of findAll(ast, "ModuleImport")) {
		const ncname = directChildOf(mi, "NCName");
		const prefix = ncname ? firstTerminalValue(ncname) : null;
		if (!prefix) continue;
		const uris = directChildrenOf(mi, "URILiteral");
		if (uris.length < 2) continue;
		const namespaceUri = stripQuotes(firstTerminalValue(uris[0]) ?? "");
		const atPath = stripQuotes(firstTerminalValue(uris[1]) ?? "");
		results.push({ prefix, namespaceUri, atPath });
	}
	return results;
}

function stripQuotes(s: string): string {
	return s.replace(/^["']|["']$/g, "");
}

function analyzeAst(ast: Node, comments: Terminal[], text: string, sourceUri: string): FileAnalysis {
	const imports = extractImports(ast);
	const moduleNs = extractModuleNamespace(text);
	const defaultFunctionNamespace = extractDefaultFunctionNamespace(text) ?? XMLNS_FN;
	const prefixMap = buildPrefixMap(moduleNs, imports);
	return {
		functions: extractFunctions(ast, sourceUri, comments, text, prefixMap),
		moduleVariables: extractModuleVariables(ast, sourceUri),
		localBindings: extractLocalBindings(ast, sourceUri),
		imports,
		defaultFunctionNamespace,
		moduleNamespaceUri: moduleNs?.uri,
		modulePrefix: moduleNs?.prefix,
	};
}

// ── Regex fallback for syntactically invalid / partial XQuery ────────────────

const RE_FUNC = /declare\s+(?:%[\w:\-]+(?:\([^)]*\))?\s+)*function\s+([\w:\-]+)\s*\(([^)]*)\)/g;
const RE_VAR_DECL = /declare\s+(?:%[\w:\-]+(?:\([^)]*\))?\s+)*variable\s+\$([\w:\-]+)/g;
const RE_LET = /\blet\s+\$([\w:\-]+)\s*:=/g;
const RE_FOR = /\bfor\s+\$([\w:\-]+)\s+in\b/g;
const RE_IMPORT = /import\s+module\s+namespace\s+([\w\-]+)\s*=\s*["']([^"']*)["']\s+at\s+["']([^"']*)["']/g;

function analyzeRegex(text: string, sourceUri: string): FileAnalysis {
	const moduleVariables: VariableSymbol[] = [];
	const localBindings: VariableSymbol[] = [];
	const moduleNs = extractModuleNamespace(text);
	const defaultFunctionNamespace = extractDefaultFunctionNamespace(text) ?? XMLNS_FN;

	let m: RegExpExecArray | null;

	// Collect imports first so we can build the prefix map before resolving functions.
	const imports: ImportInfo[] = [];
	RE_IMPORT.lastIndex = 0;
	while ((m = RE_IMPORT.exec(text)) !== null) {
		imports.push({ prefix: m[1], namespaceUri: m[2], atPath: m[3] });
	}

	const prefixMap = buildPrefixMap(moduleNs, imports);

	const functions: FunctionSymbol[] = [];
	RE_FUNC.lastIndex = 0;
	while ((m = RE_FUNC.exec(text)) !== null) {
		const name = m[1];
		const colonIdx = name.indexOf(":");
		const prefix = colonIdx >= 0 ? name.slice(0, colonIdx) : "";
		const localName = colonIdx >= 0 ? name.slice(colonIdx + 1) : name;
		const doc = findPrecedingDocInText(text, m.index);
		const rawParams = m[2].trim();
		const params: ParamInfo[] = rawParams
			? rawParams.split(",").map((p) => {
					const varMatch = p.match(/\$([\w:\-]+)/);
					const typeMatch = p.match(/as\s+([\w:\-]+(?:\(.*?\))?)/);
					const paramName = varMatch ? varMatch[1] : p.trim();
					return {
						name: paramName,
						type: typeMatch ? typeMatch[1] : undefined,
						description: doc?.params[paramName],
					};
				})
			: [];
		functions.push({
			name,
			prefix,
			localName,
			namespaceUri: resolveNamespaceUri(prefix, prefixMap),
			arity: params.length,
			params,
			doc,
			sourceUri,
			sourceOffset: m.index,
		});
	}

	RE_VAR_DECL.lastIndex = 0;
	while ((m = RE_VAR_DECL.exec(text)) !== null) {
		moduleVariables.push({
			name: m[1],
			offset: m.index,
			isModuleLevel: true,
			sourceUri,
		});
	}

	RE_LET.lastIndex = 0;
	while ((m = RE_LET.exec(text)) !== null) {
		localBindings.push({
			name: m[1],
			offset: m.index,
			isModuleLevel: false,
			sourceUri,
		});
	}

	RE_FOR.lastIndex = 0;
	while ((m = RE_FOR.exec(text)) !== null) {
		localBindings.push({
			name: m[1],
			offset: m.index,
			isModuleLevel: false,
			sourceUri,
		});
	}

	return {
		functions,
		moduleVariables,
		localBindings,
		imports,
		defaultFunctionNamespace,
		moduleNamespaceUri: moduleNs?.uri,
		modulePrefix: moduleNs?.prefix,
	};
}

// Testing

export function analyze(text: string, sourceUri: string): FileAnalysis {
	try {
		const { ast, comments } = XQuery31Full(text);
		return analyzeAst(ast, comments, text, sourceUri);
	} catch {
		return analyzeRegex(text, sourceUri);
	}
}
