module namespace range = "http://exist-db.org/xquery/range";

(:~
 : Search for nodes matching the given keys in the range index. Normally this
 : function will be called by the query optimizer.
 : @param $nodes The node set to search using a range index which is defined on those nodes
 : @param $key The key to look up.
 : @return all nodes from the input node set whose node value is equal to the key.
 :)
declare function range:contains($nodes as node()*, $key as xs:anyAtomicType*) as node()* external;

(:~
 : Search for nodes matching the given keys in the range index. Normally this
 : function will be called by the query optimizer.
 : @param $nodes The node set to search using a range index which is defined on those nodes
 : @param $key The key to look up.
 : @return all nodes from the input node set whose node value is equal to the key.
 :)
declare function range:ends-with($nodes as node()*, $key as xs:anyAtomicType*) as node()* external;

(:~
 : Search for nodes matching the given keys in the range index. Normally this
 : function will be called by the query optimizer.
 : @param $nodes The node set to search using a range index which is defined on those nodes
 : @param $key The key to look up.
 : @return all nodes from the input node set whose node value is equal to the key.
 :)
declare function range:eq($nodes as node()*, $key as xs:anyAtomicType*) as node()* external;

(:~
 : General field lookup function. Normally this will be used by the query
 : optimizer.
 : @param $fields The name of the field(s) to search
 : @param $operators The operators to use as strings: eq, lt, gt, contains ...
 : @param $keys The keys to look up for each field.
 : @return all nodes from the field set whose node value is equal to the key.
 :)
declare function range:field($fields as xs:string*, $operators as xs:string*, $keys as xs:anyAtomicType*) as node()* external;

(:~
 : Used by optimizer to optimize a contains() function call
 : @param $fields The name of the field(s) to search
 : @param $keys The keys to look up for each field.
 : @return all nodes from the field set whose node value is equal to the key.
 :)
declare function range:field-contains($fields as xs:string*, $keys as xs:anyAtomicType*) as node()* external;

(:~
 : Used by optimizer to optimize a ends-with() function call
 : @param $fields The name of the field(s) to search
 : @param $keys The keys to look up for each field.
 : @return all nodes from the field set whose node value is equal to the key.
 :)
declare function range:field-ends-with($fields as xs:string*, $keys as xs:anyAtomicType*) as node()* external;

(:~
 : General field lookup function based on equality comparison. Normally this
 : will be used by the query optimizer.
 : @param $fields The name of the field(s) to search
 : @param $keys The keys to look up for each field.
 : @return all nodes from the field set whose node value is equal to the key.
 :)
declare function range:field-eq($fields as xs:string*, $keys as xs:anyAtomicType*) as node()* external;

(:~
 : General field lookup function based on greater-than-equal comparison.
 : Normally this will be used by the query optimizer.
 : @param $fields The name of the field(s) to search
 : @param $keys The keys to look up for each field.
 : @return all nodes from the field set whose node value is equal to the key.
 :)
declare function range:field-ge($fields as xs:string*, $keys as xs:anyAtomicType*) as node()* external;

(:~
 : General field lookup function based on greater-than comparison. Normally
 : this will be used by the query optimizer.
 : @param $fields The name of the field(s) to search
 : @param $keys The keys to look up for each field.
 : @return all nodes from the field set whose node value is equal to the key.
 :)
declare function range:field-gt($fields as xs:string*, $keys as xs:anyAtomicType*) as node()* external;

(:~
 : General field lookup function based on less-than-equal comparison. Normally
 : this will be used by the query optimizer.
 : @param $fields The name of the field(s) to search
 : @param $keys The keys to look up for each field.
 : @return all nodes from the field set whose node value is equal to the key.
 :)
declare function range:field-le($fields as xs:string*, $keys as xs:anyAtomicType*) as node()* external;

(:~
 : General field lookup function based on less-than comparison. Normally this
 : will be used by the query optimizer.
 : @param $fields The name of the field(s) to search
 : @param $keys The keys to look up for each field.
 : @return all nodes from the field set whose node value is equal to the key.
 :)
declare function range:field-lt($fields as xs:string*, $keys as xs:anyAtomicType*) as node()* external;

(:~
 : Used by optimizer to optimize a matches() function call
 : @param $fields The name of the field(s) to search
 : @param $keys The keys to look up for each field.
 : @return all nodes from the field set whose node value matches the regular expression.
 :)
declare function range:field-matches($fields as xs:string*, $keys as xs:anyAtomicType*) as node()* external;

(:~
 : General field lookup function based on non-equality comparison. Normally
 : this will be used by the query optimizer.
 : @param $fields The name of the field(s) to search
 : @param $keys The keys to look up for each field.
 : @return all nodes from the field set whose node value is not equal to the key.
 :)
declare function range:field-ne($fields as xs:string*, $keys as xs:anyAtomicType*) as node()* external;

