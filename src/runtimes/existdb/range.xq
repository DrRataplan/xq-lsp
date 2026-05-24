module namespace range = "http://exist-db.org/xquery/range";

(:~
 : Queries the range index for nodes matching the given value.
 : @param $nodes The nodes to query (must be indexed)
 : @param $operator The comparison operator ("eq", "ne", "lt", "gt", "le", "ge", "starts-with", "ends-with", "contains", "matches")
 : @param $value The value to compare against
 :)
declare function range:eq($nodes as node()*, $value as xs:anyAtomicType) as node()* external;

(:~
 : Queries the range index for nodes not equal to the given value.
 : @param $nodes The nodes to query
 : @param $value The value to compare against
 :)
declare function range:ne($nodes as node()*, $value as xs:anyAtomicType) as node()* external;

(:~
 : Queries the range index for nodes less than the given value.
 : @param $nodes The nodes to query
 : @param $value The value to compare against
 :)
declare function range:lt($nodes as node()*, $value as xs:anyAtomicType) as node()* external;

(:~
 : Queries the range index for nodes less than or equal to the given value.
 : @param $nodes The nodes to query
 : @param $value The value to compare against
 :)
declare function range:le($nodes as node()*, $value as xs:anyAtomicType) as node()* external;

(:~
 : Queries the range index for nodes greater than the given value.
 : @param $nodes The nodes to query
 : @param $value The value to compare against
 :)
declare function range:gt($nodes as node()*, $value as xs:anyAtomicType) as node()* external;

(:~
 : Queries the range index for nodes greater than or equal to the given value.
 : @param $nodes The nodes to query
 : @param $value The value to compare against
 :)
declare function range:ge($nodes as node()*, $value as xs:anyAtomicType) as node()* external;

(:~
 : Queries the range index for nodes whose string value starts with the given string.
 : @param $nodes The nodes to query
 : @param $prefix The prefix string to match
 :)
declare function range:starts-with($nodes as node()*, $prefix as xs:string) as node()* external;

(:~
 : Queries the range index for nodes whose string value ends with the given string.
 : @param $nodes The nodes to query
 : @param $suffix The suffix string to match
 :)
declare function range:ends-with($nodes as node()*, $suffix as xs:string) as node()* external;

(:~
 : Queries the range index for nodes whose string value contains the given substring.
 : @param $nodes The nodes to query
 : @param $substring The substring to match
 :)
declare function range:contains($nodes as node()*, $substring as xs:string) as node()* external;

(:~
 : Queries the range index for nodes whose string value matches the given regex.
 : @param $nodes The nodes to query
 : @param $pattern The regex pattern
 :)
declare function range:matches($nodes as node()*, $pattern as xs:string) as node()* external;

(:~
 : Performs a general range index query using a field name and operator.
 : @param $nodes The nodes to query
 : @param $fields One or more field names to query
 : @param $operator The comparison operator ("eq", "lt", etc.)
 : @param $values The value(s) to compare against
 :)
declare function range:field($nodes as node()*, $fields as xs:string+, $operator as xs:string, $values as xs:anyAtomicType*) as node()* external;

(:~
 : Returns the index keys from the range index over the given nodes.
 : @param $nodes The indexed nodes
 : @param $start-value The start value for iteration (empty sequence for beginning)
 : @param $function A callback function invoked per key
 : @param $max Maximum number of keys to return
 :)
declare function range:index-keys($nodes as node()*, $start-value as xs:anyAtomicType?, $function as function(*), $max as xs:integer) as item()* external;
