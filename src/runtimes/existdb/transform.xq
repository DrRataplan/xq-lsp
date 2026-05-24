module namespace transform = "http://exist-db.org/xquery/transform";

(:~
 : Applies an XSL stylesheet to the node tree passed as first argument. The
 : parameters are the same as for the transform function. stream-transform can
 : only be used within a servlet context. Instead of returning the transformed
 : document fragment, it directly streams its output to the servlet's output
 : stream. It should thus be the last statement in the XQuery.
 : @param $stylesheet The XSL stylesheet
 : @param $parameters The transformer parameters
 :)
declare function transform:stream-transform(
	$node-tree as node()*,
	$stylesheet as item(),
	$parameters as node()?
) as empty-sequence() external;

(:~
 : Applies an XSL stylesheet to the node tree passed as first argument. The
 : parameters are the same as for the transform function. stream-transform can
 : only be used within a servlet context. Instead of returning the transformed
 : document fragment, it directly streams its output to the servlet's output
 : stream. It should thus be the last statement in the XQuery.
 : @param $stylesheet The XSL stylesheet
 : @param $parameters The transformer parameters
 : @param $attributes Attributes to pass to the transformation factory
 : @param $serialization-options The serialization options
 :)
declare function transform:stream-transform(
	$node-tree as node()*,
	$stylesheet as item(),
	$parameters as node()?,
	$attributes as node()?,
	$serialization-options as xs:string?
) as empty-sequence() external;

(:~
 : Applies an XSL stylesheet to the node tree passed as first argument. The
 : stylesheet is specified in the second argument. This should either be an URI
 : or a node. If it is an URI, it can either point to an external location or
 : to an XSL stored in the db by using the 'xmldb:' scheme. Stylesheets are
 : cached unless they were just created from an XML fragment and not from a
 : complete document. Stylesheet parameters may be passed in the third argument
 : using an XML fragment with the following structure: <parameters><param
 : name="param-name1" value="param-value1"/> </parameters>. There are two
 : special parameters named "exist:stop-on-warn" and "exist:stop-on-error". If
 : set to value "yes", eXist will generate an XQuery error if the XSL processor
 : reports a warning or error.
 : @param $stylesheet The XSL stylesheet
 : @param $parameters The transformer parameters
 :)
declare function transform:transform(
	$node-tree as node()*,
	$stylesheet as item(),
	$parameters as node()?
) as node()? external;

(:~
 : Applies an XSL stylesheet to the node tree passed as first argument. The
 : stylesheet is specified in the second argument. This should either be an URI
 : or a node. If it is an URI, it can either point to an external location or
 : to an XSL stored in the db by using the 'xmldb:' scheme. Stylesheets are
 : cached unless they were just created from an XML fragment and not from a
 : complete document. Stylesheet parameters may be passed in the third argument
 : using an XML fragment with the following structure: <parameters><param
 : name="param-name" value="param-value"/> </parameters>. There are two special
 : parameters named "exist:stop-on-warn" and "exist:stop-on-error". If set to
 : value "yes", eXist will generate an XQuery error if the XSL processor
 : reports a warning or error. The fourth argument specifies attributes to be
 : set on the used Java TransformerFactory with the following structure:
 : <attributes><attr name="attr-name" value="attr-value"/></attributes>. The
 : fifth argument specifies serialization options in the same way as if they
 : were passed to "declare option exist:serialize" expression. An additional
 : serialization option, "xinclude-path", is supported, which specifies a base
 : path against which xincludes will be expanded (if there are xincludes in the
 : document). A relative path will be relative to the current module load path.
 : @param $stylesheet The XSL stylesheet
 : @param $parameters The transformer parameters
 : @param $attributes Attributes to pass to the transformation factory
 : @param $serialization-options The serialization options
 :)
declare function transform:transform(
	$node-tree as node()*,
	$stylesheet as item(),
	$parameters as node()?,
	$attributes as node()?,
	$serialization-options as xs:string?
) as node()? external;
