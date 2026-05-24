module namespace xmldiff = "http://exist-db.org/xquery/xmldiff";

(:~
 : Compares two XML nodes for structural equality and returns true if they are equal.
 : @param $node-a The first node to compare
 : @param $node-b The second node to compare
 :)
declare function xmldiff:compare($node-a as node(), $node-b as node()) as xs:boolean external;

(:~
 : Returns an XML patch (in XUpdate format) that transforms node-a into node-b.
 : @param $node-a The source node
 : @param $node-b The target node
 :)
declare function xmldiff:diff($node-a as node(), $node-b as node()) as element()? external;

(:~
 : Applies an XUpdate patch to the given node, returning the modified node.
 : @param $node The node to patch
 : @param $patch The XUpdate patch as produced by xmldiff:diff
 :)
declare function xmldiff:patch($node as node(), $patch as element()) as node()? external;
