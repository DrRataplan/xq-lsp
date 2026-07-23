export interface QName {
	namespaceUri: string;
	localName: string;
	prefix: string; // for display only — identity is namespaceUri + localName
}

export function formatQName(q: QName): string {
	return q.prefix ? `${q.prefix}:${q.localName}` : q.localName;
}

export function qnameKey(q: QName): string {
	return q.namespaceUri ? `{${q.namespaceUri}}${q.localName}` : q.localName;
}

export interface ParamInfo {
	name: string;
	type?: string;
	description?: string;
	sourceOffset?: number; // char offset of the '$' or name in source
}

export interface DocComment {
	description: string;
	params: Record<string, string>; // param name (without $) → description
	returns?: string;
	variadic?: boolean; // true when @variadic tag is present
}

export interface FunctionSymbol {
	qname: QName;
	arity: number; // minimum number of arguments (= declared param count)
	variadic?: boolean; // accepts any number of args >= arity (e.g. fn:concat)
	params: ParamInfo[];
	returnType?: string;
	doc?: DocComment;
	sourceUri: string;
	sourceOffset?: number; // char offset of the declare keyword
}

export interface VariableSymbol {
	qname: QName;
	offset: number; // char offset in source where it's defined
	isModuleLevel: boolean;
	sourceUri: string;
	doc?: string; // markdown description from a preceding xqDoc comment, if any
}

export interface ImportInfo {
	prefix: string;
	namespaceUri: string;
	atPath?: string; // as written in source, e.g. "./other.xq"; absent when the import has no "at" clause
	offset: number; // char offset of the prefix in source
}

export interface NamespaceDecl {
	prefix: string;
	namespaceUri: string;
	offset: number; // char offset of the prefix in source
}

export interface FileAnalysis {
	functions: FunctionSymbol[];
	moduleVariables: VariableSymbol[]; // declare variable
	localBindings: VariableSymbol[]; // let/for bindings
	imports: ImportInfo[];
	namespaceDecls: NamespaceDecl[]; // from 'declare namespace prefix="uri"' statements
	defaultFunctionNamespace: string; // from 'declare default function namespace', else XMLNS_FN
	moduleNamespaceUri?: string; // from 'module namespace prefix="uri"'
	modulePrefix?: string; // from 'module namespace prefix="uri"'
	usedAstPath: boolean; // true when the AST parser succeeded, false when regex fallback was used
	ast?: import("xq-parser").Node; // present only on the AST path
}

export interface XQueryType {
	kind: "atomic" | "node" | "item" | "function" | "map" | "array" | "empty" | "unknown";
	name?: string; // e.g. "xs:string", "node", "element"
	occurrence: "" | "?" | "*" | "+";
}

export interface TypeDiagnostic {
	message: string;
	code: string; // XQuery error code, e.g. "XPTY0004"
	offset: number; // character offset into the source
	length: number;
}