(:~
 : Used by optimizer to optimize a starts-with() function call
 : @param $fields The name of the field(s) to search
 : @param $keys The keys to look up for each field.
 : @return all nodes from the field set whose node value is equal to the key.
 :)
declare function range:field-starts-with($fields as xs:string*, $keys as xs:anyAtomicType*) as node()* external;

(:~
 : Search for nodes matching the given keys in the range index. Normally this
 : function will be called by the query optimizer.
 : @param $nodes The node set to search using a range index which is defined on those nodes
 : @param $key The key to look up.
 : @return all nodes from the input node set whose node value is equal to the key.
 :)
declare function range:ge($nodes as node()*, $key as xs:anyAtomicType*) as node()* external;

(:~
 : Search for nodes matching the given keys in the range index. Normally this
 : function will be called by the query optimizer.
 : @param $nodes The node set to search using a range index which is defined on those nodes
 : @param $key The key to look up.
 : @return all nodes from the input node set whose node value is equal to the key.
 :)
declare function range:gt($nodes as node()*, $key as xs:anyAtomicType*) as node()* external;

(:~
 : Retrieve all index keys contained in a range index which has been defined
 : with a field name. Similar toutil:index-keys, but works with fields.
 : @param $field The field to use
 : @param $function-reference The function reference as created by the util:function function. It can be an arbitrary user-defined function, but it should take exactly 2 arguments: 1) the current index key as found in the range index as an atomic value, 2) a sequence containing three int values: a) the overall frequency of the key within the node set, b) the number of distinct documents in the node set the key occurs in, c) the current position of the key in the whole list of keys returned.
 : @param $max-number-returned The maximum number of returned keys
 : @return the results of the eval of the $function-reference
 :)
declare function range:index-keys-for-field($field as xs:string, $function-reference as function(*), $max-number-returned as xs:integer?) as item()* external;

(:~
 : Retrieve all index keys contained in a range index which has been defined
 : with a field name. Similar toutil:index-keys, but works with fields.
 : @param $field The field to use
 : @param $start-value Only index keys of the same type but being greater than $start-value will be reported for non-string types. For string types, only keys starting with the given prefix are reported.
 : @param $function-reference The function reference as created by the util:function function. It can be an arbitrary user-defined function, but it should take exactly 2 arguments: 1) the current index key as found in the range index as an atomic value, 2) a sequence containing three int values: a) the overall frequency of the key within the node set, b) the number of distinct documents in the node set the key occurs in, c) the current position of the key in the whole list of keys returned.
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
 : Search for nodes matching the given keys in the range index. Normally this
 : function will be called by the query optimizer.
 : @param $nodes The node set to search using a range index which is defined on those nodes
 : @param $key The key to look up.
 : @return all nodes from the input node set whose node value is equal to the key.
 :)
declare function range:le($nodes as node()*, $key as xs:anyAtomicType*) as node()* external;

(:~
 : Search for nodes matching the given keys in the range index. Normally this
 : function will be called by the query optimizer.
 : @param $nodes The node set to search using a range index which is defined on those nodes
 : @param $key The key to look up.
 : @return all nodes from the input node set whose node value is equal to the key.
 :)
declare function range:lt($nodes as node()*, $key as xs:anyAtomicType*) as node()* external;

(:~
 : Search for nodes matching the given keys in the range index. Normally this
 : function will be called by the query optimizer.
 : @param $nodes The node set to search using a range index which is defined on those nodes
 : @param $regex The regular expression.
 : @return all nodes from the input node set whose node value matches the regular expression. Regular expression syntax is limited to what Lucene supports. See http://lucene.apache.org/core/4_5_1/core/org/apache/lucene/util/automaton/RegExp.html
 :)
declare function range:matches($nodes as node()*, $regex as xs:string*) as node()* external;

(:~
 : Search for nodes matching the given keys in the range index. Normally this
 : function will be called by the query optimizer.
 : @param $nodes The node set to search using a range index which is defined on those nodes
 : @param $key The key to look up.
 : @return all nodes from the input node set whose node value is not equal to the key.
 :)
declare function range:ne($nodes as node()*, $key as xs:anyAtomicType*) as node()* external;

(:~
 : Calls Lucene's optimize method to merge all index segments into a single
 : one. This is a costly operation and should not be used except for data sets
 : which can be expected to remain unchanged for a while. The optimize will
 : block the index for other write operations and may take some time. You need
 : to be a user in group dba to call this function.
 :)
declare function range:optimize() as empty-sequence() external;

(:~
 : Search for nodes matching the given keys in the range index. Normally this
 : function will be called by the query optimizer.
 : @param $nodes The node set to search using a range index which is defined on those nodes
 : @param $key The key to look up.
 : @return all nodes from the input node set whose node value is equal to the key.
 :)
declare function range:starts-with($nodes as node()*, $key as xs:anyAtomicType*) as node()* external;
