import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { analyzeWithAst } from "./analyzer.ts";
import { checkRedundantXmlns, redundantXmlnsRemovalRange } from "./redundant-xmlns-diagnostics.ts";

function diags(src: string) {
	const { ast } = analyzeWithAst(src, "file:///main.xq");
	return ast ? checkRedundantXmlns(ast) : [];
}

const XHTML = "http://www.w3.org/1999/xhtml";

describe("redundant-xmlns", () => {
	test("xmlns matching the prolog default element namespace", () => {
		const src = `declare default element namespace "${XHTML}";\n<html xmlns="${XHTML}"><body/></html>`;
		const ds = diags(src);
		assert.equal(ds.length, 1);
		assert.equal(ds[0].code, "xq-lsp:redundant-xmlns");
		assert.equal(src.slice(ds[0].offset, ds[0].offset + ds[0].length), `xmlns="${XHTML}"`);
	});

	test("xmlns repeated on a nested element", () => {
		const ds = diags(`<a xmlns="urn:x"><b xmlns="urn:x"/></a>`);
		assert.equal(ds.length, 1);
	});

	test("xmlns:p repeated on a nested element", () => {
		assert.equal(diags(`<a xmlns:p="urn:x"><p:b xmlns:p="urn:x"/></a>`).length, 1);
	});

	test("empty xmlns when no default namespace is in scope", () => {
		assert.equal(diags(`<a xmlns=""/>`).length, 1);
	});

	test("not flagged: first declaration without prolog default", () => {
		assert.equal(diags(`<a xmlns="urn:x"/>`).length, 0);
	});

	test("not flagged: different URI", () => {
		assert.equal(diags(`declare default element namespace "urn:a"; <a xmlns="urn:b"/>`).length, 0);
	});

	test("not flagged: nested element changes the namespace back", () => {
		assert.equal(diags(`<a xmlns="urn:x"><b xmlns="urn:y"><c xmlns="urn:x"/></b></a>`).length, 0);
	});

	test("not flagged: sibling scopes do not leak", () => {
		assert.equal(diags(`<r><a xmlns="urn:x"/><b xmlns="urn:x"/></r>`).length, 0);
	});

	test("not flagged: prefix declaration matching only the prolog default", () => {
		assert.equal(diags(`declare default element namespace "urn:x"; <a xmlns:p="urn:x"/>`).length, 0);
	});
});

describe("redundant-xmlns quick fix range", () => {
	test("removal range includes the leading whitespace", () => {
		const src = `declare default element namespace "urn:x";\n<a  xmlns="urn:x" id="1"/>`;
		const [d] = diags(src);
		const { start, end } = redundantXmlnsRemovalRange(src, d);
		assert.equal(src.slice(0, start) + src.slice(end), `declare default element namespace "urn:x";\n<a id="1"/>`);
	});
});
