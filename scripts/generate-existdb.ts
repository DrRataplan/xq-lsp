#!/usr/bin/env node
/**
 * Generates src/runtimes/existdb/*.xq from eXist-db Java source code on GitHub.
 *
 * Uses the same data source as eXist-db's fundocs/inspect:inspect-module():
 * the FunctionSignature objects defined in each Java module class.
 *
 * Strategy (avoids GitHub API rate limits):
 * 1. Fetch each module's *Module.java file via raw.githubusercontent.com
 * 2. Parse the FunctionDef[] array to discover implementation class names
 * 3. Fetch each implementation class's .java file
 * 4. Parse FunctionSignature definitions from all files
 * 5. Emit a .xq file for each namespace
 *
 * Usage:  node scripts/generate-existdb.ts
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "src", "runtimes", "existdb");

const GITHUB_RAW = "https://raw.githubusercontent.com/eXist-db/exist/develop";

// ── Type & Cardinality Maps ───────────────────────────────────────────────────

const TYPE_MAP: Record<string, string> = {
	"Type.STRING": "xs:string",
	"Type.INTEGER": "xs:integer",
	"Type.LONG": "xs:long",
	"Type.INT": "xs:int",
	"Type.SHORT": "xs:short",
	"Type.BYTE": "xs:byte",
	"Type.DECIMAL": "xs:decimal",
	"Type.FLOAT": "xs:float",
	"Type.DOUBLE": "xs:double",
	"Type.BOOLEAN": "xs:boolean",
	"Type.DATE": "xs:date",
	"Type.TIME": "xs:time",
	"Type.DATE_TIME": "xs:dateTime",
	"Type.DURATION": "xs:duration",
	"Type.DAY_TIME_DURATION": "xs:dayTimeDuration",
	"Type.YEAR_MONTH_DURATION": "xs:yearMonthDuration",
	"Type.ANY_URI": "xs:anyURI",
	"Type.QNAME": "xs:QName",
	"Type.BASE64_BINARY": "xs:base64Binary",
	"Type.HEX_BINARY": "xs:hexBinary",
	"Type.ELEMENT": "element()",
	"Type.ATTRIBUTE": "attribute()",
	"Type.TEXT": "text()",
	"Type.COMMENT": "comment()",
	"Type.DOCUMENT": "document-node()",
	"Type.PROCESSING_INSTRUCTION": "processing-instruction()",
	"Type.NAMESPACE": "namespace-node()",
	"Type.NODE": "node()",
	"Type.ITEM": "item()",
	"Type.ANY_TYPE": "xs:anyType",
	"Type.ANY_SIMPLE_TYPE": "xs:anySimpleType",
	"Type.ANY_ATOMIC_TYPE": "xs:anyAtomicType",
	"Type.UNTYPED_ATOMIC": "xs:untypedAtomic",
	"Type.UNTYPED": "xs:untyped",
	"Type.FUNCTION": "function(*)",
	"Type.MAP": "map(*)",
	"Type.MAP_ITEM": "map(*)",
	"Type.ARRAY": "array(*)",
	"Type.ARRAY_ITEM": "array(*)",
	"Type.NUMERIC": "xs:numeric",
	"Type.NUMBER": "xs:numeric",
	"Type.EMPTY_SEQUENCE": "empty-sequence()",
	"Type.EMPTY": "empty-sequence()",
	"Type.NON_NEGATIVE_INTEGER": "xs:nonNegativeInteger",
	"Type.POSITIVE_INTEGER": "xs:positiveInteger",
	"Type.NEGATIVE_INTEGER": "xs:negativeInteger",
	"Type.NON_POSITIVE_INTEGER": "xs:nonPositiveInteger",
	"Type.UNSIGNED_LONG": "xs:unsignedLong",
	"Type.UNSIGNED_INT": "xs:unsignedInt",
	"Type.UNSIGNED_SHORT": "xs:unsignedShort",
	"Type.UNSIGNED_BYTE": "xs:unsignedByte",
	"Type.NORMALIZED_STRING": "xs:normalizedString",
	"Type.TOKEN": "xs:token",
	"Type.LANGUAGE": "xs:language",
	"Type.NMTOKEN": "xs:NMTOKEN",
	"Type.NAME": "xs:Name",
	"Type.NCNAME": "xs:NCName",
	"Type.ID": "xs:ID",
	"Type.IDREF": "xs:IDREF",
	"Type.ENTITY": "xs:ENTITY",
};

const CARDINALITY_MAP: Record<string, string> = {
	"Cardinality.EXACTLY_ONE": "",
	"Cardinality.ZERO_OR_ONE": "?",
	"Cardinality.ONE_OR_MORE": "+",
	"Cardinality.ZERO_OR_MORE": "*",
	"Cardinality.EMPTY_SEQUENCE": "EMPTY",
	"Cardinality.EMPTY": "EMPTY",
	"Cardinality.MANY": "*",
};

// ── Module Definitions ────────────────────────────────────────────────────────

interface ModuleDef {
	outFile: string;
	namespace: string;
	prefix: string;
	/**
	 * Repo-relative paths to the module's *Module.java file.
	 * The generator fetches this, parses its FunctionDef[] to get class names,
	 * then fetches each class file from the same directory.
	 */
	moduleFiles: string[];
}

