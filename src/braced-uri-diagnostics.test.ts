import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { analyzeWithAst } from "./analyzer.ts";
import { checkBracedUriWhitespace } from "./braced-uri-diagnostics.ts";

function bracedUriDiags(src: string) {
	const { ast } = analyzeWithAst(src, "file:///main.xq");
	if (!ast) return [];
	return checkBracedUriWhitespace(ast);
}

describe("braced-uri-diagnostics: flagged", () => {
	test("leading/trailing whitespace inside Q{...}", () => {
		const ds = bracedUriDiags(`for $Q{ urn:foo }x in 1 to 5 return $x`);
		assert.equal(ds.length, 1, `expected one diagnostic, got ${JSON.stringify(ds)}`);
		assert.equal(ds[0].code, "xq-lsp:braced-uri-whitespace");
	});

	test("internal run of whitespace inside Q{...}", () => {
		const ds = bracedUriDiags(`for $Q{urn:foo   bar}x in 1 to 5 return $x`);
		assert.equal(ds.length, 1, `expected one diagnostic, got ${JSON.stringify(ds)}`);
	});

	test("single interior space inside Q{...} is still flagged", () => {
		// Not normalized away by trim/collapse, but still a raw whitespace char in the URI.
		const ds = bracedUriDiags(`for $Q{urn:foo bar}x in 1 to 5 return $x`);
		assert.equal(ds.length, 1, `expected one diagnostic, got ${JSON.stringify(ds)}`);
	});

	test("offset/length span only the URI content, not the Q{ } wrapper or local name", () => {
		const src = `for $Q{urn:foo bar}x in 1 to 5 return $x`;
		const ds = bracedUriDiags(src);
		assert.equal(ds.length, 1);
		const { offset, length } = ds[0];
		assert.equal(src.slice(offset, offset + length), "urn:foo bar");
	});

	test("multiple URIQualifiedName occurrences are each flagged", () => {
		const ds = bracedUriDiags(`for $Q{ urn:foo }x in 1 to 5 return $Q{ urn:foo }x`);
		assert.equal(ds.length, 2, `expected two diagnostics, got ${JSON.stringify(ds)}`);
	});
});

describe("braced-uri-diagnostics: not flagged", () => {
	test("no whitespace inside Q{...}", () => {
		const ds = bracedUriDiags(`for $Q{urn:foo}x in 1 to 5 return $x`);
		assert.equal(ds.length, 0, `no diagnostics expected, got ${JSON.stringify(ds)}`);
	});

	test("plain prefixed EQName is untouched", () => {
		const ds = bracedUriDiags(`declare namespace foo = "urn:foo"; for $foo:x in 1 to 5 return $foo:x`);
		assert.equal(ds.length, 0, `no diagnostics expected, got ${JSON.stringify(ds)}`);
	});

	test("percent-escaped space is not raw whitespace", () => {
		const ds = bracedUriDiags(`for $Q{urn:foo%20bar}x in 1 to 5 return $x`);
		assert.equal(ds.length, 0, `no diagnostics expected, got ${JSON.stringify(ds)}`);
	});
});
