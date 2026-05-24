module namespace ngram = "http://exist-db.org/xquery/ngram";

(:~
 : Queries the ngram index with the given search string.
 : @param $nodes The node set to search
 : @param $query The search string
 :)
declare function ngram:query($nodes as node()*, $query as xs:string) as node()* external;

(:~
 : Queries a named ngram index field.
 : @param $nodes The node set to search
 : @param $field The ngram field name
 : @param $query The search string
 :)
declare function ngram:query-field($nodes as node()*, $field as xs:string, $query as xs:string) as node()* external;

(:~
 : Returns wildcard results from the ngram index for the given nodes.
 : @param $nodes The node set to query
 : @param $query The ngram query
 :)
declare function ngram:wildcard-query($nodes as node()*, $query as xs:string) as node()* external;

(:~
 : Returns the index keys for the ngram index over the given nodes.
 : @param $nodes The nodes to inspect
 : @param $function A callback function called for each key
 :)
declare function ngram:index-keys($nodes as node()*, $function as function(*)) as item()* external;
