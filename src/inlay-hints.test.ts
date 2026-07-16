import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { InlayHintKind } from "vscode-languageserver/node.js";
import { analyzeWithAst } from "./analyzer.ts";
import { getInlayHints } from "./inlay-hints.ts";
import { makeDoc } from "./test-utils.ts";
import type { FileAnalysis } from "./types.ts";

function hintsFor(src: string, imported: Map<string, FileAnalysis> = new Map()) {
	const doc = makeDoc(src);
	const { analysis, ast } = analyzeWithAst(src, doc.uri);
	if (!ast) throw new Error("expected AST parse to succeed");
	const range = { start: doc.positionAt(0), end: doc.positionAt(src.length) };
	return getInlayHints(doc, ast, analysis, imported, range);
}

describe("inlay-hints: parameter name hints", () => {
	test("call to a declared function shows a hint per positional argument", () => {
		const src = `declare function local:add($a, $b) { $a + $b }; local:add(1, 2)`;
		const hints = hintsFor(src);
		const paramHints = hints.filter((h) => h.kind === InlayHintKind.Parameter);
		assert.equal(paramHints.length, 2);
		assert.equal(paramHints[0].label, "a:");
		assert.equal(paramHints[1].label, "b:");

		// Hints are positioned just before their argument.
		const callStart = src.indexOf("local:add(1, 2)");
		const firstArgOffset = src.indexOf("1", callStart);
		const secondArgOffset = src.indexOf("2", callStart);
		assert.deepEqual(paramHints[0].position, makeDoc(src).positionAt(firstArgOffset));
		assert.deepEqual(paramHints[1].position, makeDoc(src).positionAt(secondArgOffset));
	});

	test("call with wrong arity is not annotated (no matching overload)", () => {
		const src = `declare function local:add($a, $b) { $a + $b }; local:add(1, 2, 3)`;
		const hints = hintsFor(src);
		assert.equal(hints.filter((h) => h.kind === InlayHintKind.Parameter).length, 0);
	});
});

describe("inlay-hints: inferred type hints", () => {
	test("untyped let binding gets an inferred-type hint", () => {
		const src = `let $x := 1 return $x`;
		const hints = hintsFor(src);
		const typeHints = hints.filter((h) => h.kind === InlayHintKind.Type);
		assert.equal(typeHints.length, 1);
		assert.equal(typeHints[0].label, ": xs:integer");

		const nameEnd = src.indexOf(" := 1");
		assert.deepEqual(typeHints[0].position, makeDoc(src).positionAt(nameEnd));
	});

	test("untyped for binding gets an inferred-type hint", () => {
		const src = `for $x in "a" return $x`;
		const hints = hintsFor(src);
		const typeHints = hints.filter((h) => h.kind === InlayHintKind.Type);
		assert.equal(typeHints.length, 1);
		assert.equal(typeHints[0].label, ": xs:string");
	});

	test("for binding over a range expression gets an inferred-type hint", () => {
		const src = `for $x in 1 to 3 return $x`;
		const hints = hintsFor(src);
		const typeHints = hints.filter((h) => h.kind === InlayHintKind.Type);
		assert.equal(typeHints.length, 1);
		assert.equal(typeHints[0].label, ": xs:integer");
	});

	test("let binding over a range expression keeps the sequence occurrence", () => {
		const src = `let $r := 1 to 5 return $r`;
		const hints = hintsFor(src);
		const typeHints = hints.filter((h) => h.kind === InlayHintKind.Type);
		assert.equal(typeHints.length, 1);
		assert.equal(typeHints[0].label, ": xs:integer*");
	});

	test("for binding over a known multi-item sequence narrows to the item type", () => {
		const src = `declare function local:seq() as xs:integer* { (1, 2, 3) };\nfor $x in local:seq() return $x`;
		const hints = hintsFor(src);
		const typeHints = hints.filter((h) => h.kind === InlayHintKind.Type);
		assert.equal(typeHints.length, 1);
		assert.equal(typeHints[0].label, ": xs:integer");
	});

	test("let binding with an explicit 'as' type gets no redundant hint", () => {
		const src = `let $x as xs:integer := 1 return $x`;
		const hints = hintsFor(src);
		assert.equal(hints.filter((h) => h.kind === InlayHintKind.Type).length, 0);
	});

	test("binding whose init expression type can't be inferred gets no hint", () => {
		const src = `let $x := local:unknown() return $x`;
		const hints = hintsFor(src);
		assert.equal(hints.filter((h) => h.kind === InlayHintKind.Type).length, 0);
	});

	test("let binding over an integer division gets an inferred xs:decimal hint", () => {
		const src = `let $y := 23 div 24 return $y`;
		const hints = hintsFor(src);
		const typeHints = hints.filter((h) => h.kind === InlayHintKind.Type);
		assert.equal(typeHints.length, 1);
		assert.equal(typeHints[0].label, ": xs:decimal");
	});

	test("path expression over literals gets no hint (not misinferred as node()*)", () => {
		const src = `let $y := 23 / 2 return $y`;
		const hints = hintsFor(src);
		assert.equal(hints.filter((h) => h.kind === InlayHintKind.Type).length, 0);
	});
});

describe("inlay-hints: range restriction", () => {
	test("hints outside the requested range are excluded", () => {
		const src = `let $x := 1 return $x`;
		const doc = makeDoc(src);
		const { analysis, ast } = analyzeWithAst(src, doc.uri);
		if (!ast) throw new Error("expected AST parse to succeed");
		// A zero-width range at the very start of the document excludes the binding.
		const narrowRange = { start: doc.positionAt(0), end: doc.positionAt(0) };
		const hints = getInlayHints(doc, ast, analysis, new Map(), narrowRange);
		assert.equal(hints.length, 0);
	});
});
