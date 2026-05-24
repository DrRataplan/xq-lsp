module namespace range = "http://exist-db.org/xquery/range";

(:~
 : @return all nodes from the input node set whose node value is equal to the key.
 :)
declare function range:contains() as node()* external;

(:~
 : @return all nodes from the input node set whose node value is equal to the key.
 :)
declare function range:ends-with() as node()* external;

(:~
 : @return all nodes from the input node set whose node value is equal to the key.
 :)
declare function range:eq() as node()* external;

(:~
 : General field lookup function. Normally this will be used by the query
 : optimizer.
 : @param $operators The operators to use as strings: eq, lt, gt, contains ...
 : @param $keys The keys to look up for each field.
 : @return all nodes from the field set whose node value is equal to the key.
 :)
declare function range:field($fields as xs:string*, $operators as xs:string*, $keys as xs:anyAtomicType*) as node()* external;

(:~
 : Used by optimizer to optimize a contains() function call
 : @return all nodes from the field set whose node value is equal to the key.
 :)
declare function range:field-contains() as node()* external;

(:~
 : Used by optimizer to optimize a ends-with() function call
 : @return all nodes from the field set whose node value is equal to the key.
 :)
declare function range:field-ends-with() as node()* external;

(:~
 : General field lookup function based on equality comparison. Normally this
 : will be used by the query optimizer.
 : @return all nodes from the field set whose node value is equal to the key.
 :)
declare function range:field-eq() as node()* external;

(:~
 : General field lookup function based on greater-than-equal comparison.
 : Normally this will be used by the query optimizer.
 : @return all nodes from the field set whose node value is equal to the key.
 :)
declare function range:field-ge() as node()* external;

(:~
 : General field lookup function based on greater-than comparison. Normally
 : this will be used by the query optimizer.
 : @return all nodes from the field set whose node value is equal to the key.
 :)
declare function range:field-gt() as node()* external;

(:~
 : General field lookup function based on less-than-equal comparison. Normally
 : this will be used by the query optimizer.
 : @return all nodes from the field set whose node value is equal to the key.
 :)
declare function range:field-le() as node()* external;

(:~
 : General field lookup function based on less-than comparison. Normally this
 : will be used by the query optimizer.
 : @return all nodes from the field set whose node value is equal to the key.
 :)
declare function range:field-lt() as node()* external;

(:~
 : Used by optimizer to optimize a matches() function call
 : @return all nodes from the field set whose node value matches the regular expression.
 :)
declare function range:field-matches() as node()* external;

(:~
 : General field lookup function based on non-equality comparison. Normally
 : this will be used by the query optimizer.
 : @return all nodes from the field set whose node value is not equal to the key.
 :)
declare function range:field-ne() as node()* external;

(:~
 : Used by optimizer to optimize a starts-with() function call
 : @return all nodes from the field set whose node value is equal to the key.
 :)
declare function range:field-starts-with() as node()* external;

(:~
 : @return all nodes from the input node set whose node value is equal to the key.
 :)
declare function range:ge() as node()* external;

(:~
 : @return all nodes from the input node set whose node value is equal to the key.
 :)
declare function range:gt() as node()* external;

(:~
 : Retrieve all index keys contained in a range index which has been defined
 : with a field name. Similar to util:index-keys, but works with fields.
 : @param $field The field to use
 : @param $function-reference The function reference as created by the util:function function. It can be an arbitrary user-defined function, but it should take exactly 2 arguments:
 : @param $max-number-returned The maximum number of returned keys
 : @return the results of the eval of the $function-reference
 :)
declare function range:index-keys-for-field($field as xs:string, $function-reference as function(*), $max-number-returned as xs:integer?) as item()* external;

(:~
 : Retrieve all index keys contained in a range index which has been defined
 : with a field name. Similar to util:index-keys, but works with fields.
 : @param $field The field to use
 : @param $start-value Only index keys of the same type but being greater than $start-value will be reported for non-string types. For string types, only keys starting with the given prefix are reported.
 : @param $function-reference The function reference as created by the util:function function. It can be an arbitrary user-defined function, but it should take exactly 2 arguments:
 : @param $max-number-returned The maximum number of returned keys
 : @return the results of the eval of the $function-reference
 :)
declare function range:index-keys-for-field(
	$field as xs:string,
	$start-value as xs:anyAtomicType?,
	$function-reference as function(*),
	$max-number-returned as xs:integer?
) as item()* external;

(:~
 : @return all nodes from the input node set whose node value is equal to the key.
 :)
declare function range:le() as node()* external;

(:~
 : @return all nodes from the input node set whose node value is equal to the key.
 :)
declare function range:lt() as node()* external;

(:~
 : @param $nodes The node set to search using a range index which is defined on those nodes
 : @param $regex The regular expression.
 : @return all nodes from the input node set whose node value matches the regular expression. Regular expression syntax is limited to what Lucene supports. See http://lucene.apache.org/core/4_5_1/core/org/apache/lucene/util/automaton/RegExp.html
 :)
declare function range:matches($nodes as node()*, $regex as xs:string*) as node()* external;

(:~
 : @return all nodes from the input node set whose node value is not equal to the key.
 :)
declare function range:ne() as node()* external;

(:~
 : Calls Lucene's optimize method to merge all index segments into a single
 : one. This is a costly operation and should not be used except for data sets
 : which can be expected to remain unchanged for a while. The optimize will
 : block the index for other write operations and may take some time. You need
 : to be a user in group dba to call this function.
 :)
declare function range:optimize() as empty-sequence() external;

(:~
 : @return all nodes from the input node set whose node value is equal to the key.
 :)
declare function range:starts-with() as node()* external;
