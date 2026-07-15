import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { analyzeWithAst } from "./analyzer.ts";
import { getBuiltins } from "./builtins.ts";
import type { FileAnalysis } from "./types.ts";
import {
	getSemanticTokensData,
	encodeSemanticTokens,
	SEMANTIC_TOKENS_LEGEND,
	TOKEN_TYPES,
	TOKEN_MODIFIERS,
} from "./semantic-tokens.ts";

const builtins = getBuiltins();
const withBuiltins = new Map<string, FileAnalysis>([["builtin:fn", builtins]]);

function typeIndex(name: (typeof TOKEN_TYPES)[number]): number {
	return TOKEN_TYPES.indexOf(name);
}

function modifierBit(name: (typeof TOKEN_MODIFIERS)[number]): number {
	return 1 << TOKEN_MODIFIERS.indexOf(name);
}

/** Decodes the flat delta-encoded array back into absolute-position tokens, for assertions. */
function decode(data: number[]): Array<{ line: number; character: number; length: number; tokenType: number; tokenModifiers: number }> {
	const out: Array<{ line: number; character: number; length: number; tokenType: number; tokenModifiers: number }> = [];
	let line = 0;
	let character = 0;
	for (let i = 0; i < data.length; i += 5) {
		const deltaLine = data[i];
		const deltaChar = data[i + 1];
		line += deltaLine;
		character = deltaLine === 0 ? character + deltaChar : deltaChar;
		out.push({ line, character, length: data[i + 2], tokenType: data[i + 3], tokenModifiers: data[i + 4] });
	}
	return out;
}

function tokensFor(src: string, importedAnalyses: Map<string, FileAnalysis> = new Map()) {
	const { analysis, ast } = analyzeWithAst(src, "file:///main.xq");
	const data = getSemanticTokensData(ast, src, analysis, importedAnalyses);
	return decode(data);
}

// ── Encoding ──────────────────────────────────────────────────────────────────

describe("semantic-tokens: delta encoding", () => {
	test("hand-computed deltas for a 3-token fixture on two lines", () => {
		// line 0: token at char 5, length 3, type 1, mods 0b01
		// line 0: token at char 10, length 4, type 2, mods 0
		// line 2: token at char 1, length 6, type 1, mods 0b10
		const data = encodeSemanticTokens([
			{ line: 0, character: 5, length: 3, tokenType: 1, tokenModifiers: 0b01 },
			{ line: 0, character: 10, length: 4, tokenType: 2, tokenModifiers: 0 },
			{ line: 2, character: 1, length: 6, tokenType: 1, tokenModifiers: 0b10 },
		]);
		assert.deepEqual(data, [
			0, 5, 3, 1, 0b01, // first token: absolute line/char since it's the first
			0, 5, 4, 2, 0, // same line as previous → deltaLine 0, deltaChar 10-5=5
			2, 1, 6, 1, 0b10, // two lines down → deltaLine 2, deltaChar absolute (1)
		]);
	});

	test("sorts out-of-order input before encoding", () => {
		const data = encodeSemanticTokens([
			{ line: 1, character: 0, length: 1, tokenType: 0, tokenModifiers: 0 },
			{ line: 0, character: 0, length: 1, tokenType: 0, tokenModifiers: 0 },
		]);
		// Must come out as line 0 first (deltaLine 0), then line 1 (deltaLine 1)
		assert.deepEqual(data, [0, 0, 1, 0, 0, 1, 0, 1, 0, 0]);
	});

	test("legend lists exactly the populated token types and modifiers", () => {
		assert.deepEqual(SEMANTIC_TOKENS_LEGEND.tokenTypes, [...TOKEN_TYPES]);
		assert.deepEqual(SEMANTIC_TOKENS_LEGEND.tokenModifiers, [...TOKEN_MODIFIERS]);
	});
});

// ── Function classification ──────────────────────────────────────────────────

describe("semantic-tokens: function classification", () => {
	test("builtin function call gets the defaultLibrary modifier", () => {
		const toks = tokensFor(`fn:concat("a", "b")`, withBuiltins);
		const fnToken = toks.find((t) => t.tokenType === typeIndex("function"));
		assert.ok(fnToken, `expected a function token, got ${JSON.stringify(toks)}`);
		assert.ok(fnToken!.tokenModifiers & modifierBit("defaultLibrary"), `expected defaultLibrary modifier, got ${fnToken!.tokenModifiers}`);
	});

	test("unprefixed builtin function call gets the defaultLibrary modifier", () => {
		const toks = tokensFor(`count((1, 2, 3))`, withBuiltins);
		const fnToken = toks.find((t) => t.tokenType === typeIndex("function"));
		assert.ok(fnToken, `expected a function token, got ${JSON.stringify(toks)}`);
		assert.ok(fnToken!.tokenModifiers & modifierBit("defaultLibrary"), `expected defaultLibrary modifier, got ${fnToken!.tokenModifiers}`);
	});

	test("user-declared function call does not get the defaultLibrary modifier", () => {
		const toks = tokensFor(`declare function local:greet($name) { $name }; local:greet("World")`);
		const fnTokens = toks.filter((t) => t.tokenType === typeIndex("function"));
		// Two function tokens: the declaration name and the call site — neither is a builtin.
		assert.equal(fnTokens.length, 2, `expected 2 function tokens, got ${JSON.stringify(fnTokens)}`);
		for (const t of fnTokens) {
			assert.equal(t.tokenModifiers & modifierBit("defaultLibrary"), 0, `expected no defaultLibrary modifier, got ${t.tokenModifiers}`);
		}
	});
});