const CORE = (dir: string, file: string) =>
	`exist-core/src/main/java/org/exist/xquery/functions/${dir}/${file}`;
const EXT = (name: string, pkg: string, file: string) =>
	`extensions/modules/${name}/src/main/java/org/exist/xquery/modules/${pkg}/${file}`;
const IDX = (name: string, pkg: string, file: string) =>
	`extensions/indexes/${name}/src/main/java/org/exist/xquery/modules/${pkg}/${file}`;
/** Extension with a non-standard java package root */
const EXTX = (path: string) => path;

const MODULES: ModuleDef[] = [
	{
		outFile: "request.xq",
		namespace: "http://exist-db.org/xquery/request",
		prefix: "request",
		moduleFiles: [CORE("request", "RequestModule.java")],
	},
	{
		outFile: "response.xq",
		namespace: "http://exist-db.org/xquery/response",
		prefix: "response",
		moduleFiles: [CORE("response", "ResponseModule.java")],
	},
	{
		outFile: "session.xq",
		namespace: "http://exist-db.org/xquery/session",
		prefix: "session",
		moduleFiles: [CORE("session", "SessionModule.java")],
	},
	{
		outFile: "util.xq",
		namespace: "http://exist-db.org/xquery/util",
		prefix: "util",
		moduleFiles: [CORE("util", "UtilModule.java")],
	},
	{
		outFile: "xmldb.xq",
		namespace: "http://exist-db.org/xquery/xmldb",
		prefix: "xmldb",
		moduleFiles: [CORE("xmldb", "XMLDBModule.java")],
	},
	{
		outFile: "system.xq",
		namespace: "http://exist-db.org/xquery/system",
		prefix: "system",
		moduleFiles: [CORE("system", "SystemModule.java")],
	},
	{
		outFile: "transform.xq",
		namespace: "http://exist-db.org/xquery/transform",
		prefix: "transform",
		moduleFiles: [CORE("transform", "TransformModule.java")],
	},
	{
		outFile: "inspect.xq",
		namespace: "http://exist-db.org/xquery/inspection",
		prefix: "inspect",
		moduleFiles: [CORE("inspect", "InspectionModule.java")],
	},
	{
		outFile: "validation.xq",
		namespace: "http://exist-db.org/xquery/validation",
		prefix: "validation",
		moduleFiles: [CORE("validation", "ValidationModule.java")],
	},
	{
		outFile: "sm.xq",
		namespace: "http://exist-db.org/xquery/securitymanager",
		prefix: "sm",
		moduleFiles: [CORE("securitymanager", "SecurityManagerModule.java")],
	},
	{
		outFile: "kwic.xq",
		namespace: "http://exist-db.org/xquery/kwic",
		prefix: "kwic",
		moduleFiles: [], // not in eXist-db/exist repo (separate module)
	},
	{
		outFile: "xmldiff.xq",
		namespace: "http://exist-db.org/xquery/xmldiff",
		prefix: "xmldiff",
		moduleFiles: [EXT("xmldiff", "xmldiff", "XmlDiffModule.java")],
	},
	{
		outFile: "repo.xq",
		namespace: "http://exist-db.org/xquery/repo",
		prefix: "repo",
		moduleFiles: [EXT("expathrepo", "expathrepo", "ExpathPackageModule.java")],
	},
	{
		outFile: "file.xq",
		namespace: "http://exist-db.org/xquery/file",
		prefix: "file",
		moduleFiles: [EXT("file", "file", "FileModule.java")],
	},
	{
		outFile: "image.xq",
		namespace: "http://exist-db.org/xquery/image",
		prefix: "image",
		moduleFiles: [EXT("image", "image", "ImageModule.java")],
	},
	{
		outFile: "cache.xq",
		namespace: "http://exist-db.org/xquery/cache",
		prefix: "cache",
		moduleFiles: [EXT("cache", "cache", "CacheModule.java")],
	},
	{
		outFile: "scheduler.xq",
		namespace: "http://exist-db.org/xquery/scheduler",
		prefix: "scheduler",
		moduleFiles: [EXT("scheduler", "scheduler", "SchedulerModule.java")],
	},
	{
		outFile: "compression.xq",
		namespace: "http://exist-db.org/xquery/compression",
		prefix: "compression",
		moduleFiles: [EXT("compression", "compression", "CompressionModule.java")],
	},
	{
		outFile: "httpclient.xq",
		namespace: "http://exist-db.org/xquery/httpclient",
		prefix: "httpclient",
		moduleFiles: [], // not in eXist-db/exist repo (separate module)
	},
	{
		outFile: "mail.xq",
		namespace: "http://exist-db.org/xquery/mail",
		prefix: "mail",
		moduleFiles: [EXT("mail", "mail", "MailModule.java")],
	},
	{
		outFile: "counter.xq",
		namespace: "http://exist-db.org/xquery/counter",
		prefix: "counter",
		moduleFiles: [EXT("counter", "counter", "CounterModule.java")],
	},
	{
		outFile: "process.xq",
		namespace: "http://exist-db.org/xquery/process",
		prefix: "process",
		moduleFiles: [EXT("process", "process", "ProcessModule.java")],
	},
	{
		outFile: "contentextraction.xq",
		namespace: "http://exist-db.org/xquery/contentextraction",
		prefix: "contentextraction",
		moduleFiles: [
			EXTX("extensions/contentextraction/src/main/java/org/exist/contentextraction/xquery/ContentExtractionModule.java"),
		],
	},
	{
		outFile: "ft.xq",
		namespace: "http://exist-db.org/xquery/lucene",
		prefix: "ft",
		moduleFiles: [IDX("lucene", "lucene", "LuceneModule.java")],
	},
	{
		outFile: "ngram.xq",
		namespace: "http://exist-db.org/xquery/ngram",
		prefix: "ngram",
		moduleFiles: [IDX("ngram", "ngram", "NGramModule.java")],
	},
	{
		outFile: "range.xq",
		namespace: "http://exist-db.org/xquery/range",
		prefix: "range",
		moduleFiles: [IDX("range", "range", "RangeIndexModule.java")],
	},
	{
		outFile: "sort.xq",
		namespace: "http://exist-db.org/xquery/sort",
		prefix: "sort",
		moduleFiles: [IDX("sort", "sort", "SortModule.java")],
	},
	{
		outFile: "console.xq",
		namespace: "http://exist-db.org/xquery/console",
		prefix: "console",
		moduleFiles: [CORE("websocket", "ConsoleCompatModule.java")],
	},
	{
		outFile: "datetime.xq",
		namespace: "http://exist-db.org/xquery/datetime",
		prefix: "datetime",
		moduleFiles: [], // not in eXist-db/exist repo (separate module)
	},
];

