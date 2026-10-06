import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeWithAst } from "./analyzer.ts";
import { runDiagnostics } from "./diagnostics.ts";
import { getBuiltins } from "./builtins.ts";
import { siblingModuleAnalysis } from "./module-siblings.ts";
import type { FileAnalysis } from "./types.ts";

const NS = "http://www.example.com/ex";
const URI_A = "file:///ws/a/src/module.xqm";
const URI_B = "file:///ws/b/src/module.xqm";

const SRC_A = `module namespace ex = '${NS}';
declare %public function ex:id ($id as xs:anyAtomicType) as element()* external;`;
const SRC_B = `module namespace ex = '${NS}';
declare function ex:foo ($id as xs:string) as element()* {
  ex:id($id)
};`;

// Mirrors getGlobAnalyses' merge of same-namespace files.
function mergedIndex(): FileAnalysis {
	const a = analyzeWithAst(SRC_A, URI_A).analysis;
	const b = analyzeWithAst(SRC_B, URI_B).analysis;
	return {
		...a,
		functions: [...a.functions, ...b.functions],
		moduleVariables: [...a.moduleVariables, ...b.moduleVariables],
	};
}

function diagnose(src: string, uri: string, imported: Map<string, FileAnalysis>) {
	const { analysis, ast } = analyzeWithAst(src, uri);
	assert.ok(ast);
	return runDiagnostics(ast, src, analysis, new Map([["builtin:fn", getBuiltins()], ...imported]));
}

test("call to a function declared in a sibling module file with the same namespace is not flagged", () => {
	const siblings = siblingModuleAnalysis(mergedIndex(), URI_B);
	assert.ok(siblings);
	const diags = diagnose(SRC_B, URI_B, new Map([[NS, siblings]]));
	assert.deepEqual(diags, []);
});

test("without the sibling module the call is flagged (sanity check)", () => {
	const diags = diagnose(SRC_B, URI_B, new Map());
	assert.ok(
		diags.some((d) => d.message.includes("ex:id")),
		JSON.stringify(diags),
	);
});

test("the current file's own declarations are left out, so they aren't reported as duplicates", () => {
	const siblings = siblingModuleAnalysis(mergedIndex(), URI_B);
	assert.ok(siblings);
	assert.deepEqual(
		siblings.functions.map((f) => f.qname.localName),
		["id"],
	);
	assert.deepEqual(diagnose(SRC_B, URI_B, new Map([[NS, siblings]])), []);
});

test("returns null when the namespace has no other contributing files", () => {
	const b = analyzeWithAst(SRC_B, URI_B).analysis;
	assert.equal(siblingModuleAnalysis(b, URI_B), null);
});

// The same function declared in two files of one namespace is a real XQST0034 even when the files
// are alternatives (e.g. jinks profiles): the sibling relationship is not second-guessed.
const SRC_ALT_A = `module namespace ex = '${NS}';
declare function ex:meta($x as xs:string, $y as xs:string) as xs:string { $x };
declare function ex:other($a as xs:string) as xs:string { $a };`;
const SRC_ALT_B = `module namespace ex = '${NS}';
declare function ex:meta($a as xs:string, $b as xs:string) as xs:string { $a };
declare function ex:other($a as xs:string, $b as xs:string) as xs:string { $a };
declare function ex:caller() as xs:string { ex:meta("x", "y") || ex:other("x", "y") };`;

function altSiblings(): FileAnalysis {
	const a = analyzeWithAst(SRC_ALT_A, URI_A).analysis;
	const b = analyzeWithAst(SRC_ALT_B, URI_B).analysis;
	const merged = { ...a, functions: [...a.functions, ...b.functions], moduleVariables: [] };
	const siblings = siblingModuleAnalysis(merged, URI_B);
	assert.ok(siblings);
	return siblings;
}

test("a function also declared in a sibling file is reported as XQST0034", () => {
	const diags = diagnose(SRC_ALT_B, URI_B, new Map([[NS, altSiblings()]]));
	assert.equal(diags.filter((d) => d.code === "XQST0034").length, 1, JSON.stringify(diags));
});

test("a call to a function whose arity differs between siblings raises no XPST0017", () => {
	const diags = diagnose(SRC_ALT_B, URI_B, new Map([[NS, altSiblings()]]));
	assert.deepEqual(diags.filter((d) => d.code === "XPST0017"), []);
});

