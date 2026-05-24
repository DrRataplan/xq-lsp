module namespace validation = "http://exist-db.org/xquery/validation";

(:~
 : Validates an XML instance against all available schemas and returns true if valid.
 : @param $instance The document node or element to validate
 :)
declare function validation:validate($instance as node()) as xs:boolean external;

(:~
 : Validates an XML instance against the specified grammar (schema, DTD, RelaxNG) and returns true if valid.
 : @param $instance The document node or element to validate
 : @param $grammar The grammar URI (xs:anyURI) or the grammar node itself
 :)
declare function validation:validate($instance as node(), $grammar as item()) as xs:boolean external;

(:~
 : Validates an XML instance and returns a detailed validation report element.
 : @param $instance The document node or element to validate
 :)
declare function validation:validate-report($instance as node()) as element() external;

(:~
 : Validates an XML instance against the given grammar and returns a detailed report.
 : @param $instance The document node or element to validate
 : @param $grammar The grammar URI or grammar node
 :)
declare function validation:validate-report($instance as node(), $grammar as item()) as element() external;

(:~
 : Validates an XML instance using the Jing validator (RelaxNG) and returns true if valid.
 : @param $instance The document node or element to validate
 : @param $grammar The RelaxNG grammar URI or node
 :)
declare function validation:jing($instance as node(), $grammar as item()) as xs:boolean external;

(:~
 : Validates an XML instance using the Jing validator and returns a detailed report.
 : @param $instance The document node or element to validate
 : @param $grammar The RelaxNG grammar URI or node
 :)
declare function validation:jing-report($instance as node(), $grammar as item()) as element() external;

(:~
 : Validates an XML instance using the JAXV (Java XML Validation API, supports W3C XML Schema) and returns true if valid.
 : @param $instance The document node or element to validate
 : @param $grammar The schema URI or schema node
 :)
declare function validation:jaxv($instance as node(), $grammar as item()) as xs:boolean external;

(:~
 : Validates an XML instance using JAXV and returns a detailed report.
 : @param $instance The document node or element to validate
 : @param $grammar The schema URI or schema node
 :)
declare function validation:jaxv-report($instance as node(), $grammar as item()) as element() external;

(:~
 : Validates an XML instance using the MSV (Multi-Schema Validator, supports DTD, W3C XML Schema, RelaxNG) and returns true if valid.
 : @param $instance The document node or element to validate
 : @param $grammar The grammar URI or node
 :)
declare function validation:msv($instance as node(), $grammar as item()) as xs:boolean external;

(:~
 : Validates an XML instance using MSV and returns a detailed report.
 : @param $instance The document node or element to validate
 : @param $grammar The grammar URI or node
 :)
declare function validation:msv-report($instance as node(), $grammar as item()) as element() external;