// ── Fetch Utilities ───────────────────────────────────────────────────────────

async function fetchText(url: string): Promise<string | null> {
	try {
		const res = await fetch(url, {
			headers: { "User-Agent": "xq-lsp-generator" },
		});
		if (!res.ok) return null;
		return res.text();
	} catch {
		return null;
	}
}

/**
 * Parse the class names referenced in a FunctionDef[] from a module file.
 * Handles both:
 *   new FunctionDef(ClassName.signature, ClassName.class)   — classic pattern
 *   functionDefs(ClassName.class, ClassName.sig, ...)       — FunctionDSL pattern
 */
function parseFunctionDefClasses(moduleJava: string): string[] {
	const classes = new Set<string>();
	const re1 = /new\s+FunctionDef\s*\([^)]+,\s*(\w+)\.class\s*\)/g;
	let m: RegExpExecArray | null;
	while ((m = re1.exec(moduleJava)) !== null) classes.add(m[1]);
	// FunctionDSL: functionDefs(ClassName.class, ...) — class is the FIRST arg
	const re2 = /\bfunctionDefs\s*\(\s*(\w+)\.class\b/g;
	while ((m = re2.exec(moduleJava)) !== null) classes.add(m[1]);
	return [...classes];
}

/**
 * Given a module file's raw URL, derive the base directory URL to fetch
 * sibling class files from.
 */
