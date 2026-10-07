module namespace validation = "http://exist-db.org/xquery/validation";

(:~
 : Remove all cached grammers.
 : @return the number of deleted grammars.
 :)
declare function validation:clear-grammar-cache() as xs:integer external;

(:~
 : Validate document by parsing $instance. Optionally grammar caching can be
 : enabled. Supported grammars types are '.xsd' and '.dtd'.
 : @param $instance The document referenced as xs:anyURI, a node (element or result of fn:doc()) or as a Java file object.
 : @param $cache-grammars Set the flag to true() to enable grammar caching.
 : @return true() if the document is valid and no single problem occured, false() for all other conditions. For detailed validation information use the corresponding -report() function.
 :)
declare function validation:jaxp($instance as item(), $cache-grammars as xs:boolean) as xs:boolean external;

(:~
 : Validate document by parsing $instance. Optionally grammar caching can be
 : enabled and an XML catalog can be specified. Supported grammars types are
 : '.xsd' and '.dtd'.
 : @param $instance The document referenced as xs:anyURI, a node (element or result of fn:doc()) or as a Java file object.
 : @param $cache-grammars Set the flag to true() to enable grammar caching.
 : @param $catalogs The catalogs referenced as xs:anyURI's.
 : @return true() if the document is valid and no single problem occured, false() for all other conditions. For detailed validation information use the corresponding -report() function.
 :)
declare function validation:jaxp($instance as item(), $cache-grammars as xs:boolean, $catalogs as item()*) as xs:boolean external;

(:~
 : Parse document in validating mode, all defaults are filled in according to
 : the grammar (xsd).
 : @param $instance The document referenced as xs:anyURI, a node (element or result of fn:doc()) or as a Java file object.
 : @param $enable-grammar-cache Set the flag to true() to enable grammar caching.
 : @param $catalogs The catalogs referenced as xs:anyURI's.
 : @return the parsed document.
 :)
declare function validation:jaxp-parse($instance as item(), $enable-grammar-cache as xs:boolean, $catalogs as item()*) as node() external;

(:~
 : Validate document by parsing $instance. Optionally grammar caching can be
 : enabled. Supported grammars types are '.xsd' and '.dtd'. An XML report is
 : returned.
 : @param $instance The document referenced as xs:anyURI, a node (element or result of fn:doc()) or as a Java file object.
 : @param $enable-grammar-cache Set the flag to true() to enable grammar caching.
 : @return a validation report.
 :)
declare function validation:jaxp-report($instance as item(), $enable-grammar-cache as xs:boolean) as node() external;

(:~
 : Validate document by parsing $instance. Optionally grammar caching can be
 : enabled and an XML catalog can be specified. Supported grammars types are
 : '.xsd' and '.dtd'. An XML report is returned.
 : @param $instance The document referenced as xs:anyURI, a node (element or result of fn:doc()) or as a Java file object.
 : @param $enable-grammar-cache Set the flag to true() to enable grammar caching.
 : @param $catalogs The catalogs referenced as xs:anyURI's.
 : @return a validation report.
 :)
declare function validation:jaxp-report($instance as item(), $enable-grammar-cache as xs:boolean, $catalogs as item()*) as node() external;

(:~
 : Validate document specified by $instance using the schemas in $grammars.
 : Based on functionality provided by 'javax.xml.validation.Validator'. Only
 : '.xsd' grammars are supported.
 : @param $instance The document referenced as xs:anyURI, a node (element or returned by fn:doc()) or as a Java file object.
 : @param $grammars The namespace URI to designate a schema language. Depending on the jaxv.SchemaFactory implementation the following values are valid: (XSD 1.0) http://www.w3.org/2001/XMLSchema http://www.w3.org/XML/XMLSchema/v1.0, (XSD 1.1) http://www.w3.org/XML/XMLSchema/v1.1, (RELAX NG 1.0) http://relaxng.org/ns/structure/1.0
 : @return true() if the document is valid and no single problem occured, false() for all other conditions. For detailed validation information use the corresponding -report() function.
 :)
declare function validation:jaxv($instance as item(), $grammars as item()+) as xs:boolean external;

(:~
 : Validate document specified by $instance using the schemas in $grammars.
 : Based on functionality provided by 'javax.xml.validation.Validator'. Only
 : '.xsd' grammars are supported.
 : @param $instance The document referenced as xs:anyURI, a node (element or returned by fn:doc()) or as a Java file object.
 : @param $grammars One of more XML Schema documents (.xsd), referenced as xs:anyURI, a node (element or returned by fn:doc()) or as Java file objects.
 : @param $language The namespace URI to designate a schema language. Depending on the jaxv.SchemaFactory implementation the following values are valid: (XSD 1.0) http://www.w3.org/2001/XMLSchema http://www.w3.org/XML/XMLSchema/v1.0, (XSD 1.1) http://www.w3.org/XML/XMLSchema/v1.1, (RELAX NG 1.0) http://relaxng.org/ns/structure/1.0
 : @return true() if the document is valid and no single problem occured, false() for all other conditions. For detailed validation information use the corresponding -report() function.
 :)
declare function validation:jaxv($instance as item(), $grammars as item()+, $language as xs:string) as xs:boolean external;

