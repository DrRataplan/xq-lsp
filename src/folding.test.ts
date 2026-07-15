import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "./analyzer.ts";
import { getFoldingRanges } from "./folding.ts";
import { makeDoc } from "./test-utils.ts";

function folds(src: string) {
	const doc = makeDoc(src);
	const analysis = analyze(src, "file:///test.xq");
	return getFoldingRanges(analysis.ast ?? null, analysis, doc);
}

describe("folding ranges", () => {
	test("function declaration body folds", () => {
		const src = `declare function local:foo($a as xs:integer) as xs:integer {\n  $a + 1\n};\nlocal:foo(1)`;
		const ranges = folds(src);
		assert.ok(
			ranges.some((r) => r.startLine === 0 && r.endLine === 2),
			`expected a range spanning the function body, got: ${JSON.stringify(ranges)}`,
		);
	});

	test("FLWOR expression folds", () => {
		const src = `let $x := 1\nfor $y in (1, 2, 3)\nreturn $x + $y`;
		const ranges = folds(src);
		assert.ok(
			ranges.some((r) => r.startLine === 0 && r.endLine === 2),
			`expected a range spanning the FLWOR expression, got: ${JSON.stringify(ranges)}`,
		);
	});

	test("direct element constructor folds", () => {
		const src = `let $e := <root>\n  <child/>\n</root>\nreturn $e`;
		const ranges = folds(src);
		assert.ok(
			ranges.some((r) => r.startLine === 0 && r.endLine === 2),
			`expected a range spanning <root>...</root>, got: ${JSON.stringify(ranges)}`,
		);
		// The self-closing <child/> is single-line and shouldn't produce a range.
		assert.ok(!ranges.some((r) => r.startLine === 1 && r.endLine === 1));
	});

	test("multi-line comment folds with comment kind", () => {
		const src = `(: a comment\n   spanning lines :)\ndeclare variable $x := 1;\n$x`;
		const ranges = folds(src);
		const range = ranges.find((r) => r.kind === "comment");
		assert.ok(range, `expected a comment range, got: ${JSON.stringify(ranges)}`);
		assert.equal(range!.startLine, 0);
		assert.equal(range!.endLine, 1);
	});

	test("single-line constructs produce no ranges", () => {
		const src = `declare function local:foo() as xs:integer { 1 }; local:foo()`;
		assert.deepEqual(folds(src), []);
	});

	test("no-AST fallback returns []", () => {
		const src = `declare function local:foo(`; // syntactically invalid, forces regex fallback
		const doc = makeDoc(src);
		const analysis = analyze(src, "file:///test.xq");
		assert.equal(analysis.usedAstPath, false);
		assert.deepEqual(getFoldingRanges(analysis.ast ?? null, analysis, doc), []);
	});
});
