module namespace fn = "http://www.w3.org/2005/xpath-functions";

(: ── Sequence functions new in XPath/XQuery 4.0 ─────────────────────────────── :)

(:~
 : Returns the last item in a sequence (complement of fn:head).
 : @param $seq The input sequence
 :)
declare function fn:foot($seq as item()*) as item()? external;

(:~
 : Returns all items of a sequence except the last (complement of fn:tail).
 : @param $seq The input sequence
 :)
declare function fn:trunk($seq as item()*) as item()* external;

(:~
 : Replicates a sequence a given number of times.
 : @param $input The sequence to replicate
 : @param $count The number of times to replicate
 :)
declare function fn:replicate($input as item()*, $count as xs:integer) as item()* external;

(:~
 : Returns the items at specified positions in a sequence.
 : @param $seq The input sequence
 : @param $positions The 1-based positions to select
 :)
declare function fn:items-at($seq as item()*, $positions as xs:integer*) as item()* external;

(:~
 : Returns a sub-sequence (slice) of the input.
 : @param $input The input sequence
 : @param $start Start position (1-based; negative counts from end)
 :)
declare function fn:slice($input as item()*, $start as xs:integer?) as item()* external;

(:~
 : Returns a sub-sequence (slice) of the input.
 : @param $input The input sequence
 : @param $start Start position
 : @param $end End position (exclusive; negative counts from end)
 :)
declare function fn:slice($input as item()*, $start as xs:integer?, $end as xs:integer?) as item()* external;

(:~
 : Returns a sub-sequence (slice) of the input.
 : @param $input The input sequence
 : @param $start Start position
 : @param $end End position (exclusive)
 : @param $step Step size (negative reverses direction)
 :)
declare function fn:slice($input as item()*, $start as xs:integer?, $end as xs:integer?, $step as xs:integer?) as item()* external;

(:~
 : Sorts a sequence by the result of applying a key function to each item.
 : @param $input The sequence to sort
 : @param $key Function mapping each item to sort keys
 :)
declare function fn:sort-by($input as item()*, $key as function(item()) as xs:anyAtomicType*) as item()* external;

(:~
 : Sorts a sequence by key, using a specific collation for string comparison.
 : @param $input The sequence to sort
 : @param $collation Collation URI (empty sequence for default)
 : @param $key Function mapping each item to sort keys
 :)
declare function fn:sort-by($input as item()*, $collation as xs:string?, $key as function(item()) as xs:anyAtomicType*) as item()* external;

(:~
 : Returns the items with the highest key value.
 : @param $seq The input sequence
 :)
declare function fn:highest($seq as item()*) as item()* external;

(:~
 : Returns the items with the highest value of a key function.
 : @param $seq The input sequence
 : @param $key Function mapping each item to a sort key
 :)
declare function fn:highest($seq as item()*, $key as function(item()) as xs:anyAtomicType*) as item()* external;

(:~
 : Returns the items with the highest key, using a specific collation.
 : @param $seq The input sequence
 : @param $collation Collation URI
 : @param $key Function mapping each item to a sort key
 :)
declare function fn:highest($seq as item()*, $collation as xs:string?, $key as function(item()) as xs:anyAtomicType*) as item()* external;

(:~
 : Returns the items with the lowest key value.
 : @param $seq The input sequence
 :)
declare function fn:lowest($seq as item()*) as item()* external;

(:~
 : Returns the items with the lowest value of a key function.
 : @param $seq The input sequence
 : @param $key Function mapping each item to a sort key
 :)
declare function fn:lowest($seq as item()*, $key as function(item()) as xs:anyAtomicType*) as item()* external;

(:~
 : Returns the items with the lowest key, using a specific collation.
 : @param $seq The input sequence
 : @param $collation Collation URI
 : @param $key Function mapping each item to a sort key
 :)
declare function fn:lowest($seq as item()*, $collation as xs:string?, $key as function(item()) as xs:anyAtomicType*) as item()* external;

(:~
 : Returns true if all items in the sequence satisfy the predicate.
 : @param $seq The input sequence
 : @param $predicate Predicate function
 :)
