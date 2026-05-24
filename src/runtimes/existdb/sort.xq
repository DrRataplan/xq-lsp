module namespace sort = "http://exist-db.org/xquery/sort";

(:~
 : Create a sort index to be used within an 'order by' expression.
 : @param $id The id by which the index will be known and distinguished from other indexes on the same nodes.
 : @param $nodes The node set to be indexed.
 : @param $values The values to be indexed. There should be one value for each node in $nodes. $values thus needs to contain as many items as $nodes. If not, a dynamic error is triggered.
 : @param $options <options order='ascending|descending' empty='least|greatest'/>
 :)
declare function sort:create-index(
	$id as xs:string,
	$nodes as node()*,
	$values as xs:anyAtomicType*,
	$options as element()?
) as item()* external;

(:~
 : Create a sort index to be used within an 'order by' expression.
 : @param $id The id by which the index will be known and distinguished from other indexes on the same nodes.
 : @param $nodes The node set to be indexed.
 : @param $callback A callback function which will be called for every node in the $nodes input set. The function receives the current node as single argument and should return an atomic value by which the node will be sorted.
 : @param $options <options order='ascending|descending' empty='least|greatest'/>
 :)
declare function sort:create-index-callback(
	$id as xs:string,
	$nodes as node()*,
	$callback as function(*),
	$options as element()?
) as item()* external;

(:~
 : Check if the sort index, $id, exists.
 : @param $id The name of the index.
 :)
declare function sort:has-index($id as xs:string) as xs:boolean external;

(:~
 : Look up a node in the sort index and return a number (&gt; 0) corresponding
 : to the position of that node in the ordered set which was created by a
 : previous call to the sort:create-index function. The function returns the
 : empty sequence if the node cannot be found in the index.
 : @param $id The name of the index.
 : @param $node The node to look up.
 : @return A number &gt; 0 or the empty sequence if the $node argument was empty or the node could not be found in the index.
 :)
declare function sort:index($id as xs:string, $node as node()?) as xs:long? external;

(:~
 : Remove a sort index identified by its name.
 : @param $id The name of the index to be removed.
 :)
declare function sort:remove-index($id as xs:string) as item()* external;

(:~
 : Remove all sort index entries for the given document.
 : @param $id The name of the index to be removed.
 : @param $document-node A node from the document for which entries should be removed.
 :)
declare function sort:remove-index($id as xs:string, $document-node as node()) as item()* external;