function baseDir(moduleFileUrl: string): string {
	return moduleFileUrl.slice(0, moduleFileUrl.lastIndexOf("/"));
}

// ── Java Source Parser ────────────────────────────────────────────────────────

interface ParamDef {
	name: string;
	xqType: string;
	description: string;
}

interface SignatureDef {
	localName: string;
	description: string;
	params: ParamDef[] | null;
	returnXqType: string;
	returnDescription: string;
	deprecated?: string;
	variadic?: boolean;
}

/** Extract balanced parenthesized content starting right after the opening '(' */
function extractBalanced(src: string, start: number): string {
	let depth = 1;
	let i = start;
	let inString = false;
	let stringChar = "";
	while (i < src.length && depth > 0) {
		const ch = src[i];
		if (inString) {
			if (ch === "\\" && stringChar === '"') {
				i++;
			} else if (ch === stringChar) {
				inString = false;
			}
		} else {
			if (ch === '"' || ch === "'") {
				inString = true;
				stringChar = ch;
			} else if (ch === "(") {
				depth++;
			} else if (ch === ")") {
				depth--;
				if (depth === 0) break;
			}
		}
		i++;
	}
	return src.slice(start, i);
}

/** Concatenate Java string literals (handles "a" + "b" across lines) */
function extractJavaString(fragment: string): string {
	const parts: string[] = [];
	const re = /"((?:[^"\\]|\\.)*)"/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(fragment)) !== null) {
		parts.push(m[1].replace(/\\n/g, " ").replace(/\\t/g, " ").replace(/\\"/g, '"').trim());
	}
	return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** Split top-level comma-separated args (ignoring commas inside parens/strings) */
function splitArgs(src: string): string[] {
	const args: string[] = [];
	let depth = 0;
	let inStr = false;
	let start = 0;
	for (let i = 0; i < src.length; i++) {
		const ch = src[i];
		if (inStr) {
			if (ch === "\\") i++;
			else if (ch === '"') inStr = false;
		} else if (ch === '"') {
			inStr = true;
		} else if (ch === "(" || ch === "[" || ch === "{") {
			depth++;
		} else if (ch === ")" || ch === "]" || ch === "}") {
			depth--;
		} else if (ch === "," && depth === 0) {
			args.push(src.slice(start, i));
			start = i + 1;
		}
	}
	args.push(src.slice(start));
	return args;
}

function mapType(javaType: string): string {
	return TYPE_MAP[javaType.trim()] ?? "item()";
}

function mapOccurrence(javaCardinality: string): string {
	return CARDINALITY_MAP[javaCardinality.trim()] ?? "*";
}

function buildXqType(type: string, occurrence: string): string {
	if (occurrence === "EMPTY") return "empty-sequence()";
	if (type === "empty-sequence()") return "empty-sequence()";
	if (!type) return "item()*";
	return type + occurrence;
}

/** Parse a single FunctionParameterSequenceType or SequenceType arg */
function parseOneParam(fragment: string): ParamDef | null {
	// FunctionParameterSequenceType("name", Type.X, Cardinality.Y[, "desc"])
	const fpst = /(?:new\s+)?FunctionParameterSequenceType\s*\(([^)]*(?:\([^)]*\)[^)]*)*)\)/s.exec(fragment);
	if (fpst) {
		const args = splitArgs(fpst[1]);
		if (args.length >= 3) {
			const name = extractJavaString(args[0]) || "arg";
			const xqType = buildXqType(mapType(args[1].trim()), mapOccurrence(args[2].trim()));
			const description = args.length >= 4 ? extractJavaString(args[3]) : "";
			return { name, xqType, description };
		}
	}
	// SequenceType(Type.X, Cardinality.Y)
	const st = /(?:new\s+)?SequenceType\s*\(([^)]+)\)/s.exec(fragment);
	if (st) {
		const args = splitArgs(st[1]);
		if (args.length >= 2) {
			const xqType = buildXqType(mapType(args[0].trim()), mapOccurrence(args[1].trim()));
			return { name: "arg", xqType, description: "" };
		}
	}
	return null;
}

