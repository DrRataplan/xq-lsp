module namespace response = "http://exist-db.org/xquery/response";

(:~
 : Returns whether a response object exists.
 :)
declare function response:exists() as item()* external;

(:~
 : Sends a HTTP redirect response (302) to the client.
 : @param $uri The URI to redirect the client to
 :)
declare function response:redirect-to($uri as xs:anyURI) as empty-sequence() external;

(:~
 : Sets a HTTP Cookie on the HTTP Response.
 : @param $name The cookie name
 : @param $value The cookie value
 :)
declare function response:set-cookie($name as xs:string, $value as xs:string) as empty-sequence() external;

(:~
 : Sets a HTTP Cookie on the HTTP Response.
 : @param $name The cookie name
 : @param $value The cookie value
 : @param $max-age The xs:duration of the cookie
 :)
declare function response:set-cookie(
	$name as xs:string,
	$value as xs:string,
	$max-age as xs:duration?,
	$secure-flag as xs:boolean?
) as empty-sequence() external;

(:~
 : Sets a HTTP Cookie on the HTTP Response.
 : @param $name The cookie name
 : @param $value The cookie value
 : @param $max-age The xs:duration of the cookie
 : @param $domain The cookie domain
 : @param $path The cookie path
 :)
declare function response:set-cookie(
	$name as xs:string,
	$value as xs:string,
	$max-age as xs:duration?,
	$secure-flag as xs:boolean?,
	$domain as xs:string?,
	$path as xs:string?
) as empty-sequence() external;

(:~
 : Sets a HTTP Header on the HTTP Response.
 : @param $name The header name
 : @param $value The header value
 :)
declare function response:set-date-header($name as xs:string, $value as xs:string) as empty-sequence() external;

(:~
 : Sets a HTTP Header on the HTTP Response.
 : @param $name The header name
 : @param $value The header value
 :)
declare function response:set-header($name as xs:string, $value as xs:string) as empty-sequence() external;

(:~
 : Sets a HTTP server status code on the HTTP Response.
 : @param $code The status code
 :)
declare function response:set-status-code($code as xs:integer) as empty-sequence() external;

(:~
 : Stream can only be used within a servlet context. It directly streams its
 : input to the servlet's output stream. It should thus be the last statement
 : in the XQuery.
 : @param $content The source sequence
 : @param $serialization-options The serialization options
 :)
declare function response:stream($content as item()*, $serialization-options as xs:string) as empty-sequence() external;

(:~
 : Streams the binary data to the current servlet response output stream. The
 : ContentType HTTP header is set to the value given in $content-type. Note:
 : the servlet output stream will be closed afterwards and mime-type settings
 : in the prolog will not be passed.
 : @param $binary-data The binary data to stream
 : @param $content-type The ContentType HTTP header value
 : @param $filename The filename. If provided, a Content-Disposition header is set for the filename in the HTTP Response
 :)
declare function response:stream-binary($binary-data as xs:base64Binary, $content-type as xs:string, $filename as xs:string?) as empty-sequence() external;

(:~
 : @param $binary-resource-path The path to the stored binary resource, e.g. /db/path/to/image.png
 : @param $content-type The ContentType HTTP header value
 :)
declare function response:stream-binary-resource($binary-resource-path as xs:string, $content-type as xs:string) as empty-sequence() external;

(:~
 : A Content-Disposition header is set from $filename.
 : @param $binary-resource-path The path to the stored binary resource, e.g. /db/path/to/image.png
 : @param $content-type The ContentType HTTP header value
 : @param $filename The filename. If provided, a Content-Disposition header is set for the filename in the HTTP Response
 :)
declare function response:stream-binary-resource($binary-resource-path as xs:string, $content-type as xs:string, $filename as xs:string?) as empty-sequence() external;
