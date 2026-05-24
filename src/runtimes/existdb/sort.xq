module namespace sort = "http://exist-db.org/xquery/sort";

(:~
 : Creates a sort index with the given name over the given nodes.
 : @param $id The sort index name
 : @param $nodes The nodes to index
 :)
declare function sort:create-index($id as xs:string, $nodes as node()*) as empty-sequence() external;

(:~
 : Creates a sort index by calling the given function for each node to obtain its sort key.
 : @param $id The sort index name
 : @param $nodes The nodes to index
 : @param $key-function A function that takes a node and returns its sort key value
 :)
declare function sort:create-index($id as xs:string, $nodes as node()*, $key-function as function(*)) as empty-sequence() external;

(:~
 : Returns nodes sorted according to the named sort index.
 : @param $nodes The nodes to sort
 : @param $id The sort index name
 :)
declare function sort:index($nodes as node()*, $id as xs:string) as node()* external;

(:~
 : Removes the sort index with the given name.
 : @param $id The sort index name to remove
 :)
declare function sort:remove-index($id as xs:string) as empty-sequence() external;

(:~
 : Returns true if a sort index with the given name exists.
 : @param $id The sort index name
 :)
declare function sort:has-index($id as xs:string) as xs:boolean external;
