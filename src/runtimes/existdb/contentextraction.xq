module namespace contentextraction = "http://exist-db.org/xquery/contentextraction";

(:~
 : Extracts text and metadata from the given binary document using Apache Tika.
 : Returns an element with the extracted metadata and text content.
 : @param $binary The binary content to extract from (xs:base64Binary)
 :)
declare function contentextraction:get-metadata($binary as xs:base64Binary) as element() external;

(:~
 : Extracts text content and metadata from the given binary document.
 : Returns an element with both metadata and text content.
 : @param $binary The binary content
 :)
declare function contentextraction:get-metadata-and-content($binary as xs:base64Binary) as element() external;

(:~
 : Streams the extracted content from the given binary document to a ContentHandler.
 : Used for integration with SAX-based pipelines.
 : @param $binary The binary content
 : @param $handler The SAX ContentHandler (passed as an item())
 :)
declare function contentextraction:stream-content($binary as xs:base64Binary, $handler as item()) as empty-sequence() external;