function parseParamList(arrayContent: string): ParamDef[] {
	const params: ParamDef[] = [];
	const re = /new\s+(?:FunctionParameter)?SequenceType\s*\(/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(arrayContent)) !== null) {
		const inner = extractBalanced(arrayContent, m.index + m[0].length);
		// m[0] ends with "(", inner is the content inside, reconstruct the full expr
		const p = parseOneParam(m[0] + inner + ")");
		if (p) params.push(p);
	}
	return params;
}

function parseReturnType(returnArg: string): { xqType: string; description: string } {
	// FunctionReturnSequenceType(Type.X, Cardinality.Y[, "desc"])
	const frst = /(?:new\s+)?FunctionReturnSequenceType\s*\(([^)]*(?:\([^)]*\)[^)]*)*)\)/s.exec(returnArg);
	if (frst) {
		const args = splitArgs(frst[1]);
		if (args.length >= 2) {
			const xqType = buildXqType(mapType(args[0].trim()), mapOccurrence(args[1].trim()));
			const description = args.length >= 3 ? extractJavaString(args[2]) : "";
			return { xqType, description };
		}
	}
	// SequenceType(Type.X, Cardinality.Y)
	const st = /(?:new\s+)?SequenceType\s*\(([^)]+)\)/s.exec(returnArg);
	if (st) {
		const args = splitArgs(st[1]);
		if (args.length >= 2) {
			const xqType = buildXqType(mapType(args[0].trim()), mapOccurrence(args[1].trim()));
			return { xqType, description: "" };
		}
	}
	return { xqType: "item()*", description: "" };
}

/** Build a map of String variable name → literal value (for DSL name vars) */
function buildStringVarMap(java: string): Map<string, string> {
	const map = new Map<string, string>();
	const re = /\bString\s+(\w+)\s*=\s*"([^"]+)"/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(java)) !== null) map.set(m[1], m[2]);
	return map;
}

/** Build a map of FunctionParameterSequenceType variable name → ParamDef */
function buildParamVarMap(java: string): Map<string, ParamDef> {
	const map = new Map<string, ParamDef>();
	const re = /\bFunctionParameterSequenceType\s+(\w+)\s*=\s*(optManyParam|manyParam|optParam|param|funParam|optFunParam|optManyFunParam)\s*\(/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(java)) !== null) {
		const varName = m[1];
		const helper = m[2];
		const inner = extractBalanced(java, m.index + m[0].length);
		const args = splitArgs(inner);
		const name = extractJavaString(args[0]) || "arg";
		const xqBase = mapType(args[1]?.trim() ?? "Type.ITEM");
		let xqType: string;
		if (helper === "param") xqType = buildXqType(xqBase, "");
		else if (helper === "optParam") xqType = buildXqType(xqBase, "?");
		else if (helper === "manyParam") xqType = buildXqType(xqBase, "+");
		else if (helper === "optManyParam") xqType = buildXqType(xqBase, "*");
		else xqType = "function(*)"; // funParam, optFunParam, optManyFunParam
		const description = args[2] ? extractJavaString(args[2]) : "";
		map.set(varName, { name, xqType, description });
	}
	return map;
}

