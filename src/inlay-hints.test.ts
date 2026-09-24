import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { InlayHintKind } from "vscode-languageserver/node.js";
import { analyzeWithAst } from "./analyzer.ts";
import { getInlayHints } from "./inlay-hints.ts";
import { makeDoc } from "./test-utils.ts";
import { getBuiltins } from "./builtins.ts";
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

// Maps each hinted variable name (the text just before the hint) to its type label.
function typeHintsByVar(src: string): Record<string, string> {
	const doc = makeDoc(src);
	const out: Record<string, string> = {};
	for (const h of hintsFor(src, new Map([["builtin:fn", getBuiltins()]])).filter((h) => h.kind === InlayHintKind.Type)) {
		const end = doc.offsetAt(h.position);
		const name = /\$([\w:-]+)$/.exec(src.slice(0, end))?.[1] ?? "?";
		out[name] = h.label as string;
	}
	return out;
}

describe("inlay-hints: inferred types of compound expressions", () => {
	test("if/then/else takes the common type of both branches", () => {
		const hints = typeHintsByVar(`
			let $same := if (1 = 1) then 1 else 2
			let $opt := if (1 = 1) then "a" else ()
			let $num := if (1 = 1) then 1 else 1.5
			let $mixed := if (1 = 1) then 1 else 1e0
			let $any := if (1 = 1) then 1 else "a"
			let $nodes := if (1 = 1) then <a/> else <b/>
			return 1`);
		assert.equal(hints.same, ": xs:integer");
		assert.equal(hints.opt, ": xs:string?");
		assert.equal(hints.num, ": xs:decimal");
		assert.equal(hints.mixed, ": xs:numeric");
		assert.equal(hints.any, ": xs:anyAtomicType");
		assert.equal(hints.nodes, ": element()");
	});

	test("bindings inside if/else branches see the outer scope", () => {
		const hints = typeHintsByVar(`
			let $x := "a"
			return if ($x = "a") then let $t := $x return $t else let $e := 1 return $e`);
		assert.equal(hints.t, ": xs:string");
		assert.equal(hints.e, ": xs:integer");
	});

	test("switch, typeswitch and try/catch combine their branches", () => {
		const hints = typeHintsByVar(`
			let $s := switch (1) case 1 return "a" default return "b"
			let $ts := typeswitch (1) case $i as xs:integer return $i default return 2
			let $tc := try { 1 } catch * { () }
			return 1`);
		assert.equal(hints.s, ": xs:string");
		assert.equal(hints.ts, ": xs:integer");
		assert.equal(hints.tc, ": xs:integer?");
	});

	test("sequences, empty sequences and predicates", () => {
		const hints = typeHintsByVar(`
			let $seq := (1, 2, 3)
			let $empty := ()
			let $first := $seq[1]
			let $filtered := $seq[. > 1]
			return 1`);
		assert.equal(hints.seq, ": xs:integer+");
		assert.equal(hints.empty, ": empty-sequence()");
		assert.equal(hints.first, ": xs:integer?");
		assert.equal(hints.filtered, ": xs:integer*");
	});

	test("boolean, string and cast expressions", () => {
		const hints = typeHintsByVar(`
			let $cmp := 1 = 2
			let $and := 1 eq 1 and 2 eq 2
			let $inst := 1 instance of xs:integer
			let $some := some $v in (1, 2) satisfies $v = 1
			let $concat := "a" || "b"
			let $tmpl := \`\`[x]\`\`
			let $cast := "1" cast as xs:integer
			let $treat := "a" treat as xs:string
			return 1`);
		assert.equal(hints.cmp, ": xs:boolean");
		assert.equal(hints.and, ": xs:boolean");
		assert.equal(hints.inst, ": xs:boolean");
		assert.equal(hints.some, ": xs:boolean");
		assert.equal(hints.concat, ": xs:string");
		assert.equal(hints.tmpl, ": xs:string");
		assert.equal(hints.cast, ": xs:integer");
		assert.equal(hints.treat, ": xs:string");
	});

	test("maps, arrays, lookups and function items", () => {
		const hints = typeHintsByVar(`
			declare function local:f($a as xs:string) as xs:integer { 1 };
			let $m := map { "a": 1, "b": 2 }
			let $v := $m?a
			let $arr := [1, 2]
			let $member := $arr?1
			let $curly := array { 1, 2 }
			let $ref := local:f#1
			let $inline := function($z as xs:integer) { $z + 1 }
			let $called := $inline(1)
			return 1`);
		assert.equal(hints.m, ": map(xs:string, xs:integer)");
		assert.equal(hints.v, ": xs:integer?");
		assert.equal(hints.arr, ": array(xs:integer)");
		assert.equal(hints.member, ": xs:integer");
		assert.equal(hints.curly, ": array(xs:integer)");
		assert.equal(hints.ref, ": function(xs:string) as xs:integer");
		assert.equal(hints.inline, ": function(xs:integer) as xs:integer");
		assert.equal(hints.called, ": xs:integer");
	});

	test("nested FLWOR: for multiplies cardinality, where makes it optional, group by regroups", () => {
		const hints = typeHintsByVar(`
			let $doubled := for $w in (1, 2) return $w * 2
			let $kept := for $w2 in (1, 2) where $w2 > 1 return $w2
			let $groups := for $g in ("a", "b") group by $k := $g return $g
			return 1`);
		assert.equal(hints.w, ": xs:integer");
		assert.equal(hints.doubled, ": xs:integer+");
		assert.equal(hints.kept, ": xs:integer*");
		assert.equal(hints.k, ": xs:string");
		// A non-empty input yields at least one group, and every group holds at least one item.
		assert.equal(hints.groups, ": xs:string+");
	});

	test("path expressions infer the kind of node selected by the last step", () => {
		const hints = typeHintsByVar(`
			let $doc := <a><b c="1"/></a>
			let $elems := $doc//b
			let $attrs := $doc/b/@c
			let $texts := $doc//text()
			return 1`);
		assert.equal(hints.doc, ": element()");
		assert.equal(hints.elems, ": element()*");
		assert.equal(hints.attrs, ": attribute()*");
		assert.equal(hints.texts, ": text()*");
	});

	test("simple map operator tracks the context item", () => {
		const hints = typeHintsByVar(`let $plus := (1, 2) ! (. + 1) return 1`);
		assert.equal(hints.plus, ": xs:integer+");
	});
});

