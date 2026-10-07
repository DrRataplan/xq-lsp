module namespace rest = "http://exquery.org/ns/restxq";

(:~
 : This function returns the implementation defined base URI of the Resource
 : Function.
 : @return The base URI of the Resource Function.
 :)
declare function rest:base-uri() as xs:anyURI external;

(:~
 : Gets a list of all the registered resource functions.
 : @return The list of registered resource functions.
 :)
declare function rest:resource-functions() as document-node() external;

(:~
 : This function is returns the complete URI that addresses the Resource
 : Function. Typically this is the rest:base-uri() appended with the path from
 : the Path Annotation (if present) of the Resource Function.
 : @return The URI which addressed the Resource Function.
 :)
declare function rest:uri() as xs:anyURI external;
