import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { analyzeWithAst } from "./analyzer.ts";
import { getSelectionRange } from "./selection-range.ts";
import { makeDoc } from "./test-utils.ts";

function ranges(src: string, offset: number) {
	const doc = makeDoc(src);
	const { analysis } = analyzeWithAst(src, "file:///test.xq");
	const chain: { start: number; end: number }[] = [];
	let range = getSelectionRange(doc, offset, analysis);
	while (range) {
		chain.push({ start: doc.offsetAt(range.range.start), end: doc.offsetAt(range.range.end) });
		range = range.parent;
	}
	return chain;
}

describe("getSelectionRange", () => {
	test("nested expression: chain grows outward from the innermost literal", () => {
		const src = `declare function local:f($x as xs:integer) as xs:integer { $x + (1 + 2) }; local:f(1)`;
		const offset = src.indexOf("1 + 2") + 1; // inside the "1" literal
		const chain = ranges(src, offset);

		assert.ok(chain.length > 0, "expected at least one selection range");

		// Innermost: the "1" literal.
		assert.deepEqual(chain[0], { start: 65, end: 66 });
		// Grows to the inner "1 + 2" additive expression.
		assert.ok(chain.some((r) => src.slice(r.start, r.end) === "1 + 2"));
		// Grows to the parenthesized "(1 + 2)".
		assert.ok(chain.some((r) => src.slice(r.start, r.end) === "(1 + 2)"));
		// Grows to the full "$x + (1 + 2)" expression.
		assert.ok(chain.some((r) => src.slice(r.start, r.end) === "$x + (1 + 2)"));

		// Each range in the chain must strictly contain (or equal) the previous one — no shrinking.
		for (let i = 1; i < chain.length; i++) {
			assert.ok(chain[i].start <= chain[i - 1].start && chain[i].end >= chain[i - 1].end);
		}

		// No two consecutive entries share an identical span (would make expand-selection feel "stuck").
		for (let i = 1; i < chain.length; i++) {
			assert.ok(chain[i].start !== chain[i - 1].start || chain[i].end !== chain[i - 1].end);
		}

		// Outermost range spans the whole document.
		assert.deepEqual(chain.at(-1), { start: 0, end: src.length });
	});

	test("regex-fallback path (invalid/mid-edit source): returns null", () => {
		const src = `
declare function local:double($x as xs:integer) as xs:integer {
  $x * 2
};

let $result := local:double(
`; // intentionally truncated — invalid XQuery, forces the regex fallback
		const { analysis } = analyzeWithAst(src, "file:///incomplete.xq");
		assert.equal(analysis.usedAstPath, false, "expected regex-fallback path for truncated source");

		const doc = makeDoc(src);
		const offset = src.indexOf("$x * 2") + 1;
		assert.equal(getSelectionRange(doc, offset, analysis), null);
	});

	test("offset outside every node: returns null", () => {
		const src = `1 + 2`;
		const doc = makeDoc(src);
		const { analysis } = analyzeWithAst(src, "file:///test.xq");
		assert.equal(getSelectionRange(doc, src.length + 10, analysis), null);
	});
});