describe("inlay-hints: operator and built-in type rules", () => {
	test("arithmetic keeps optionality, atomizes nodes and handles dates and durations", () => {
		const hints = typeHintsByVar(`
			declare function local:opt() as xs:integer? { () };
			let $opt := local:opt()
			let $plus := $opt + 1
			let $neg := -$opt
			let $node := <a>1</a> + 1
			let $days := xs:date("2020-01-02") - xs:date("2020-01-01")
			let $later := xs:dateTime("2020-01-01T00:00:00") + xs:dayTimeDuration("PT1H")
			let $scaled := xs:dayTimeDuration("PT1H") * 2
			let $ratio := xs:dayTimeDuration("PT1H") div xs:dayTimeDuration("PT1M")
			let $none := () + 1
			return 1`);
		assert.equal(hints.plus, ": xs:integer?");
		assert.equal(hints.neg, ": xs:integer?");
		assert.equal(hints.node, ": xs:double");
		assert.equal(hints.days, ": xs:dayTimeDuration");
		assert.equal(hints.later, ": xs:dateTime");
		assert.equal(hints.scaled, ": xs:dayTimeDuration");
		assert.equal(hints.ratio, ": xs:decimal");
		assert.equal(hints.none, ": empty-sequence()");
	});

	test("value comparisons are optional when an operand is, general comparisons never are", () => {
		const hints = typeHintsByVar(`
			declare function local:opt() as xs:integer? { () };
			let $value := local:opt() eq 1
			let $general := local:opt() = 1
			return 1`);
		assert.equal(hints.value, ": xs:boolean?");
		assert.equal(hints.general, ": xs:boolean");
	});

	test("aggregates and atomization follow their argument types", () => {
		const hints = typeHintsByVar(`
			let $sum := sum((1, 2))
			let $avg := avg((1, 2))
			let $max := max((1.5, 2.5))
			let $maybe := min(())
			let $data := data(<a/>)
			let $distinct := distinct-values(("a", "b"))
			return 1`);
		assert.equal(hints.sum, ": xs:integer");
		assert.equal(hints.avg, ": xs:decimal");
		assert.equal(hints.max, ": xs:decimal");
		assert.equal(hints.maybe, ": empty-sequence()");
		assert.equal(hints.data, ": xs:untypedAtomic");
		assert.equal(hints.distinct, ": xs:string+");
	});

	test("higher-order functions and map/array accessors keep member types", () => {
		const hints = typeHintsByVar(`
			let $strings := for-each((1, 2), function($x) as xs:string { string($x) })
			let $got := map:get(map { "a": 1 }, "a")
			let $keys := map:keys(map { "a": 1 })
			let $entry := map:entry("k", 1)
			let $member := array:get([1, 2], 1)
			let $head := array:head(["a"])
			let $mapped := array:for-each([1], function($x) as xs:boolean { true() })
			return 1`);
		assert.equal(hints.strings, ": xs:string+");
		assert.equal(hints.got, ": xs:integer?");
		assert.equal(hints.keys, ": xs:string*");
		assert.equal(hints.entry, ": map(xs:string, xs:integer)");
		assert.equal(hints.member, ": xs:integer");
		assert.equal(hints.head, ": xs:string");
		assert.equal(hints.mapped, ": array(xs:boolean)");
	});

	test("except/intersect keep the left operand's node kind", () => {
		const hints = typeHintsByVar(`let $d := <a><b/></a> let $rest := $d//b except $d/b return 1`);
		assert.equal(hints.rest, ": element()*");
	});

	test("copy/modify returns the copied node's type", () => {
		const hints = typeHintsByVar(`let $copy := copy $c := <a/> modify () return $c return 1`);
		assert.equal(hints.c, ": element()");
		assert.equal(hints.copy, ": element()");
	});
});

