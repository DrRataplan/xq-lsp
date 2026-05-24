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
 : @param $callback The callback function. Expected signature:
 : @param $namespaces Prefix/namespace mappings to be used for matching the paths. Pass an XML fragment with the following structure: <namespaces><namespace prefix="prefix" uri="uri"/></namespaces>.
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
