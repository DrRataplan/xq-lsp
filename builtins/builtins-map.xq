module namespace map="http://www.w3.org/2005/xpath-functions/map";

(:~
 : Returns a map that combines the entries of a sequence of maps.
 : @param $maps The maps to merge
 : @return A map containing all entries
 :)
declare function map:merge($maps as map(*)*) as map(*) external;
(:~
 : Merges maps with options controlling duplicate key handling.
 : @param $maps The maps to merge
 : @param $options Options map (e.g. map{"duplicates": "use-first"})
 : @return A map containing all entries
 :)
declare function map:merge($maps as map(*)*, $options as map(*)) as map(*) external;

(:~
 : Returns the number of entries in a map.
 : @param $map The map
 : @return The number of key-value pairs
 :)
declare function map:size($map as map(*)) as xs:integer external;

(:~
 : Returns the keys of a map as a sequence of atomic values.
 : @param $map The map
 : @return Sequence of keys
 :)
declare function map:keys($map as map(*)) as xs:anyAtomicType* external;

(:~
 : Tests whether a map contains a given key.
 : @param $map The map
 : @param $key The key to look for
 : @return true if the map contains the key
 :)
declare function map:contains($map as map(*), $key as xs:anyAtomicType) as xs:boolean external;

(:~
 : Returns the value associated with a key in a map.
 : @param $map The map
 : @param $key The key
 : @return The associated value, or empty sequence if the key is absent
 :)
declare function map:get($map as map(*), $key as xs:anyAtomicType) as item()* external;

(:~
 : Searches a nested data structure for all values with a given key.
 : @param $input The structure to search
 : @param $key The key to find
 : @return An array of all matching values
 :)
declare function map:find($input as item()*, $key as xs:anyAtomicType) as array(*) external;

(:~
 : Returns a new map with an added or replaced entry.
 : @param $map The source map
 : @param $key The key
 : @param $value The value
 : @return A new map with the entry added or replaced
 :)
declare function map:put($map as map(*), $key as xs:anyAtomicType, $value as item()*) as map(*) external;

(:~
 : Creates a single-entry map.
 : @param $key The key
 : @param $value The value
 : @return A map with one entry
 :)
declare function map:entry($key as xs:anyAtomicType, $value as item()*) as map(*) external;

(:~
 : Returns a new map with one or more entries removed.
 : @param $map The source map
 : @param $keys Keys to remove
 : @return A new map without the specified entries
 :)
declare function map:remove($map as map(*), $keys as xs:anyAtomicType*) as map(*) external;

(:~
 : Applies a function to each entry in a map, returning a sequence of results.
 : @param $map The map
 : @param $action Function taking (key, value) and returning items
 : @return Concatenated results
 :)
declare function map:for-each($map as map(*), $action as function(xs:anyAtomicType, item()*) as item()*) as item()* external;
