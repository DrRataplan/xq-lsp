module namespace counter = "http://exist-db.org/xquery/counter";

(:~
 : Create a unique counter named $counter-name.
 : @param $counter-name Name of the counter.
 : @return the value of the newly created counter.
 :)
declare function counter:create($counter-name as item()) as xs:long? external;

(:~
 : Create a unique counter named $counter-name and initialize it with value
 : $init-value.
 : @param $counter-name Name of the counter.
 : @param $init-value The initial value of the counter.
 : @return the value of the newly created counter.
 :)
declare function counter:create($counter-name as item(), $init-value as xs:long) as xs:long? external;

(:~
 : Destroy the counter named $counter-name.
 : @param $counter-name Name of the counter.
 :)
declare function counter:destroy($counter-name as item()) as xs:boolean? external;

(:~
 : Increment the counter $counter-name and return its new value.
 : @param $counter-name Name of the counter.
 : @return the new value of the specified counter, or -1 if the counter does not exist.
 :)
declare function counter:next-value($counter-name as item()) as xs:long? external;
