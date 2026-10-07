module namespace xslfo = "http://exist-db.org/xquery/xslfo";

(:~
 : Renders a given FO document. Returns an xs:base64binary of the result.
 : Parameters are specified with the structure: &lt;parameters>&lt;param
 : name="param-name1" value="param-value1"/>&lt;/parameters>. Recognised
 : rendering parameters are: author, title, keywords and dpi. URL's in the FO
 : can be resolved from: http, https, file and exist URI schemes. If you wish
 : to access a resource in the local database then the URI
 : 'exist://localhost/db' refers to the root collection.
 : @param $document FO document
 : @param $media-type The Internet Media Type of the desired result
 : @param $parameters parameters for the transform
 : @return The result of rendering the FO
 :)
declare function xslfo:render($document as node(), $media-type as xs:string, $parameters as node()?) as xs:base64Binary? external;

(:~
 : Renders a given FO document. Returns an xs:base64binary of the result.
 : Parameters are specified with the structure: &lt;parameters>&lt;param
 : name="param-name1" value="param-value1"/>&lt;/parameters>. Recognised
 : rendering parameters are: author, title, keywords and dpi. URL's in the FO
 : can be resolved from: http, https, file and exist URI schemes. If you wish
 : to access a resource in the local database then the URI
 : 'exist://localhost/db' refers to the root collection.
 : @param $document FO document
 : @param $media-type The Internet Media Type of the desired result
 : @param $parameters parameters for the transform
 : @param $processor-config FOP Processor Configuration file
 : @return The result of rendering the FO
 :)
declare function xslfo:render(
	$document as node(),
	$media-type as xs:string,
	$parameters as node()?,
	$processor-config as node()?
) as xs:base64Binary? external;
