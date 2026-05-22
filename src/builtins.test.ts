import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getBuiltins } from "./builtins.ts";
import { formatQName } from "./types.ts";

describe("builtins", () => {
	const builtins = getBuiltins();

	test("fn:exists has arity 1", () => {
		const fn = builtins.functions.find((f) => formatQName(f.qname) === "fn:exists");
		assert.ok(fn, "fn:exists not found");
		assert.equal(fn.arity, 1);
	});

	test("fn:exists has correct param and return types", () => {
		const fn = builtins.functions.find((f) => formatQName(f.qname) === "fn:exists");
		assert.equal(fn?.params[0].type, "item()*");
		assert.equal(fn?.returnType, "xs:boolean");
	});

	test("fn:true has arity 0", () => {
		const fn = builtins.functions.find((f) => formatQName(f.qname) === "fn:true");
		assert.ok(fn, "fn:true not found");
		assert.equal(fn.arity, 0);
	});

	test("functions have doc comments", () => {
		const fn = builtins.functions.find((f) => formatQName(f.qname) === "fn:empty");
		assert.ok(fn?.doc?.description, "expected doc description");
		assert.ok(fn?.params[0].description, "expected param description");
	});
});
