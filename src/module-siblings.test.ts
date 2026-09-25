import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeWithAst } from "./analyzer.ts";
import { runDiagnostics } from "./diagnostics.ts";
import { getBuiltins } from "./builtins.ts";
import { siblingModuleAnalysis } from "./module-siblings.ts";
import type { FileAnalysis } from "./types.ts";

const NS = "http://www.ctrlprint.com/cxp";
const URI_A = "file:///ws/a/src/module.xqm";
const URI_B = "file:///ws/b/src/module.xqm";

const SRC_A = `module namespace cxp = '${NS}';
declare %public function cxp:id ($id as xs:anyAtomicType) as element()* external;`;
const SRC_B = `module namespace cxp = '${NS}';
declare function cxp:foo ($id as xs:string) as element()* {
  cxp:id($id)
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
		diags.some((d) => d.message.includes("cxp:id")),
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
