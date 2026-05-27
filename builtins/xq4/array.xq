module namespace array = "http://www.w3.org/2005/xpath-functions/array";

(: ── Array functions new in XPath/XQuery 4.0 ────────────────────────────────── :)

(:~
 : Returns the last member of an array (complement of array:head).
 : @param $array The input array
 :)
declare function array:foot($array as array(*)) as item()* external;

(:~
 : Returns an array containing all but the last member (complement of array:tail).
 : @param $array The input array
 :)
declare function array:trunk($array as array(*)) as array(*) external;

(:~
 : Returns a sub-array (slice).
 : @param $array The input array
 : @param $start Start index (1-based; negative counts from end)
 :)
declare function array:slice($array as array(*), $start as xs:integer?) as array(*) external;

(:~
 : Returns a sub-array (slice) with explicit end.
 : @param $array The input array
 : @param $start Start index
 : @param $end End index (exclusive; negative counts from end)
 :)
declare function array:slice($array as array(*), $start as xs:integer?, $end as xs:integer?) as array(*) external;

(:~
 : Returns a sub-array (slice) with step.
 : @param $array The input array
 : @param $start Start index
 : @param $end End index (exclusive)
 : @param $step Step size (negative reverses direction)
 :)
declare function array:slice($array as array(*), $start as xs:integer?, $end as xs:integer?, $step as xs:integer?) as array(*) external;

(:~
 : Returns the positions of array members satisfying a predicate.
 : @param $array The input array
 : @param $predicate Predicate function applied to each member
 :)
declare function array:index-where($array as array(*), $predicate as function(item()*) as xs:boolean) as xs:integer* external;

(:~
 : Sorts array members by the result of a key function.
 : @param $array The array to sort
 : @param $key Function mapping each member to sort keys
 :)
declare function array:sort-by($array as array(*), $key as function(item()*) as xs:anyAtomicType*) as array(*) external;

(:~
 : Sorts array members by key, using a specific collation.
 : @param $array The array to sort
 : @param $collation Collation URI (empty sequence for default)
 : @param $key Function mapping each member to sort keys
 :)
declare function array:sort-by($array as array(*), $collation as xs:string?, $key as function(item()*) as xs:anyAtomicType*) as array(*) external;

(:~
 : Returns the members of an array as a flat sequence.
 : @param $array The input array
 :)
declare function array:members($array as array(*)) as item()** external;

(:~
 : Constructs an array by applying a mapping function to a sequence.
 : @param $input The input sequence
 : @param $action Function mapping each item to an array member
 :)
declare function array:build($input as item()*, $action as function(item()) as item()*) as array(*) external;
