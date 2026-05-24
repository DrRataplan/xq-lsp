module namespace validation = "http://exist-db.org/xquery/validation";

(:~
 : Remove all cached grammers.
 : @return the number of deleted grammars.
 :)
declare function validation:clear-grammar-cache() as xs:integer external;

declare function validation:jaxp($instance as item(), $cache-grammars as xs:boolean) as xs:boolean external;

declare function validation:jaxp($instance as item(), $cache-grammars as xs:boolean, $catalogs as item()*) as xs:boolean external;

(:~
 : Parse document in validating mode, all defaults are filled in according to
 : the grammar (xsd).
 : @return the parsed document.
 :)
declare function validation:jaxp-parse($instance as item(), $enable-grammar-cache as xs:boolean, $catalogs as item()*) as node() external;

(:~
 : An XML report is returned.
 :)
declare function validation:jaxp-report($instance as item(), $enable-grammar-cache as xs:boolean) as node() external;

(:~
 : An XML report is returned.
 :)
declare function validation:jaxp-report($instance as item(), $enable-grammar-cache as xs:boolean, $catalogs as item()*) as node() external;

declare function validation:jaxv($instance as item(), $grammars as item()+) as xs:boolean external;

declare function validation:jaxv($instance as item(), $grammars as item()+, $language as xs:string) as xs:boolean external;

(:~
 : An XML report is returned.
 :)
declare function validation:jaxv-report($instance as item(), $grammars as item()+) as node() external;

(:~
 : An XML report is returned.
 :)
declare function validation:jaxv-report($instance as item(), $grammars as item()+, $language as xs:string) as node() external;

declare function validation:jing($instance as item(), $grammar as item()) as xs:boolean external;

(:~
 : An XML report is returned.
 :)
declare function validation:jing-report($instance as item(), $grammar as item()) as node() external;

(:~
 : Pre parse grammars and add to grammar cache. Only XML schemas (.xsd) are
 : supported.
 : @param $grammar Reference to grammar.
 : @return sequence of namespaces of preparsed grammars.
 :)
declare function validation:pre-parse-grammar($grammar as xs:anyURI*) as xs:string* external;

(:~
 : Show all cached grammars.
 : @return an XML document containing details on all cached grammars.
 :)
declare function validation:show-grammar-cache() as node() external;
