xquery version "3.1";

(: ── Module & namespace declarations ──────────────────────────────────────── :)

module namespace app = "http://example.com/app";
declare namespace html = "http://www.w3.org/1999/xhtml";
import module namespace util = "http://example.com/util" at "util.xqm";

(# ext:mode "fast" #) 1

(:~
 : A doc-comment — also a block comment.
 : @param $items the sequence to process
 : @return processed result
 :)

(: ── Variable declarations ─────────────────────────────────────────────────── :)

declare variable $app:base-uri as xs:anyURI := xs:anyURI("http://example.com");
declare variable $limit as xs:integer external;

(: ── Function declarations ──────────────────────────────────────────────────── :)

declare function app:greet($name as xs:string) as xs:string {
  "Hello, " || $name || "!"
};

declare private function local:max($a as xs:integer, $b as xs:integer) as xs:integer {
  if ($a gt $b) then $a else $b
};

declare updating function app:set-flag($node as element()) {
  replace value of node $node with "true"
};

(: ── Control flow ───────────────────────────────────────────────────────────── :)

let $items := (1, 2, 3, 4, 5)
let $evens :=
  for $i in $items
  where $i mod 2 eq 0
  order by $i ascending
  return $i
return $evens

,

(: if / then / else :)
if (count($items) gt 0)
then "non-empty"
else "empty"

,

(: typeswitch :)
typeswitch ($items)
  case xs:integer return "integer"
  case xs:string  return "string"
  default         return "other"

,

(: try / catch :)
try {
  xs:integer("not-a-number")
} catch * {
  "conversion failed"
}

,

(: every / some :)
every $x in $items satisfies ($x gt 0)
,
some  $x in $items satisfies ($x gt 3)

(: ── Word operators ─────────────────────────────────────────────────────────── :)

,

(1 + 2) div 3
,
5 idiv 2
,
7 mod 3
,
$items union ()
,
$items intersect (1, 3)
,
$items except (2, 4)
,
true() and false()
,
true() or  false()
,
1 eq 1
,
1 ne 2
,
1 lt 2
,
1 le 1
,
2 gt 1
,
2 ge 2
,
1 to 5

(: XQuery 4.0: otherwise :)
,
() otherwise (1, 2, 3)

(: ── Type expressions ───────────────────────────────────────────────────────── :)

,

"42" cast as xs:integer
,
"42" castable as xs:integer
,
42   treat as xs:integer
,
42   instance of xs:integer
,
42   instance of xs:double?
,
<a/> instance of element()
,
() instance of empty-sequence()

(: ── Sequence type keywords ─────────────────────────────────────────────────── :)

declare function local:accepts-node($n as node()) as item()* { $n };
declare function local:takes-map($m as map(*)) as array(*) { array { $m?* } };
declare function local:takes-record($r as record(id as xs:integer, label as xs:string)) as xs:string { $r?label };

(: ── XPath axes ─────────────────────────────────────────────────────────────── :)

,

<root><child/></root>/child::*
,
<root/>/self::element()
,
<root><a/></root>/descendant-or-self::node()
,
<root/>/attribute::*
,
<root/>/following-sibling::*

(: ── Function calls ─────────────────────────────────────────────────────────── :)

,

fn:string-join(("a", "b", "c"), ", ")
,
string-join(("a", "b"), "-")
,
xs:integer("42")
,
local:max(3, 7)

(: ── Variables ──────────────────────────────────────────────────────────────── :)

,

let $x := 1
let $my-var := $x + 1
return ($x, $my-var)

(: ── Strings & escapes ───────────────────────────────────────────────────────── :)

,

"a ""quoted"" word"
,
'it''s fine'
,
"ampersand: &amp; copyright: &#169; hex: &#x00A9;"

(: ── Numbers ────────────────────────────────────────────────────────────────── :)

,

42
,
3.14
,
2.5e10
,
.5

(: ── Arrow operators (3.1 => and 4.0 ->) ───────────────────────────────────── :)

,

"hello" => upper-case()
,
(1, 2, 3) -> fn:sum#1
