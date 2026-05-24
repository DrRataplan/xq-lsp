module namespace counter = "http://exist-db.org/xquery/counter";

(:~
 : Creates a new counter in the given collection.
 : @param $collection-name The collection URI where the counter is stored
 :)
declare function counter:create($collection-name as xs:string) as xs:long? external;

(:~
 : Creates a named counter in the given collection.
 : @param $collection-name The collection URI
 : @param $counter-name The name for the counter
 :)
declare function counter:create($collection-name as xs:string, $counter-name as xs:string) as xs:long? external;

(:~
 : Creates a named counter with a specific starting value.
 : @param $collection-name The collection URI
 : @param $counter-name The name for the counter
 : @param $init-value The initial value of the counter
 :)
declare function counter:create($collection-name as xs:string, $counter-name as xs:string, $init-value as xs:long) as xs:long? external;

(:~
 : Returns the next value of the default counter in the given collection, incrementing it atomically.
 : @param $collection-name The collection URI
 :)
declare function counter:next-value($collection-name as xs:string) as xs:long? external;

(:~
 : Returns the next value of the named counter, incrementing it atomically.
 : @param $collection-name The collection URI
 : @param $counter-name The counter name
 :)
declare function counter:next-value($collection-name as xs:string, $counter-name as xs:string) as xs:long? external;

(:~
 : Increments the named counter and appends the new value to the given node.
 : @param $collection-name The collection URI
 : @param $counter-name The counter name
 : @param $node The node to update with the new counter value
 :)
declare function counter:next-value-append($collection-name as xs:string, $counter-name as xs:string, $node as node()) as xs:long? external;

(:~
 : Destroys the default counter in the given collection.
 : @param $collection-name The collection URI
 :)
declare function counter:destroy($collection-name as xs:string) as xs:boolean? external;

(:~
 : Destroys the named counter in the given collection.
 : @param $collection-name The collection URI
 : @param $counter-name The counter name
 :)
declare function counter:destroy($collection-name as xs:string, $counter-name as xs:string) as xs:boolean? external;
