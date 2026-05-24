module namespace cache = "http://exist-db.org/xquery/cache";

(:~
 : Creates a new named cache with the given options.
 : @param $cache-name The unique name for the cache
 : @param $options A map of options (e.g. map { "maximumSize": 1000, "expireAfterAccess": 30 })
 :)
declare function cache:create($cache-name as xs:string, $options as map(*)) as xs:boolean external;

(:~
 : Returns the keys currently stored in the named cache.
 : @param $cache-name The cache name
 :)
declare function cache:keys($cache-name as xs:string) as xs:string* external;

(:~
 : Returns the names of all existing caches.
 :)
declare function cache:list() as xs:string* external;

(:~
 : Stores a value in the named cache under the given key, returning the previous value.
 : @param $cache-name The cache name
 : @param $key The cache key
 : @param $value The value to store
 :)
declare function cache:put($cache-name as xs:string, $key as xs:string, $value as item()*) as item()* external;

(:~
 : Retrieves the value associated with the given key from the named cache.
 : @param $cache-name The cache name
 : @param $key The cache key
 :)
declare function cache:get($cache-name as xs:string, $key as xs:string) as item()* external;

(:~
 : Removes the entry for the given key from the named cache.
 : @param $cache-name The cache name
 : @param $key The cache key to remove
 :)
declare function cache:remove($cache-name as xs:string, $key as xs:string) as item()* external;

(:~
 : Removes all entries from the named cache.
 : @param $cache-name The cache name
 :)
declare function cache:clear($cache-name as xs:string) as xs:boolean external;

(:~
 : Destroys the named cache and releases its resources.
 : @param $cache-name The cache name
 :)
declare function cache:destroy($cache-name as xs:string) as xs:boolean external;

(:~
 : Performs maintenance on all caches (e.g. evicting expired entries).
 :)
declare function cache:cleanup() as xs:boolean external;
