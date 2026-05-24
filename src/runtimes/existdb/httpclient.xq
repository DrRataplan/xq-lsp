module namespace httpclient = "http://exist-db.org/xquery/httpclient";

(:~
 : Sends an HTTP GET request to the given URI and returns the response.
 : @param $uri The URI to request
 : @param $persist If true, keep the HTTP connection alive for subsequent requests
 : @param $request-headers A sequence of header elements, or the empty sequence
 :)
declare function httpclient:get(
	$uri as xs:anyURI,
	$persist as xs:boolean,
	$request-headers as element()?
) as element() external;

(:~
 : Sends an HTTP HEAD request to the given URI.
 : @param $uri The URI to request
 : @param $persist If true, keep the HTTP connection alive
 : @param $request-headers A sequence of header elements, or the empty sequence
 :)
declare function httpclient:head(
	$uri as xs:anyURI,
	$persist as xs:boolean,
	$request-headers as element()?
) as element() external;

(:~
 : Sends an HTTP POST request to the given URI with the given body.
 : @param $uri The URI to request
 : @param $content The request body (node or xs:string)
 : @param $persist If true, keep the HTTP connection alive
 : @param $request-headers A sequence of header elements, or the empty sequence
 :)
declare function httpclient:post(
	$uri as xs:anyURI,
	$content as item(),
	$persist as xs:boolean,
	$request-headers as element()?
) as element() external;

(:~
 : Sends an HTTP POST request with a named content type.
 : @param $uri The URI to request
 : @param $content The request body
 : @param $persist If true, keep the HTTP connection alive
 : @param $request-headers Request headers element
 : @param $content-type The Content-Type header value
 :)
declare function httpclient:post(
	$uri as xs:anyURI,
	$content as item(),
	$persist as xs:boolean,
	$request-headers as element()?,
	$content-type as xs:string
) as element() external;

(:~
 : Sends an HTTP PUT request to the given URI.
 : @param $uri The URI to request
 : @param $content The request body
 : @param $persist If true, keep the HTTP connection alive
 : @param $request-headers Request headers element
 :)
declare function httpclient:put(
	$uri as xs:anyURI,
	$content as item(),
	$persist as xs:boolean,
	$request-headers as element()?
) as element() external;

(:~
 : Sends an HTTP DELETE request to the given URI.
 : @param $uri The URI to request
 : @param $persist If true, keep the HTTP connection alive
 : @param $request-headers Request headers element
 :)
declare function httpclient:delete(
	$uri as xs:anyURI,
	$persist as xs:boolean,
	$request-headers as element()?
) as element() external;

(:~
 : Sends an HTTP OPTIONS request to the given URI.
 : @param $uri The URI to request
 : @param $persist If true, keep the HTTP connection alive
 : @param $request-headers Request headers element
 :)
declare function httpclient:options(
	$uri as xs:anyURI,
	$persist as xs:boolean,
	$request-headers as element()?
) as element() external;

(:~
 : Sends an HTTP PATCH request to the given URI.
 : @param $uri The URI to request
 : @param $content The request body
 : @param $persist If true, keep the HTTP connection alive
 : @param $request-headers Request headers element
 :)
declare function httpclient:patch(
	$uri as xs:anyURI,
	$content as item(),
	$persist as xs:boolean,
	$request-headers as element()?
) as element() external;

(:~
 : Clears all persistent HTTP connections maintained by the client.
 :)
declare function httpclient:clear-response-cache() as empty-sequence() external;

(:~
 : Encodes a string for use in a URL (percent-encoding).
 : @param $string The string to encode
 :)
declare function httpclient:encode-url($string as xs:string) as xs:string external;