// ── Variable / unused classification ─────────────────────────────────────────

describe("semantic-tokens: variable classification", () => {
	test("unused %private module variable gets the unused modifier", () => {
		const src = `declare %private variable $local:x := 1;\n1`;
		const toks = tokensFor(src);
		const declOffset = src.indexOf("local:x");
		// The declaration's local-name token starts right after "local:".
		const varToken = toks.find((t) => t.tokenType === typeIndex("variable") && t.character === declOffset + "local:".length);
		assert.ok(varToken, `expected a variable token for the declaration, got ${JSON.stringify(toks)}`);
		assert.ok(varToken!.tokenModifiers & modifierBit("unused"), `expected unused modifier, got ${varToken!.tokenModifiers}`);
		assert.ok(varToken!.tokenModifiers & modifierBit("readonly"), `expected readonly modifier, got ${varToken!.tokenModifiers}`);
	});

	test("used %private module variable does not get the unused modifier", () => {
		const src = `declare %private variable $local:x := 1;\n$local:x eq $local:x`;
		const toks = tokensFor(src);
		const declOffset = src.indexOf("local:x");
		const varToken = toks.find((t) => t.tokenType === typeIndex("variable") && t.character === declOffset + "local:".length);
		assert.ok(varToken, `expected a variable token for the declaration, got ${JSON.stringify(toks)}`);
		assert.equal(varToken!.tokenModifiers & modifierBit("unused"), 0, `expected no unused modifier, got ${varToken!.tokenModifiers}`);
	});

	test("a plain $x variable reference is classified as variable with readonly modifier", () => {
		const toks = tokensFor(`let $x := 1 return $x`);
		const varTokens = toks.filter((t) => t.tokenType === typeIndex("variable"));
		assert.equal(varTokens.length, 2, `expected declaration + reference, got ${JSON.stringify(varTokens)}`);
		for (const t of varTokens) assert.ok(t.tokenModifiers & modifierBit("readonly"));
	});
});

// ── Namespace / other token types ────────────────────────────────────────────

describe("semantic-tokens: namespace and misc token types", () => {
	test("a builtin namespace prefix (fn:) gets the defaultLibrary modifier", () => {
		const toks = tokensFor(`fn:concat("a", "b")`, withBuiltins);
		const nsToken = toks.find((t) => t.tokenType === typeIndex("namespace"));
		assert.ok(nsToken, `expected a namespace token, got ${JSON.stringify(toks)}`);
		assert.ok(nsToken!.tokenModifiers & modifierBit("defaultLibrary"));
	});

	test("a user-declared namespace prefix does not get the defaultLibrary modifier", () => {
		const toks = tokensFor(`declare namespace foo = "urn:foo"; foo:bar()`);
		const nsToken = toks.find((t) => t.tokenType === typeIndex("namespace"));
		assert.ok(nsToken, `expected a namespace token, got ${JSON.stringify(toks)}`);
		assert.equal(nsToken!.tokenModifiers & modifierBit("defaultLibrary"), 0);
	});

	test("string literals are classified as string tokens", () => {
		const toks = tokensFor(`"hello"`);
		const strToken = toks.find((t) => t.tokenType === typeIndex("string"));
		assert.ok(strToken, `expected a string token, got ${JSON.stringify(toks)}`);
		assert.equal(strToken!.length, `"hello"`.length);
	});

	test("keywords like for/let/return are classified as keyword tokens", () => {
		const toks = tokensFor(`for $x in (1,2) let $y := $x return $y`);
		const keywordTokens = toks.filter((t) => t.tokenType === typeIndex("keyword"));
		assert.ok(keywordTokens.length >= 3, `expected for/let/return keyword tokens, got ${JSON.stringify(keywordTokens)}`);
	});

	test("function parameters are classified as parameter tokens", () => {
		const toks = tokensFor(`declare function local:f($x) { $x }; local:f(1)`);
		const paramToken = toks.find((t) => t.tokenType === typeIndex("parameter"));
		assert.ok(paramToken, `expected a parameter token, got ${JSON.stringify(toks)}`);
	});

	test("returns no tokens when the source fails to parse", () => {
		const { analysis, ast } = analyzeWithAst(`declare function (`, "file:///broken.xq");
		assert.equal(ast, null);
		const data = getSemanticTokensData(ast, `declare function (`, analysis, new Map());
		assert.deepEqual(data, []);
	});
});
