module namespace exrest = "http://exquery.org/ns/restxq/exist";

(:~
 : Gets a list of all the dependencies of compiled XQuery modules discovered by
 : RESTXQ in the process of discovering resource functions.
 : @return The list of dependencies.
 :)
declare function exrest:dependencies() as document-node() external;

(:~
 : Deregisters all resource functions identified in the XQuery Module from the
 : RestXQ Registry.
 : @param $module A URI pointing to an XQuery module.
 : @return The list of deregistered resource functions.
 :)
declare function exrest:deregister-module($module as xs:anyURI) as document-node() external;

(:~
 : Deregisters a resource function from the RestXQ Registry.
 : @param $module A URI pointing to an XQuery module.
 : @param $function-signature A signature identifying a resource function. Takes the format {namespace}local-name#arity e.g. {http://somenamespace}some-function#2
 : @return true if the function was deregistered, false otherwise.
 :)
declare function exrest:deregister-resource-function($module as xs:anyURI, $function-signature as xs:string) as xs:boolean external;

(:~
 : Compiles the XQuery Module and examines it, producing a list of all the
 : declared resource functions.
 : @param $module A URI pointing to an XQuery module.
 : @return The list of newly registered resource functions.
 :)
declare function exrest:find-resource-functions($module as xs:anyURI) as document-node() external;

(:~
 : Gets a list of all the invalid XQuery modules discovered by RESTXQ in the
 : process of discovering resource functions.
 : @return The list of invalid XQuery modules.
 :)
declare function exrest:invalid-modules() as xs:string* external;

(:~
 : Gets a list of all the missing dependencies for XQuery modules discovered by
 : RESTXQ in the process of discovering resource functions.
 : @return The list of missing dependencies.
 :)
declare function exrest:missing-dependencies() as document-node() external;

(:~
 : Registers all resource functions identified in the XQuery Module with the
 : RestXQ Registry.
 : @param $module A URI pointing to an XQuery module.
 : @return The list of newly registered resource functions.
 :)
declare function exrest:register-module($module as xs:anyURI) as document-node() external;

(:~
 : Registers a resource function from the XQuery Module with the RestXQ
 : Registry.
 : @param $module A URI pointing to an XQuery module.
 : @param $function-signature A signature identifying a resource function. Takes the format {namespace}local-name#arity e.g. {http://somenamespace}some-function#2
 : @return true if the function was registered, false otherwise.
 :)
declare function exrest:register-resource-function($module as xs:anyURI, $function-signature as xs:string) as xs:boolean external;
