module namespace simpleql = "http://exist-db.org/xquery/simple-ql";

(:~
 : Translates expressions in a simple query language to an XPath expression. A
 : single search term is translated into '. &amp;= term', 'and'/'or' used to
 : combine terms, quotes define a phrase and are translated into near(.,
 : 'quoted terms').
 : @param $expression The expression to parse
 : @return the result
 :)
declare function simpleql:parse-simpleql($expression as xs:string?) as xs:string? external;