describe("inlay-hints: user functions", () => {
	test("functions without a declared return type get one inferred from their body", () => {
		const hints = typeHintsByVar(`
			declare function local:double($a as xs:integer) { $a * 2 };
			declare function local:uses-later() { local:later() };
			declare function local:later() { "x" };
			let $d := local:double(1)
			let $l := local:uses-later()
			return 1`);
		assert.equal(hints.d, ": xs:integer");
		assert.equal(hints.l, ": xs:string");
	});

	test("recursive functions without a return type stay unknown", () => {
		const hints = typeHintsByVar(`
			declare function local:fact($n as xs:integer) { if ($n le 1) then 1 else $n * local:fact($n - 1) };
			let $f := local:fact(3)
			return 1`);
		assert.equal(hints.f, undefined);
	});

	test("partial application yields a function over the placeholder arguments", () => {
		const hints = typeHintsByVar(`
			declare function local:add($a as xs:integer, $b as xs:decimal) as xs:decimal { $a + $b };
			let $inc := local:add(1, ?)
			return 1`);
		assert.equal(hints.inc, ": function(xs:decimal) as xs:decimal");
	});
});

describe("inlay-hints: narrowing", () => {
	test("instance of narrows the variable inside the then-branch", () => {
		const hints = typeHintsByVar(`
			declare function local:opt() as xs:integer? { () };
			let $x := local:opt()
			let $r := if ($x instance of xs:integer) then $x else 0
			let $inside := if ($x instance of xs:integer) then let $y := $x return $y else ()
			return 1`);
		assert.equal(hints.r, ": xs:integer");
		assert.equal(hints.y, ": xs:integer");
	});

	test("exists(), empty(), not() and a bare variable narrow optional values", () => {
		const hints = typeHintsByVar(`
			declare function local:opt() as xs:string? { () };
			let $x := local:opt()
			let $e := if (exists($x)) then $x else "none"
			let $n := if (empty($x)) then "none" else $x
			let $nn := if (not(empty($x))) then $x else "none"
			let $b := if ($x) then $x else "none"
			return 1`);
		assert.equal(hints.e, ": xs:string");
		assert.equal(hints.n, ": xs:string");
		assert.equal(hints.nn, ": xs:string");
		assert.equal(hints.b, ": xs:string");
	});

	test("where clauses narrow the variables seen by later clauses", () => {
		const hints = typeHintsByVar(`
			declare function local:opt() as xs:string? { () };
			for $i in 1 to 3
			let $x := local:opt()
			where exists($x)
			let $y := $x
			return $y`);
		assert.equal(hints.y, ": xs:string");
	});

	test("instance of never widens an already more specific type", () => {
		const hints = typeHintsByVar(`let $x := 1 let $r := if ($x instance of xs:decimal) then $x else 0 return 1`);
		assert.equal(hints.r, ": xs:integer");
	});
});

describe("inlay-hints: scopes", () => {
	test("function parameters are in scope inside the function body", () => {
		const hints = typeHintsByVar(`declare function local:g($p as xs:string) { let $u := $p return $u }; 1`);
		assert.equal(hints.u, ": xs:string");
	});

	test("untyped module variables get a hint and are visible to later code", () => {
		const hints = typeHintsByVar(`declare variable $v := 1;\nlet $w := $v + 1 return $w`);
		assert.equal(hints.v, ": xs:integer");
		assert.equal(hints.w, ": xs:integer");
	});

	test("inline functions close over outer variables", () => {
		const hints = typeHintsByVar(`let $x := "a" let $f := function() { let $y := $x return $y } return $f`);
		assert.equal(hints.y, ": xs:string");
	});

	test("a let inside one branch does not leak into the other", () => {
		const hints = typeHintsByVar(`
			let $x := 1
			return (if (true()) then let $x := "s" return $x else (), let $after := $x return $after)`);
		assert.equal(hints.after, ": xs:integer");
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
