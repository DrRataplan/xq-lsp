module namespace xmldiff = "http://exist-db.org/xquery/xmldiff";

(:~
 : Compares two nodes sets to determine their equivalence. Equivalence is
 : determined in 3 stages, first by sequence length, then equivalent Node
 : types, and finally by XMLUnit Diff.
 : @param $node-set-1 The first node set.
 : @param $node-set-2 The second node set.
 : @return Returns true if the node sets $node-set-1 and $node-set-2 are equal, false otherwise. This function is a simplified version of: : #2 that only returns true or false.
 :)
declare function xmldiff:compare($node-set-1 as node()*, $node-set-2 as node()*) as xs:boolean external;

(:~
 : Reports on the differences between two nodes sets to determine their
 : equality. Equality is determined in 3 stages, first by sequence length, then
 : equivalent Node types, and finally by XMLUnit Diff for Document and Element
 : nodes, or fn:deep-equals for all other node types.
 : @param $node-set-1 The first node set.
 : @param $node-set-2 The second node set.
 : @return Returns a map(xs:string, xs:anyAtomicType). When the node sets are equivalent the map is: map {'equivalent': fn:true() }. When the nodesets are not equivalent, the map is structured like: map {'equivalent': fn:false(), 'position': xs:integer, 'message': xs:string}.
 :)
declare function xmldiff:diff($node-set-1 as node()*, $node-set-2 as node()*) as map(*) external;
