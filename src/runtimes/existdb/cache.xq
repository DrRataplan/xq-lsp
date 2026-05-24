module namespace cache = "http://exist-db.org/xquery/cache";

(:~
 : Eviction policy work of the cache is performed asynchronously. Performs any
 : pending maintenance operations needed by the cache, on the current thread.
 : Typically not needed by users, and only used for testing scenarios. Requires
 : 'clear' permissions.
 : @param $cache-name The name of the cache
 :)
declare function cache:cleanup($cache-name as xs:string) as empty-sequence() external;

(:~
 : Clears all key/values from either all caches or the named cache
 :)
declare function cache:clear() as empty-sequence() external;

(:~
 : Clears all key/values from either all caches or the named cache
 : @param $cache-name The name of the cache
 :)
declare function cache:clear($cache-name as xs:string) as empty-sequence() external;

(:~
 : Explicitly create a cache with a specific configuration
 : @param $cache-name The name of the cache
 : @param $config A map with configuration for the cache. At present cache LRU and permission groups may be specified, for operations on the cache. `maximumSize` is optional and specifies the maximum number of entries. `expireAfterAccess` is optional and specifies the expiry period for infrequently accessed entries (in milliseconds). `expireAfterWrite` is optional and specifies the expiry period after the entry's creation, or the most recent replacement of its value (in milliseconds). If a permission group is not specified for an operation, then permissions are not checked for that operation. Should have the format: map { "maximumSize": 1000, "expireAfterAccess": 120000, "expireAfterWrite": 240000, "permissions": map { "put-group": "group1", "get-group": "group2", "remove-group": "group3", "clear-group": "group4"} }
 : @return true if the cache was created, false if the cache already exists
 :)
declare function cache:create($cache-name as xs:string, $config as map(*)) as xs:boolean external;

(:~
 : Destroys a cache entirely
 : @param $cache-name The name of the cache
 :)
declare function cache:destroy($cache-name as xs:string) as empty-sequence() external;

(:~
 : Get data from identified global cache by key
 : @param $cache-name The name of the cache
 : @param $key The key
 : @return The value associated with the key
 :)
declare function cache:get($cache-name as xs:string, $key as xs:anyType+) as item()* external;

(:~
 : List all keys stored in a cache. Note this operation is expensive.
 : @param $cache-name The name of the cache
 : @return The keys in the cache. Note these will be returned in serialized string form, as that is used internally.
 :)
declare function cache:keys($cache-name as xs:string) as xs:string* external;

(:~
 : List all values (for the associated keys) stored in a cache.
 : @param $cache-name The name of the cache
 : @param $keys The keys, if none are specified, all values are returned
 : @return The values associated with the keys
 :)
declare function cache:list($cache-name as xs:string, $keys as xs:anyType*) as item()* external;

(:~
 : Get the names of all current caches
 : @return The names of all caches currently in use.
 :)
declare function cache:names() as xs:string* external;

(:~
 : Put data with a key into the identified cache. Returns the previous value
 : associated with the key
 : @param $cache-name The name of the cache
 : @param $key The key
 : @param $value The value
 : @return The previous value associated with the key
 :)
declare function cache:put($cache-name as xs:string, $key as xs:anyType+, $value as item()*) as item()* external;

(:~
 : Remove data from the identified cache by the key. Returns the value that was
 : previously associated with key
 : @param $cache-name The name of the cache
 : @param $key The key
 : @return The value that was previously associated with the key
 :)
declare function cache:remove($cache-name as xs:string, $key as xs:anyType+) as item()* external;
