module namespace ngram = "http://exist-db.org/xquery/ngram";

(:~
 : For each of the nodes in the argument sequence, mark the entire first text
 : descendant as a text match, just as if it had been found through a search
 : operation. At serialization time, the text node will be enclosed in an
 : &lt;exist:match&gt; tag, which facilitates further processing by the kwic
 : module or match highlighting. The function is not directly related to the
 : NGram index and works without an index; it just uses the NGram module's
 : match processor.
 : @param $node-set The node set
 : @return a node set containing nodes that do not have descendent nodes.
 :)
declare function ngram:add-match($node-set as node()?) as node()* external;

(:~
 : Similar to the standard XQuery fn:contains function, but based on the NGram
 : index. The string may appear at any position within the node content.
 : @param $nodes The input node set to search
 : @param $queryString The exact string to search for
 : @return a set of nodes from the input node set $nodes containing the query string or the empty sequence
 :)
declare function ngram:contains($nodes as node()*, $queryString as xs:string?) as node()* external;

(:~
 : Similar to the standard XQuery fn:ends-with function, but based on the NGram
 : index. The string has to appear at the end of the node's content.
 : @param $nodes The input node set to search
 : @param $queryString The exact string to search for
 : @return a set of nodes from the input node set $nodes ending with the query string or the empty sequence
 :)
declare function ngram:ends-with($nodes as node()*, $queryString as xs:string?) as node()* external;

(:~
 : @param $nodes The sequence of nodes
 : @param $function-reference The callback function
 : @return a resulting node set
 :)
declare function ngram:filter-matches($nodes as node()*, $function-reference as function(*)) as node()* external;

(:~
 : Similar to the standard XQuery fn:starts-with function, but based on the
 : NGram index. The string has to appear at the start of the node's content.
 : @param $nodes The input node set to search
 : @param $queryString The exact string to search for
 : @return a set of nodes from the input node set $nodes starting with the query string or the empty sequence
 :)
declare function ngram:starts-with($nodes as node()*, $queryString as xs:string?) as node()* external;

(:~
 : Similar to the standard XQuery fn:matches function, but based on the NGram
 : index and allowing wildcards in the query string. The string has to match
 : the whole node's content.
 : @param $nodes The input node set to search
 : @return a set of nodes from the input node set $nodes matching the query string or the empty sequence
 :)
declare function ngram:wildcard-contains($nodes as node()*, $queryString as xs:string?) as node()* external;
