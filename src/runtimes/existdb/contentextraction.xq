module namespace contentextraction = "http://exist-db.org/xquery/contentextraction";

(:~
 : extracts the metadata
 : @param $binary The binary data to extract from
 : @return Extracted metadata
 :)
declare function contentextraction:get-metadata($binary as xs:base64Binary) as document-node() external;

(:~
 : extracts the metadata and contents
 : @param $binary The binary data to extract from
 : @return Extracted content and metadata
 :)
declare function contentextraction:get-metadata-and-content($binary as xs:base64Binary) as document-node() external;

(:~
 : extracts the metadata
 : @param $binary The binary data to extract from
 : @param $paths A sequence of (simple) node paths which should be passed to the callback function
 : @param $callback The callback function. Expected signature: callback($node as node(), $userData as item()*, $retValue as item()*),where $node is the currently processed node, $userData contains the data supplied in the $userData parameter of stream-content, and $retValue is the return value of the previous call to the callback function. The last two parameters are used for passing information between the calling function and subsequent invocations of the callback function.
 : @param $namespaces Prefix/namespace mappings to be used for matching the paths. Pass an XML fragment with the following structure: &lt;namespaces>&lt;namespace prefix="prefix" uri="uri"/>&lt;/namespaces>.
 : @param $userData Additional data which will be passed to the callback function.
 : @return Returns empty sequence
 :)
declare function contentextraction:stream-content(
	$binary as xs:base64Binary,
	$paths as xs:string*,
	$callback as function(*),
	$namespaces as element()?,
	$userData as item()*
) as empty-sequence() external;
