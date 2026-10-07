module namespace ngram = "http://exist-db.org/xquery/ngram";

(:~
 : For each of the nodes in the argument sequence, mark the entire first text
 : descendant as a text match, just as if it had been found through a search
 : operation. At serialization time, the text node will be enclosed in an
 : &amp;lt;exist:match&amp;gt; tag, which facilitates further processing by the
 : kwic module or match highlighting. The function is not directly related to
 : the NGram indexand works without an index; it just uses the NGram module's
 : match processor.
 : @param $node-set The node set
 : @return a node set containing nodes that do not have descendent nodes.
 :)
declare function ngram:add-match($node-set as node()?) as node()* external;

(:~
 : Similar to the standard XQuery fn:contains function, but based on the NGram
 : index. Searches the given $queryString in the index defined on the input
 : node set $nodes. String comparison is case insensitive. Nodes need to have
 : an ngram index to be searched.The string may appear at any position within
 : the node content.
 : @param $nodes The input node set to search
 : @param $queryString The exact string to search for
 : @return a set of nodes from the input node set $nodes containing the query string or the empty sequence
 :)
declare function ngram:contains($nodes as node()*, $queryString as xs:string?) as node()* external;

(:~
 : Similar to the standard XQuery fn:ends-with function, but based on the NGram
 : index. Searches the given $queryString in the index defined on the input
 : node set $nodes. String comparison is case insensitive. Nodes need to have
 : an ngram index to be searched.The string has to appear at the end of the
 : node's content.
 : @param $nodes The input node set to search
 : @param $queryString The exact string to search for
 : @return a set of nodes from the input node set $nodes ending with the query string or the empty sequence
 :)
declare function ngram:ends-with($nodes as node()*, $queryString as xs:string?) as node()* external;

(:~
 : Highlight matching strings within text nodes that resulted from a ngram
 : search. The function takes a sequence of nodes as first argument $nodes and
 : a callback function (defined with util:function) as second parameter
 : $function-reference. Each node in $nodes will be copied into a new document
 : fragment. For each ngram match found while copying a node, the callback
 : function in $function-reference will be called once. The callback function
 : should take 2 arguments: 1) the matching text string as xs:string, 2) the
 : node to which this text string belongs. The callback function should return
 : zero or more nodes, which will be inserted into the resulting node set at
 : the place where the matching text sequence occurred. Note: a ngram match on
 : mixed content may span multiple nodes. In this case, the callback function
 : is called once for every text node which is part of the matching text
 : sequence.
 : @param $nodes The sequence of nodes
 : @param $function-reference The callback function
 : @return a resulting node set
 :)
declare function ngram:filter-matches($nodes as node()*, $function-reference as function(*)) as node()* external;

(:~
 : Similar to the standard XQuery fn:starts-with function, but based on the
 : NGram index. Searches the given $queryString in the index defined on the
 : input node set $nodes. String comparison is case insensitive. Nodes need to
 : have an ngram index to be searched.The string has to appear at the start of
 : the node's content.
 : @param $nodes The input node set to search
 : @param $queryString The exact string to search for
 : @return a set of nodes from the input node set $nodes starting with the query string or the empty sequence
 :)
declare function ngram:starts-with($nodes as node()*, $queryString as xs:string?) as node()* external;

(:~
 : Similar to the standard XQuery fn:matches function, but based on the NGram
 : index and allowing wildcards in the query string. Searches the given
 : $queryString in the index defined on the input node set $nodes. String
 : comparison is case insensitive. Nodes need to have an ngram index to be
 : searched.The string has to match the whole node's content.
 : @param $nodes The input node set to search
 : @param $queryString The string to search for.A full stop, '.', (not between brackets), without any qualifiers: Matches a single arbitrary character.A full stop, '.', (not between brackets), immediately followed by a single question mark, '?': Matches either no characters or one character.A full stop, '.', (not between brackets), immediately followed by a single asterisk, '*': Matches zero or more characters.A full stop, '.', (not between brackets), immediately followed by a single plus sign, '+': Matches one or more characters.A full stop, '.', immediately followed by a sequence of characters that matches the regular expression {[0-9]+,[0-9]+}: Matches a number of characters, where the number is no less than the number represented by the series of digits before the comma, and no greater than the number represented by the series of digits following the comma.An expression "[…]" matches a single character, namely any of the charactersenclosed by the brackets. The string enclosed by the brackets cannot be empty; therefore ']' can be allowed between the brackets, provided that it is the first character.(Thus, "[][?]" matches the three characters '[', ']' and '?'.)A circumflex accent, '^', at the start of the search string matches the start of the element content.A dollar sign, '$', at the end of the search string matches the end of the element content.One can remove the special meaning of any character mentioned above by preceding them by a backslash.Between brackets these characters stand for themselves. Thus, "[[?*\]" matchesthe four characters '[', '?', '*' and '\'.'?', '*', '+' and character sequences matching the regular expression {[0-9]+,[0-9]+} not immediately preceeded by an unescaped period, '.', stand for themselves.'^' and '$' not at the very beginning or end of the search string, respectively, stand for themselves.
 : @return a set of nodes from the input node set $nodes matching the query string or the empty sequence
 :)
declare function ngram:wildcard-contains($nodes as node()*, $queryString as xs:string?) as node()* external;
