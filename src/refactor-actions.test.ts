import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { analyzeWithAst } from "./analyzer.ts";
import { buildOrganizeImportsEdit, buildExtractVariableEdit, buildExtractFunctionEdit } from "./refactor-actions.ts";
import type { OffsetEdit } from "./refactor-actions.ts";

function applyEdits(src: string, edits: OffsetEdit[]): string {
	let out = src;
	for (const e of [...edits].sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.newText + out.slice(e.end);
	return out;
}

function organizeImports(src: string): OffsetEdit | null {
	const { analysis, ast } = analyzeWithAst(src, "file:///main.xq");
	if (!ast) return null;
	return buildOrganizeImportsEdit(ast, analysis, src);
}

describe("refactor-actions: organize imports", () => {
	test("sorts imports by prefix and removes an unused one", () => {
		const src = `import module namespace z = "urn:z" at "./z.xq";
import module namespace a = "urn:a" at "./a.xq";
import module namespace unused = "urn:unused";
a:foo(), z:bar()
`;
		const edit = organizeImports(src);
		assert.ok(edit, "expected an edit");
		const out = applyEdits(src, [edit!]);
		assert.equal(
			out,
			`import module namespace a = "urn:a" at "./a.xq";
import module namespace z = "urn:z" at "./z.xq";
a:foo(), z:bar()
`,
		);
	});

	test("already sorted with no unused imports returns null (nothing to do)", () => {
		const src = `import module namespace a = "urn:a";
import module namespace b = "urn:b";
a:foo(), b:bar()
`;
		assert.equal(organizeImports(src), null);
	});

	test("no imports at all returns null", () => {
		assert.equal(organizeImports(`1 + 1`), null);
	});
});

describe("refactor-actions: extract to variable", () => {
	test("inserts let binding right before the FLWOR clause using the selection", () => {
		const src = `for $x in (1, 2, 3)
return $x + 1
`;
		const { analysis, ast } = analyzeWithAst(src, "file:///main.xq");
		assert.ok(ast);
		const start = src.indexOf("$x + 1");
		const end = start + "$x + 1".length;
		const result = buildExtractVariableEdit(ast!, analysis, src, start, end);
		assert.ok(result);
		assert.equal(result!.variableName, "value");
		const out = applyEdits(src, result!.edits);
		assert.equal(
			out,
			`for $x in (1, 2, 3)
let $value := $x + 1 return $value
`,
		);
	});

	test("picks a non-colliding default name when '$value' is already bound", () => {
		const src = `let $value := 1
return $value + 2
`;
		const { analysis, ast } = analyzeWithAst(src, "file:///main.xq");
		assert.ok(ast);
		const start = src.indexOf("$value + 2");
		const end = start + "$value + 2".length;
		const result = buildExtractVariableEdit(ast!, analysis, src, start, end);
		assert.ok(result);
		assert.equal(result!.variableName, "value2");
	});

	test("wraps the enclosing function body in a synthetic let/return when there's no FLWOR", () => {
		const src = `declare function local:foo($a, $b) { $a + $b };
1
`;
		const { analysis, ast } = analyzeWithAst(src, "file:///main.xq");
		assert.ok(ast);
		const start = src.indexOf("$a + $b");
		const end = start + "$a + $b".length;
		const result = buildExtractVariableEdit(ast!, analysis, src, start, end);
		assert.ok(result);
		const out = applyEdits(src, result!.edits);
		assert.equal(
			out,
			`declare function local:foo($a, $b) { let $value := $a + $b return ($value) };
1
`,
		);
	});

	test("misaligned selection (not a whole expression node) yields no edit", () => {
		const src = `$a + 1`;
		const { analysis, ast } = analyzeWithAst(src, "file:///main.xq");
		assert.ok(ast);
		// Selects "$a " — a partial token boundary, not a valid expression span.
		const result = buildExtractVariableEdit(ast!, analysis, src, 0, 3);
		assert.equal(result, null);
	});

	test("empty selection yields no edit", () => {
		const src = `$a + 1`;
		const { analysis, ast } = analyzeWithAst(src, "file:///main.xq");
		assert.ok(ast);
		const result = buildExtractVariableEdit(ast!, analysis, src, 2, 2);
		assert.equal(result, null);
	});
});

describe("refactor-actions: extract to function", () => {
	test("infers parameters from free variables and inserts a new declaration", () => {
		const src = `declare function local:foo($a, $b) { $a + $b };
1
`;
		const { analysis, ast } = analyzeWithAst(src, "file:///main.xq");
		assert.ok(ast);
		const start = src.indexOf("$a + $b");
		const end = start + "$a + $b".length;
		const result = buildExtractFunctionEdit(ast!, analysis, src, start, end);
		assert.ok(result);
		assert.equal(result!.functionName, "extracted");
		const out = applyEdits(src, result!.edits);
		assert.equal(
			out,
			`declare function local:foo($a, $b) { local:extracted($a, $b) };
declare function local:extracted($a, $b) {
	$a + $b
};

1
`,
		);
	});

	test("a variable bound outside the selection becomes a parameter", () => {
		const src = `for $x in (1, 2, 3)
return $x + 1
`;
		const { analysis, ast } = analyzeWithAst(src, "file:///main.xq");
		assert.ok(ast);
		const start = src.indexOf("$x + 1");
		const end = start + "$x + 1".length;
		const result = buildExtractFunctionEdit(ast!, analysis, src, start, end);
		assert.ok(result);
		// $x is bound by the enclosing "for", not inside the selection itself,
		// so it's free relative to the selection and becomes a parameter.
		const callEdit = result!.edits.find((e) => e.start === start);
		assert.equal(callEdit?.newText, "local:extracted($x)");
	});

	test("a variable bound inside the selection is not treated as free", () => {
		const src = `for $x in (1, 2, 3)
return let $y := $x + 1 return $y * 2
`;
		const { analysis, ast } = analyzeWithAst(src, "file:///main.xq");
		assert.ok(ast);
		const start = src.indexOf("let $y := $x + 1 return $y * 2");
		const end = start + "let $y := $x + 1 return $y * 2".length;
		const result = buildExtractFunctionEdit(ast!, analysis, src, start, end);
		assert.ok(result);
		// $y is bound by the "let" inside the selection, so it's not free — only $x is.
		const callEdit = result!.edits.find((e) => e.start === start);
		assert.equal(callEdit?.newText, "local:extracted($x)");
	});

	test("picks a non-colliding default function name", () => {
		const src = `declare function local:extracted() { 1 };
$a + 1
`;
		const { analysis, ast } = analyzeWithAst(src, "file:///main.xq");
		assert.ok(ast);
		const start = src.indexOf("$a + 1");
		const end = start + "$a + 1".length;
		const result = buildExtractFunctionEdit(ast!, analysis, src, start, end);
		assert.ok(result);
		assert.equal(result!.functionName, "extracted2");
	});
});