(:~
 : Validate document specified by $instance using the schemas in $grammars.
 : Based on functionality provided by 'javax.xml.validation.Validator'. Only
 : '.xsd' grammars are supported. Optionally an XML catalog can be specified
 : for schema/entity resolution.
 : @param $instance The document referenced as xs:anyURI, a node (element or returned by fn:doc()) or as a Java file object.
 : @param $grammars One of more XML Schema documents (.xsd), referenced as xs:anyURI, a node (element or returned by fn:doc()) or as Java file objects.
 : @param $language The namespace URI to designate a schema language. Depending on the jaxv.SchemaFactory implementation the following values are valid: (XSD 1.0) http://www.w3.org/2001/XMLSchema http://www.w3.org/XML/XMLSchema/v1.0, (XSD 1.1) http://www.w3.org/XML/XMLSchema/v1.1, (RELAX NG 1.0) http://relaxng.org/ns/structure/1.0
 : @param $catalogs The catalogs referenced as xs:anyURI's. An empty sequence uses the system catalog. A directory-search catalog (a collection URI ending in '/') searches that collection for an XSD whose target namespace matches an import.
 : @return true() if the document is valid and no single problem occured, false() for all other conditions. For detailed validation information use the corresponding -report() function.
 :)
declare function validation:jaxv(
	$instance as item(),
	$grammars as item()+,
	$language as xs:string,
	$catalogs as item()*
) as xs:boolean external;

(:~
 : Validate document specified by $instance using the schemas in $grammars.
 : Based on functionality provided by 'javax.xml.validation.Validator'. Only
 : '.xsd' grammars are supported. An XML report is returned.
 : @param $instance The document referenced as xs:anyURI, a node (element or returned by fn:doc()) or as a Java file object.
 : @param $grammars One of more XML Schema documents (.xsd), referenced as xs:anyURI, a node (element or returned by fn:doc()) or as Java file objects.
 : @return a validation report.
 :)
declare function validation:jaxv-report($instance as item(), $grammars as item()+) as node() external;

(:~
 : Validate document specified by $instance using the schemas in $grammars.
 : Based on functionality provided by 'javax.xml.validation.Validator'. Only
 : '.xsd' grammars are supported. An XML report is returned.
 : @param $instance The document referenced as xs:anyURI, a node (element or returned by fn:doc()) or as a Java file object.
 : @param $grammars One of more XML Schema documents (.xsd), referenced as xs:anyURI, a node (element or returned by fn:doc()) or as Java file objects.
 : @param $language The namespace URI to designate a schema language. Depending on the jaxv.SchemaFactory implementation the following values are valid: (XSD 1.0) http://www.w3.org/2001/XMLSchema http://www.w3.org/XML/XMLSchema/v1.0, (XSD 1.1) http://www.w3.org/XML/XMLSchema/v1.1, (RELAX NG 1.0) http://relaxng.org/ns/structure/1.0
 : @return a validation report.
 :)
declare function validation:jaxv-report($instance as item(), $grammars as item()+, $language as xs:string) as node() external;

(:~
 : Validate document specified by $instance using the schemas in $grammars.
 : Based on functionality provided by 'javax.xml.validation.Validator'. Only
 : '.xsd' grammars are supported. An XML report is returned. Optionally an XML
 : catalog can be specified for schema/entity resolution.
 : @param $instance The document referenced as xs:anyURI, a node (element or returned by fn:doc()) or as a Java file object.
 : @param $grammars One of more XML Schema documents (.xsd), referenced as xs:anyURI, a node (element or returned by fn:doc()) or as Java file objects.
 : @param $language The namespace URI to designate a schema language. Depending on the jaxv.SchemaFactory implementation the following values are valid: (XSD 1.0) http://www.w3.org/2001/XMLSchema http://www.w3.org/XML/XMLSchema/v1.0, (XSD 1.1) http://www.w3.org/XML/XMLSchema/v1.1, (RELAX NG 1.0) http://relaxng.org/ns/structure/1.0
 : @param $catalogs The catalogs referenced as xs:anyURI's. An empty sequence uses the system catalog. A directory-search catalog (a collection URI ending in '/') searches that collection for an XSD whose target namespace matches an import.
 : @return a validation report.
 :)
declare function validation:jaxv-report(
	$instance as item(),
	$grammars as item()+,
	$language as xs:string,
	$catalogs as item()*
) as node() external;

(:~
 : Validate document using 'Jing'. Supported grammar documents extensions are
 : ".xsd" ".rng" ".rnc" ".sch" and ".nvdl". Based on functionality provided by
 : 'com.thaiopensource.validate.ValidationDriver'.
 : @param $instance The document referenced as xs:anyURI, a node (element or returned by fn:doc()) or as a Java file object.
 : @param $grammar The grammar document as node (element of returned by fn:doc()), xs:anyURI, returned by util:binary-doc() or as a Java file object.
 : @return true() if the document is valid and no single problem occured, false() for all other conditions. For detailed validation information use the corresponding -report() function.
 :)
declare function validation:jing($instance as item(), $grammar as item()) as xs:boolean external;

(:~
 : Validate document using 'Jing'. Supported grammar documents extensions are
 : ".xsd" ".rng" ".rnc" ".sch" and ".nvdl". Based on functionality provided by
 : 'com.thaiopensource.validate.ValidationDriver'. An XML report is returned.
 : @param $instance The document referenced as xs:anyURI, a node (element or returned by fn:doc()) or as a Java file object.
 : @param $grammar The grammar document as node (element of returned by fn:doc()), xs:anyURI, returned by util:binary-doc() or as a Java file object.
 : @return a validation report.
 :)
declare function validation:jing-report($instance as item(), $grammar as item()) as node() external;

(:~
 : Pre parse grammars and add to grammar cache. Only XML schemas (.xsd) are
 : supported.
 : @param $grammar Reference to grammar.
 : @return sequence of namespaces of preparsed grammars.
 :)
declare function validation:pre-parse-grammar($grammar as xs:anyURI*) as xs:string* external;

(:~
 : Show all cached grammars.
 : @return an XML document containing details on all cached grammars.
 :)
declare function validation:show-grammar-cache() as node() external;
