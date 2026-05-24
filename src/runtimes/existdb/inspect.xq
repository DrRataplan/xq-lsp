module namespace inspect = "http://exist-db.org/xquery/inspection";

(:~
 : Returns an element describing the signature and annotations of the given function reference.
 : @param $function The function reference to inspect
 :)
declare function inspect:inspect-function($function as function(*)) as element() external;

(:~
 : Returns an element describing the module at the given location URI (file path or db URI).
 : @param $location The location of the XQuery module to inspect
 :)
declare function inspect:inspect-module($location as xs:anyURI) as element()? external;

(:~
 : Returns the location URI of the module with the given namespace URI, as loaded in the system.
 : @param $namespace-uri The namespace URI of the module
 :)
declare function inspect:inspect-module-uri($namespace-uri as xs:anyURI) as xs:anyURI? external;

(:~
 : Returns all function references defined in the module at the given location.
 : @param $location The location of the XQuery module
 :)
declare function inspect:module-functions($location as xs:anyURI) as function(*)* external;

(:~
 : Returns all function references defined in the currently executing module.
 :)
declare function inspect:module-functions() as function(*)* external;

(:~
 : Returns the annotation map for the given function reference.
 : @param $function The function reference
 :)
declare function inspect:function-annotations($function as function(*)) as map(*)* external;

(:~
 : Returns a string describing the XQuery type of the given item.
 : @param $item The item to inspect
 :)
declare function inspect:type($item as item()) as xs:string? external;

(:~
 : Returns an element describing the static type of the given item.
 : @param $item The item to inspect
 :)
declare function inspect:inspect-type($item as item()) as element()* external;

(:~
 : Returns an element containing the full module description (like inspect:inspect-module but by namespace).
 : @param $module-uri The namespace URI of the module to dump
 :)
declare function inspect:dump($module-uri as xs:anyURI) as element()? external;
