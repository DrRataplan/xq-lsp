import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "./analyzer.ts";
import { getHover, getSignatureHelp, getDocumentSymbols } from "./features.ts";
import { getBuiltins } from "./builtins.ts";
import { makeDoc } from "./test-utils.ts";

// ── hover ─────────────────────────────────────────────────────────────────────

describe("hover", () => {
	const SRC = `declare function local:double($x as xs:integer) as xs:integer { $x * 2 };
local:double(5)`;
	const analysis = analyze(SRC, "file:///test.xq");

	function hoverValue(doc: ReturnType<typeof makeDoc>, offset: number, imports = new Map()) {
		const hover = getHover(doc, offset, analysis, imports);
		if (!hover) return null;
		return typeof hover.contents === "object" && "value" in hover.contents ? hover.contents.value : "";
	}

	test("function name returns signature with params", () => {
		const doc = makeDoc(SRC);
		const value = hoverValue(doc, SRC.indexOf("local:double(5)") + 1);
		assert.ok(value, "expected hover result");
		assert.ok(value!.includes("local:double"), `signature missing, got: ${value}`);
		assert.ok(value!.includes("$x"), `param missing, got: ${value}`);
	});

	test("unknown word returns null", () => {
		assert.equal(hoverValue(makeDoc(SRC), 0), null);
	});

	test("picks correct overload by arity", () => {
		const src = `subsequence((1,2,3),2,3)`;
		const builtins = getBuiltins();
		const hover = getHover(
			makeDoc(src),
			src.indexOf("subsequence") + 1,
			analyze(src, "file:///test.xq"),
			new Map([["builtin:fn", builtins]]),
		);
		const value = typeof hover?.contents === "object" && "value" in hover.contents ? hover.contents.value : "";
		assert.ok(value.includes("$length"), `expected 3-arity overload with $length, got: ${value}`);
	});

	test("unprefixed builtin resolves via default function namespace", () => {
		const src = `fn:true()`;
		const builtins = getBuiltins();
		const hover = getHover(
			makeDoc(src),
			src.indexOf("true"),
			analyze(src, "file:///test.xq"),
			new Map([["builtin:fn", builtins]]),
		);
		assert.ok(hover, "expected hover");
		const value = typeof hover.contents === "object" && "value" in hover.contents ? hover.contents.value : "";
		assert.ok(value.includes("fn:true"), `expected fn:true in hover, got: ${value}`);
	});

	test("element name matching a builtin function is not treated as a call", () => {
		const src = `<error/>`;
		const builtins = getBuiltins();
		const hover = getHover(
			makeDoc(src),
			src.indexOf("error"),
			analyze(src, "file:///test.xq"),
			new Map([["builtin:fn", builtins]]),
		);
		assert.equal(hover, null, "hovering an element name should not resolve fn:error");
	});

	test("attribute name matching a builtin function is not treated as a call", () => {
		const src = `<x error="1"/>`;
		const builtins = getBuiltins();
		const hover = getHover(
			makeDoc(src),
			src.indexOf("error"),
			analyze(src, "file:///test.xq"),
			new Map([["builtin:fn", builtins]]),
		);
		assert.equal(hover, null, "hovering an attribute name should not resolve fn:error");
	});

	test("string literal contents matching a builtin function is not treated as a call", () => {
		const src = `foo("error")`;
		const builtins = getBuiltins();
		const hover = getHover(
			makeDoc(src),
			src.indexOf("error"),
			analyze(src, "file:///test.xq"),
			new Map([["builtin:fn", builtins]]),
		);
		assert.equal(hover, null, "hovering string contents should not resolve fn:error");
	});

	test("named function ref still resolves", () => {
		const src = `error#1`;
		const builtins = getBuiltins();
		const hover = getHover(
			makeDoc(src),
			src.indexOf("error"),
			analyze(src, "file:///test.xq"),
			new Map([["builtin:fn", builtins]]),
		);
		assert.ok(hover, "expected hover for named function ref");
	});

	test("arrow call still resolves", () => {
		const src = `$x => error()`;
		const builtins = getBuiltins();
		const hover = getHover(
			makeDoc(src),
			src.indexOf("error"),
			analyze(src, "file:///test.xq"),
			new Map([["builtin:fn", builtins]]),
		);
		assert.ok(hover, "expected hover for arrow-called function");
	});
});

// ── signature help ────────────────────────────────────────────────────────────

describe("signatureHelp", () => {
	const SRC = `declare function local:add($a, $b) { $a + $b };
local:add(1, `;
	const analysis = analyze(SRC, "file:///test.xq");

	test("inside first argument", () => {
		const help = getSignatureHelp(makeDoc(SRC), SRC.indexOf("local:add(1,") + "local:add(".length, analysis, new Map());
		assert.ok(help, "expected signature help");
		assert.equal(help.signatures.length, 1);
		assert.ok(help.signatures[0].label.includes("local:add"));
		assert.equal(help.activeParameter, 0);
	});

	test("tracks active parameter after comma", () => {
		const help = getSignatureHelp(makeDoc(SRC), SRC.length, analysis, new Map());
		assert.ok(help, "expected signature help");
		assert.equal(help.activeParameter, 1);
	});

	test("returns null outside any call", () => {
		assert.equal(getSignatureHelp(makeDoc(SRC), 0, analysis, new Map()), null);
	});
});

// ── document symbols ──────────────────────────────────────────────────────────

describe("documentSymbols", () => {
	const SRC = `declare variable $local:count := 0;
declare function local:add($a, $b) { $a + $b };
declare function local:noop() { () };`;
	const analysis = analyze(SRC, "file:///test.xq");

	test("returns all declared functions", () => {
		const names = getDocumentSymbols(makeDoc(SRC), analysis).map((s) => s.name);
		assert.ok(names.includes("local:add"), `missing local:add, got ${names}`);
		assert.ok(names.includes("local:noop"), `missing local:noop, got ${names}`);
	});

	test("returns declared variables", () => {
		const names = getDocumentSymbols(makeDoc(SRC), analysis).map((s) => s.name);
		assert.ok(names.includes("$local:count"), `missing $local:count, got ${names}`);
	});

	test("function symbol includes arity in detail", () => {
		const add = getDocumentSymbols(makeDoc(SRC), analysis).find((s) => s.name === "local:add");
		assert.ok(add?.detail?.includes("2"), `expected arity 2, got ${add?.detail}`);
	});
});
