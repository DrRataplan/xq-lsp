module namespace xqdm = "http://exist-db.org/xquery/xqdoc";

(:~
 : Scan and extract function documentation from an external XQuery function
 : module according to theXQDoc specification. The single argument URI may
 : either point to an XQuery module stored in the db (URI starts with
 : xmldb:exist:...) or a module in the file system. A file system module is
 : searched in the same way as if it were loaded through an "import module"
 : statement. Static mappings defined in conf.xml are searched first.
 : @deprecated Deprecated for removal. This function is built on the external org.xqdoc:xqdoc-conversion library, whose only release is 1.6 (2012) -- it predates XQuery 3.0 and cannot parse a module using map(*), %private, an inline map, an array constructor or the simple map operator, nor eXist's own bundled libraries. Use inspect:inspect-module instead, which is eXist's own implementation and is unaffected. See https://github.com/eXist-db/exist/issues/6717. This function could be removed in the next major version release!
 : @param $uri The URI from which to load the function module
 : @return the function docs.
 :)
declare function xqdm:scan($uri as xs:anyURI) as node()* external;

(:~
 : Scan and extract function documentation from an external XQuery function
 : module according to the XQDoc specification. The two parameter version of
 : the function expects to get the source code of the module in the first
 : argument and a name for the module in the second.
 : @deprecated Deprecated for removal. This function is built on the external org.xqdoc:xqdoc-conversion library, whose only release is 1.6 (2012) -- it predates XQuery 3.0 and cannot parse a module using map(*), %private, an inline map, an array constructor or the simple map operator, nor eXist's own bundled libraries. Use inspect:inspect-module instead, which is eXist's own implementation and is unaffected. See https://github.com/eXist-db/exist/issues/6717. This function could be removed in the next major version release!
 : @param $data The base64 encoded source data of the module
 : @param $name The name of the module
 : @return the function docs.
 :)
declare function xqdm:scan($data as xs:base64Binary, $name as xs:string) as node()* external;
