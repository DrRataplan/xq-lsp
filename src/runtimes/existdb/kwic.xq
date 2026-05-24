module namespace kwic = "http://exist-db.org/xquery/kwic";

(:~
 : Returns a KWIC (Key Word In Context) summary for the given match node.
 : The result is an element with &lt;exist:match&gt; children wrapping the match terms.
 : @param $node The node containing a Lucene full-text match
 : @param $config A &lt;kwic:config&gt; element controlling width and truncation
 :)
declare function kwic:summarize($node as node(), $config as element()) as element()? external;

(:~
 : Returns a KWIC summary calling a callback function for each match.
 : @param $node The node containing a Lucene full-text match
 : @param $config A &lt;kwic:config&gt; element
 : @param $callback A function called for each match with (match, mode) arguments
 :)
declare function kwic:summarize($node as node(), $config as element(), $callback as function(*)) as element()? external;

(:~
 : Gets the text before a Lucene match term.
 : @param $node The match node
 : @param $chars Maximum number of characters of context before the match
 :)
declare function kwic:get-text($node as node(), $chars as xs:integer) as xs:string? external;