declare function fn:every($seq as item()*, $predicate as function(item()) as xs:boolean) as xs:boolean external;

(:~
 : Returns true if at least one item in the sequence satisfies the predicate.
 : @param $seq The input sequence
 : @param $predicate Predicate function
 :)
declare function fn:some($seq as item()*, $predicate as function(item()) as xs:boolean) as xs:boolean external;

(:~
 : Returns the integer positions of items in a sequence satisfying a predicate.
 : @param $seq The input sequence
 : @param $predicate Predicate function
 :)
declare function fn:index-where($seq as item()*, $predicate as function(item()) as xs:boolean) as xs:integer* external;

(:~
 : Applies a function to corresponding pairs of items from two sequences.
 : @param $seq1 First input sequence
 : @param $seq2 Second input sequence
 : @param $action Function to apply to each pair
 :)
declare function fn:for-each-pair($seq1 as item()*, $seq2 as item()*, $action as function(item(), item()) as item()*) as item()* external;

(:~
 : Returns leading items of a sequence while a predicate holds.
 : @param $seq The input sequence
 : @param $predicate Predicate function
 :)
declare function fn:take-while($seq as item()*, $predicate as function(item()) as xs:boolean) as item()* external;

(:~
 : Partitions a sequence into groups sharing the same key value.
 : @param $seq The input sequence
 : @param $key Function mapping each item to a partition key
 :)
declare function fn:partition($seq as item()*, $key as function(item()) as xs:anyAtomicType) as array(*)* external;

(:~
 : Applies a body function repeatedly until a condition is met.
 : @param $initial Initial sequence value
 : @param $body Function to apply each iteration
 : @param $condition Termination predicate
 :)
declare function fn:do-until($initial as item()*, $body as function(item()*) as item()*, $condition as function(item()*) as xs:boolean) as item()* external;

(:~
 : Applies a body function repeatedly while a condition holds.
 : @param $condition Condition to test before each iteration
 : @param $body Function producing each iteration's result
 :)
declare function fn:while-do($condition as function() as xs:boolean, $body as function() as item()*) as item()* external;

(: ── String functions new in XPath/XQuery 4.0 ───────────────────────────────── :)

(:~
 : Splits a string into a sequence of single Unicode characters.
 : @param $str The input string
 :)
declare function fn:characters($str as xs:string?) as xs:string* external;

(: ── Equality functions new in XPath/XQuery 4.0 ────────────────────────────── :)

(:~
 : Returns true if all atomic values in the sequence are equal to each other.
 : @param $seq The input sequence of atomic values
 :)
declare function fn:all-equal($seq as xs:anyAtomicType*) as xs:boolean external;

(:~
 : Returns true if all atomic values in the sequence are equal, using a specific collation.
 : @param $seq The input sequence of atomic values
 : @param $collation Collation URI
 :)
declare function fn:all-equal($seq as xs:anyAtomicType*, $collation as xs:string) as xs:boolean external;

(:~
 : Returns true if no two items in the sequence are equal to each other.
 : @param $seq The input sequence of atomic values
 :)
declare function fn:all-different($seq as xs:anyAtomicType*) as xs:boolean external;

(:~
 : Returns true if no two items are equal, using a specific collation.
 : @param $seq The input sequence of atomic values
 : @param $collation Collation URI
 :)
declare function fn:all-different($seq as xs:anyAtomicType*, $collation as xs:string) as xs:boolean external;

(: ── Utility functions new in XPath/XQuery 4.0 ─────────────────────────────── :)

(:~
 : Returns its argument unchanged. Useful as a function reference.
 : @param $input The input sequence
 :)
declare function fn:identity($input as item()*) as item()* external;

(:~
 : Returns a function implementing the named operator.
 : @param $op The operator name (e.g. "eq", "lt", "+")
 :)
declare function fn:op($op as xs:string) as function(*) external;

(:~
 : Evaluates its argument and returns the empty sequence, discarding the result.
 : @param $input The expression to evaluate
 :)
declare function fn:void($input as item()*) as empty-sequence() external;