/** Parse FunctionDSL returns*(type[, desc]) helper calls */
function parseDSLReturnType(src: string): { xqType: string; description: string } {
	if (/\breturnsNothing\s*\(\s*\)/.test(src)) return { xqType: "empty-sequence()", description: "" };
	const m = /\b(returnsOptMany|returnsMany|returnsOpt|returns)\s*\(/.exec(src);
	if (m) {
		const helper = m[1];
		const inner = extractBalanced(src, m.index + m[0].length);
		const args = splitArgs(inner);
		const xqBase = mapType(args[0]?.trim() ?? "Type.ITEM");
		let occ = helper === "returnsOptMany" ? "*" : helper === "returnsMany" ? "+" : helper === "returnsOpt" ? "?" : "";
		let descIdx = 1;
		if (args.length >= 2 && args[1].trim().startsWith("Cardinality.")) {
			occ = mapOccurrence(args[1].trim());
			descIdx = 2;
		}
		const xqType = buildXqType(xqBase, occ);
		const desc = args[descIdx] ? extractJavaString(args[descIdx]) : "";
		return { xqType, description: desc };
	}
	return { xqType: "item()*", description: "" };
}

/** Resolve a list of param args (variable refs or inline calls) to ParamDef[] */
function resolveDSLParams(paramArgs: string[], paramVarMap: Map<string, ParamDef>): ParamDef[] {
	const params: ParamDef[] = [];
	for (const pArg of paramArgs) {
		const pt = pArg.trim();
		if (!pt) continue;
		// Inline param call
		const inlineM = /\b(optManyParam|manyParam|optParam|param|funParam|optFunParam|optManyFunParam)\s*\(/.exec(pt);
		if (inlineM) {
			const inner = extractBalanced(pt, inlineM.index + inlineM[0].length);
			const args = splitArgs(inner);
			const name = extractJavaString(args[0]) || "arg";
			const xqBase = mapType(args[1]?.trim() ?? "Type.ITEM");
			const helper = inlineM[1];
			let xqType: string;
			if (helper === "param") xqType = buildXqType(xqBase, "");
			else if (helper === "optParam") xqType = buildXqType(xqBase, "?");
			else if (helper === "manyParam") xqType = buildXqType(xqBase, "+");
			else if (helper === "optManyParam") xqType = buildXqType(xqBase, "*");
			else xqType = "function(*)";
			const description = args[2] ? extractJavaString(args[2]) : "";
			params.push({ name, xqType, description });
			continue;
		}
		// Variable reference
		const varParam = paramVarMap.get(pt);
		if (varParam) { params.push(varParam); continue; }
		// Last-token fallback (e.g. qualified: SomeClass.PARAM_VAR)
		const last = pt.split(/[\s.[\]()]/).filter(Boolean).pop();
		if (last) {
			const byLast = paramVarMap.get(last);
			if (byLast) { params.push(byLast); continue; }
		}
	}
	return params;
}

/**
 * Extract signatures defined via FunctionDSL helpers:
 *   functionSignature(nameVar, "desc", returns*(type, "desc"), param1, ...)
 *   functionSignatures(nameVar, "desc", returns*, arities(arity(params...), ...))
 */
function extractFunctionDSLSignatures(java: string): SignatureDef[] {
	const results: SignatureDef[] = [];
	const stringVarMap = buildStringVarMap(java);
	const paramVarMap = buildParamVarMap(java);

	function resolveName(arg: string): string | undefined {
		const lit = extractJavaString(arg);
		if (lit) return lit;
		const tok = arg.trim();
		if (tok.startsWith("new ") || tok.startsWith("new\t")) return undefined; // constructor, not a name var
		return stringVarMap.get(tok) ?? stringVarMap.get(tok.split(/[\s.[\]()]/).filter(Boolean).pop() ?? "");
	}

	// functionSignature(name, desc, returns*, params...)
	const sigRe = /\bfunctionSignature\s*\(/g;
	let m: RegExpExecArray | null;
	while ((m = sigRe.exec(java)) !== null) {
		const content = extractBalanced(java, m.index + m[0].length);
		const args = splitArgs(content);
		if (args.length < 3) continue;
		const localName = resolveName(args[0]);
		if (!localName) continue;
		const description = extractJavaString(args[1]);
		const ret = parseDSLReturnType(args[2]);
		const params = resolveDSLParams(args.slice(3), paramVarMap);
		results.push({ localName, description, params, returnXqType: ret.xqType, returnDescription: ret.description });
	}

	// functionSignatures(name, desc, returns*, arities(arity(params...), ...))
	const sigsRe = /\bfunctionSignatures\s*\(/g;
	while ((m = sigsRe.exec(java)) !== null) {
		const content = extractBalanced(java, m.index + m[0].length);
		const args = splitArgs(content);
		if (args.length < 4) continue;
		const localName = resolveName(args[0]);
		if (!localName) continue;
		const description = extractJavaString(args[1]);
		const ret = parseDSLReturnType(args[2]);
		// Parse arities(arity(params...), ...)
		const aritiesContent = args[3];
		const arityRe = /\barity\s*\(/g;
		let am: RegExpExecArray | null;
		while ((am = arityRe.exec(aritiesContent)) !== null) {
			const arityContent = extractBalanced(aritiesContent, am.index + am[0].length);
			const arityArgs = splitArgs(arityContent);
			const params = arityArgs[0]?.trim() === "" ? [] : resolveDSLParams(arityArgs, paramVarMap);
			results.push({ localName, description, params, returnXqType: ret.xqType, returnDescription: ret.description });
		}
	}

	return results;
}

/** Build a map of QName variable name → local name from static QName declarations */
function buildQNameVarMap(java: string): Map<string, string> {
	const map = new Map<string, string>();
	const re = /\bQName\s+(\w+)\s*=\s*new\s+QName\s*\(\s*"([^"]+)"/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(java)) !== null) {
		map.set(m[1], m[2]);
	}
	return map;
}

/** Extract all FunctionSignature definitions from Java source. */
function extractSignatures(java: string): SignatureDef[] {
	const results: SignatureDef[] = [];
	const qnameVars = buildQNameVarMap(java);

	const markerRe = /new\s+FunctionSignature\s*\(/g;
	let m: RegExpExecArray | null;
	while ((m = markerRe.exec(java)) !== null) {
		const content = extractBalanced(java, m.index + m[0].length);
		const args = splitArgs(content);
		if (args.length < 2) continue;

		// arg[0]: new QName("local", ...) or a variable name
		let localName: string | undefined;
		const inline = /new\s+QName\s*\(\s*"([^"]+)"/.exec(args[0]);
		if (inline) {
			localName = inline[1];
		} else {
			// Variable reference — try the trimmed token
			const tok = args[0].trim();
			localName = qnameVars.get(tok);
			if (!localName) {
				// Sometimes it's wrapped, e.g. `new QName(qnCreateAccount, ...)` unlikely
				// Try extracting last word before any dot or whitespace
				const last = tok.split(/[\s.()]/).filter(Boolean).pop();
				if (last) localName = qnameVars.get(last);
			}
		}
		if (!localName) continue;

		const description = extractJavaString(args[1]);

		let params: ParamDef[] | null = null;
		const paramArg = args[2]?.trim() ?? "";
		if (paramArg !== "null" && paramArg !== "") {
			const arrayMatch = /\{([\s\S]*)\}/s.exec(paramArg);
			if (arrayMatch) params = parseParamList(arrayMatch[1]);
		}

		const ret = parseReturnType(args[3] ?? "");

		let deprecated: string | undefined;
		let variadic: boolean | undefined;
		if (args[4]) {
			const a4 = args[4].trim();
			if (a4 === "true") variadic = true;
			else if (a4.includes('"')) deprecated = extractJavaString(a4);
		}

		results.push({
			localName,
			description,
			params,
			returnXqType: ret.xqType,
			returnDescription: ret.description,
			deprecated,
			variadic,
		});
	}

	return results;
}

// ── XQuery File Generator ─────────────────────────────────────────────────────

function renderXqFile(mod: ModuleDef, signatures: SignatureDef[]): string {
	// Deduplicate by (localName, arity)
	const seen = new Set<string>();
	const deduped = signatures.filter((s) => {
		const arity = s.params === null ? 0 : s.params.length;
		const key = `${s.localName}/${arity}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});

	deduped.sort((a, b) => {
		const n = a.localName.localeCompare(b.localName);
		if (n !== 0) return n;
		const aa = a.params === null ? 0 : a.params.length;
		const ab = b.params === null ? 0 : b.params.length;
		return aa - ab;
	});

	const lines: string[] = [];
	lines.push(`module namespace ${mod.prefix} = "${mod.namespace}";`);
	lines.push("");

	for (const sig of deduped) {
		const arity = sig.params === null ? 0 : sig.params.length;
		const hasDoc =
			sig.description || sig.deprecated || sig.returnDescription ||
			(sig.params && sig.params.some((p) => p.description));

		if (hasDoc) {
			lines.push("(:~");
			if (sig.description) {
				for (const line of wrapText(sig.description, 76)) lines.push(` : ${line}`);
			}
			if (sig.deprecated) lines.push(` : @deprecated ${sig.deprecated}`);
			if (sig.params) {
				for (const p of sig.params) {
					if (p.description) lines.push(` : @param $${p.name} ${p.description}`);
				}
			}
			if (sig.returnDescription) lines.push(` : @return ${sig.returnDescription}`);
			lines.push(" :)");
		}

		const qname = `${mod.prefix}:${sig.localName}`;
		if (arity === 0) {
			lines.push(`declare function ${qname}() as ${sig.returnXqType} external;`);
		} else {
			const params = sig.params!;
			if (params.length <= 3) {
				const paramStr = params.map((p) => `$${p.name} as ${p.xqType}`).join(", ");
				lines.push(`declare function ${qname}(${paramStr}) as ${sig.returnXqType} external;`);
			} else {
				lines.push(`declare function ${qname}(`);
				params.forEach((p, i) => {
					lines.push(`\t$${p.name} as ${p.xqType}${i < params.length - 1 ? "," : ""}`);
				});
				lines.push(`) as ${sig.returnXqType} external;`);
			}
		}
		lines.push("");
	}

	return lines.join("\n");
}

function wrapText(text: string, maxWidth: number): string[] {
	if (text.length <= maxWidth) return [text];
	const words = text.split(/\s+/);
	const lines: string[] = [];
	let current = "";
	for (const word of words) {
		if (current.length + word.length + 1 > maxWidth && current) {
			lines.push(current);
			current = word;
		} else {
			current = current ? `${current} ${word}` : word;
		}
	}
	if (current) lines.push(current);
	return lines;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function processModule(mod: ModuleDef): Promise<void> {
	console.log(`\n→ ${mod.outFile} (${mod.namespace})`);
	const allSignatures: SignatureDef[] = [];

	for (const moduleFilePath of mod.moduleFiles) {
		const moduleUrl = `${GITHUB_RAW}/${moduleFilePath}`;
		const moduleJava = await fetchText(moduleUrl);
		if (!moduleJava) {
			console.log(`  ✗ module file not found: ${moduleFilePath}`);
			continue;
		}

		// Parse the module file itself first (may contain signatures)
		const modSigs = [...extractSignatures(moduleJava), ...extractFunctionDSLSignatures(moduleJava)];
		if (modSigs.length > 0) {
			console.log(`  + ${moduleFilePath.split("/").pop()}: ${modSigs.length} signature(s)`);
			allSignatures.push(...modSigs);
		}

		// Discover implementation class names from FunctionDef registrations
		const classNames = parseFunctionDefClasses(moduleJava);
		if (classNames.length === 0) {
			console.log(`  ⚠ no FunctionDef classes found in module file`);
			continue;
		}

		const dir = baseDir(moduleFilePath);
		console.log(`  found ${classNames.length} class(es) in module`);

		// Fetch each implementation class file
		for (const className of classNames) {
			const classUrl = `${GITHUB_RAW}/${dir}/${className}.java`;
			const classJava = await fetchText(classUrl);
			if (!classJava) {
				// Class might be in a subpackage — skip silently
				continue;
			}
			const sigs = extractSignatures(classJava);
			const dslSigs = extractFunctionDSLSignatures(classJava);
			const combined = [...sigs, ...dslSigs];
			if (combined.length > 0) {
				console.log(`    + ${className}.java: ${combined.length} signature(s)`);
				allSignatures.push(...combined);
			}
		}
	}

	if (allSignatures.length === 0) {
		console.log(`  ⚠ no signatures found — keeping existing file`);
		return;
	}

	const content = renderXqFile(mod, allSignatures);
	const outPath = path.join(OUT_DIR, mod.outFile);
	fs.writeFileSync(outPath, content, "utf-8");
	const fnCount = content.split("declare function").length - 1;
	console.log(`  ✓ wrote ${mod.outFile} (${allSignatures.length} raw → ${fnCount} functions)`);
}

async function main() {
	console.log("Generating eXist-db function library from Java source...");
	console.log(`Output: ${OUT_DIR}`);

	for (const mod of MODULES) {
		await processModule(mod);
		// Small delay to be polite to GitHub
		await new Promise((r) => setTimeout(r, 150));
	}

	console.log("\nDone.");
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
