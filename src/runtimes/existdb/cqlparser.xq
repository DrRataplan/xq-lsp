module namespace cqlparser = "http://exist-db.org/xquery/cqlparser";

(:~
 : Parses expressions in the Contextual Query Language (SRU/CQL) v1.2,
 : returning it back as XCQL or CQL, based on the second parameter, default is
 : XCQL. Basic searchClauses (index relation term) can be combined with boolean
 : operators.
 : @param $expression The expression to parse
 : @param $output-as Output as 'XCQL' or 'CQL'
 : @return the result
 :)
declare function cqlparser:parse-cql($expression as xs:string?, $output-as as xs:string?) as item()? external;
