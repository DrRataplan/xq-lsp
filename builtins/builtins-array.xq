module namespace array="http://www.w3.org/2005/xpath-functions/array";

(:~
 : Returns the number of members in an array.
 : @param $array The array
 : @return The number of members
 :)
declare function array:size($array as array(*)) as xs:integer external;

(:~
 : Returns the member at a given position.
 : @param $array The array
 : @param $index 1-based position
 : @return The member value
 :)
declare function array:get($array as array(*), $index as xs:integer) as item()* external;

(:~
 : Returns a new array with the member at a given position replaced.
 : @param $array The array
 : @param $index 1-based position
 : @param $member The new value
 : @return A new array with the replacement
 :)
declare function array:put($array as array(*), $index as xs:integer, $member as item()*) as array(*) external;

(:~
 : Returns a new array with an additional member appended.
 : @param $array The array
 : @param $appendage The value to append
 : @return A new array with the value appended
 :)
declare function array:append($array as array(*), $appendage as item()*) as array(*) external;

(:~
 : Returns a subarray starting at a given position.
 : @param $array The array
 : @param $start 1-based start position
 : @return The subarray from $start to the end
 :)
declare function array:subarray($array as array(*), $start as xs:integer) as array(*) external;
(:~
 : Returns a subarray of a given length starting at a given position.
 : @param $array The array
 : @param $start 1-based start position
 : @param $length Number of members
 : @return The subarray
 :)
declare function array:subarray($array as array(*), $start as xs:integer, $length as xs:integer) as array(*) external;

(:~
 : Returns a new array with members at given positions removed.
 : @param $array The array
 : @param $positions 1-based positions to remove
 : @return A new array without the specified members
 :)
declare function array:remove($array as array(*), $positions as xs:integer*) as array(*) external;

(:~
 : Returns a new array with a member inserted before a given position.
 : @param $array The array
 : @param $position 1-based insertion point
 : @param $member The value to insert
 : @return A new array with the member inserted
 :)
declare function array:insert-before($array as array(*), $position as xs:integer, $member as item()*) as array(*) external;

(:~
 : Returns the first member of an array.
 : @param $array The array
 : @return The first member value
 :)
declare function array:head($array as array(*)) as item()* external;

(:~
 : Returns an array containing all but the first member.
 : @param $array The array
 : @return A new array without the first member
 :)
declare function array:tail($array as array(*)) as array(*) external;

(:~
 : Returns a new array with members in reverse order.
 : @param $array The array
 : @return The reversed array
 :)
declare function array:reverse($array as array(*)) as array(*) external;

(:~
 : Concatenates arrays into a single array.
 : @param $arrays Sequence of arrays to join
 : @return A single array containing all members
 :)
declare function array:join($arrays as array(*)*) as array(*) external;

(:~
 : Applies a function to each member, returning a new array of results.
 : @param $array The input array
 : @param $action Function to apply to each member
 : @return A new array of results
 :)
declare function array:for-each($array as array(*), $action as function(item()*) as item()*) as array(*) external;

(:~
 : Returns an array of members for which a predicate returns true.
 : @param $array The input array
 : @param $function Predicate function
 : @return A new array of matching members
 :)
declare function array:filter($array as array(*), $function as function(item()*) as xs:boolean) as array(*) external;

(:~
 : Reduces an array to a single value by applying a function from the left.
 : @param $array The input array
 : @param $zero Initial accumulator value
 : @param $f Combining function
 : @return The accumulated result
 :)
declare function array:fold-left($array as array(*), $zero as item()*, $f as function(item()*, item()*) as item()*) as item()* external;

(:~
 : Reduces an array to a single value by applying a function from the right.
 : @param $array The input array
 : @param $zero Initial accumulator value
 : @param $f Combining function
 : @return The accumulated result
 :)
declare function array:fold-right($array as array(*), $zero as item()*, $f as function(item()*, item()*) as item()*) as item()* external;

(:~
 : Applies a function pairwise to members of two arrays.
 : @param $array1 First array
 : @param $array2 Second array
 : @param $f Function to apply to each pair
 : @return A new array of results
 :)
declare function array:for-each-pair($array1 as array(*), $array2 as array(*), $f as function(item()*, item()*) as item()*) as array(*) external;

(:~
 : Sorts the members of an array.
 : @param $array The array to sort
 : @return A new sorted array
 :)
declare function array:sort($array as array(*)) as array(*) external;
(:~ @param $array Array @param $collation Collation URI or empty :)
declare function array:sort($array as array(*), $collation as xs:string?) as array(*) external;
(:~
 : @param $array Array
 : @param $collation Collation URI or empty
 : @param $key Function to extract the sort key from each member
 : @return A new sorted array
 :)
declare function array:sort($array as array(*), $collation as xs:string?, $key as function(item()*) as xs:anyAtomicType*) as array(*) external;

(:~
 : Flattens nested arrays into a sequence of atomic values and non-array items.
 : @param $input The sequence or array to flatten
 : @return The flattened sequence
 :)
declare function array:flatten($input as item()*) as item()* external;
