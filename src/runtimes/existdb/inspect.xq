module namespace inspect = "http://exist-db.org/xquery/inspection";

(:~
 : Returns an XML fragment describing the function referenced by the passed
 : function item.
 : @param $function The function item to inspect
 : @return the signature of the function
 :)
declare function inspect:inspect-function($function as function(*)) as node() external;

(:~
 : Compiles a library module from source (without importing it) and returns an
 : XML fragment describing the module and the functions/variables contained in
 : it.
 : @param $location The location URI of the module to inspect
 :)
declare function inspect:inspect-module($location as xs:anyURI) as item()* external;

(:~
 : Returns an XML fragment describing the library module identified by the
 : given namespace URI and the functions/variables contained in it.
 : @param $uri The namespace URI of the module to inspect
 :)
declare function inspect:inspect-module-uri($uri as xs:anyURI) as item()* external;

(:~
 : Returns a sequence of function items pointing to each public function in the
 : module. If no $location is provided, then the current (calling) module is
 : inspected.
 : @return Sequence of function items containing all public functions in the module, or the empty sequence if the module is not known in the current context.
 :)
declare function inspect:module-functions() as function(*)* external;

(:~
 : Returns a sequence of function items pointing to each public function in the
 : module. If no $location is provided, then the current (calling) module is
 : inspected.
 : @param $location The location URI of the module to be inspected.
 : @return Sequence of function items containing all public functions in the module, or the empty sequence if the module is not known in the current context.
 :)
declare function inspect:module-functions($location as xs:anyURI) as function(*)* external;

(:~
 : Returns a sequence of function items pointing to each public function in the
 : specified module.
 : @param $uri The URI of the module to be loaded.
 : @return Sequence of function items containing all public functions in the module, or the empty sequence if the module is not known in the current context.
 :)
declare function inspect:module-functions-by-uri($uri as xs:anyURI) as function(*)* external;
